import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: config } = await supabaseAdmin
    .from("slack_configs")
    .select("bot_token, approval_url, security_url, reminder_url, google_calendar_id")
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  return NextResponse.json({
    bot_token:          config?.bot_token          ?? null,
    approval_url:       config?.approval_url       ?? null,
    security_url:       config?.security_url       ?? null,
    reminder_url:       config?.reminder_url       ?? null,
    google_calendar_id: config?.google_calendar_id ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const calendarId = typeof body?.google_calendar_id === "string"
    ? body.google_calendar_id.trim()
    : null;

  if (!calendarId) {
    return NextResponse.json({ error: "google_calendar_id is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("slack_configs")
    .upsert(
      { workspace_id: ctx.workspaceId, google_calendar_id: calendarId, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
