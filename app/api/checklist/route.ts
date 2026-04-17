import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function getWebhookUrls() {
  const { data } = await supabaseAdmin
    .from("variables")
    .select("key, value")
    .in("key", ["approval_url", "security_url", "reminder_url"]);

  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  return {
    approvalUrl: map["approval_url"] || "",
    securityUrl: map["security_url"] || "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      checklist_id, submitted_by, reason, values,
      completedItems, totalItems,
      department_id, user_id,
    } = body;

    if (!checklist_id || !submitted_by || !values) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // 1. Insert response
    const { data: responseData, error: responseError } = await supabaseAdmin
      .from("responses")
      .insert({
        checklist_id,
        submitted_by,
        reason,
        department_id: department_id || null,
        user_id: user_id || null,
      })
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

    // 4. Fetch department name
    let departmentName = "";
    if (department_id) {
      const { data: deptData } = await supabaseAdmin
        .from("departments")
        .select("name")
        .eq("id", department_id)
        .single();
      departmentName = deptData?.name || "";
    }

    // 5. Fetch sections with items
    const { data: sections } = await supabaseAdmin
      .from("checklist_sections")
      .select("*, checklist_items(*)")
      .eq("checklist_id", checklist_id)
      .order("order_index");

    const sortedSections = (sections || []).sort((a, b) => a.order_index - b.order_index);
    const allItems = sortedSections.flatMap((sec) =>
      [...(sec.checklist_items || [])].sort((a: any, b: any) => a.order_index - b.order_index)
    );

    const checkboxItems  = allItems.filter((i: any) => i.type === "checkbox");
    const incompleteTasks = checkboxItems
      .filter((i: any) => values[i.id] !== "true")
      .map((i: any) => i.label);

    // 6. Fetch webhook URLs
    const { approvalUrl, securityUrl } = await getWebhookUrls();

    // ── Shared: header block ───────────────────────────────────────────────────
    const headerBlock: any = {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*チェックリスト:* ${checklistData?.title || "未設定"}`,
          `*提出者:* ${submitted_by}`,
          departmentName ? `*部署:* ${departmentName}` : null,
          `*進捗:* ${completedItems}/${totalItems} 件完了`,
        ].filter(Boolean).join("\n"),
      },
    };

    // ── Shared: one block per section showing every item ──────────────────────
    const sectionBreakdownBlocks: any[] = sortedSections.map((sec) => {
      const secItems = [...(sec.checklist_items || [])].sort(
        (a: any, b: any) => a.order_index - b.order_index
      );
      const lines = secItems.map((item: any) => {
        if (item.type === "checkbox") {
          return `${values[item.id] === "true" ? "✅" : "❌"} ${item.label}`;
        }
        return `*${item.label}:* ${values[item.id]?.trim() || "_未入力_"}`;
      });
      return {
        type: "section",
        text: { type: "mrkdwn", text: `*${sec.title}*\n${lines.join("\n")}` },
      };
    });

    // ── Shared: reason block ──────────────────────────────────────────────────
    const reasonBlock = reason?.trim()
      ? { type: "section", text: { type: "mrkdwn", text: `*📝 提出理由:*\n${reason}` } }
      : null;

    // ── Approval channel only: interactive input + button ─────────────────────
    const actionBlocks: any[] = [
      {
        type: "input",
        block_id: "reason_block",
        element: {
          type: "plain_text_input",
          action_id: "reason_input",
          placeholder: { type: "plain_text", text: "メッセージを入力" },
        },
        label: { type: "plain_text", text: "メッセージ" },
        optional: true,
      },
      {
        type: "actions",
        block_id: "actions_block",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "承認する" },
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
    ];

    // ── Base blocks shared by both channels ───────────────────────────────────
    const sharedBlocks: any[] = [
      headerBlock,
      { type: "divider" },
      ...sectionBreakdownBlocks,
      ...(reasonBlock ? [reasonBlock] : []),
    ];

    // ── Send to Approval channel ──────────────────────────────────────────────
    if (approvalUrl) {
      await fetch(approvalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [...sharedBlocks, ...actionBlocks],
        }),
      });
    }

    // ── Send to Security channel ──────────────────────────────────────────────
    if (securityUrl) {
      await fetch(securityUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: sharedBlocks,
        }),
      });
    }

    return NextResponse.json({ success: true, responseId });
  } catch (err: any) {
    console.error("❌ 送信エラー:", err);
    return NextResponse.json({ error: err.message || "サーバーエラー" }, { status: 500 });
  }
}