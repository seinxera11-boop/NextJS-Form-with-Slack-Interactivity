import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportRow = {
  submitted_by: string;
  submission_date: string;
  approved_by: string;
  approval_date: string;
  comment_by_approver: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateOnly(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0]; // YYYY-MM-DD
}
function getMonthRange(now: Date): { start: string; end: string; label: string } {
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed — this is current month

  // // Report on CURRENT month
  // const start = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();
  // const end   = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString();

// Report on PREVIOUS month
const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
const end   = new Date(Date.UTC(year, month,     1, 0, 0, 0)).toISOString();

  const label = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return { start, end, label };
}

function toCSV(rows: ReportRow[]): string {
  const headers = [
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
    headers.map(escape).join(", "),
    ...rows.map(r => [
  escape(r.submitted_by),
  escape(r.submission_date),
  escape(r.approved_by),
  escape(r.approval_date),
  escape(r.comment_by_approver),
].join(",")),
  ];

  return lines.join("\r\n");
}

async function fetchMonthlyData(start: string, end: string): Promise<ReportRow[]> {
  const { data, error } = await supabaseAdmin
    .from("responses")
    .select(`
      submitted_by,
      created_at,
      response_approvals (
        approved_by,
        approved_at,
        reason
      )
    `)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);

  return (data || []).map((resp: any) => {
  const approval = (resp.response_approvals || [])[0] ?? null;

  return {
    submitted_by: resp.submitted_by ?? "",
    submission_date: toDateOnly(resp.created_at),
    approved_by: approval?.approved_by ?? "",
    approval_date: toDateOnly(approval?.approved_at),
    comment_by_approver: approval?.reason ?? "",
  };
});
}

async function sendReportEmail(csv: string, label: string, rowCount: number): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAILS;
  if (!adminEmail) throw new Error("ADMIN_EMAIL env variable is not set");

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP environment variables are not fully set");
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Verify SMTP connection before sending
  await transporter.verify();

  const filename = `monthly_report_${label.replace(" ", "_")}.csv`;

  await transporter.sendMail({
    from:    `"OfficeAdmin Reports" <${process.env.SMTP_USER}>`,
    to:      adminEmail,
    subject: `Monthly Report — ${label}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="color: #111;">Monthly Report — ${label}</h2>
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

    const rows = await fetchMonthlyData(start, end);
    console.log(`✅ Fetched ${rows.length} response(s)`);

    if (rows.length === 0) {
      console.log("ℹ️  No responses this month — skipping email");
      return NextResponse.json({ success: true, message: "No data this month, email skipped" });
    }

    const csv = toCSV(rows);

    await sendReportEmail(csv, label, rows.length);
    console.log(`📧 Report emailed to ${process.env.ADMIN_EMAILS}`);

    return NextResponse.json({ success: true, month: label, rows: rows.length });

  } catch (err: any) {
    console.error("❌ Monthly report error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}