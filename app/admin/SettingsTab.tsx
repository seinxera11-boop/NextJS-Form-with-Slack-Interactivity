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

  const S: Record<string, React.CSSProperties> = {
    wrap:       { marginBottom: 26 },
    labelRow:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
    label:      { fontSize: 14, fontWeight: 600, color: "#4b3d80" },
    inputWrap:  { display: "flex", gap: 8, alignItems: "center" },
    input: {
      flex: 1, border: `1.5px solid ${editing ? "#a78bfa" : "#ccc0fa"}`,
      borderRadius: 10, padding: "11px 15px", fontSize: 15,
      color: editing ? "#1a1035" : "#6a5d8e", outline: "none",
      background: editing ? "#fff" : "#faf9ff",
      fontFamily: "monospace", boxSizing: "border-box" as const,
      transition: "all 0.15s",
      boxShadow: editing ? "0 0 0 3px rgba(167,139,250,0.2)" : "none"
    },
    eyeBtn: {
      background: "#ede9fe", border: "1.5px solid #ccc0fa",
      borderRadius: 10, padding: "10px 13px", cursor: "pointer",
      fontSize: 15, lineHeight: 1, color: "#6a5d8e", flexShrink: 0
    },
    editBtn: {
      fontSize: 14, fontWeight: 500, color: "#4b3d80", background: "#ede9fe",
      border: "1.5px solid #ccc0fa", borderRadius: 10,
      padding: "10px 18px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0
    },
    saveBtn: {
      fontSize: 14, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      border: "none", borderRadius: 10, padding: "10px 18px",
      cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
      boxShadow: "0 2px 10px rgba(109,40,217,0.28)"
    },
    cancelBtn: {
      fontSize: 14, color: "#6a5d8e", background: "none",
      border: "1.5px solid #ccc0fa", borderRadius: 10,
      padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0
    },
    savedBadge: { fontSize: 13, color: "#059669", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 4 },
    errText: { fontSize: 13, color: "#dc2626", marginTop: 6, fontWeight: 500 },
  };

  const inputType = isPassword ? (showPw ? "text" : "password") : "text";

  return (
    <div style={S.wrap}>
      <div style={S.labelRow}><span style={S.label}>{label}</span></div>
      <div style={S.inputWrap}>
        <input
          style={S.input} type={inputType} placeholder={placeholder}
          value={editing ? draft : (value || "")}
          onChange={e => editing && setDraft(e.target.value)}
          readOnly={!editing} autoComplete="off"
        />
        {isPassword && (
          <button style={S.eyeBtn} onClick={() => setShowPw(p => !p)}>
            {showPw ? "🚫" : "👁"}
          </button>
        )}
        {!editing ? (
          <button style={S.editBtn} onClick={handleEdit}>編集</button>
        ) : (
          <>
            <button style={S.cancelBtn} onClick={handleCancel} disabled={saving}>キャンセル</button>
            <button style={S.saveBtn} onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</button>
          </>
        )}
      </div>
      {saved && <div style={S.savedBadge}>✓ 保存しました</div>}
      {error && <div style={S.errText}>⚠ {error}</div>}
    </div>
  );
}

// ─── Sub-admin management ─────────────────────────────────────────────────────

type SubAdmin = {
  id: string;
  email: string;
  sub_admin_departments: { department_id: number }[];
};

type Department = { id: number; name: string };

function SubAdminsSection() {
  const [subAdmins, setSubAdmins]     = useState<SubAdmin[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);
  const [newEmail, setNewEmail]       = useState("");
  const [newDepts, setNewDepts]       = useState<number[]>([]);
  const [adding, setAdding]           = useState(false);
  const [addError, setAddError]       = useState("");
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editDepts, setEditDepts]     = useState<number[]>([]);
  const [saving, setSaving]           = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [saRes, deptRes] = await Promise.all([
      fetch("/api/sub-admins"),
      fetch("/api/departments"),
    ]);
    const [saData, deptData] = await Promise.all([saRes.json(), deptRes.json()]);
    setSubAdmins(Array.isArray(saData) ? saData : []);
    setDepartments(Array.isArray(deptData) ? deptData : []);
    setLoading(false);
  };

  const toggleDept = (list: number[], id: number): number[] =>
    list.includes(id) ? list.filter(d => d !== id) : [...list, id];

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true); setAddError("");
    try {
      const res = await fetch("/api/sub-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), department_ids: newDepts }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "追加に失敗しました");
      setNewEmail(""); setNewDepts([]);
      await fetchAll();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (sa: SubAdmin) => {
    setEditingId(sa.id);
    setEditDepts(sa.sub_admin_departments.map(d => d.department_id));
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/sub-admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_ids: editDepts }),
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

  const S: Record<string, React.CSSProperties> = {
    secLabel: {
      fontSize: 13, fontWeight: 700, color: "#3e249e",
      textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 22
    },
    addRow: { display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" as const, marginBottom: 18 },
    input: {
      flex: 1, minWidth: 220,
      border: "1.5px solid #ccc0fa", borderRadius: 10, padding: "10px 15px",
      fontSize: 15, color: "#1a1035", outline: "none", background: "#faf9ff",
      fontFamily: "inherit",
    },
    addBtn: {
      fontSize: 14, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      border: "none", borderRadius: 10, padding: "10px 20px",
      cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 2px 10px rgba(109,40,217,0.28)", flexShrink: 0
    },
    deptPills: { display: "flex", gap: 7, flexWrap: "wrap" as const, marginTop: 10 },
    row: {
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      padding: "16px 0", borderBottom: "1px solid #ede9fe", gap: 12
    },
    email: { fontSize: 15, fontWeight: 500, color: "#1a1035", marginBottom: 7 },
    deptList: { fontSize: 13, color: "#7a6aaa" },
    actionBtns: { display: "flex", gap: 6, flexShrink: 0 },
    editBtn: {
      fontSize: 13, color: "#4b3d80", background: "#ede9fe",
      border: "1.5px solid #ccc0fa", borderRadius: 8,
      padding: "6px 14px", cursor: "pointer", fontFamily: "inherit"
    },
    deleteBtn: {
      fontSize: 13, color: "#dc2626", background: "#fff5f5",
      border: "1.5px solid #fecaca", borderRadius: 8,
      padding: "6px 14px", cursor: "pointer", fontFamily: "inherit"
    },
    saveBtn: {
      fontSize: 13, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      border: "none", borderRadius: 8, padding: "6px 16px",
      cursor: "pointer", fontFamily: "inherit"
    },
    cancelBtn: {
      fontSize: 13, color: "#6a5d8e", background: "none",
      border: "1.5px solid #ccc0fa", borderRadius: 8,
      padding: "6px 14px", cursor: "pointer", fontFamily: "inherit"
    },
    errText: { fontSize: 13, color: "#dc2626", marginTop: 7, fontWeight: 500 },
    emptyText: { fontSize: 14, color: "#a696f2", padding: "22px 0", textAlign: "center" as const },
  };

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 13, fontWeight: 500, padding: "5px 14px", borderRadius: 100,
    cursor: "pointer", border: `1.5px solid ${active ? "#c4b5fd" : "#ccc0fa"}`,
    background: active ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)" : "#faf9ff",
    color: active ? "#4f35be" : "#7a6aaa",
    transition: "all 0.12s",
  });

  const deptName = (id: number) => departments.find(d => d.id === id)?.name ?? String(id);

  return (
    <div>
      <div style={S.secLabel}>サブ管理者</div>

      {/* Add new sub-admin */}
      <div>
        <div style={S.addRow}>
          <input
            style={S.input}
            type="email"
            placeholder="sub-admin@example.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <button style={{ ...S.addBtn, opacity: adding || !newEmail ? 0.6 : 1 }} onClick={handleAdd} disabled={adding || !newEmail}>
            {adding ? "追加中…" : "+ 追加"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#7c6fa0", marginBottom: 8 }}>アクセス可能な部署を選択：</div>
        <div style={S.deptPills}>
          {departments.map(d => (
            <button key={d.id} style={pill(newDepts.includes(d.id))} onClick={() => setNewDepts(p => toggleDept(p, d.id))}>
              {d.name}
            </button>
          ))}
        </div>
        {addError && <div style={S.errText}>⚠ {addError}</div>}
      </div>

      <div style={{ height: 1, background: "#f0ebff", margin: "20px 0" }} />

      {/* Sub-admin list */}
      {loading ? (
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "#c4b5fd" }}>読み込み中…</div>
      ) : subAdmins.length === 0 ? (
        <div style={S.emptyText}>サブ管理者はまだ登録されていません。</div>
      ) : subAdmins.map(sa => {
        const isEditing = editingId === sa.id;
        const assignedNames = sa.sub_admin_departments.map(d => deptName(d.department_id));
        return (
          <div key={sa.id} style={S.row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.email}>{sa.email}</div>
              {isEditing ? (
                <div style={S.deptPills}>
                  {departments.map(d => (
                    <button key={d.id} style={pill(editDepts.includes(d.id))} onClick={() => setEditDepts(p => toggleDept(p, d.id))}>
                      {d.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={S.deptList}>
                  {assignedNames.length > 0 ? assignedNames.join(" · ") : "部署未割り当て"}
                </div>
              )}
            </div>
            <div style={S.actionBtns}>
              {isEditing ? (
                <>
                  <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={() => handleSaveEdit(sa.id)} disabled={saving}>
                    {saving ? "保存中…" : "保存"}
                  </button>
                  <button style={S.cancelBtn} onClick={() => setEditingId(null)}>キャンセル</button>
                </>
              ) : (
                <>
                  <button style={S.editBtn} onClick={() => startEdit(sa)}>編集</button>
                  <button style={S.deleteBtn} onClick={() => handleDelete(sa.id, sa.email)}>削除</button>
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

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 600, margin: "-20px auto", padding: "56px 32px" },
    pageTitle: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 8 },
    pageSub: { fontSize: 15, color: "#6a5d8e", marginBottom: 44 },
    section: {
      border: "1.5px solid #dfd5fb", borderRadius: 16, padding: "32px",
      marginBottom: 22, background: "#fff",
      boxShadow: "0 2px 18px rgba(79,53,190,0.10)"
    },
    secLabel: {
      fontSize: 13, fontWeight: 700, color: "#3e249e",
      textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 26
    },
    divider: { height: "1.5px", background: "linear-gradient(90deg, #dfd5fb 0%, #ede9fe 100%)", margin: "22px 0" },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>設定</div>
      <div style={S.pageSub}>Slack連携とサブ管理者の設定を行います。</div>

      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#c4b5fd" }}>読み込み中…</div>
      ) : loadError ? (
        <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>⚠ {loadError}</div>
      ) : (
        <>
          <div style={S.section}>
            <div style={S.secLabel}>Slack設定</div>
            <FieldRow label="ボットトークン" fieldKey="bot_token" value={fields.bot_token} placeholder="xoxb-..." isPassword onSave={handleSaveField} />
            <div style={S.divider} />
            <FieldRow label="承認チャンネル Webhook URL" fieldKey="approval_url" value={fields.approval_url} placeholder="https://hooks.slack.com/services/..." onSave={handleSaveField} />
            <div style={S.divider} />
            <FieldRow label="セキュリティチャンネル Webhook URL" fieldKey="security_url" value={fields.security_url} placeholder="https://hooks.slack.com/services/..." onSave={handleSaveField} />
            <div style={S.divider} />
            <FieldRow label="リマインダーチャンネル Webhook URL" fieldKey="reminder_url" value={fields.reminder_url} placeholder="https://hooks.slack.com/services/..." onSave={handleSaveField} />
          </div>

          <div style={S.section}>
            <SubAdminsSection />
          </div>
        </>
      )}
    </div>
  );
}
