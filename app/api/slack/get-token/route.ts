import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("team_id");
  if (!teamId) return NextResponse.json({ error: "Missing team_id" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("slack_tokens")
    .select("bot_token, webhook_url")
    .eq("team_id", teamId)
    .order("installed_at", { ascending: false }) // latest installation
    .limit(1)
    .single();
  console.log("Supabase data:", data);
  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    botToken: data.bot_token,
    webhookUrl: data.webhook_url
  });
}