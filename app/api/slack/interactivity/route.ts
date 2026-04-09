import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const payload = JSON.parse(formData.get("payload") as string);

  // 👤 Slack user
  const userName = payload.user.username || payload.user.name;

  // 📝 Reason input
  const reason =
    payload.state?.values?.reason_block?.reason_input?.value || "No reason";

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
      console.error("DB insert error:", error);
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
      text: `*Reason:* ${reason}\n${userName} approved!`,
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