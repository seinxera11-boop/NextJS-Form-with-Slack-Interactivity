import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function resolveUserName(teamId: string, userId: string, fallback: string) {
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slack_team_id", teamId)
    .maybeSingle();

  if (!workspace) {
    console.error("[slack/interactivity] no workspace for slack_team_id:", teamId, wsErr?.message);
    return fallback;
  }

  const { data: config, error: cfgErr } = await supabaseAdmin
    .from("slack_configs")
    .select("bot_token")
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!config?.bot_token) {
    console.error("[slack/interactivity] no bot_token for workspace:", workspace.id, cfgErr?.message);
    return fallback;
  }

  try {
    const res = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      { headers: { Authorization: `Bearer ${config.bot_token}` } }
    );
    const data = await res.json();

    if (!data.ok) {
      console.error("[slack/interactivity] users.info error:", data.error);
      return fallback;
    }

    console.log("[slack/interactivity] users.info real_name:", data.user?.profile?.real_name, "| display_name:", data.user?.profile?.display_name);
    return data.user?.profile?.real_name || data.user?.real_name || fallback;
  } catch (err) {
    console.error("[slack/interactivity] users.info failed:", err);
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const payload = JSON.parse(formData.get("payload") as string);

  // 👤 Slack user
  const fallbackName = payload.user.username || payload.user.name;
  const userName = await resolveUserName(payload.team.id, payload.user.id, fallbackName);

  // 📝 Reason input
  const reason =
    payload.state?.values?.reason_block?.input_reason?.value || "理由なし";

  // 📦 Get metadata from button
  const action = payload.actions?.[0];
  const parsedValue = JSON.parse(action.value || "{}");

  const response_id = parsedValue.response_id;

  // ✅ 1. STORE IN DATABASE
  if (response_id) {
    const { error } = await supabaseAdmin
      .from("response_approvals")
      .insert({
        response_id,
        reason,
        approved_by: userName,
      });

    if (error) {
      console.error("DB登録エラー:", error);
    }
  }

  // 📦 Original message
  const originalBlocks = payload.message.blocks;

  // ❌ Remove input + button
  const cleanedBlocks = originalBlocks.filter(
    (block: any) =>
      block.block_id !== "reason_block" &&
      block.block_id !== "actions_block"
  );

  // ✅ Add final message
  cleanedBlocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${userName}が承認しました\n*コメント:* ${reason}`,
    },
  });

  // 🔁 Update Slack message
  await fetch(payload.response_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      replace_original: true,
      blocks: cleanedBlocks,
    }),
  });

  return NextResponse.json({ ok: true });
}