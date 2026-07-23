# Checklist-Level Slack Config — Copy-Paste Change Plan

Every open question from the first draft of this plan has been decided below. Nothing
here is a "sketch" — each snippet is the complete, final code for that file/section.
Copy it in as-is, adjusting only the surrounding unchanged code to match your current
file if it has drifted since this was written.

## 1. What this adds

Priority chain for all three notification types (`approval_url`, `security_url`,
`reminder_url`):

```
checklist_slack_configs   (most specific — a single checklist's own Slack connection)
        ↓ falls back to
department_slack_configs  (a department's own Slack connection)
        ↓ falls back to
slack_configs             (workspace-level default)
```

A checklist can now be connected to Slack directly — its own full OAuth-issued
`bot_token` + `slack_team_id`, exactly like a department, reusing the existing
`SlackConnectPanel` overlay. When a checklist has its own URL for a given type, that URL
is used directly and department fan-out is skipped entirely for that checklist. When it
doesn't, department fan-out still happens, but reminder delivery is deduplicated **by
resolved URL** (not by department id) — this is the fix for the real incident where 5
departments sharing one fallback channel produced 5 duplicate reminder messages.

Not included here (separate, already-discussed items, out of scope for this plan):
Japanese-language holiday keyword detection, and the cron whole-run idempotency guard
(`reminder_runs` table). Do those separately if/when you implement them.

---

## 2. Database migration (do this first)

```sql
create table checklist_slack_configs (
  checklist_id  integer primary key references checklists(id) on delete cascade,
  bot_token     text,
  slack_team_id text,
  approval_url  text,
  security_url  text,
  reminder_url  text
);
```

Mirrors `department_slack_configs` exactly (same columns, same single-column primary
key), so the same `.upsert(..., { onConflict: "checklist_id" })` pattern used for
departments works unchanged for checklists. Run this in the Supabase SQL Editor before
touching any code below.

---

## 3. `lib/slack-helpers.ts` — full file

```ts
import { supabaseAdmin } from "./supabase-admin";

type SlackChannelType = "approval" | "security" | "reminder";

export async function getWebhookUrl(
  checklistId: number | null,
  departmentId: number | null,
  type: SlackChannelType,
  workspaceId: string
): Promise<string | null> {

  // Step 1: checklist-level override (most specific)
  if (checklistId) {
    const { data: checklistConfig } = await supabaseAdmin
      .from("checklist_slack_configs")
      .select("approval_url, security_url, reminder_url")
      .eq("checklist_id", checklistId)
      .maybeSingle();

    const url = checklistConfig?.[`${type}_url`];
    if (url) return url;
  }

  // Step 2: department config
  if (departmentId) {
    const { data: deptConfig } = await supabaseAdmin
      .from("department_slack_configs")
      .select("approval_url, security_url, reminder_url")
      .eq("department_id", departmentId)
      .maybeSingle();

    const url = deptConfig?.[`${type}_url`];
    if (url) return url;
  }

  // Step 3: fall back to workspace default
  const { data: workspaceConfig } = await supabaseAdmin
    .from("slack_configs")
    .select("approval_url, security_url, reminder_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const workspaceUrl = workspaceConfig?.[`${type}_url`];
  return workspaceUrl ?? null;
}
```

**Decided:** `checklistId` is now the first parameter (was: `getWebhookUrl(departmentId, type, workspaceId)`). Both call sites below are updated accordingly. No separate "checklist-only, no-fallback" helper is needed — the cron (§7) reads a checklist's own `reminder_url` directly from an already-batched query instead of calling into this file per-checklist, which is both simpler and avoids N extra queries.

---

## 4. `app/api/slack/install/route.ts` — full file

```ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const workspace    = searchParams.get("workspace") ?? "";
  const channel      = searchParams.get("channel") ?? "approval";
  const departmentId = searchParams.get("department_id") ?? "";
  const checklistId  = searchParams.get("checklist_id") ?? "";

  const slackClientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth/callback`;

  let state = `${workspace}:${channel}`;
  if (departmentId) state += `:dept:${departmentId}`;
  else if (checklistId) state += `:checklist:${checklistId}`;

  const url =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${slackClientId}` +
    `&scope=chat:write,incoming-webhook,channels:read,users:read,users.profile:read` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
```

**Decided:** new `state` format is `"{workspace}:{channel}"` (workspace-level), `"{workspace}:{channel}:dept:{id}"` (department-level), or `"{workspace}:{channel}:checklist:{id}"` (checklist-level) — the `dept:`/`checklist:` tag disambiguates what used to be an unlabeled 3rd segment. If both `department_id` and `checklist_id` are somehow present, `department_id` silently wins — this can't happen from the UI since each "Connect" link only ever sets one, so no extra validation was added.

---

## 5. `app/api/slack/oauth/callback/route.ts` — full file

```ts
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

  // state format:
  //   "{workspace}:{channel}"                  -> workspace-level
  //   "{workspace}:{channel}:dept:{id}"        -> department-level
  //   "{workspace}:{channel}:checklist:{id}"   -> checklist-level
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

  if (checklistId) {
    // Checklist-specific: save webhook + this checklist's own Slack team/token
    // to checklist_slack_configs. Mirrors the department branch below — a
    // checklist may be connected to a different physical Slack workspace than
    // its department/org default.
    console.log("[slack/callback] Saving checklist config | checklist:", checklistId, "| channel:", channelType);
    const { error: checklistErr } = await supabaseAdmin
      .from("checklist_slack_configs")
      .upsert(
        { checklist_id: checklistId, bot_token: botToken, slack_team_id: slackTeamId ?? null, [urlColumn]: webhookUrl },
        { onConflict: "checklist_id" }
      );

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
```

**Decided:** the checklist branch is checked first (order vs. the department branch doesn't matter — `state` only ever encodes one id kind), and redirects back to `?tab=settings` (where the new checklist UI lives, §9) instead of `?tab=departments`.

---

## 6. `app/api/slack/interactivity/route.ts` — only `findBotTokenForTeam` changes

Replace this function; leave everything else in the file (`resolveUserName`, the `POST` handler, the idempotency guard, the `approved_block` confirmation logic) untouched.

```ts
async function findBotTokenForTeam(teamId: string): Promise<string | null> {

  const { data: checklistConfigs } = await supabaseAdmin
    .from("checklist_slack_configs")
    .select("bot_token")
    .eq("slack_team_id", teamId)
    .limit(1);

  if (checklistConfigs?.[0]?.bot_token) return checklistConfigs[0].bot_token;

  const { data: deptConfigs } = await supabaseAdmin
    .from("department_slack_configs")
    .select("bot_token")
    .eq("slack_team_id", teamId)
    .limit(1);

  if (deptConfigs?.[0]?.bot_token) return deptConfigs[0].bot_token;

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slack_team_id", teamId)
    .maybeSingle();

  if (!workspace) return null;

  const { data: config } = await supabaseAdmin
    .from("slack_configs")
    .select("bot_token")
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  return config?.bot_token ?? null;
}
```

This resolves a bot **token** for a physical Slack team, not a notification destination — any matching row for the same team_id has an equivalent token, so checking checklist-tier first here is just for consistency with the rest of this doc, not a functional requirement.

---

## 7. `app/api/checklist/route.ts` — two lines change

Find this block (submission handler, "5. Fetch webhook URLs"):

```ts
// 5. Fetch webhook URLs — dept-specific first, falls back to workspace
const [approvalUrl, securityUrl] = await Promise.all([
  getWebhookUrl(resolvedDeptId, "approval", workspaceId),
  getWebhookUrl(resolvedDeptId, "security", workspaceId),
]);
```

Replace with:

```ts
// 5. Fetch webhook URLs — checklist-specific first, then dept, then workspace
const [approvalUrl, securityUrl] = await Promise.all([
  getWebhookUrl(checklist_id, resolvedDeptId, "approval", workspaceId),
  getWebhookUrl(checklist_id, resolvedDeptId, "security", workspaceId),
]);
```

`checklist_id` is already destructured from the request body earlier in this same function — no new variable needed.

---

## 8. `app/api/cron/daily-check/route.ts` — full file

This is the trickiest rewrite. The department-keyed `groups: Map<number, string[]>` is replaced by a **URL-keyed** map, built with full knowledge of each checklist's own override before any fan-out decision is made. Everything outside `processWorkspace` (calendar/holiday/weekend logic, the route handler) is unchanged from what you have today.

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWebhookUrl } from "@/lib/slack-helpers";
import { google } from "googleapis";

type CalendarEvent = {
  summary:   string;
  start:     string;
  end:       string;
  isAllDay:  boolean;
};

async function getTodayEvents(calendarId: string): Promise<CalendarEvent[]> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key:   process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({ version: "v3", auth });
  const now = new Date();

  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
  ));

  const endOfDay = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59
  ));

  const res = await calendar.events.list({
    calendarId,
    timeMin:      startOfDay.toISOString(),
    timeMax:      endOfDay.toISOString(),
    singleEvents: true,
    orderBy:      "startTime",
  });

  return (res.data.items || []).map(event => ({
    summary:  event.summary || "",
    start:    event.start?.dateTime || event.start?.date || "",
    end:      event.end?.dateTime   || event.end?.date   || "",
    isAllDay: !!event.start?.date && !event.start?.dateTime,
  }));
}

function isHoliday(events: CalendarEvent[]): boolean {
  const holidayKeywords = ["holiday", "public holiday", "day off", "leave", "company off"];
  return events.some(event =>
    holidayKeywords.some(keyword => event.summary.toLowerCase().includes(keyword))
  );
}

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

async function isHolidayForWorkspace(workspaceId: string): Promise<boolean> {
  const { data: calConfig } = await supabaseAdmin
    .from("slack_configs")
    .select("google_calendar_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const calendarId = calConfig?.google_calendar_id ?? process.env.GOOGLE_CALENDAR_ID!;

  try {
    const events = await getTodayEvents(calendarId);
    console.log(`📅 [${workspaceId}] Today's events:`, events.map(e => e.summary));
    return isHoliday(events);
  } catch (err: any) {
    console.error(`⚠️  [${workspaceId}] Calendar check failed for ${calendarId} — proceeding as non-holiday:`, err.message);
    return false;
  }
}

async function processWorkspace(workspaceId: string): Promise<string> {
  if (await isHolidayForWorkspace(workspaceId)) return "holiday";

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
  const todayEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();

  const { data: checklists } = await supabaseAdmin
    .from("checklists")
    .select("id, title, department_id, checklist_departments(department_id), checklist_slack_configs(reminder_url)")
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

  // Build a URL-keyed map: a checklist's own reminder_url (if any) always wins
  // and skips department fan-out entirely; otherwise fan out per department as
  // before, but bucket by the RESOLVED url so departments/checklists sharing a
  // fallback channel only ever produce one message, not one each.
  const urlMap = new Map<string, Set<string>>();
  const deptUrlCache = new Map<number, string | null>();
  let workspaceDefaultUrl: string | null | undefined; // undefined = not yet fetched

  const addTitle = (url: string | null | undefined, title: string) => {
    if (!url) return;
    if (!urlMap.has(url)) urlMap.set(url, new Set());
    urlMap.get(url)!.add(title);
  };

  for (const cl of unfilled) {
    const ownUrl = (cl as any).checklist_slack_configs?.reminder_url as string | null | undefined;

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
        workspaceDefaultUrl = await getWebhookUrl(null, null, "reminder", workspaceId);
      }
      addTitle(workspaceDefaultUrl, cl.title);
      continue;
    }

    for (const deptId of deptIds) {
      if (!deptUrlCache.has(deptId)) {
        deptUrlCache.set(deptId, await getWebhookUrl(null, deptId, "reminder", workspaceId));
      }
      addTitle(deptUrlCache.get(deptId), cl.title);
    }
  }

  let sent = 0;
  for (const [url, titleSet] of urlMap) {
    await sendReminder(url, Array.from(titleSet));
    sent++;
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
```

**Decided:** `checklist_slack_configs(reminder_url)` is batched directly into the existing `checklists` select (one query per workspace) rather than calling a separate per-checklist helper — this avoids N extra round-trips. `deptUrlCache`/`workspaceDefaultUrl` caching is included (not optional) since it costs nothing and avoids redundant identical queries within a single run.

---

## 9. `app/admin/types.ts` — full relevant section

```ts
export type SlackChannelConfig = {
  bot_token:     string | null;
  slack_team_id: string | null;
  approval_url:  string | null;
  security_url:  string | null;
  reminder_url:  string | null;
};

// kept so any existing import of the old name still resolves
export type DepartmentSlackConfigs = SlackChannelConfig;

export type Checklist = {
  id: number;
  title: string;
  created_by: string;
  created_at: string;
  is_large_checklist?: boolean;
  department_id?: number | null;
  checklist_sections?: ChecklistSection[];
  checklist_departments?: { department_id: number }[];
  checklist_slack_configs: SlackChannelConfig | null;
};

export type Department = {
  id: number;
  name: string;
  created_at: string;
  department_slack_configs: SlackChannelConfig | null;
};
```

**Decided:** `checklist_slack_configs` on `Checklist` is required-but-nullable (`SlackChannelConfig | null`), matching `Department`'s existing pattern exactly — not optional (`?:`) — because the API route in §10 always selects it, so every `Checklist` object that comes from the network genuinely has this field, just possibly `null`.

---

## 10. `app/api/checklists/route.ts` — full file

Only the `GET` handler's `select(...)` call changes; `POST` is untouched.

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  let query = supabaseAdmin
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*)), checklist_departments(department_id), checklist_slack_configs(*)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  if (!ctx.isMainAdmin) {
    if (ctx.assignedChecklists.length === 0) return NextResponse.json([]);
    query = query.in("id", ctx.assignedChecklists);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!ctx.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { title, sections, created_by, department_ids } = await req.json();

  if (!Array.isArray(department_ids) || department_ids.length === 0) {
    return NextResponse.json({ error: "少なくとも1つの部署を選択してください。" }, { status: 400 });
  }

  const { data: cl, error: clErr } = await supabaseAdmin
    .from("checklists")
    .insert({
      title,
      created_by,
      is_large_checklist: department_ids.length > 1,
      department_id: null,
      workspace_id: ctx.workspaceId,
    })
    .select()
    .single();
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  const { error: deptErr } = await supabaseAdmin
    .from("checklist_departments")
    .insert(department_ids.map((dId: number) => ({ checklist_id: cl.id, department_id: dId })));
  if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 });

  for (const sec of sections) {
    const { data: secRow, error: secErr } = await supabaseAdmin
      .from("checklist_sections")
      .insert({ checklist_id: cl.id, title: sec.title, order_index: sec.order_index })
      .select()
      .single();
    if (secErr) return NextResponse.json({ error: secErr.message }, { status: 500 });

    if (sec.tasks?.length) {
      const items = sec.tasks.map((t: any) => ({
        checklist_id: cl.id,
        section_id:   secRow.id,
        label:        t.label,
        order_index:  t.order_index,
      }));
      const { error: itemErr } = await supabaseAdmin.from("checklist_items").insert(items);
      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: cl.id }, { status: 201 });
}
```

---

## 11. `app/admin/SlackConnectPanel.tsx` — no changes

Already fully generic (`connectedMap`, `installUrl`, `botConnected`, `showConnected`, `note` props). Reused as-is in §12.

---

## 12. `app/admin/SettingsTab.tsx` — add a new section

`SettingsTab.tsx` already imports `useRouter`/`useSearchParams` at the top (used by the existing `SlackSection`) — no new imports needed for those. Add one import:

```ts
import { type SlackChannelConfig } from "./types";
import { SlackConnectPanel } from "./SlackConnectPanel";
```

(`SlackConnectPanel` may already be imported if you wired the department-style import in earlier work — check before duplicating.)

Add this new component anywhere among the other section functions (`SlackSection`, `GoogleCalendarSection`, `SubAdminsSection`) — it mirrors `DepartmentsTab.tsx`'s exact modal pattern (same fixed-overlay markup, same `pendingOpen…`-on-redirect state flow), just keyed by checklist instead of department:

```tsx
// ─── Checklist-level Slack config ─────────────────────────────────────────────

type ChecklistWithSlack = {
  id: number;
  title: string;
  checklist_slack_configs: SlackChannelConfig | null;
};

function ChecklistSlackSection({ workspaceSlug }: { workspaceSlug: string }) {
  const [checklists, setChecklists]                   = useState<ChecklistWithSlack[]>([]);
  const [loading, setLoading]                         = useState(true);
  const [slackConfigChecklistId, setSlackConfigChecklistId] = useState<number | null>(null);
  const [showSlackConnected, setShowSlackConnected]   = useState<string | null>(null);
  const [slackErrorMsg, setSlackErrorMsg]             = useState<string | null>(null);
  const [pendingOpenChecklistId, setPendingOpenChecklistId] = useState<number | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("slack_connected");
  const justConnectedChecklistId = Number(searchParams.get("checklist_id")) || null;
  const slackError = searchParams.get("slack_error");

  useEffect(() => {
    if (!justConnected && !slackError) return;
    if (justConnected) setShowSlackConnected(justConnected);
    if (justConnectedChecklistId) setPendingOpenChecklistId(justConnectedChecklistId);
    if (slackError) setSlackErrorMsg(slackError);
    setTimeout(() => { setShowSlackConnected(null); setSlackErrorMsg(null); }, 5000);
    router.replace("/admin?tab=settings", { scroll: false });
  }, [justConnected, slackError]);

  useEffect(() => {
    if (checklists.length > 0 && pendingOpenChecklistId) {
      setSlackConfigChecklistId(pendingOpenChecklistId);
      setPendingOpenChecklistId(null);
    }
  }, [checklists.length, pendingOpenChecklistId]);

  useEffect(() => {
    fetch("/api/checklists")
      .then(r => r.json())
      .then(data => { setChecklists(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const modalChecklist = checklists.find(c => c.id === slackConfigChecklistId) ?? null;

  if (loading) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  return (
    <div>
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">
        チェックリスト別Slack連携
      </div>
      <div className="text-xs text-[#9688c0] mb-6">
        特定のチェックリストに専用のSlackチャンネルを接続できます。設定すると、部署・ワークスペースの設定より優先されます。
      </div>

      {slackErrorMsg && (
        <div className="text-xs text-[#dc2626] font-semibold mb-5 bg-[#fff5f5] border border-[#fecaca] rounded-lg px-4 py-2.5">
          ✗ Slack接続に失敗しました: {slackErrorMsg}。もう一度お試しください。
        </div>
      )}

      {checklists.length === 0 ? (
        <div className="text-sm text-[#a696f2] py-5.5 text-center">チェックリストがまだありません。</div>
      ) : (
        <div className="space-y-2">
          {checklists.map(cl => (
            <div
              key={cl.id}
              className="flex items-center justify-between gap-2 sm:gap-4 py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl border-[1.5px] border-[#ede9fe] bg-[#faf9ff]"
            >
              <div className="text-sm font-semibold text-[#1a1035] truncate">{cl.title}</div>
              <button
                className={`shrink-0 text-[10px] sm:text-xs rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer border font-semibold ${cl.checklist_slack_configs?.bot_token ? "text-[#059669] bg-[#ecfdf5] border-[#6ee7b7]" : "text-[#4a5568] bg-[#f8fafc] border-[#cbd5e1]"}`}
                onClick={() => setSlackConfigChecklistId(cl.id)}
              >
                Slack
              </button>
            </div>
          ))}
        </div>
      )}

      {modalChecklist && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setSlackConfigChecklistId(null); }}
        >
          <div className="bg-white rounded-2xl border-[1.5px] border-[#dfd5fb] shadow-[0_8px_40px_rgba(79,53,190,0.18)] w-full max-w-lg p-6 sm:p-8 relative">
            <button
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#a696f2] hover:text-[#6a5d8e] hover:bg-[#f5f0ff] rounded-lg bg-transparent border-none cursor-pointer text-base transition-colors duration-120"
              onClick={() => setSlackConfigChecklistId(null)}
            >
              ✕
            </button>

            <div className="text-lg font-bold text-[#1a1035] pr-8 mb-4">{modalChecklist.title}</div>

            <SlackConnectPanel
              connectedMap={modalChecklist.checklist_slack_configs ?? {}}
              installUrl={ch => `/api/slack/install?workspace=${workspaceSlug}&channel=${ch}&checklist_id=${modalChecklist.id}`}
              botConnected={!!modalChecklist.checklist_slack_configs?.bot_token}
              showConnected={showSlackConnected}
              note="「接続」をクリックしてSlackでアクセスを許可すると、このチェックリストのWebhook URLがデータベースに自動的に保存されます。部署・ワークスペースの設定より優先されます。"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

Then inside the main `SettingsTab` component's returned JSX, add a fourth card matching the existing three exactly:

```tsx
export function SettingsTab({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="max-w-150 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">設定</div>
      <div className="text-sm text-[#6a5d8e] mb-11">Slack連携とサブ管理者の設定を行います。</div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-4 sm:p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <SlackSection workspaceSlug={workspaceSlug} />
      </div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-4 sm:p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <ChecklistSlackSection workspaceSlug={workspaceSlug} />
      </div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-4 sm:p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <GoogleCalendarSection />
      </div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-4 sm:p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <SubAdminsSection />
      </div>
    </div>
  );
}
```

(Placed right after `<SlackSection />` since it's conceptually "more Slack config," before the unrelated Google Calendar / sub-admin cards — reorder if you'd rather have it elsewhere.)

---

## 13. Implementation order

1. **Migration (§2)** — everything else reads/writes this table.
2. **`lib/slack-helpers.ts` (§3)** — shared resolution logic every server-side change depends on.
3. **`install` + `oauth/callback` routes (§4–5)** — needed before any UI can create a checklist-level connection to test against.
4. **`interactivity/route.ts` (§6)** — small, isolated; do it while the OAuth-route context is fresh.
5. **`checklist/route.ts` (§7)** — depends on step 2's new signature.
6. **`cron/daily-check/route.ts` (§8)** — highest-risk change; do it once step 2 is confirmed correct.
7. **UI last (§9–12)** — `types.ts`, `checklists/route.ts` select, `SettingsTab.tsx` — purely a way to populate the table from step 1 via the routes from step 3, so it has nothing to drive until those exist.
