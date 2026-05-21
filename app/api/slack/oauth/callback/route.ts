import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=missing_code`
    );
  }

  // state format: "{workspaceSlug}:{channelType}"  e.g. "acme:approval"
  const colonIdx      = state.indexOf(":");
  const workspaceSlug = colonIdx > -1 ? state.slice(0, colonIdx) : state;
  const channelType   = colonIdx > -1 ? state.slice(colonIdx + 1) : "approval";

  console.log("[slack/callback] state raw:", state);
  console.log("[slack/callback] workspaceSlug:", workspaceSlug, "| channelType:", channelType);

  if (!workspaceSlug) {
    console.error("[slack/callback] workspaceSlug is empty — state was:", state);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=missing_workspace_slug`
    );
  }

  // Exchange code for tokens
  const slackRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      redirect_uri:  `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth/callback`,
    }),
  });

  const data = await slackRes.json();

  console.log("[slack/callback] Slack API response:", JSON.stringify(data, null, 2));

  if (!data.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=slack_${data.error ?? "unknown"}`
    );
  }

  const botToken   = data.access_token as string | undefined;
  const webhookUrl = data.incoming_webhook?.url as string | undefined;

  if (!webhookUrl) {
    // Slack didn't return a webhook URL — "Incoming Webhooks" feature may be off
    // in the Slack app settings (api.slack.com → Features → Incoming Webhooks)
    console.error("[slack/callback] No incoming_webhook.url in Slack response. Full response:", data);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=no_webhook_url`
    );
  }

  if (!botToken) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=no_bot_token`
    );
  }

  // Resolve workspace from slug
  console.log("[slack/callback] Looking up workspace slug:", workspaceSlug);
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  console.log("[slack/callback] Workspace lookup result:", workspace, "error:", wsErr?.message);

  if (wsErr || !workspace) {
    console.error("[slack/callback] Workspace not found for slug:", workspaceSlug);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=workspace_not_found`
    );
  }

  const workspaceId = workspace.id;
  console.log("[slack/callback] workspaceId:", workspaceId);

  // Map channel type to column name in slack_configs
  const urlColumn = channelType === "security"
    ? "security_url"
    : channelType === "reminder"
    ? "reminder_url"
    : "approval_url";

  console.log("[slack/callback] Saving | workspace:", workspaceSlug, "| channel:", channelType, "| webhook:", webhookUrl);

  console.log("[slack/callback] Upserting into slack_configs | column:", urlColumn, "| workspace_id:", workspaceId);
  const { data: upsertData, error: upsertErr } = await supabaseAdmin
    .from("slack_configs")
    .upsert(
      {
        workspace_id: workspaceId,
        bot_token:    botToken,
        [urlColumn]:  webhookUrl,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    )
    .select();

  console.log("[slack/callback] Upsert result:", upsertData, "error:", upsertErr?.message);

  if (upsertErr) {
    console.error("[slack/callback] DB upsert error:", upsertErr.message);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=${encodeURIComponent(upsertErr.message)}`
    );
  }

  console.log("[slack/callback] Saved successfully.");

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_connected=${channelType}`
  );
}
