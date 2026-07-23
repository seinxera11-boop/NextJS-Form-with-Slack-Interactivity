import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportRow = {
  checklist_title: string;
  submitted_by: string;
  submission_date: string;
  approved_by: string;
  approval_date: string;
  comment_by_approver: string;
};

type AdminUser = {
  email: string;
  workspace_id: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateOnly(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0];
}

function getMonthRange(now: Date): { start: string; end: string; label: string } {
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
  const end   = new Date(Date.UTC(year, month,     1, 0, 0, 0)).toISOString();

  const label = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return { start, end, label };
}

function toCSV(rows: ReportRow[]): string {
  const headers = [
    "Checklist",
    "Submitted By",
    "Submission Time",
    "Approved By",
    "Approval Time",
    "Approver Comment",
  ];

  const escape = (val: string) => {
    const str = val ?? "";
    return `"${str.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map(r => [
      escape(r.checklist_title),
      escape(r.submitted_by),
      escape(r.submission_date),
      escape(r.approved_by),
      escape(r.approval_date),
      escape(r.comment_by_approver),
    ].join(",")),
  ];

  return lines.join("\r\n");
}

async function fetchMainAdmins(): Promise<AdminUser[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("email, workspace_id")
    .eq("is_main_admin", true);

  if (error) throw new Error(`Failed to fetch admin users: ${error.message}`);
  return (data ?? []) as AdminUser[];
}

async function fetchMonthlyData(workspaceId: string, start: string, end: string): Promise<ReportRow[]> {
  const { data, error } = await supabaseAdmin
    .from("responses")
    .select(`
      submitted_by,
      created_at,
      checklists (title),
      response_approvals (
        approved_by,
        approved_at,
        reason
      )
    `)
    .eq("workspace_id", workspaceId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);

  return (data || []).map((resp: any) => {
    const approval = resp.response_approvals ?? null;
    return {
      checklist_title:    (resp.checklists as any)?.title ?? "",
      submitted_by:       resp.submitted_by ?? "",
      submission_date:    toDateOnly(resp.created_at),
      approved_by:        approval?.approved_by ?? "",
      approval_date:      toDateOnly(approval?.approved_at),
      comment_by_approver: approval?.reason ?? "",
    };
  });
}

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP environment variables are not fully set");
  }
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendReportEmail(
  transporter: nodemailer.Transporter,
  to: string,
  csv: string,
  label: string,
  rowCount: number,
): Promise<void> {
  const filename = `monthly_report_${label.replace(" ", "_")}.csv`;

  await transporter.sendMail({
    from:    `"OfficeAdmin Reports" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `月次報告書 — ${label}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="color: #111;">月次報告書— ${label}</h2>
        <p>お疲れ様です。先月分の戸締り確認履歴でございます。必要に応じて（ダウンロード
          等）活用ください
        </p>
        <p><strong>${rowCount}</strong> submission${rowCount !== 1 ? "s" : ""} recorded this month.</p>
        <p style="color: #999; font-size: 13px;">This report was generated automatically.</p>
      </div>
    `,
    attachments: [
      {
        filename,
        content:     Buffer.from(csv, "utf-8"),
        contentType: "text/csv",
      },
    ],
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const { start, end, label } = getMonthRange(now);

    console.log(`📊 Generating monthly report for ${label} (${start} → ${end})`);

    let admins = await fetchMainAdmins();

    const workspaceFilter = req.nextUrl.searchParams.get("workspace");
    if (workspaceFilter) {
      const { data: matchingWorkspaces, error: wsErr } = await supabaseAdmin
        .from("workspaces")
        .select("id")
        .ilike("name", workspaceFilter);
      if (wsErr) throw new Error(wsErr.message);

      const matchingIds = new Set((matchingWorkspaces ?? []).map(w => w.id));
      admins = admins.filter(a => matchingIds.has(a.workspace_id));
    }

    if (admins.length === 0) {
      console.log("ℹ️  No main admins found — skipping");
      return NextResponse.json({ success: true, message: "No main admins found" });
    }

    const transporter = createTransporter();
    await transporter.verify();

    const results: { email: string; rows: number; skipped?: boolean; error?: string }[] = [];

    for (const admin of admins) {
      try {
        const rows = await fetchMonthlyData(admin.workspace_id, start, end);

        if (rows.length === 0) {
          console.log(`ℹ️  No data for workspace ${admin.workspace_id} (${admin.email}) — skipping`);
          results.push({ email: admin.email, rows: 0, skipped: true });
          continue;
        }

        const csv = toCSV(rows);
        await sendReportEmail(transporter, admin.email, csv, label, rows.length);
        console.log(`📧 Report (${rows.length} rows) emailed to ${admin.email}`);
        results.push({ email: admin.email, rows: rows.length });
      } catch (err: any) {
        console.error(`⚠️  Failed to generate/send report for ${admin.email} (workspace ${admin.workspace_id}):`, err.message);
        results.push({ email: admin.email, rows: 0, error: err.message });
      }
    }

    return NextResponse.json({ success: true, month: label, results });

  } catch (err: any) {
    console.error("❌ Monthly report error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
