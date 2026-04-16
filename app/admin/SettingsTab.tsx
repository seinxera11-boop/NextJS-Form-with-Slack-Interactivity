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

  // Keep draft in sync if parent value changes (e.g. on initial load)
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
    wrap:       { marginBottom: 20 },
    labelRow:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
    label:      { fontSize: 13, fontWeight: 500, color: "#555" },
    inputWrap:  { display: "flex", gap: 8, alignItems: "center" },
    input:      { flex: 1, border: `1px solid ${editing ? "#111" : "#e5e5e5"}`, borderRadius: 8, padding: "10px 13px", fontSize: 14, color: editing ? "#111" : "#555", outline: "none", background: editing ? "#fff" : "#fafafa", fontFamily: "monospace", boxSizing: "border-box" as const, transition: "border-color 0.15s" },
    eyeBtn:     { background: "none", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 11px", cursor: "pointer", fontSize: 15, lineHeight: 1, color: "#888", flexShrink: 0 },
    editBtn:    { fontSize: 13, fontWeight: 500, color: "#555", background: "#f5f5f5", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
    saveBtn:    { fontSize: 13, fontWeight: 600, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
    cancelBtn:  { fontSize: 13, color: "#999", background: "none", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
    savedBadge: { fontSize: 12, color: "#16a34a", fontWeight: 500, marginTop: 5 },
    errText:    { fontSize: 12, color: "#dc2626", marginTop: 5 },
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

        {/* Eye toggle — only for password fields */}
        {isPassword && (
          <button style={S.eyeBtn} onClick={() => setShowPw(p => !p)} title={showPw ? "Hide" : "Show"}>
            {showPw ? "🚫" : "👁"}
          </button>
        )}

        {/* Edit / Save / Cancel */}
        {!editing ? (
          <button style={S.editBtn} onClick={handleEdit}>Edit</button>
        ) : (
          <>
            <button style={S.cancelBtn} onClick={handleCancel} disabled={saving}>Cancel</button>
            <button style={S.saveBtn}   onClick={handleSave}  disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>

      {saved  && <div style={S.savedBadge}>✓ Saved</div>}
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
      .catch(() => { setLoadError("Failed to load settings."); setLoading(false); });
  }, []);

  const handleSaveField = async (key: FieldKey, val: string) => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: val }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Save failed");
    // Update local state so the saved value is reflected
    setFields(p => ({ ...p, [key]: val }));
  };

  const S: Record<string, React.CSSProperties> = {
    main:      { maxWidth: 600, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSub:   { fontSize: 14, color: "#999", marginBottom: 40 },
    section:   { border: "1px solid #f0f0f0", borderRadius: 12, padding: "28px", marginBottom: 20 },
    secLabel:  { fontSize: 12, fontWeight: 600, color: "#bbb", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 24 },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>Settings</div>
      <div style={S.pageSub}>Configure Slack integration tokens and webhook URLs.</div>

      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#ccc" }}>Loading…</div>
      ) : loadError ? (
        <div style={{ fontSize: 13, color: "#dc2626" }}>⚠ {loadError}</div>
      ) : (
        <div style={S.section}>
          <div style={S.secLabel}>Slack Configuration</div>

          <FieldRow
            label="Bot Token"
            fieldKey="bot_token"
            value={fields.bot_token}
            placeholder="xoxb-..."
            isPassword
            onSave={handleSaveField}
          />
          <FieldRow
            label="Approval Channel Webhook URL"
            fieldKey="approval_url"
            value={fields.approval_url}
            placeholder="https://hooks.slack.com/services/..."
            onSave={handleSaveField}
          />
          <FieldRow
            label="Security Channel Webhook URL"
            fieldKey="security_url"
            value={fields.security_url}
            placeholder="https://hooks.slack.com/services/..."
            onSave={handleSaveField}
          />
          <FieldRow
            label="Reminder Channel Webhook URL"
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