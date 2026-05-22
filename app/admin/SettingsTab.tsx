"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// ─── Slack connection ──────────────────────────────────────────────────────────

type SlackFields = {
  bot_token:    string | null;
  approval_url: string | null;
  security_url: string | null;
  reminder_url: string | null;
};

type ChannelConfig = {
  key:          keyof SlackFields;
  label:        string;
  description:  string;
  channelParam: "approval" | "security" | "reminder";
};

const CHANNELS: ChannelConfig[] = [
  { key: "approval_url", label: "Approval Channel", description: "Receives checklist submissions with approve button",   channelParam: "approval" },
  { key: "security_url", label: "Security Channel", description: "Receives exit log with missing task details",          channelParam: "security" },
  { key: "reminder_url", label: "Reminder Channel", description: "Receives daily reminder if no submission by day end",  channelParam: "reminder" },
];

function SlackSection({ workspaceSlug }: { workspaceSlug: string }) {
  const [fields, setFields]   = useState<SlackFields>({ bot_token: null, approval_url: null, security_url: null, reminder_url: null });
  const [loading, setLoading] = useState(true);
  const searchParams          = useSearchParams();
  const justConnected         = searchParams.get("slack_connected");
  const slackError            = searchParams.get("slack_error");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { setFields(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [justConnected]);

  const installUrl = (channelParam: string) =>
    `/api/slack/install?workspace=${workspaceSlug}&channel=${channelParam}`;

  const botConnected = !!fields.bot_token;

  if (loading) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  return (
    <div>
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">Slack Integration</div>
      <div className="text-xs text-[#9688c0] mb-6">
        Connect each channel separately. Click Connect, select your Slack workspace and the channel for that notification type — the webhook URL is saved automatically.
      </div>

      {justConnected && (
        <div className="text-xs text-[#059669] font-semibold mb-5 bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-4 py-2.5">
          ✓ {justConnected} channel connected — webhook URL saved automatically.
        </div>
      )}

      {slackError && (
        <div className="text-xs text-[#dc2626] font-semibold mb-5 bg-[#fff5f5] border border-[#fecaca] rounded-lg px-4 py-2.5">
          {slackError === "no_webhook_url"
            ? "✗ Slack did not return a webhook URL. Make sure \"Incoming Webhooks\" is enabled in your Slack app settings (api.slack.com → your app → Features → Incoming Webhooks → On)."
            : slackError === "workspace_not_found"
            ? "✗ Workspace not found. Please contact your administrator."
            : slackError === "missing_code"
            ? "✗ Authorization cancelled or timed out. Please try again."
            : `✗ Slack connection failed: ${slackError}. Please try again.`}
        </div>
      )}

      {/* Bot token status */}
      <div className="flex items-center gap-2.5 mb-5 pb-5 border-b border-[#ede9fe]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${botConnected ? "bg-[#059669]" : "bg-[#d1d5db]"}`} />
        <div className="text-xs text-[#9688c0]">
          {botConnected ? "Bot token saved — app is authorized." : "Not authorized yet — connect any channel below."}
        </div>
      </div>

      {/* Per-channel rows */}
      <div className="space-y-3">
        {CHANNELS.map(ch => {
          const connected = !!fields[ch.key];
          return (
            <div key={ch.key} className="flex items-center justify-between gap-4 py-3.5 px-4 rounded-xl border-[1.5px] border-[#ede9fe] bg-[#faf9ff]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-[#059669]" : "bg-[#d1d5db]"}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1a1035]">{ch.label}</div>
                  <div className="text-xs text-[#9688c0] truncate">{ch.description}</div>
                </div>
              </div>
              <a
                href={installUrl(ch.channelParam)}
                className="shrink-0 text-xs font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] rounded-lg py-1.75 px-4 no-underline inline-flex items-center gap-1.5 shadow-[0_1px_6px_rgba(109,40,217,0.25)]"
              >
                {connected ? "Reconnect" : "Connect"}
              </a>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-[#a696f2] leading-relaxed bg-[#f5f0ff] border border-[#ede9fe] rounded-lg px-4 py-3">
        After clicking Connect and allowing access in Slack, the webhook URL for that channel is saved to the database automatically — no manual copying needed.
      </div>
    </div>
  );
}

/*
// ─── Single-connect Slack section (commented out, do not delete) ───────────────

function SlackSectionSingle({ workspaceSlug }: { workspaceSlug: string }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading]     = useState(true);
  const searchParams              = useSearchParams();
  const justConnected             = searchParams.get("slack_connected");
  const slackError                = searchParams.get("slack_error");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { setConnected(!!data.bot_token); setLoading(false); })
      .catch(() => setLoading(false));
  }, [justConnected]);

  const connectUrl = `/api/slack/install?workspace=${workspaceSlug}&channel=approval`;

  if (loading) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  return (
    <div>
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">Slack Integration</div>
      <div className="text-xs text-[#9688c0] mb-6">Connect your Slack workspace to receive notifications.</div>
      {justConnected && <div className="text-xs text-[#059669] font-semibold mb-5 bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-4 py-2.5">Connected successfully.</div>}
      {slackError && (
        <div className="text-xs text-[#dc2626] font-semibold mb-5 bg-[#fff5f5] border border-[#fecaca] rounded-lg px-4 py-2.5">
          {slackError === "workspace_not_found" ? "Workspace not found." : `Connection failed (${slackError}).`}
        </div>
      )}
      <div className="flex items-center justify-between gap-4 py-4 px-5 rounded-xl border-[1.5px] border-[#ede9fe] bg-[#faf9ff]">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${connected ? "bg-[#059669]" : "bg-[#d1d5db]"}`} />
          <div>
            <div className="text-sm font-semibold text-[#1a1035]">{connected ? "Slack Connected" : "Slack Not Connected"}</div>
            <div className="text-xs text-[#9688c0] mt-0.5">{connected ? "Bot token and webhook URL saved." : "Click Connect to authorize."}</div>
          </div>
        </div>
        <a href={connectUrl} className="shrink-0 text-xs font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] rounded-lg py-2 px-5 no-underline">
          {connected ? "Reconnect" : "Connect Slack"}
        </a>
      </div>
    </div>
  );
}
*/

// ─── Google Calendar ──────────────────────────────────────────────────────────

function GoogleCalendarSection() {
  const [calendarId, setCalendarId] = useState("");
  const [saved,      setSaved]      = useState<string | null>(null);
  const [saveError,  setSaveError]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { setCalendarId(data.google_calendar_id ?? ""); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(null); setSaveError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_calendar_id: calendarId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "保存に失敗しました");
      setSaved(calendarId);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  return (
    <div>
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">Google Calendar</div>
      <div className="text-xs text-[#9688c0] mb-6">
        Holiday calendar used by the daily cron to skip reminders on public holidays. Find the Calendar ID under Google Calendar → Settings → Integrate calendar.
      </div>

      {saved && (
        <div className="text-xs text-[#059669] font-semibold mb-5 bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-4 py-2.5">
          ✓ Calendar ID saved.
        </div>
      )}
      {saveError && (
        <div className="text-xs text-[#dc2626] font-semibold mb-5 bg-[#fff5f5] border border-[#fecaca] rounded-lg px-4 py-2.5">
          ✗ {saveError}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input
          className="flex-1 border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-3.75 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit]"
          type="text"
          placeholder="xxxxxxxx@group.calendar.google.com"
          value={calendarId}
          onChange={e => { setCalendarId(e.target.value); setSaved(null); }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
        />
        <button
          className={`shrink-0 text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-5 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(109,40,217,0.28)] ${saving || !calendarId.trim() ? "opacity-60" : ""}`}
          onClick={handleSave}
          disabled={saving || !calendarId.trim()}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>

      <div className="mt-4 text-xs text-[#a696f2] leading-relaxed bg-[#f5f0ff] border border-[#ede9fe] rounded-lg px-4 py-3">
        If left empty, falls back to the <span className="font-mono">GOOGLE_CALENDAR_ID</span> environment variable.
      </div>
    </div>
  );
}

// ─── Sub-admin management ─────────────────────────────────────────────────────

type SubAdmin = {
  id: string;
  email: string;
  sub_admin_checklists: { checklist_id: number }[];
};

type Checklist = { id: number; title: string };

function SubAdminsSection() {
  const [subAdmins,  setSubAdmins]  = useState<SubAdmin[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [newEmail,   setNewEmail]   = useState("");
  const [newCls,     setNewCls]     = useState<number[]>([]);
  const [adding,     setAdding]     = useState(false);
  const [addError,   setAddError]   = useState("");
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editCls,    setEditCls]    = useState<number[]>([]);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [saRes, clRes] = await Promise.all([
      fetch("/api/sub-admins"),
      fetch("/api/checklists"),
    ]);
    const [saData, clData] = await Promise.all([saRes.json(), clRes.json()]);
    setSubAdmins(Array.isArray(saData) ? saData : []);
    setChecklists(Array.isArray(clData) ? clData : []);
    setLoading(false);
  };

  const toggle = (list: number[], id: number): number[] =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true); setAddError("");
    try {
      const res = await fetch("/api/sub-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), checklist_ids: newCls }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "追加に失敗しました");
      setNewEmail(""); setNewCls([]);
      await fetchAll();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (sa: SubAdmin) => {
    setEditingId(sa.id);
    setEditCls(sa.sub_admin_checklists.map(c => c.checklist_id));
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/sub-admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist_ids: editCls }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setEditingId(null);
      await fetchAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`${email} を削除しますか？`)) return;
    await fetch(`/api/sub-admins/${id}`, { method: "DELETE" });
    await fetchAll();
  };

  const pill = (active: boolean) =>
    `text-xs font-medium py-1.25 px-3.5 rounded-full cursor-pointer border-[1.5px] transition-all duration-[120ms] ${active ? "border-[#c4b5fd] bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] text-[#4f35be]" : "border-[#ccc0fa] bg-[#faf9ff] text-[#7a6aaa]"}`;

  const clTitle = (id: number) => checklists.find(c => c.id === id)?.title ?? String(id);

  return (
    <div>
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-5.5">サブ管理者</div>

      <div>
        <div className="flex gap-2 items-start flex-wrap mb-4.5">
          <input
            className="flex-1 min-w-55 border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-3.75 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit]"
            type="email"
            placeholder="sub-admin@example.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <button
            className={`text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-5 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(109,40,217,0.28)] shrink-0 ${adding || !newEmail ? "opacity-60" : ""}`}
            onClick={handleAdd}
            disabled={adding || !newEmail}
          >
            {adding ? "追加中…" : "+ 追加"}
          </button>
        </div>
        <div className="text-xs text-[#7c6fa0] mb-2">アクセス可能なチェックリストを選択：</div>
        <div className="flex gap-1.75 flex-wrap mt-2.5">
          {checklists.map(cl => (
            <button key={cl.id} className={pill(newCls.includes(cl.id))} onClick={() => setNewCls(p => toggle(p, cl.id))}>
              {cl.title}
            </button>
          ))}
        </div>
        {addError && <div className="text-xs text-[#dc2626] mt-1.75 font-medium">⚠ {addError}</div>}
      </div>

      <div className="h-px bg-[#f0ebff] my-5" />

      {loading ? (
        <div className="py-5 text-center text-xs text-[#c4b5fd]">読み込み中…</div>
      ) : subAdmins.length === 0 ? (
        <div className="text-sm text-[#a696f2] py-5.5 text-center">サブ管理者はまだ登録されていません。</div>
      ) : subAdmins.map(sa => {
        const isEditing = editingId === sa.id;
        const assignedTitles = sa.sub_admin_checklists.map(c => clTitle(c.checklist_id));
        return (
          <div key={sa.id} className="flex items-start justify-between py-4 border-b border-b-[#ede9fe] gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1a1035] mb-1.75">{sa.email}</div>
              {isEditing ? (
                <div className="flex gap-1.75 flex-wrap mt-2.5">
                  {checklists.map(cl => (
                    <button key={cl.id} className={pill(editCls.includes(cl.id))} onClick={() => setEditCls(p => toggle(p, cl.id))}>
                      {cl.title}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#7a6aaa]">
                  {assignedTitles.length > 0 ? assignedTitles.join(" · ") : "チェックリスト未割り当て"}
                </div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {isEditing ? (
                <>
                  <button
                    className={`text-xs font-semibold text-white bg-[linear-gradient(135deg,#059669_0%,#047857_100%)] border-none rounded-lg py-1.5 px-4 cursor-pointer font-[inherit] ${saving ? "opacity-60" : ""}`}
                    onClick={() => handleSaveEdit(sa.id)}
                    disabled={saving}
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                  <button
                    className="text-xs text-[#6a5d8e] bg-transparent border-[1.5px] border-[#ccc0fa] rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit]"
                    onClick={() => setEditingId(null)}
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="text-xs text-[#4b3d80] bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit]"
                    onClick={() => startEdit(sa)}
                  >
                    編集
                  </button>
                  <button
                    className="text-xs text-[#dc2626] bg-[#fff5f5] border-[1.5px] border-[#fecaca] rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit]"
                    onClick={() => handleDelete(sa.id, sa.email)}
                  >
                    削除
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main SettingsTab ─────────────────────────────────────────────────────────

export function SettingsTab({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="max-w-150 -my-5 mx-auto py-14 px-8">
      <div className="text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">設定</div>
      <div className="text-sm text-[#6a5d8e] mb-11">Slack連携とサブ管理者の設定を行います。</div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <SlackSection workspaceSlug={workspaceSlug} />
      </div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <GoogleCalendarSection />
      </div>

      <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
        <SubAdminsSection />
      </div>
    </div>
  );
}
