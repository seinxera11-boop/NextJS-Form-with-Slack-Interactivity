import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWebhookUrl } from "@/lib/slack-helpers";

export const runtime = "nodejs";

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

    // Fetch checklist (includes workspace_id)
    const { data: checklistData, error: checklistFetchErr } = await supabaseAdmin
      .from("checklists")
      .select("title, is_large_checklist, department_id, workspace_id, checklist_departments(department_id)")
      .eq("id", checklist_id)
      .single();
    if (checklistFetchErr) throw checklistFetchErr;

    const workspaceId = checklistData.workspace_id;

    const singleDeptId = (checklistData.checklist_departments as { department_id: number }[] | null)?.[0]?.department_id
      ?? checklistData.department_id ?? null;
    const resolvedDeptId = checklistData.is_large_checklist
      ? (department_id || null)
      : singleDeptId;

    // 1. Fetch department name upfront so it can be stored as a snapshot
    let departmentName = "";
    if (resolvedDeptId) {
      const { data: deptData } = await supabaseAdmin
        .from("departments")
        .select("name")
        .eq("id", resolvedDeptId)
        .single();
      departmentName = deptData?.name || "";
    }

    // 2. Insert response (with name snapshot so it survives dept deletion)
    const { data: responseData, error: responseError } = await supabaseAdmin
      .from("responses")
      .insert({
        checklist_id,
        submitted_by,
        reason,
        department_id:   resolvedDeptId,
        department_name: departmentName || null,
        user_id:         user_id || null,
        workspace_id:    workspaceId,
      })
      .select()
      .single();
    if (responseError) throw responseError;
    const responseId = responseData.id;

    // 3. Insert response_items
    const itemsToInsert = Object.entries(values).map(([itemId, value]) => ({
      response_id:       responseId,
      checklist_item_id: itemId,
      value:             String(value),
    }));
    if (itemsToInsert.length) {
      const { error: itemsError } = await supabaseAdmin
        .from("response_items")
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    // 4. Fetch sections with items
    const { data: sections } = await supabaseAdmin
      .from("checklist_sections")
      .select("*, checklist_items(*)")
      .eq("checklist_id", checklist_id)
      .order("order_index");

    const sortedSections = (sections || []).sort((a, b) => a.order_index - b.order_index);

    const missingItems: string[] = [];
    for (const sec of sortedSections) {
      const secItems = [...(sec.checklist_items || [])].sort(
        (a: any, b: any) => a.order_index - b.order_index
      );
      for (const item of secItems) {
        if (item.type === "checkbox" && values[item.id] !== "true") {
          missingItems.push(`${item.label} (${sec.title})`);
        }
      }
    }

    const reasonText = reason?.trim() || "コメントありませんでした。";
    const hasMissing = missingItems.length > 0;

    // 5. Fetch webhook URLs — dept-specific first, falls back to workspace
    const [approvalUrl, securityUrl] = await Promise.all([
      getWebhookUrl(resolvedDeptId, "approval", workspaceId),
      getWebhookUrl(resolvedDeptId, "security", workspaceId),
    ]);

    // ── Approval channel payload ───────────────────────────────────────────────
    const approvalBodyText = hasMissing
      ? `${missingItems.join("\n")} はチェックしませんでした。\n コメント： ${reasonText}`
      : `\nすべてのタスクが完了しました\n コメント：${reasonText}`;

    const approvalPayload = {
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "<!channel> " },
        },
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${departmentName}の ${submitted_by} さんから新しい提出があります`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: approvalBodyText },
        },
        {
          type: "input",
          block_id: "reason_block",
          element: {
            type: "plain_text_input",
            action_id: "input_reason",
          },
          label: {
            type: "plain_text",
            text: "承認の理由を教えてください",
          },
        },
        {
          type: "actions",
          block_id: "actions_block",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", emoji: true, text: "承認" },
              style: "primary",
              value: JSON.stringify({ response_id: responseId, checklist_id, submitted_by }),
              action_id: "approve_action",
            },
          ],
        },
      ],
    };

    // ── Security channel payload ───────────────────────────────────────────────
    const securityText = hasMissing
      ? `*${departmentName}の ${submitted_by} が最終退出しました。\n${missingItems.join("\n")} はチェックしませんでした。 \nコメント：${reasonText}*`
      : `*${departmentName}の ${submitted_by} が最終退出しました。\nコメント：${reasonText}*`;

    const securityPayload = { text: securityText };

    if (approvalUrl) {
      await fetch(approvalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approvalPayload),
      });
    }

    if (securityUrl) {
      await fetch(securityUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(securityPayload),
      });
    }

    return NextResponse.json({ success: true, responseId });
  } catch (err: any) {
    console.error("❌ 送信エラー:", err);
    return NextResponse.json({ error: err.message || "サーバーエラー" }, { status: 500 });
  }
}
