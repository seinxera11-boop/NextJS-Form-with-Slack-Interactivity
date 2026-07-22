"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlackConnectPanel } from "./SlackConnectPanel";
import { type SlackChannelConfig } from "./types";
import { isValidEmail } from "@/lib/utils";

// ─── Slack connection ──────────────────────────────────────────────────────────

type SlackFields = {
  bot_token:    string | null;
  approval_url: string | null;
  security_url: string | null;
  reminder_url: string | null;
};

function SlackSection({ workspaceSlug }: { workspaceSlug: string }) {
  const [fields, setFields]             = useState<SlackFields>({ bot_token: null, approval_url: null, security_url: null, reminder_url: null });
  const [loading, setLoading]           = useState(true);
  const [showConnected, setShowConnected] = useState(false);
  const router                          = useRouter();
  const searchParams                    = useSearchParams();
  const justConnected                   = searchParams.get("slack_connected");
  const slackError                      = searchParams.get("slack_error");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { setFields(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [justConnected]);

  useEffect(() => {
    if (!justConnected && !slackError) return;
    if (justConnected) setShowConnected(true);
    const t = setTimeout(() => setShowConnected(false), 5000);
    router.replace("/admin?tab=settings", { scroll: false });
    return () => clearTimeout(t);
  }, [justConnected, slackError]);

  const installUrl = (channelParam: string) =>
    `/api/slack/install?workspace=${workspaceSlug}&channel=${channelParam}`;

  const botConnected = !!fields.bot_token;

  if (loading) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  return (
    <div>
      {slackError && (
        <div className="text-xs text-[#dc2626] font-semibold mb-5 bg-[#fff5f5] border border-[#fecaca] rounded-lg px-4 py-2.5">
          {slackError === "no_webhook_url"
            ? "✗ SlackからWebhook URLが返されませんでした。Slackアプリの設定でIncoming Webhooksが有効になっているか確認してください（api.slack.com → アプリ → Features → Incoming Webhooks → オン）。"
            : slackError === "workspace_not_found"
            ? "✗ ワークスペースが見つかりません。管理者に連絡してください。"
            : slackError === "missing_code"
            ? "✗ 認証がキャンセルされたか、タイムアウトしました。もう一度お試しください。"
            : `✗ Slack接続に失敗しました: ${slackError}。もう一度お試しください。`}
        </div>
      )}

      <SlackConnectPanel
        connectedMap={fields}
        installUrl={installUrl}
        botConnected={botConnected}
        showConnected={showConnected ? justConnected : null}
        note="「接続」をクリックしてSlackでアクセスを許可すると、そのチャンネルのWebhook URLがデータベースに自動的に保存されます — 手動でコピーする必要はありません。"
      />
    </div>
  );
}

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
      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">Google カレンダー</div>
      <div className="text-xs text-[#9688c0] mb-6">
        祝日カレンダーは、祝日にリマインダーをスキップするために毎日のcronで使用されます。カレンダーIDはGoogle カレンダー → 設定 → カレンダーの統合 で確認できます。
      </div>

      {saved && (
        <div className="text-xs text-[#059669] font-semibold mb-5 bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-4 py-2.5">
          ✓ カレンダーIDが保存されました。
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
        空白の場合は、環境変数 <span className="font-mono">GOOGLE_CALENDAR_ID</span> が使用されます。
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
  const [editEmail,  setEditEmail]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState("");

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
    if (!isValidEmail(newEmail)) {
      setAddError("メールアドレスの形式が正しくありません");
      setTimeout(() => setAddError(""), 2000);
      return;
    }
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
      setTimeout(() => setAddError(""),2000);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (sa: SubAdmin) => {
    setEditingId(sa.id);
    setEditCls(sa.sub_admin_checklists.map(c => c.checklist_id));
    setEditEmail(sa.email);
    setSaveError("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editEmail.trim()) return;
    if (!isValidEmail(editEmail)) { setSaveError("メールアドレスの形式が正しくありません"); return; }
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`/api/sub-admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editEmail.trim(), checklist_ids: editCls }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "保存に失敗しました");
      setEditingId(null);
      await fetchAll();
    } catch (err: any) {
      setSaveError(err.message);
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
              {isEditing ? (
                <>
                  <input
                    className="w-full max-w-xs border-[1.5px] border-[#ccc0fa] rounded-lg py-1.5 px-3 text-sm outline-none bg-[#faf9ff] font-[inherit] text-[#1a1035] mb-2 focus:border-[#6d28d9]"
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    placeholder="sub-admin@example.com"
                  />
                  <div className="flex gap-1.75 flex-wrap mt-2.5">
                    {checklists.map(cl => (
                      <button key={cl.id} className={pill(editCls.includes(cl.id))} onClick={() => setEditCls(p => toggle(p, cl.id))}>
                        {cl.title}
                      </button>
                    ))}
                  </div>
                  {saveError && <div className="text-xs text-[#dc2626] mt-1.75 font-medium">⚠ {saveError}</div>}
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-[#1a1035] mb-1.75">{sa.email}</div>
                  <div className="text-xs text-[#7a6aaa]">
                    {assignedTitles.length > 0 ? assignedTitles.join(" · ") : "チェックリスト未割り当て"}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {isEditing ? (
                <>
                  <button
                    className={`text-[10px] sm:text-xs font-semibold text-white bg-[linear-gradient(135deg,#059669_0%,#047857_100%)] border-none rounded-lg py-1 sm:py-1.5 px-3 sm:px-4 cursor-pointer font-[inherit] ${saving || !editEmail.trim() ? "opacity-60" : ""}`}
                    onClick={() => handleSaveEdit(sa.id)}
                    disabled={saving || !editEmail.trim()}
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                  <button
                    className="text-[10px] sm:text-xs text-[#6a5d8e] bg-transparent border-[1.5px] border-[#ccc0fa] rounded-lg py-1 sm:py-1.5 px-2.5 sm:px-3.5 cursor-pointer font-[inherit]"
                    onClick={() => { setEditingId(null); setSaveError(""); }}
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="text-[10px] sm:text-xs text-[#4b3d80] bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-lg py-1 sm:py-1.5 px-2.5 sm:px-3.5 cursor-pointer font-[inherit]"
                    onClick={() => startEdit(sa)}
                  >
                    編集
                  </button>
                  <button
                    className="text-[10px] sm:text-xs text-[#dc2626] bg-[#fff5f5] border-[1.5px] border-[#fecaca] rounded-lg py-1 sm:py-1.5 px-2.5 sm:px-3.5 cursor-pointer font-[inherit]"
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
