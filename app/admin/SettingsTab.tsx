"use client";

import { useEffect, useState } from "react";

// ─── Slack settings ───────────────────────────────────────────────────────────

type Fields = {
  bot_token: string;
  approval_url: string;
  security_url: string;
  reminder_url: string;
};

const EMPTY: Fields = { bot_token: "", approval_url: "", security_url: "", reminder_url: "" };
type FieldKey = keyof Fields;

function FieldRow({
  label, fieldKey, value, placeholder, isPassword, onSave,
}: {
  label: string; fieldKey: FieldKey; value: string;
  placeholder: string; isPassword?: boolean;
  onSave: (key: FieldKey, val: string) => Promise<void>;
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [showPw, setShowPw]     = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const handleEdit = () => { setDraft(value); setEditing(true); setError(""); setSaved(false); };
  const handleCancel = () => { setDraft(value); setEditing(false); setError(""); };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await onSave(fieldKey, draft);
      setSaved(true); setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputType = isPassword ? (showPw ? "text" : "password") : "text";

  return (
    <div className="mb-6.5">
      <div className="flex items-center justify-between mb-2.25">
        <span className="text-sm font-semibold text-[#4b3d80]">{label}</span>
      </div>
      <div className="flex gap-2 items-center">
        <input
          className={`flex-1 border-[1.5px] ${editing ? "border-[#a78bfa]" : "border-[#ccc0fa]"} rounded-[10px] py-2.75 px-3.75 text-sm ${editing ? "text-[#1a1035]" : "text-[#6a5d8e]"} outline-none ${editing ? "bg-white" : "bg-[#faf9ff]"} font-mono box-border transition-all duration-150 ${editing ? "shadow-[0_0_0_3px_rgba(167,139,250,0.2)]" : "shadow-none"}`}
          type={inputType}
          placeholder={placeholder}
          value={editing ? draft : (value || "")}
          onChange={e => editing && setDraft(e.target.value)}
          readOnly={!editing}
          autoComplete="off"
        />
        {isPassword && (
          <button
            className="bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-3.25 cursor-pointer text-sm leading-none text-[#6a5d8e] shrink-0"
            onClick={() => setShowPw(p => !p)}
          >
            {showPw ? "🚫" : "👁"}
          </button>
        )}
        {!editing ? (
          <button
            className="text-sm font-medium text-[#4b3d80] bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-4.5 cursor-pointer font-[inherit] shrink-0"
            onClick={handleEdit}
          >
            編集
          </button>
        ) : (
          <>
            <button
              className="text-sm text-[#6a5d8e] bg-transparent border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-4 cursor-pointer font-[inherit] shrink-0"
              onClick={handleCancel}
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              className="text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-4.5 cursor-pointer font-[inherit] shrink-0 shadow-[0_2px_10px_rgba(109,40,217,0.28)]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </>
        )}
      </div>
      {saved && <div className="text-xs text-[#059669] font-semibold mt-1.5 flex items-center gap-1">✓ 保存しました</div>}
      {error && <div className="text-xs text-[#dc2626] mt-1.5 font-medium">⚠ {error}</div>}
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

      {/* Add new sub-admin */}
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

      {/* Sub-admin list */}
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

export function SettingsTab() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { setFields({ ...EMPTY, ...data }); setLoading(false); })
      .catch(() => { setLoadError("設定の読み込みに失敗しました。"); setLoading(false); });
  }, []);

  const handleSaveField = async (key: FieldKey, val: string) => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: val }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "保存に失敗しました");
    setFields(p => ({ ...p, [key]: val }));
  };

  return (
    <div className="max-w-150 -my-5 mx-auto py-14 px-8">
      <div className="text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">設定</div>
      <div className="text-sm text-[#6a5d8e] mb-11">Slack連携とサブ管理者の設定を行います。</div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[#c4b5fd]">読み込み中…</div>
      ) : loadError ? (
        <div className="text-xs text-[#dc2626] font-medium">⚠ {loadError}</div>
      ) : (
        <>
          <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
            <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-6.5">Slack設定</div>
            <FieldRow label="ボットトークン" fieldKey="bot_token" value={fields.bot_token} placeholder="xoxb-..." isPassword onSave={handleSaveField} />
            <div className="h-[1.5px] bg-[linear-gradient(90deg,#dfd5fb_0%,#ede9fe_100%)] my-5.5" />
            <FieldRow label="承認チャンネル Webhook URL" fieldKey="approval_url" value={fields.approval_url} placeholder="https://hooks.slack.com/services/..." onSave={handleSaveField} />
            <div className="h-[1.5px] bg-[linear-gradient(90deg,#dfd5fb_0%,#ede9fe_100%)] my-5.5" />
            <FieldRow label="セキュリティチャンネル Webhook URL" fieldKey="security_url" value={fields.security_url} placeholder="https://hooks.slack.com/services/..." onSave={handleSaveField} />
            <div className="h-[1.5px] bg-[linear-gradient(90deg,#dfd5fb_0%,#ede9fe_100%)] my-5.5" />
            <FieldRow label="リマインダーチャンネル Webhook URL" fieldKey="reminder_url" value={fields.reminder_url} placeholder="https://hooks.slack.com/services/..." onSave={handleSaveField} />
          </div>

          <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-8 mb-5.5 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
            <SubAdminsSection />
          </div>
        </>
      )}
    </div>
  );
}
