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

  const parts        = state.split(":");
  const workspaceSlug = parts[0] ?? "";
  const channelType   = parts[1] ?? "approval";
  const idKind        = parts[2] as "dept" | "checklist" | undefined;
  const rawId         = parts[3] ? parseInt(parts[3]) : null;

  const departmentId = idKind === "dept" ? rawId : null;
  const checklistId  = idKind === "checklist" ? rawId : null;

  console.log("[slack/callback] state raw:", state);
  console.log("[slack/callback] workspaceSlug:", workspaceSlug, "| channelType:", channelType, "| departmentId:", departmentId, "| checklistId:", checklistId);

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
    .select("id, slack_team_id")
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

  if (checklistId) {
    console.log("[slack/callback] Saving checklist config | checklist:", checklistId, "| channel:", channelType);

    const { data: existingChecklistConfig } = await supabaseAdmin
      .from("checklist_slack_configs")
      .select("bot_token, slack_team_id")
      .eq("checklist_id", checklistId)
      .maybeSingle();

    // Only (re)write bot_token/slack_team_id when it's safe: the approval
    // channel is always authoritative since it's the only one that consumes
    // the token; otherwise only write it if there's no token yet (first
    // connect at this tier) or it's the same physical team reconnecting.
    // This stops a security/reminder connect from clobbering a token that
    // approval already anchored to a different Slack workspace.
    const canWriteToken =
      channelType === "approval" ||
      !existingChecklistConfig?.bot_token ||
      existingChecklistConfig.slack_team_id === (slackTeamId ?? null);

    const checklistUpsertPayload: Record<string, unknown> = {
      checklist_id: checklistId,
      [urlColumn]: webhookUrl,
    };
    if (canWriteToken) {
      checklistUpsertPayload.bot_token = botToken;
      checklistUpsertPayload.slack_team_id = slackTeamId ?? null;
    }

    const { error: checklistErr } = await supabaseAdmin
      .from("checklist_slack_configs")
      .upsert(checklistUpsertPayload, { onConflict: "checklist_id" });

    if (checklistErr) {
      console.error("[slack/callback] checklist upsert error:", checklistErr.message);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_error=${encodeURIComponent(checklistErr.message)}&checklist_id=${checklistId}`
      );
    }

    console.log("[slack/callback] Checklist config saved.");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin?tab=settings&slack_connected=${channelType}&checklist_id=${checklistId}`
    );
  }

  if (departmentId) {
    console.log("[slack/callback] Saving dept config | dept:", departmentId, "| channel:", channelType);

    const { data: existingDeptConfig } = await supabaseAdmin
      .from("department_slack_configs")
      .select("bot_token, slack_team_id")
      .eq("department_id", departmentId)
      .maybeSingle();

    // Same reasoning as the checklist branch above: approval is always
    // authoritative; security/reminder only get to write the token if none
    // exists yet or it's the same team reconnecting.
    const canWriteToken =
      channelType === "approval" ||
      !existingDeptConfig?.bot_token ||
      existingDeptConfig.slack_team_id === (slackTeamId ?? null);

    const deptUpsertPayload: Record<string, unknown> = {
      department_id: departmentId,
      [urlColumn]: webhookUrl,
    };
    if (canWriteToken) {
      deptUpsertPayload.bot_token = botToken;
      deptUpsertPayload.slack_team_id = slackTeamId ?? null;
    }

    const { error: deptErr } = await supabaseAdmin
      .from("department_slack_configs")
      .upsert(deptUpsertPayload, { onConflict: "department_id" });

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

  // Same reasoning as the checklist/department branches: approval is always
  // authoritative; security/reminder only get to (re)write the team-id/token
  // pairing if none exists yet or it's the same physical team reconnecting.
  const canWriteToken =
    channelType === "approval" ||
    !workspace.slack_team_id ||
    workspace.slack_team_id === (slackTeamId ?? null);

  if (canWriteToken && slackTeamId) {
    await supabaseAdmin
      .from("workspaces")
      .update({ slack_team_id: slackTeamId })
      .eq("id", workspace.id);
  }

  const slackConfigUpsertPayload: Record<string, unknown> = {
    workspace_id: workspaceId,
    [urlColumn]: webhookUrl,
    updated_at: new Date().toISOString(),
  };
  if (canWriteToken) {
    slackConfigUpsertPayload.bot_token = botToken;
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("slack_configs")
    .upsert(slackConfigUpsertPayload, { onConflict: "workspace_id" });

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
