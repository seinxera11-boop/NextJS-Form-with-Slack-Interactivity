import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: config } = await supabaseAdmin
    .from("slack_configs")
    .select("bot_token, approval_url, security_url, reminder_url")
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  return NextResponse.json({
    bot_token:    config?.bot_token    ?? null,
    approval_url: config?.approval_url ?? null,
    security_url: config?.security_url ?? null,
    reminder_url: config?.reminder_url ?? null,
  });
}
