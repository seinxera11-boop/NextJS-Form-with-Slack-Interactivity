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

  // state format: "{workspace}:{channel}" or "{workspace}:{channel}:{departmentId}"
  const parts        = state.split(":");
  const workspaceSlug = parts[0] ?? "";
  const channelType   = parts[1] ?? "approval";
  const departmentId  = parts[2] ? parseInt(parts[2]) : null;

  console.log("[slack/callback] state raw:", state);
  console.log("[slack/callback] workspaceSlug:", workspaceSlug, "| channelType:", channelType, "| departmentId:", departmentId);

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

  const slackTeamId = data.team?.id as string | undefined;
  const workspaceId = workspace.id;
  const urlColumn = channelType === "security"
    ? "security_url"
    : channelType === "reminder"
    ? "reminder_url"
    : "approval_url";

  if (departmentId) {
    // Department-specific: save webhook + this department's own Slack team/token
    // to department_slack_configs. Deliberately does NOT touch the workspace-level
    // slack_configs row — a department may belong to a different physical Slack
    // workspace than the org default, so its token/team must not overwrite it.
    console.log("[slack/callback] Saving dept config | dept:", departmentId, "| channel:", channelType);
    const { error: deptErr } = await supabaseAdmin
      .from("department_slack_configs")
      .upsert(
        { department_id: departmentId, bot_token: botToken, slack_team_id: slackTeamId ?? null, [urlColumn]: webhookUrl },
        { onConflict: "department_id" }
      );

    if (deptErr) {
      console.error("[slack/callback] dept upsert error:", deptErr.message);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=departments&slack_error=${encodeURIComponent(deptErr.message)}&department_id=${departmentId}`
      );
    }

    console.log("[slack/callback] Dept config saved.");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=departments&slack_connected=${channelType}&department_id=${departmentId}`
    );
  }

  // Workspace-level: save to slack_configs + keep workspaces.slack_team_id in sync
  console.log("[slack/callback] Saving workspace config | workspace:", workspaceSlug, "| channel:", channelType);
  if (slackTeamId) {
    await supabaseAdmin
      .from("workspaces")
      .update({ slack_team_id: slackTeamId })
      .eq("id", workspace.id);
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("slack_configs")
    .upsert(
      { workspace_id: workspaceId, bot_token: botToken, [urlColumn]: webhookUrl, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id" }
    );

  if (upsertErr) {
    console.error("[slack/callback] DB upsert error:", upsertErr.message);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=${encodeURIComponent(upsertErr.message)}`
    );
  }

  console.log("[slack/callback] Workspace config saved.");
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_connected=${channelType}`
  );
}
