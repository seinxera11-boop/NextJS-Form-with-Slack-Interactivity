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

// ✅ FIXED: Only treat real holidays as holidays
function isHoliday(events: CalendarEvent[]): boolean {
  const holidayKeywords = [
    "holiday",
    "public holiday",
    "day off",
    "leave",
    "company off",
  ];

  return events.some(event => {
    const title = event.summary.toLowerCase();

    return holidayKeywords.some(keyword => title.includes(keyword));
  });
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

// ─── Submission check ─────────────────────────────────────────────────────────

async function hasSubmissionToday(): Promise<boolean> {
  const now = new Date();

  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
  )).toISOString();

  const todayEnd = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59
  )).toISOString();

  const { data, error } = await supabaseAdmin
    .from("responses")
    .select("id")
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd)
    .limit(1);

  if (error) throw new Error(`DB check error: ${error.message}`);

  return (data || []).length > 0;
}

// ─── Slack notification ───────────────────────────────────────────────────────

async function sendSlackReminder(reminderUrl: string): Promise<void> {
  const res = await fetch(reminderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "<!channel>\n 本日、最終退社フォームの提出を確認できませんでした。状況を確認いただけますか？",
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${res.statusText}`);
  }
}

// ─── Fetch reminder URL ───────────────────────────────────────────────────────

async function getReminderUrl(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("variables")
    .select("value")
    .eq("key", "reminder_url")
    .single();

  if (error || !data?.value) {
    throw new Error("reminder_url not configured in variables table");
  }

  return data.value;
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

    // 1. Weekend check
    if (isWeekend(now)) {
      return NextResponse.json({ skipped: true, reason: "weekend" });
    }

    // 2. Holiday check
    const events = await getTodayEvents();

    console.log("📅 Today's events:", events.map(e => e.summary));

    const holiday = isHoliday(events);

    if (holiday) {
      return NextResponse.json({
        skipped: true,
        reason: "holiday",
        events: events.map(e => e.summary),
      });
    }

    // 3. Submission check
    const submitted = await hasSubmissionToday();

    if (submitted) {
      return NextResponse.json({
        skipped: true,
        reason: "already_submitted",
      });
    }

    // 4. Send Slack reminder
    const reminderUrl = await getReminderUrl();
    await sendSlackReminder(reminderUrl);

    return NextResponse.json({
      success: true,
      reason: "reminder_sent",
      events: events.map(e => e.summary),
    });

  } catch (err: any) {
    console.error("❌ Daily check error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}