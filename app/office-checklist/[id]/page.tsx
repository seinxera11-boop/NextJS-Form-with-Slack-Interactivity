"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type ItemType = "checkbox" | "text" | "textarea";

type ChecklistTask = {
  id: number;
  label: string;
  type: ItemType;
  required: boolean;
  order_index: number;
};

type ChecklistSection = {
  id: number;
  title: string;
  order_index: number;
  checklist_items: ChecklistTask[];
};

type Checklist = {
  id: number;
  title: string;
  is_large_checklist: boolean;
  department_id: number | null;
  checklist_sections: ChecklistSection[];
};

type Department = { id: number; name: string };
type OrgUser    = { id: number; name: string; department_id: number };

// Step type for large flow only
type LargeStep = "department" | "user" | "form";

export default function ChecklistPage() {
  const params = useParams();
  const id = params?.id as string;

  // ── Core data ──────────────────────────────────────────────────────────────
  const [checklist,    setChecklist]    = useState<Checklist | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [values,       setValues]       = useState<Record<number, string>>({});

  // ── Department / user ──────────────────────────────────────────────────────
  const [departments,     setDepartments]     = useState<Department[]>([]);
  const [orgUsers,        setOrgUsers]        = useState<OrgUser[]>([]);
  const [selectedDeptId,  setSelectedDeptId]  = useState<string>("");
  const [selectedUserId,  setSelectedUserId]  = useState<string>("");
  const [isOther,         setIsOther]         = useState(false);
  const [otherName,       setOtherName]       = useState("");
  const [loadingUsers,    setLoadingUsers]    = useState(false);

  // ── Large flow step ────────────────────────────────────────────────────────
  const [largeStep, setLargeStep] = useState<LargeStep>("department");

  // ── Submission ─────────────────────────────────────────────────────────────
  const [reason,      setReason]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");

  // ── Computed helpers ───────────────────────────────────────────────────────
  const sections = checklist
    ? [...checklist.checklist_sections].sort((a, b) => a.order_index - b.order_index)
    : [];

  const allTasks     = sections.flatMap(s => [...s.checklist_items].sort((a, b) => a.order_index - b.order_index));
  const checkboxTasks = allTasks.filter(t => t.type === "checkbox");
  const checked       = checkboxTasks.filter(t => values[t.id] === "true").length;
  const total         = checkboxTasks.length;
  const pct           = total > 0 ? Math.round((checked / total) * 100) : 0;

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/checklists/${id}`).then(r => r.json()),
      fetch("/api/departments").then(r => r.json()),
    ]).then(([clData, deptData]) => {
      if (clData.error) throw new Error(clData.error);

      setChecklist(clData);
      setDepartments(deptData || []);

      // Initialise form values
      const init: Record<number, string> = {};
      (clData.checklist_sections || []).forEach((sec: ChecklistSection) =>
        sec.checklist_items.forEach(item => {
          init[item.id] = item.type === "checkbox" ? "false" : "";
        })
      );
      setValues(init);

      // For the SMALL flow: pre-select the fixed department
      if (!clData.is_large_checklist && clData.department_id) {
        setSelectedDeptId(String(clData.department_id));
      }

      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  // ── Load users when dept changes ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedDeptId) {
      setOrgUsers([]); setSelectedUserId(""); setIsOther(false); return;
    }
    setLoadingUsers(true);
    fetch(`/api/org-users?department_id=${selectedDeptId}`)
      .then(r => r.json())
      .then(data => {
        setOrgUsers(data || []);
        setSelectedUserId("");
        setIsOther(false);
        setLoadingUsers(false);
      });
  }, [selectedDeptId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleCheck = (id: number) =>
    setValues(p => ({ ...p, [id]: p[id] === "true" ? "false" : "true" }));

  const handleText = (id: number, val: string) =>
    setValues(p => ({ ...p, [id]: val }));

  // Large flow navigation
  const handleDeptContinue = () => {
    if (!selectedDeptId) { alert("部署を選択してください。"); return; }
    setLargeStep("user");
  };

  const handleUserContinue = () => {
    if (!isOther && !selectedUserId) { alert("ユーザーを選択するか、「その他」を選んでください。"); return; }
    if (isOther && !otherName.trim())  { alert("お名前を入力してください。"); return; }
    setLargeStep("form");
  };

  const handleSubmit = async () => {
    // Validate required text/textarea fields
    const missing = allTasks.filter(
      it => it.required && it.type !== "checkbox" && !values[it.id]?.trim()
    );
    if (missing.length > 0) {
      alert(`以下の項目を入力してください：${missing.map(m => m.label).join("、")}`);
      return;
    }

    // For small flow: user selection is inline so validate here too
    if (!checklist?.is_large_checklist) {
      if (!isOther && !selectedUserId) { alert("ユーザーを選択するか、「その他」を選んでください。"); return; }
      if (isOther && !otherName.trim())  { alert("お名前を入力してください。"); return; }
    }

    const resolvedName = isOther
      ? otherName.trim()
      : (orgUsers.find(u => String(u.id) === selectedUserId)?.name || "");

    setSubmitting(true);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id:  checklist?.id,
          submitted_by:  resolvedName,
          department_id: Number(selectedDeptId),
          user_id:       isOther ? null : Number(selectedUserId),
          reason,
          values,
          completedItems: checked,
          totalItems:     total,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSubmittedBy(resolvedName);
      setSubmitted(true);
    } catch (err: any) {
      alert("送信に失敗しました：" + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    const init: Record<number, string> = {};
    allTasks.forEach(it => { init[it.id] = it.type === "checkbox" ? "false" : ""; });
    setValues(init);
    setSelectedUserId(""); setIsOther(false);
    setOtherName(""); setReason("");
    setSubmitted(false); setSubmittedBy("");

    if (checklist?.is_large_checklist) {
      setSelectedDeptId("");
      setLargeStep("department");
    }
    // Small flow: keep selectedDeptId (it comes from the DB, not the user)
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S: Record<string, React.CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f5f0fe 0%, #e8e0fc 50%, #f8f0ff 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#1a1035",
    },
    header: {
      borderBottom: "1.5px solid #dfd5fb",
      padding: "18px 32px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "rgba(250,247,255,0.92)",
      backdropFilter: "blur(10px)",
    },
    headerDot: {
      width: 10, height: 10, borderRadius: "50%",
      background: "linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)",
    },
    headerName: { fontSize: 17, fontWeight: 800, color: "#4f35be", letterSpacing: "-0.03em" },
    main:       { maxWidth: 620, margin: "0 auto", padding: "52px 24px" },
    title:      { fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 28 },

    // Progress bar
    progressWrap:  { marginBottom: 36 },
    progressLabel: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7a6aaa", marginBottom: 9, fontWeight: 500 },
    progressTrack: { height: 7, background: "#dfd5fb", borderRadius: 100, overflow: "hidden" },
    progressFill:  { height: "100%", background: "linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)", borderRadius: 100, transition: "width 0.3s" },

    // Selection cards
    selCard: {
      border: "1.5px solid #dfd5fb", borderRadius: 16, padding: "24px",
      marginBottom: 18, background: "#fff",
      boxShadow: "0 4px 22px rgba(79,53,190,0.10)",
    },
    selLabel: { fontSize: 14, fontWeight: 600, color: "#4b3d80", marginBottom: 12, display: "block" },

    // Inputs
    select: {
      width: "100%", border: "1.5px solid #ccc0fa", borderRadius: 10,
      padding: "12px 15px", fontSize: 16, color: "#1a1035", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", cursor: "pointer",
      transition: "border-color 0.15s",
    },
    selectDisabled: {
      width: "100%", border: "1.5px solid #dfd5fb", borderRadius: 10,
      padding: "12px 15px", fontSize: 16, color: "#a696f2", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", cursor: "not-allowed",
    },
    textInput: {
      width: "100%", border: "1.5px solid #ccc0fa", borderRadius: 10,
      padding: "11px 14px", fontSize: 16, color: "#1a1035", outline: "none",
      background: "#faf9ff", fontFamily: "inherit",
      boxSizing: "border-box" as const, resize: "none" as const,
      transition: "border-color 0.15s",
    },

    // Other button
    otherBtn: {
      marginTop: 11, fontSize: 14, color: "#6d28d9",
      background: "#ede9fe", border: "1.5px solid #ccc0fa",
      borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit",
    },
    otherBtnActive: {
      marginTop: 11, fontSize: 14, color: "#fff",
      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      border: "1.5px solid #7c3aed",
      borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit",
    },

    // User inline section (small flow)
    userInlineCard: {
      border: "1.5px solid #dfd5fb", borderRadius: 14, padding: "20px 24px",
      marginBottom: 22, background: "#fff",
      boxShadow: "0 2px 14px rgba(79,53,190,0.09)",
    },

    // Read-only dept chip (small flow)
    deptReadOnly: {
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      border: "1px solid #ccc0fa", borderRadius: 10, padding: "7px 16px",
      fontSize: 14, color: "#4b3d80", fontWeight: 500, marginBottom: 22,
    },

    // Sections
    secCard: {
      border: "1.5px solid #dfd5fb", borderRadius: 14, overflow: "hidden",
      marginBottom: 13, background: "#fff",
      boxShadow: "0 2px 14px rgba(79,53,190,0.09)",
    },
    secTitle: {
      fontSize: 15, fontWeight: 700, color: "#6d28d9",
      padding: "13px 22px", borderBottom: "1.5px solid #ede9fe",
      background: "linear-gradient(135deg, #f5f0fe 0%, #ede9fe 100%)",
    },
    itemRow:     { display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 22px", borderBottom: "1.5px solid #f5f0fe" },
    itemRowLast: { display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 22px" },
    checkbox:    { width: 17, height: 17, marginTop: 2, flexShrink: 0, cursor: "pointer", accentColor: "#7c3aed" },
    itemLabel:   { fontSize: 16, color: "#1a1035", lineHeight: 1.55, flex: 1 },
    itemLabelMuted: { fontSize: 16, color: "#b09af8", lineHeight: 1.55, flex: 1, textDecoration: "line-through" },
    reqStar:     { color: "#dc2626", fontSize: 13, marginLeft: 3 },

    // Summary chips (large flow step 3)
    summaryChip: {
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      border: "1px solid #ccc0fa", borderRadius: 10, padding: "7px 16px",
      fontSize: 14, color: "#4b3d80", fontWeight: 500,
    },

    // Reason card
    nameCard: {
      border: "1.5px solid #dfd5fb", borderRadius: 14, padding: "24px",
      marginBottom: 13, background: "#fff",
      boxShadow: "0 2px 14px rgba(79,53,190,0.09)",
    },
    nameLabel: { fontSize: 14, fontWeight: 600, color: "#4b3d80", marginBottom: 11, display: "block" },

    // Buttons
    submitBtn: {
      width: "100%",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      color: "#fff", border: "none", borderRadius: 12, padding: "16px 0",
      fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 4px 18px rgba(109,40,217,0.38)", transition: "opacity 0.15s",
    },
    submitBtnDisabled: {
      width: "100%", background: "#ddd6fe", color: "#a894f0",
      border: "none", borderRadius: 12, padding: "16px 0",
      fontSize: 16, fontWeight: 700, cursor: "not-allowed", fontFamily: "inherit",
    },
    continueBtn: {
      width: "100%",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      color: "#fff", border: "none", borderRadius: 12, padding: "15px 0",
      fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      marginTop: 14, boxShadow: "0 3px 14px rgba(109,40,217,0.33)",
    },
    backLink: {
      fontSize: 14, color: "#6a5d8e", background: "none", border: "none",
      cursor: "pointer", fontFamily: "inherit", padding: "8px 0",
      display: "inline-block", marginBottom: 18,
    },

    // Success
    successWrap: { textAlign: "center" as const, padding: "80px 0" },
    successIcon: {
      width: 68, height: 68, borderRadius: "50%",
      background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 30, margin: "0 auto 28px", color: "#fff",
    },
    centerMsg: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontSize: 16, color: "#8c70e8" },
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) return <div style={S.root}><div style={S.centerMsg}>読み込み中…</div></div>;
  if (error || !checklist) return <div style={S.root}><div style={S.centerMsg}>チェックリストが見つかりません。</div></div>;

  const isLarge = checklist.is_large_checklist;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>オフィス管理者</span></div>
      <div style={S.main}>
        <div style={S.successWrap}>
          <div style={S.successIcon}>✓</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1035", marginBottom: 12 }}>送信が完了しました</div>
          <p style={{ fontSize: 15, color: "#6a5d8e", lineHeight: 1.8, marginBottom: 40 }}>
            回答が記録されました。<br />
            <strong style={{ color: "#4f35be" }}>{submittedBy}</strong>さん、ありがとうございました。
          </p>
          <button
            style={{ fontSize: 15, color: "#4b3d80", background: "#ede9fe", border: "1.5px solid #ccc0fa", borderRadius: 10, padding: "12px 26px", cursor: "pointer", fontFamily: "inherit" }}
            onClick={handleReset}
          >
            別の回答を送信する
          </button>
        </div>
      </div>
    </div>
  );

  // ── Helper: user selector (shared between both flows) ──────────────────────
  const renderUserSelector = () => (
    <div>
      {loadingUsers ? (
        <div style={{ fontSize: 15, color: "#a696f2", padding: "8px 0" }}>ユーザーを読み込み中…</div>
      ) : (
        <>
          <select
            style={isOther ? S.selectDisabled : S.select}
            value={selectedUserId}
            disabled={isOther}
            onChange={e => { setSelectedUserId(e.target.value); setIsOther(false); }}
            onFocus={e => (e.target.style.borderColor = "#a78bfa")}
            onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
          >
            <option value="">ユーザーを選択してください…</option>
            {orgUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <button
              style={isOther ? S.otherBtnActive : S.otherBtn}
              onClick={() => { setIsOther(v => !v); setSelectedUserId(""); setOtherName(""); }}
            >
              {isOther ? "✓ その他" : "その他"}
            </button>
            {isOther && <span style={{ fontSize: 14, color: "#7a6aaa" }}>以下にお名前を入力してください</span>}
          </div>

          {isOther && (
            <input
              type="text"
              style={{ ...S.textInput, marginTop: 10 }}
              placeholder="お名前を入力してください…"
              value={otherName}
              onChange={e => setOtherName(e.target.value)}
              autoFocus
              onFocus={e => (e.target.style.borderColor = "#a78bfa")}
              onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
            />
          )}
        </>
      )}
    </div>
  );

  // ── Helper: checklist form body ────────────────────────────────────────────
  const renderForm = () => (
    <>
      {total > 0 && (
        <div style={S.progressWrap}>
          <div style={S.progressLabel}>
            <span>進捗</span>
            <span style={{ color: "#6d28d9", fontWeight: 700 }}>{checked}/{total} 完了</span>
          </div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${pct}%` }} />
          </div>
        </div>
      )}

      {sections.map(sec => {
        const tasks = [...sec.checklist_items].sort((a, b) => a.order_index - b.order_index);
        return (
          <div key={sec.id} style={S.secCard}>
            <div style={S.secTitle}>{sec.title}</div>
            {tasks.map((item, idx) => {
              const isLast  = idx === tasks.length - 1;
              const isDone  = item.type === "checkbox" && values[item.id] === "true";
              return (
                <div key={item.id} style={isLast ? S.itemRowLast : S.itemRow}>
                  {item.type === "checkbox" ? (
                    <>
                      <input type="checkbox" style={S.checkbox} checked={values[item.id] === "true"} onChange={() => toggleCheck(item.id)} />
                      <span style={isDone ? S.itemLabelMuted : S.itemLabel}>{item.label}</span>
                    </>
                  ) : item.type === "text" ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ ...S.itemLabel, marginBottom: 8 }}>{item.label}{item.required && <span style={S.reqStar}>*</span>}</div>
                      <input type="text" style={S.textInput} placeholder="回答を入力してください…" value={values[item.id] || ""} onChange={e => handleText(item.id, e.target.value)} onFocus={e => (e.target.style.borderColor = "#a78bfa")} onBlur={e => (e.target.style.borderColor = "#ddd6fe")} />
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div style={{ ...S.itemLabel, marginBottom: 8 }}>{item.label}{item.required && <span style={S.reqStar}>*</span>}</div>
                      <textarea style={{ ...S.textInput, minHeight: 80 }} placeholder="回答を入力してください…" value={values[item.id] || ""} onChange={e => handleText(item.id, e.target.value)} onFocus={e => (e.target.style.borderColor = "#a78bfa")} onBlur={e => (e.target.style.borderColor = "#ddd6fe")} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={S.nameCard}>
        <label style={S.nameLabel}>理由</label>
        <textarea
          style={{ ...S.textInput, minHeight: 80 }}
          placeholder="送信理由を入力してください"
          value={reason}
          onChange={e => setReason(e.target.value)}
          onFocus={e => (e.target.style.borderColor = "#a78bfa")}
          onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
        />
      </div>

      <button style={submitting ? S.submitBtnDisabled : S.submitBtn} onClick={handleSubmit} disabled={submitting}>
        {submitting ? "送信中…" : "チェックリストを送信"}
      </button>
    </>
  );

  // ── Dept name for display ──────────────────────────────────────────────────
  const deptName = departments.find(d => String(d.id) === selectedDeptId)?.name || "";
  const userName = isOther ? otherName : (orgUsers.find(u => String(u.id) === selectedUserId)?.name || "");

  // ══════════════════════════════════════════════════════════════════════════
  // SMALL FLOW — form + user selector shown immediately, dept is hidden/fixed
  // ══════════════════════════════════════════════════════════════════════════
  if (!isLarge) {
    return (
      <div style={S.root}>
        <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>オフィス管理者</span></div>
        <div style={S.main}>
          <div style={S.title}>{checklist.title}</div>

          {/* Read-only dept chip */}
          {deptName && (
            <div style={{ marginBottom: 20 }}>
              <span style={S.deptReadOnly}>
                <span style={{ color: "#a78bfa" }}>部署</span> {deptName}
              </span>
            </div>
          )}

          {/* Inline user selector */}
          <div style={S.userInlineCard}>
            <label style={S.selLabel}>ユーザー <span style={{ color: "#dc2626" }}>*</span></label>
            {renderUserSelector()}
          </div>

          {/* Checklist form rendered immediately */}
          {renderForm()}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LARGE FLOW — step-by-step: dept → user → form
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>オフィス管理者</span></div>
      <div style={S.main}>
        <div style={S.title}>{checklist.title}</div>

        {/* ── Step 1: Department ── */}
        {largeStep === "department" && (
          <div style={S.selCard}>
            <label style={S.selLabel}>部署 <span style={{ color: "#dc2626" }}>*</span></label>
            <select
              style={S.select}
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(e.target.value)}
              onFocus={e => (e.target.style.borderColor = "#a78bfa")}
              onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
            >
              <option value="">部署を選択してください…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button style={S.continueBtn} onClick={handleDeptContinue}>次へ</button>
          </div>
        )}

        {/* ── Step 2: User ── */}
        {largeStep === "user" && (
          <div style={S.selCard}>
            <button style={S.backLink} onClick={() => setLargeStep("department")}>← {deptName}</button>
            <label style={S.selLabel}>ユーザー <span style={{ color: "#dc2626" }}>*</span></label>
            {renderUserSelector()}
            <button style={S.continueBtn} onClick={handleUserContinue}>次へ</button>
          </div>
        )}

        {/* ── Step 3: Form ── */}
        {largeStep === "form" && (
          <>
            <div style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              <span style={S.summaryChip}><span style={{ color: "#a78bfa" }}>部署</span> {deptName}</span>
              <span style={S.summaryChip}><span style={{ color: "#a78bfa" }}>ユーザー</span> {userName}</span>
              <button style={{ ...S.backLink, margin: 0, alignSelf: "center" }} onClick={() => setLargeStep("user")}>変更</button>
            </div>
            {renderForm()}
          </>
        )}
      </div>
    </div>
  );
}