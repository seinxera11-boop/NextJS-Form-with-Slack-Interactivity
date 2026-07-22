# In-App Holiday Tracking — Replaces Google Calendar — Change Plan

Every section below is complete, final code — copy it in as-is. This fully replaces
the Google Calendar integration used by the daily-check cron's holiday check.

## 1. Summary

The daily-check cron currently decides "is today a holiday" by querying a Google
Calendar via a service account — a source of nearly every bug we've chased this
session: wrong calendar ID, subscribed-vs-owned calendar confusion, English-only
keyword matching against event titles that are actually in Japanese, service-account
sharing permissions, etc.

This replaces all of that with a plain, workspace-scoped table of holiday dates,
managed directly in your own Settings tab. No external API, no service account, no
keyword matching — just "does today's date exist in this table for this workspace."

**Exactly three existing files touch Google Calendar today, confirmed by search:**
`app/api/cron/daily-check/route.ts`, `app/admin/SettingsTab.tsx`, `app/api/settings/route.ts`.
All three are rewritten below. Two new files are added: a holidays API route and its
`[id]` delete route.

No `label` field on holidays — a holiday date doesn't need a name to function; the
cron only ever checks for the date's existence.

---

## 2. Database migration

```sql
create table workspace_holidays (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  holiday_date date not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, holiday_date)
);
```

Run this in the Supabase SQL Editor before touching any code below.

---

## 3. New file: `app/api/holidays/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("workspace_holidays")
    .select("id, holiday_date")
    .eq("workspace_id", ctx.workspaceId)
    .order("holiday_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawDates: unknown[] = Array.isArray(body?.dates) ? body.dates : [];

  const validDates = rawDates.filter(
    (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
  );

  if (validDates.length === 0) {
    return NextResponse.json(
      { error: "有効な日付がありません（YYYY-MM-DD形式で指定してください）" },
      { status: 400 }
    );
  }

  const rows = validDates.map(holiday_date => ({ workspace_id: ctx.workspaceId, holiday_date }));

  const { error } = await supabaseAdmin
    .from("workspace_holidays")
    .upsert(rows, { onConflict: "workspace_id,holiday_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, added: validDates.length }, { status: 201 });
}
```

**One endpoint handles both single-date add and bulk import** — the UI always sends
`{ dates: [...] }`, whether that array has 1 entry or 20. `upsert` with
`onConflict: "workspace_id,holiday_date"` means re-adding a date already present (e.g.
re-pasting a corrected list) never errors, it just no-ops on the duplicate.

---

## 4. New file: `app/api/holidays/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const id = Number((await params).id);

  const { error } = await supabaseAdmin
    .from("workspace_holidays")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

The `.eq("workspace_id", ctx.workspaceId)` on the delete matters for security — without
it, anyone could delete another workspace's holiday row just by guessing/incrementing
an `id` in the URL.

---

## 5. `app/api/cron/daily-check/route.ts` — full file

Google Calendar entirely removed: no `googleapis` import, no `CalendarEvent` type, no
`getTodayEvents()`, no `isHoliday()` keyword matching. `isHolidayForWorkspace()`
becomes a single Supabase query. Everything else (the `reminder_runs` claim, the
checklist/department URL-map reminder logic, the route handler) is unchanged from
what you have today.

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWebhookUrl } from "@/lib/slack-helpers";

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
    // unique constraint violation — another invocation already claimed today
    // for this workspace (e.g. a Vercel retry). Skip entirely to avoid resending.
    console.log(`[daily-check] workspace ${workspaceId} already processed today — skipping`);
    return "already_processed_today";
  }

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

---

## 6. `app/api/settings/route.ts` — full file

`google_calendar_id` removed from `GET`; the `PATCH` handler is deleted entirely
(it only ever existed to save the calendar ID).

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { data: config } = await supabaseAdmin
    .from("slack_configs")
    .select("bot_token, approval_url, security_url, reminder_url")
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  return NextResponse.json({
    bot_token:    config?.bot_token    ?? null,
    approval_url: config?.approval_url ?? null,
    security_url: config?.security_url ?? null,
    reminder_url: config?.reminder_url ?? null,
  });
}
```

**Decided:** removing the `PATCH` export entirely is safe — its only caller was
`GoogleCalendarSection` in `SettingsTab.tsx`, which is deleted in the next section.

---

## 7. `app/admin/SettingsTab.tsx` — remove `GoogleCalendarSection`, add `HolidaysSection`

**Delete this entire function** (currently sits between the `SlackSection` and
`SubAdminsSection` blocks, under the `// ─── Google Calendar ───` comment):

```tsx
// ─── Google Calendar ──────────────────────────────────────────────────────────

function GoogleCalendarSection() {
  // ...the whole function, calendarId state, handleSave, the input + save button, all of it...
}
```

**Replace it with this new section**, in the same place:

```tsx
// ─── Workspace holidays ────────────────────────────────────────────────────────

type Holiday = { id: number; holiday_date: string };

function HolidaysSection() {
  const [holidays, setHolidays]     = useState<Holiday[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newDate, setNewDate]       = useState("");
  const [bulkText, setBulkText]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [saved, setSaved]           = useState(false);

  const fetchHolidays = () => {
    fetch("/api/holidays")
      .then(r => r.json())
      .then(data => { setHolidays(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchHolidays(); }, []);

  const addDates = async (dates: string[]) => {
    setSaving(true); setSaveError(""); setSaved(false);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "保存に失敗しました");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchHolidays();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSingle = () => {
    if (!newDate) return;
    addDates([newDate]);
    setNewDate("");
  };

  const handleBulkImport = () => {
    const lines = bulkText
      .split("\n")
      .map(l => l.trim())
      .filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l));

    if (lines.length === 0) {
      setSaveError("YYYY-MM-DD形式の日付が見つかりませんでした。");
      return;
    }
    addDates(lines);
    setBulkText("");
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    fetchHolidays();
  };

  if (loading) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  return (
    <div>
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">休日設定</div>
      <div className="text-xs text-[#9688c0] mb-6">
        登録した日付は、毎日のリマインダーcronでスキップされます。
      </div>

      {saved && (
        <div className="text-xs text-[#059669] font-semibold mb-5 bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-4 py-2.5">
          ✓ 保存されました。
        </div>
      )}
      {saveError && (
        <div className="text-xs text-[#dc2626] font-semibold mb-5 bg-[#fff5f5] border border-[#fecaca] rounded-lg px-4 py-2.5">
          ✗ {saveError}
        </div>
      )}

      <div className="flex gap-2 items-center mb-5">
        <input
          type="date"
          className="flex-1 border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-3.75 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit]"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
        />
        <button
          className={`shrink-0 text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-5 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(109,40,217,0.28)] ${saving || !newDate ? "opacity-60" : ""}`}
          onClick={handleAddSingle}
          disabled={saving || !newDate}
        >
          追加
        </button>
      </div>

      <div className="mb-2 text-xs text-[#7c6fa0]">まとめて追加（1行に1日付、YYYY-MM-DD形式）：</div>
      <div className="flex gap-2 mb-6">
        <textarea
          className="flex-1 border-[1.5px] border-[#ccc0fa] focus:border-[#a78bfa] rounded-[10px] py-2.5 px-3.25 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit] transition-colors duration-150"
          placeholder={"2026-01-01\n2026-01-12"}
          rows={4}
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
        />
        <button
          className={`shrink-0 self-start text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-4.5 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(109,40,217,0.28)] ${saving || !bulkText.trim() ? "opacity-60" : ""}`}
          onClick={handleBulkImport}
          disabled={saving || !bulkText.trim()}
        >
          インポート
        </button>
      </div>

      {holidays.length === 0 ? (
        <div className="text-sm text-[#a696f2] py-5.5 text-center">登録された休日はありません。</div>
      ) : (
        <div className="space-y-1.5">
          {holidays.map(h => (
            <div
              key={h.id}
              className="flex items-center justify-between py-2.5 px-3.5 rounded-lg border-[1.5px] border-[#ede9fe] bg-[#faf9ff]"
            >
              <span className="text-sm text-[#1a1035] font-medium">{h.holiday_date}</span>
              <button
                className="text-[10px] sm:text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg py-1 px-2.5 cursor-pointer"
                onClick={() => handleDelete(h.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Then update the main `SettingsTab` render** — replace the `<GoogleCalendarSection />`
card with `<HolidaysSection />`:

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
        <HolidaysSection />
      </div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-4 sm:p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <SubAdminsSection />
      </div>
    </div>
  );
}
```

(This assumes `ChecklistSlackSection` from the earlier checklist-Slack-config plan is
already in this file — if you haven't done that one yet, just omit that card.)

---

## 8. Optional cleanup (not required for correctness — do whenever convenient)

- Remove `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` from
  `.env.local` and Vercel's environment variables — nothing reads them anymore.
- `npm uninstall googleapis` — no file imports it after this change.
- Optionally drop the now-unused `google_calendar_id` column from `slack_configs`:
  ```sql
  alter table slack_configs drop column google_calendar_id;
  ```
  Leaving it in place is completely harmless if you'd rather not touch schema further
  right now — nothing reads or writes it anymore either way.

---

## 9. Implementation order

1. **Migration (§2)** — the new table everything else depends on.
2. **`app/api/holidays/route.ts` + `app/api/holidays/[id]/route.ts` (§3–4)** — needed
   before the UI has anything to call.
3. **`app/api/cron/daily-check/route.ts` (§5)** — the actual behavior change; safe to
   deploy on its own even before the UI exists, since an empty `workspace_holidays`
   table just means "never a holiday" until you start adding dates.
4. **`app/api/settings/route.ts` (§6)** — small, isolated.
5. **`app/admin/SettingsTab.tsx` (§7)** — UI last, since it's just a way to populate
   the table via the routes from step 2.
6. **Optional cleanup (§8)** — whenever, no urgency.
