import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checklist_id, submitted_by, reason, values, completedItems, totalItems } = body;

    if (!checklist_id || !submitted_by || !values) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Insert response
    const { data: responseData, error: responseError } = await supabaseAdmin
      .from("responses")
      .insert({ checklist_id, submitted_by, reason })
      .select()
      .single();

    if (responseError) throw responseError;

    const responseId = responseData.id;

    // 2. Insert response_items — keep itemId as string so Supabase coerces correctly
    const itemsToInsert = Object.entries(values).map(([itemId, value]) => ({
      response_id: responseId,
      checklist_item_id: itemId,
      value: String(value),
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("response_items")
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // 3. Fetch checklist items for Slack message
    const { data: checklistItems } = await supabaseAdmin
      .from("checklist_items")
      .select("*")
      .eq("checklist_id", checklist_id)
      .order("order_index");
    
    const { data: checklistData } = await supabaseAdmin
  .from("checklists")
  .select("title")
  .eq("id", checklist_id)
  .single();

    const checkboxItems = (checklistItems || []).filter((i) => i.type === "checkbox");
    const completedTasks = checkboxItems.filter((i) => values[i.id] === "true").map((i) => i.label);
    const incompleteTasks = checkboxItems.filter((i) => values[i.id] !== "true").map((i) => i.label);
    const textItems = (checklistItems || []).filter((i) => i.type !== "checkbox");

    // 4. Send Slack notification
// Define webhooks
const webhook1 = process.env.SLACK_WEBHOOK_URL_1; // full message
const webhook2 = process.env.SLACK_WEBHOOK_URL_2; // limited message
// const webhook3 = process.env.SLACK_WEBHOOK_URL_3; // (optional)

const baseBlocks: any[] = [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Checklist Title:* ${checklistData?.title || "Untitled"}\n*Submitted by:* ${submitted_by}\n*Progress:* ${completedItems}/${totalItems} tasks checked`,
    },
  },
];

// ✅ Completed
const completedBlock =
  completedTasks.length > 0
    ? {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*✅ Completed:*\n${completedTasks.map((t) => `• ${t}`).join("\n")}`,
        },
      }
    : null;

// ❌ Incomplete
const incompleteBlock =
  incompleteTasks.length > 0
    ? {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Not Completed:*\n${incompleteTasks.map((t) => `• ${t}`).join("\n")}`,
        },
      }
    : null;
const reasonBlock =
  reason && reason.trim()
    ? {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Submission Reason:*\n${reason}`,
        },
      }
    : null;

// 📝 Text responses (only for full message)
const textBlock =
  textItems.length > 0
    ? {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Responses:*\n${textItems
            .map((i) => `*${i.label}:*\n${values[i.id] || "_No response_"}`)
            .join("\n\n")}`,
        },
      }
    : null;

// 🔘 Button block (only for full message)
const actionBlocks =
  incompleteTasks.length > 0
    ? [
        {
          type: "input",
          block_id: "reason_block",
          element: {
            type: "plain_text_input",
            action_id: "reason_input",
            placeholder: {
              type: "plain_text",
              text: "Enter reason for incomplete tasks",
            },
          },
          label: {
            type: "plain_text",
            text: "Reason for incomplete tasks",
          },
        },
        {
          type: "actions",
          block_id: "actions_block", // ✅ ADD THIS
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Approve" },
              style: "primary",
              action_id: "submit_reason",
              value: JSON.stringify({
                response_id: responseId, // ✅ IMPORTANT
                checklist_id,
                submitted_by,
              }), // ✅ optional but useful
            },
          ],
        },
      ]
    : [];

// ✅ Channel 1 → FULL message
if (webhook1) {
  const fullBlocks = [
    ...baseBlocks,
    ...(completedBlock ? [completedBlock] : []),
    ...(incompleteBlock ? [incompleteBlock] : []),
    ...(reasonBlock ? [reasonBlock] : []), // ✅ ADD HERE
    ...(textBlock ? [textBlock] : []),
    ...actionBlocks,
  ];

  await fetch(webhook1, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: fullBlocks }),
  });
}

// ✅ Channel 2 → ONLY checklist status (no text, no button)
if (webhook2) {
  const simpleBlocks = [
    ...baseBlocks,
    ...(completedBlock ? [completedBlock] : []),
    ...(incompleteBlock ? [incompleteBlock] : []),
    ...(reasonBlock ? [reasonBlock] : []), // ✅ ADD HERE
  ];

  await fetch(webhook2, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: simpleBlocks }),
  });
}

// // ✅ Channel 3 → optional (same as full or custom)
// if (webhook3) {
//   await fetch(webhook3, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ blocks: baseBlocks }),
//   });
// }

    return NextResponse.json({ success: true, responseId });
  } catch (err: any) {
    console.error("❌ Submission error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}