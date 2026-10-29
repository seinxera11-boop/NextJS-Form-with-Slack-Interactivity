import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWebhookUrl } from "@/lib/slack-helpers";
import { getConversationId, getMessagingProvider } from "@/lib/teams-helpers";
import { getTeamsApp } from "@/lib/teams-app";
import { MessageActivity } from "@microsoft/teams.api";

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

async function sendReminder(webhookUrl: string, titles: string[]): Promise<void> {
  const list = titles.map(t => `• ${t}`).join("\n");
  const text = `<!channel>\n本日、以下のチェックリストの提出を確認できませんでした。状況を確認いただけますか？\n${list}`;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: [{ type: "section", text: { type: "mrkdwn", text } }] }),
  });
}

// Teams has no <!channel>; the mention would need an entity, so it is dropped.
async function sendTeamsReminder(conversationId: string, titles: string[]): Promise<void> {
  const list = titles.map(t => `• ${t}`).join("\n\n");
  const text = `本日、以下のチェックリストの提出を確認できませんでした。状況を確認いただけますか？\n\n${list}`;

  const app = await getTeamsApp();
  await app.send(conversationId, new MessageActivity(text));
}

async function isHolidayForWorkspace(workspaceId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const { data } = await supabaseAdmin
    .from("workspace_holidays")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("holiday_date", today)
    .maybeSingle();

  return !!data;
}

async function processWorkspace(workspaceId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const { error: claimErr } = await supabaseAdmin
    .from("reminder_runs")
    .insert({ workspace_id: workspaceId, run_date: today });

  if (claimErr) {
    console.log(`[daily-check] workspace ${workspaceId} already processed today — skipping`);
    return "already_processed_today";
  }

  if (await isHolidayForWorkspace(workspaceId)) return "holiday";

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
  const todayEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();

  const provider = await getMessagingProvider(workspaceId);
  const isTeams = provider === "teams";

  const { data: checklists } = await supabaseAdmin
    .from("checklists")
    .select("id, title, department_id, checklist_departments(department_id), checklist_slack_configs(reminder_url), checklist_teams_configs(reminder_conversation_id)")
    .eq("workspace_id", workspaceId);

  if (!checklists || checklists.length === 0) return "no_checklists";

  const { data: todayResponses } = await supabaseAdmin
    .from("responses")
    .select("checklist_id")
    .eq("workspace_id", workspaceId)
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  const submittedIds = new Set((todayResponses || []).map(r => r.checklist_id));
  const unfilled = checklists.filter(cl => !submittedIds.has(cl.id));

  if (unfilled.length === 0) return "already_submitted";

  // The map key is a webhook URL (Slack) or a conversationId (Teams); the
  // grouping below is identical either way.
  const resolveReminderTarget = (deptId: number | null) =>
    isTeams
      ? getConversationId(null, deptId, "reminder", workspaceId)
      : getWebhookUrl(null, deptId, "reminder", workspaceId);

  const urlMap = new Map<string, Set<string>>();
  const deptUrlCache = new Map<number, string | null>();
  let workspaceDefaultUrl: string | null | undefined; // undefined = not yet fetched

  const addTitle = (url: string | null | undefined, title: string) => {
    if (!url) return;
    if (!urlMap.has(url)) urlMap.set(url, new Set());
    urlMap.get(url)!.add(title);
  };

  for (const cl of unfilled) {
    const ownUrl = (isTeams
      ? (cl as any).checklist_teams_configs?.reminder_conversation_id
      : (cl as any).checklist_slack_configs?.reminder_url) as string | null | undefined;

    if (ownUrl) {
      addTitle(ownUrl, cl.title);
      continue; // this checklist has its own channel — do not also fan out to departments
    }

    const cdDepts = ((cl as any).checklist_departments as { department_id: number }[] | null) ?? [];
    const deptIds = cdDepts.length > 0
      ? cdDepts.map(cd => cd.department_id)
      : (cl.department_id ? [cl.department_id as number] : []);

    if (deptIds.length === 0) {
      if (workspaceDefaultUrl === undefined) {
        workspaceDefaultUrl = await resolveReminderTarget(null);
      }
      addTitle(workspaceDefaultUrl, cl.title);
      continue;
    }

    for (const deptId of deptIds) {
      if (!deptUrlCache.has(deptId)) {
        deptUrlCache.set(deptId, await resolveReminderTarget(deptId));
      }
      addTitle(deptUrlCache.get(deptId), cl.title);
    }
  }

  let sent = 0;
  for (const [url, titleSet] of urlMap) {
    if (isTeams) {
      // app.send() throws; one unreachable channel must not stop the rest.
      try {
        await sendTeamsReminder(url, Array.from(titleSet));
        sent++;
      } catch (err) {
        console.error("[daily-check] teams reminder failed:", err);
      }
    } else {
      await sendReminder(url, Array.from(titleSet));
      sent++;
    }
  }

  return sent > 0 ? "reminder_sent" : "no_reminder_url";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    if (isWeekend(now)) {
      return NextResponse.json({ skipped: true, reason: "weekend" });
    }

    const workspaceFilter = req.nextUrl.searchParams.get("workspace");

    let wsQuery = supabaseAdmin.from("workspaces").select("id, name");
    if (workspaceFilter) wsQuery = wsQuery.ilike("name", workspaceFilter);

    const { data: workspaces, error: wsErr } = await wsQuery;
    if (wsErr) throw new Error(wsErr.message);

    const results: Record<string, string> = {};
    for (const ws of workspaces || []) {
      results[ws.name] = await processWorkspace(ws.id);
    }

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error("❌ Daily check error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}