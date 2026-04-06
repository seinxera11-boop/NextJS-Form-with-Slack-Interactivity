import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checklist_id, submitted_by, values, completedItems, totalItems } = body;

    if (!checklist_id || !submitted_by || !values) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Insert response
    const { data: responseData, error: responseError } = await supabaseAdmin
      .from("responses")
      .insert({ checklist_id, submitted_by })
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

    const checkboxItems = (checklistItems || []).filter((i) => i.type === "checkbox");
    const completedTasks = checkboxItems.filter((i) => values[i.id] === "true").map((i) => i.label);
    const incompleteTasks = checkboxItems.filter((i) => values[i.id] !== "true").map((i) => i.label);
    const textItems = (checklistItems || []).filter((i) => i.type !== "checkbox");

    // 4. Send Slack notification
    if (process.env.SLACK_WEBHOOK_URL) {
      const blocks: any[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Checklist Submitted*\n*Submitted by:* ${submitted_by}\n*Progress:* ${completedItems}/${totalItems} tasks checked`,
          },
        },
      ];

      if (completedTasks.length > 0) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*✅ Completed:*\n${completedTasks.map((t) => `• ${t}`).join("\n")}` },
        });
      }

      if (incompleteTasks.length > 0) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*❌ Not Completed:*\n${incompleteTasks.map((t) => `• ${t}`).join("\n")}` },
        });
      }

      if (textItems.length > 0) {
        const textResponses = textItems
          .map((i) => `*${i.label}:*\n${values[i.id] || "_No response_"}`)
          .join("\n\n");
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*📝 Responses:*\n${textResponses}` },
        });
      }

      if (incompleteTasks.length > 0) {
        blocks.push(
          {
            type: "input",
            block_id: "reason_block",
            element: {
              type: "plain_text_input",
              action_id: "reason_input",
              placeholder: { type: "plain_text", text: "Enter reason for incomplete tasks" },
            },
            label: { type: "plain_text", text: "Reason for incomplete tasks" },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Submit Reason" },
                style: "primary",
                action_id: "submit_reason",
              },
            ],
          }
        );
      }

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
    }

    return NextResponse.json({ success: true, responseId });
  } catch (err: any) {
    console.error("❌ Submission error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}