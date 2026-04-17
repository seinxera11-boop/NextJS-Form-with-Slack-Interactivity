"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type ItemType = "checkbox" | "text" | "textarea";
type ChecklistTask = { id: number; label: string; type: ItemType; required: boolean; order_index: number; };
type ChecklistSection = { id: number; title: string; order_index: number; checklist_items: ChecklistTask[]; };
type Checklist = { id: number; title: string; checklist_sections: ChecklistSection[]; };
type Department = { id: number; name: string; };
type OrgUser = { id: number; name: string; department_id: number; };

type Step = "department" | "user" | "form";

export default function ChecklistPage() {
  const params = useParams();
  const id = params?.id as string;

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});

  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isOther, setIsOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [step, setStep] = useState<Step>("department");

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/checklists/${id}`).then(r => r.json()),
      fetch("/api/departments").then(r => r.json()),
    ]).then(([clData, deptData]) => {
      if (clData.error) throw new Error(clData.error);
      setChecklist(clData);
      const init: Record<number, string> = {};
      (clData.checklist_sections || []).forEach((sec: ChecklistSection) => {
        (sec.checklist_items || []).forEach((item: ChecklistTask) => {
          init[item.id] = item.type === "checkbox" ? "false" : "";
        });
      });
      setValues(init);
      setDepartments(deptData || []);
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

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

  const sections = checklist
    ? [...checklist.checklist_sections].sort((a, b) => a.order_index - b.order_index)
    : [];
  const allTasks = sections.flatMap(s =>
    [...s.checklist_items].sort((a, b) => a.order_index - b.order_index)
  );
  const checkboxTasks = allTasks.filter(t => t.type === "checkbox");
  const checked = checkboxTasks.filter(t => values[t.id] === "true").length;
  const total = checkboxTasks.length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const toggleCheck = (id: number) =>
    setValues(p => ({ ...p, [id]: p[id] === "true" ? "false" : "true" }));
  const handleText = (id: number, val: string) =>
    setValues(p => ({ ...p, [id]: val }));

  const handleDeptContinue = () => {
    if (!selectedDeptId) { alert("部署を選択してください。"); return; }
    setStep("user");
  };

  const handleUserContinue = () => {
    if (!isOther && !selectedUserId) { alert("ユーザーを選択するか、「その他」を選んでください。"); return; }
    if (isOther && !otherName.trim()) { alert("お名前を入力してください。"); return; }
    setStep("form");
  };

  const handleSubmit = async () => {
    const missing = allTasks.filter(
      it => it.required && it.type !== "checkbox" && !values[it.id]?.trim()
    );
    if (missing.length > 0) {
      alert(`以下の項目を入力してください：${missing.map(m => m.label).join("、")}`);
      return;
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
    setSelectedDeptId(""); setSelectedUserId(""); setIsOther(false);
    setOtherName(""); setReason(""); setSubmitted(false); setSubmittedBy("");
    setStep("department");
  };

  const S: Record<string, React.CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #faf9ff 0%, #f0ebff 50%, #fdf4ff 100%)",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1035"
    },
    header: {
      borderBottom: "1.5px solid #ede9fe", padding: "16px 32px",
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)"
    },
    headerDot: {
      width: 8, height: 8, borderRadius: "50%",
      background: "linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)"
    },
    headerName: { fontSize: 15, fontWeight: 800, color: "#4f35be", letterSpacing: "-0.03em" },
    main: { maxWidth: 620, margin: "0 auto", padding: "48px 24px" },
    title: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 24 },
    progressWrap: { marginBottom: 32 },
    progressLabel: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9688c0", marginBottom: 8, fontWeight: 500 },
    progressTrack: { height: 6, background: "#ede9fe", borderRadius: 100, overflow: "hidden" },
    progressFill: { height: "100%", background: "linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)", borderRadius: 100, transition: "width 0.3s" },
    selCard: {
      border: "1.5px solid #ede9fe", borderRadius: 16, padding: "22px",
      marginBottom: 16, background: "#fff",
      boxShadow: "0 4px 20px rgba(79,53,190,0.08)"
    },
    selLabel: { fontSize: 13, fontWeight: 600, color: "#4b3d80", marginBottom: 10, display: "block" },
    select: {
      width: "100%", border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "11px 14px", fontSize: 15, color: "#1a1035", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", cursor: "pointer",
      transition: "border-color 0.15s"
    },
    selectDisabled: {
      width: "100%", border: "1.5px solid #f0ebff", borderRadius: 10,
      padding: "11px 14px", fontSize: 15, color: "#c4b5fd", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", cursor: "not-allowed"
    },
    otherBtn: {
      marginTop: 10, fontSize: 13, color: "#6d28d9",
      background: "#f5f0ff", border: "1.5px solid #ddd6fe",
      borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit"
    },
    otherBtnActive: {
      marginTop: 10, fontSize: 13, color: "#fff",
      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      border: "1.5px solid #7c3aed",
      borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit"
    },
    textInput: {
      width: "100%", border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "10px 13px", fontSize: 15, color: "#1a1035", outline: "none",
      background: "#faf9ff", fontFamily: "inherit",
      boxSizing: "border-box" as const, resize: "none" as const,
      transition: "border-color 0.15s"
    },
    secCard: {
      border: "1.5px solid #ede9fe", borderRadius: 14, overflow: "hidden",
      marginBottom: 12, background: "#fff",
      boxShadow: "0 2px 12px rgba(79,53,190,0.06)"
    },
    secTitle: {
      fontSize: 13, fontWeight: 600, color: "#6d28d9",
      padding: "12px 20px", borderBottom: "1.5px solid #f5f0ff",
      background: "linear-gradient(135deg, #faf9ff 0%, #f5f0ff 100%)"
    },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px", borderBottom: "1.5px solid #faf8ff" },
    itemRowLast: { display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px" },
    checkbox: { width: 16, height: 16, marginTop: 2, flexShrink: 0, cursor: "pointer", accentColor: "#7c3aed" },
    itemLabel: { fontSize: 15, color: "#1a1035", lineHeight: 1.5, flex: 1 },
    itemLabelMuted: { fontSize: 15, color: "#c4b5fd", lineHeight: 1.5, flex: 1, textDecoration: "line-through" },
    reqStar: { color: "#dc2626", fontSize: 12, marginLeft: 3 },
    nameCard: {
      border: "1.5px solid #ede9fe", borderRadius: 14, padding: "22px",
      marginBottom: 12, background: "#fff",
      boxShadow: "0 2px 12px rgba(79,53,190,0.06)"
    },
    nameLabel: { fontSize: 13, fontWeight: 600, color: "#4b3d80", marginBottom: 10, display: "block" },
    submitBtn: {
      width: "100%",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      color: "#fff", border: "none", borderRadius: 12, padding: "14px 0",
      fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 4px 16px rgba(109,40,217,0.35)", transition: "opacity 0.15s"
    },
    submitBtnDisabled: {
      width: "100%", background: "#e9e4f8", color: "#b4a9d6",
      border: "none", borderRadius: 12, padding: "14px 0",
      fontSize: 15, fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit"
    },
    continueBtn: {
      width: "100%",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      color: "#fff", border: "none", borderRadius: 12, padding: "13px 0",
      fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      marginTop: 12, boxShadow: "0 3px 12px rgba(109,40,217,0.3)"
    },
    backLink: {
      fontSize: 13, color: "#7c6fa0", background: "none", border: "none",
      cursor: "pointer", fontFamily: "inherit", padding: "8px 0",
      display: "inline-block", marginBottom: 16
    },
    summaryChip: {
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "linear-gradient(135deg, #f5f0ff 0%, #ede9fe 100%)",
      border: "1px solid #ddd6fe", borderRadius: 10, padding: "6px 14px",
      fontSize: 13, color: "#4b3d80", fontWeight: 500
    },
    successWrap: { textAlign: "center" as const, padding: "80px 0" },
    centerMsg: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontSize: 15, color: "#a78bfa" },
    successIcon: {
      width: 64, height: 64, borderRadius: "50%",
      background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 28, margin: "0 auto 24px", color: "#fff"
    },
  };

  if (loading) return <div style={S.root}><div style={S.centerMsg}>読み込み中…</div></div>;
  if (error || !checklist) return <div style={S.root}><div style={S.centerMsg}>チェックリストが見つかりません。</div></div>;

  if (submitted) return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>オフィス管理者</span></div>
      <div style={S.main}>
        <div style={S.successWrap}>
          <div style={S.successIcon}>✓</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1035", marginBottom: 10 }}>送信が完了しました</div>
          <p style={{ fontSize: 14, color: "#7c6fa0", lineHeight: 1.8, marginBottom: 36 }}>
            回答が記録されました。<br /><strong style={{ color: "#4f35be" }}>{submittedBy}</strong>さん、ありがとうございました。
          </p>
          <button
            style={{
              fontSize: 14, color: "#4b3d80", background: "#f5f0ff",
              border: "1.5px solid #ddd6fe", borderRadius: 10,
              padding: "10px 22px", cursor: "pointer", fontFamily: "inherit"
            }}
            onClick={handleReset}
          >
            別の回答を送信する
          </button>
        </div>
      </div>
    </div>
  );

  const deptName = departments.find(d => String(d.id) === selectedDeptId)?.name || "";
  const userName = isOther ? otherName : (orgUsers.find(u => String(u.id) === selectedUserId)?.name || "");

  return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>
オフィス管理者</span></div>
      <div style={S.main}>
        <div style={S.title}>{checklist.title}</div>

        {/* ── STEP 1: Department ── */}
        {step === "department" && (
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
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button style={S.continueBtn} onClick={handleDeptContinue}>
              次へ
            </button>
          </div>
        )}

        {/* ── STEP 2: User ── */}
        {step === "user" && (
          <div style={S.selCard}>
            <button style={S.backLink} onClick={() => setStep("department")}>
              ← {deptName}
            </button>
            <label style={S.selLabel}>ユーザー <span style={{ color: "#dc2626" }}>*</span></label>
            {loadingUsers ? (
              <div style={{ fontSize: 14, color: "#c4b5fd", padding: "8px 0" }}>ユーザーを読み込み中…</div>
            ) : (
              <>
                <select
                  style={isOther ? S.selectDisabled : S.select}
                  value={selectedUserId}
                  onChange={e => { setSelectedUserId(e.target.value); setIsOther(false); }}
                  disabled={isOther}
                >
                  <option value="">ユーザーを選択してください…</option>
                  {orgUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>

                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    style={isOther ? S.otherBtnActive : S.otherBtn}
                    onClick={() => { setIsOther(!isOther); setSelectedUserId(""); setOtherName(""); }}
                  >
                    {isOther ? "✓ その他" : "その他"}
                  </button>
                  {isOther && (
                    <span style={{ fontSize: 13, color: "#9688c0" }}>以下にお名前を入力してください</span>
                  )}
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
            <button style={S.continueBtn} onClick={handleUserContinue}>
              次へ
            </button>
          </div>
        )}

        {/* ── STEP 3: Form ── */}
        {step === "form" && (
          <>
            <div style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              <span style={S.summaryChip}>
                <span style={{ color: "#a78bfa" }}>部署</span> {deptName}
              </span>
              <span style={S.summaryChip}>
                <span style={{ color: "#a78bfa" }}>ユーザー</span> {userName}
              </span>
              <button
                style={{ ...S.backLink, margin: 0, alignSelf: "center" }}
                onClick={() => setStep("user")}
              >
                変更
              </button>
            </div>

            {total > 0 && (
              <div style={S.progressWrap}>
                <div style={S.progressLabel}>
                  <span>進捗</span><span style={{ color: "#7c3aed", fontWeight: 600 }}>{checked}/{total} 完了</span>
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
                    const isLast = idx === tasks.length - 1;
                    const isDone = item.type === "checkbox" && values[item.id] === "true";
                    return (
                      <div key={item.id} style={isLast ? S.itemRowLast : S.itemRow}>
                        {item.type === "checkbox" ? (
                          <>
                            <input
                              type="checkbox"
                              style={S.checkbox}
                              checked={values[item.id] === "true"}
                              onChange={() => toggleCheck(item.id)}
                            />
                            <span style={isDone ? S.itemLabelMuted : S.itemLabel}>{item.label}</span>
                          </>
                        ) : item.type === "text" ? (
                          <div style={{ flex: 1 }}>
                            <div style={{ ...S.itemLabel, marginBottom: 8 }}>
                              {item.label}{item.required && <span style={S.reqStar}>*</span>}
                            </div>
                            <input
                              type="text"
                              style={S.textInput}
                              placeholder="回答を入力してください…"
                              value={values[item.id] || ""}
                              onChange={e => handleText(item.id, e.target.value)}
                              onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                              onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
                            />
                          </div>
                        ) : (
                          <div style={{ flex: 1 }}>
                            <div style={{ ...S.itemLabel, marginBottom: 8 }}>
                              {item.label}{item.required && <span style={S.reqStar}>*</span>}
                            </div>
                            <textarea
                              style={{ ...S.textInput, minHeight: 80 }}
                              placeholder="回答を入力してください…"
                              value={values[item.id] || ""}
                              onChange={e => handleText(item.id, e.target.value)}
                              onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                              onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
                            />
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

            <button
              style={submitting ? S.submitBtnDisabled : S.submitBtn}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "送信中…" : "チェックリストを送信"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}