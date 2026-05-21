import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { google } from "googleapis";

// ─── Types ───────────────────────────────────────────────────────────────────

type CalendarEvent = {
  summary:   string;
  start:     string;
  end:       string;
  isAllDay:  boolean;
};

// ─── Google Calendar ──────────────────────────────────────────────────────────

async function getTodayEvents(): Promise<CalendarEvent[]> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key:   process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({ version: "v3", auth });
  const now = new Date();

  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
  ));

  const endOfDay = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59
  ));

  const res = await calendar.events.list({
    calendarId:   process.env.GOOGLE_CALENDAR_ID!,
    timeMin:      startOfDay.toISOString(),
    timeMax:      endOfDay.toISOString(),
    singleEvents: true,
    orderBy:      "startTime",
  });

  return (res.data.items || []).map(event => ({
    summary:  event.summary || "",
    start:    event.start?.dateTime || event.start?.date || "",
    end:      event.end?.dateTime   || event.end?.date   || "",
    isAllDay: !!event.start?.date && !event.start?.dateTime,
  }));
}

// ─── Holiday & Weekend ───────────────────────────────────────────────────────

function isHoliday(events: CalendarEvent[]): boolean {
  const holidayKeywords = ["holiday", "public holiday", "day off", "leave", "company off"];
  return events.some(event =>
    holidayKeywords.some(keyword => event.summary.toLowerCase().includes(keyword))
  );
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

// ─── Per-workspace reminder ───────────────────────────────────────────────────

async function processWorkspace(workspaceId: string): Promise<string> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
  )).toISOString();
  const todayEnd = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59
  )).toISOString();

  // Check if submitted today
  const { data } = await supabaseAdmin
    .from("responses")
    .select("id")
    .eq("workspace_id", workspaceId)
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd)
    .limit(1);

  if ((data || []).length > 0) return "already_submitted";

  // Get reminder URL for this workspace
  const { data: configData } = await supabaseAdmin
    .from("slack_configs")
    .select("reminder_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!configData?.reminder_url) return "no_reminder_url";

  await fetch(configData.reminder_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: "<!channel>\n 本日、最終退社フォームの提出を確認できませんでした。状況を確認いただけますか？",
        },
      }],
    }),
  });

  return "reminder_sent";
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

    if (isWeekend(now)) {
      return NextResponse.json({ skipped: true, reason: "weekend" });
    }

    const events = await getTodayEvents();
    console.log("📅 Today's events:", events.map(e => e.summary));

    if (isHoliday(events)) {
      return NextResponse.json({ skipped: true, reason: "holiday", events: events.map(e => e.summary) });
    }

    // Fetch all workspaces
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name");

    if (wsErr) throw new Error(wsErr.message);

    const results: Record<string, string> = {};
    for (const ws of workspaces || []) {
      results[ws.name] = await processWorkspace(ws.id);
    }

    return NextResponse.json({ success: true, results, events: events.map(e => e.summary) });

  } catch (err: any) {
    console.error("❌ Daily check error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
