"use client";

import { useEffect, useState } from "react";

type Fields = {
  bot_token: string;
  approval_url: string;
  security_url: string;
  reminder_url: string;
};

const EMPTY: Fields = { bot_token: "", approval_url: "", security_url: "", reminder_url: "" };

type FieldKey = keyof Fields;

function FieldRow({
  label,
  fieldKey,
  value,
  placeholder,
  isPassword,
  onSave,
}: {
  label: string;
  fieldKey: FieldKey;
  value: string;
  placeholder: string;
  isPassword?: boolean;
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
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const S: Record<string, React.CSSProperties> = {
    wrap:       { marginBottom: 22 },
    labelRow:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    label:      { fontSize: 13, fontWeight: 600, color: "#4b3d80" },
    inputWrap:  { display: "flex", gap: 8, alignItems: "center" },
    input: {
      flex: 1,
      border: `1.5px solid ${editing ? "#a78bfa" : "#ddd6fe"}`,
      borderRadius: 10, padding: "10px 14px", fontSize: 14,
      color: editing ? "#1a1035" : "#7c6fa0",
      outline: "none",
      background: editing ? "#fff" : "#faf9ff",
      fontFamily: "monospace", boxSizing: "border-box" as const,
      transition: "all 0.15s",
      boxShadow: editing ? "0 0 0 3px rgba(167,139,250,0.18)" : "none"
    },
    eyeBtn: {
      background: "#f5f0ff", border: "1.5px solid #ddd6fe",
      borderRadius: 10, padding: "9px 12px", cursor: "pointer",
      fontSize: 14, lineHeight: 1, color: "#7c6fa0", flexShrink: 0
    },
    editBtn: {
      fontSize: 13, fontWeight: 500, color: "#4b3d80", background: "#f5f0ff",
      border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "9px 16px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0
    },
    saveBtn: {
      fontSize: 13, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      border: "none", borderRadius: 10, padding: "9px 16px",
      cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
      boxShadow: "0 2px 8px rgba(109,40,217,0.25)"
    },
    cancelBtn: {
      fontSize: 13, color: "#7c6fa0", background: "none",
      border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0
    },
    savedBadge: {
      fontSize: 12, color: "#059669", fontWeight: 600, marginTop: 5,
      display: "flex", alignItems: "center", gap: 4
    },
    errText: { fontSize: 12, color: "#dc2626", marginTop: 5, fontWeight: 500 },
  };

  const inputType = isPassword ? (showPw ? "text" : "password") : "text";
  const displayValue = editing ? draft : (value || "");

  return (
    <div style={S.wrap}>
      <div style={S.labelRow}>
        <span style={S.label}>{label}</span>
      </div>

      <div style={S.inputWrap}>
        <input
          style={S.input}
          type={inputType}
          placeholder={placeholder}
          value={displayValue}
          onChange={e => editing && setDraft(e.target.value)}
          readOnly={!editing}
          autoComplete="off"
        />

        {isPassword && (
          <button style={S.eyeBtn} onClick={() => setShowPw(p => !p)} title={showPw ? "非表示" : "表示"}>
            {showPw ? "🚫" : "👁"}
          </button>
        )}

        {!editing ? (
          <button style={S.editBtn} onClick={handleEdit}>編集</button>
        ) : (
          <>
            <button style={S.cancelBtn} onClick={handleCancel} disabled={saving}>キャンセル</button>
            <button style={S.saveBtn}   onClick={handleSave}  disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </button>
          </>
        )}
      </div>

      {saved  && <div style={S.savedBadge}>✓ 保存しました</div>}
      {error  && <div style={S.errText}>⚠ {error}</div>}
    </div>
  );
}

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
    main: { maxWidth: 600, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 6 },
    pageSub: { fontSize: 14, color: "#7c6fa0", marginBottom: 40 },
    section: {
      border: "1.5px solid #ede9fe", borderRadius: 16, padding: "28px",
      marginBottom: 20, background: "#fff",
      boxShadow: "0 2px 16px rgba(79,53,190,0.07)"
    },
    secLabel: {
      fontSize: 10, fontWeight: 700, color: "#a78bfa",
      textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 24
    },
    divider: { height: "1.5px", background: "linear-gradient(90deg, #ede9fe 0%, #f5f0ff 100%)", margin: "20px 0" },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>設定</div>
      <div style={S.pageSub}>Slack連携のトークンとWebhook URLを設定します。</div>

      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#c4b5fd" }}>読み込み中…</div>
      ) : loadError ? (
        <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 500 }}>⚠ {loadError}</div>
      ) : (
        <div style={S.section}>
          <div style={S.secLabel}>Slack設定</div>

          <FieldRow
            label="ボットトークン"
            fieldKey="bot_token"
            value={fields.bot_token}
            placeholder="xoxb-..."
            isPassword
            onSave={handleSaveField}
          />
          <div style={S.divider} />
          <FieldRow
            label="承認チャンネル Webhook URL"
            fieldKey="approval_url"
            value={fields.approval_url}
            placeholder="https://hooks.slack.com/services/..."
            onSave={handleSaveField}
          />
          <div style={S.divider} />
          <FieldRow
            label="セキュリティチャンネル Webhook URL"
            fieldKey="security_url"
            value={fields.security_url}
            placeholder="https://hooks.slack.com/services/..."
            onSave={handleSaveField}
          />
          <div style={S.divider} />
          <FieldRow
            label="リマインダーチャンネル Webhook URL"
            fieldKey="reminder_url"
            value={fields.reminder_url}
            placeholder="https://hooks.slack.com/services/..."
            onSave={handleSaveField}
          />
        </div>
      )}
    </div>
  );
}