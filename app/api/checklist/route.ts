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

    // 2. Insert response_items
    const itemsToInsert = Object.entries(values).map(([itemId, value]) => ({
      response_id: responseId,
      checklist_item_id: itemId,
      value: String(value),
    }));

    if (itemsToInsert.length) {
      const { error: itemsError } = await supabaseAdmin
        .from("response_items")
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    // 3. Fetch checklist title
    const { data: checklistData } = await supabaseAdmin
      .from("checklists")
      .select("title")
      .eq("id", checklist_id)
      .single();

    // 4. Fetch sections with their items (ordered)
    const { data: sections } = await supabaseAdmin
      .from("checklist_sections")
      .select("*, checklist_items(*)")
      .eq("checklist_id", checklist_id)
      .order("order_index");

    const sortedSections = (sections || []).sort((a, b) => a.order_index - b.order_index);

    // Flatten all items across sections (order_index within each section)
    const allItems = sortedSections.flatMap((sec) =>
      [...(sec.checklist_items || [])].sort((a: any, b: any) => a.order_index - b.order_index)
    );

    const checkboxItems = allItems.filter((i: any) => i.type === "checkbox");
    const textItems = allItems.filter((i: any) => i.type !== "checkbox");

    const completedTasks = checkboxItems
      .filter((i: any) => values[i.id] === "true")
      .map((i: any) => i.label);
    const incompleteTasks = checkboxItems
      .filter((i: any) => values[i.id] !== "true")
      .map((i: any) => i.label);

    // 5. Build Slack blocks

    const webhook1 = process.env.SLACK_WEBHOOK_URL_1;
    const webhook2 = process.env.SLACK_WEBHOOK_URL_2;

    const baseBlocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Checklist:* ${checklistData?.title || "Untitled"}\n*Submitted by:* ${submitted_by}\n*Progress:* ${completedItems}/${totalItems} tasks checked`,
        },
      },
    ];

    // Per-section breakdown block (shows section name + task status)
    const sectionBreakdownBlocks: any[] = sortedSections.map((sec) => {
      const secItems = [...(sec.checklist_items || [])].sort(
        (a: any, b: any) => a.order_index - b.order_index
      );
      const lines = secItems.map((item: any) => {
        if (item.type === "checkbox") {
          const done = values[item.id] === "true";
          return `${done ? "✅" : "❌"} ${item.label}`;
        }
        const answer = values[item.id]?.trim() || "_No response_";
        return `*${item.label}:* ${answer}`;
      });

      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${sec.title}*\n${lines.join("\n")}`,
        },
      };
    });

    const reasonBlock =
      reason?.trim()
        ? {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*📝 Submission Reason:*\n${reason}`,
            },
          }
        : null;

    // Text responses block (for full message — webhook1)
    const textBlock =
      textItems.length > 0
        ? {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*📝 Responses:*\n${textItems
                .map((i: any) => `*${i.label}:*\n${values[i.id] || "_No response_"}`)
                .join("\n\n")}`,
            },
          }
        : null;

    // Approve button (only when tasks are incomplete)
    const actionBlocks: any[] =
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
              block_id: "actions_block",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Approve" },
                  style: "primary",
                  action_id: "submit_reason",
                  value: JSON.stringify({
                    response_id: responseId,
                    checklist_id,
                    submitted_by,
                  }),
                },
              ],
            },
          ]
        : [];

    // Channel 1 — full message with per-section breakdown
    if (webhook1) {
      const fullBlocks = [
        ...baseBlocks,
        { type: "divider" },
        ...sectionBreakdownBlocks,
        ...(reasonBlock ? [reasonBlock] : []),
        ...actionBlocks,
      ];
      await fetch(webhook1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: fullBlocks }),
      });
    }

    // Channel 2 — simple summary only (completed/incomplete counts, no text answers)
    if (webhook2) {
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

      const simpleBlocks = [
        ...baseBlocks,
        ...(completedBlock ? [completedBlock] : []),
        ...(incompleteBlock ? [incompleteBlock] : []),
        ...(reasonBlock ? [reasonBlock] : []),
      ];
      await fetch(webhook2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: simpleBlocks }),
      });
    }

    return NextResponse.json({ success: true, responseId });
  } catch (err: any) {
    console.error("❌ Submission error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}