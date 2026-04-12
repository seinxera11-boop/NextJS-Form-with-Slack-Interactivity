"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type ItemType = "checkbox" | "text" | "textarea";
type ChecklistTask = { id: number; label: string; type: ItemType; required: boolean; order_index: number; };
type ChecklistSection = { id: number; title: string; order_index: number; checklist_items: ChecklistTask[]; };
type Checklist = { id: number; title: string; checklist_sections: ChecklistSection[]; };
type Department = { id: number; name: string; };
type OrgUser = { id: number; name: string; department_id: number; };

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

  const handleSubmit = async () => {
    if (!selectedDeptId) { alert("Please select a department."); return; }
    if (!isOther && !selectedUserId) { alert("Please select a user or choose Other."); return; }
    if (isOther && !otherName.trim()) { alert("Please enter your name."); return; }

    const missing = allTasks.filter(
      it => it.required && it.type !== "checkbox" && !values[it.id]?.trim()
    );
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map(m => m.label).join(", ")}`);
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
      alert("Failed to submit: " + err.message);
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
  };

  const S: Record<string, React.CSSProperties> = {
    root: { minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#111" },
    header: { borderBottom: "1px solid #f0f0f0", padding: "16px 32px", display: "flex", alignItems: "center", gap: 8 },
    headerDot: { width: 8, height: 8, borderRadius: "50%", background: "#111" },
    headerName: { fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" },
    main: { maxWidth: 640, margin: "0 auto", padding: "48px 24px" },
    title: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 24 },
    progressWrap: { marginBottom: 32 },
    progressLabel: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#999", marginBottom: 8 },
    progressTrack: { height: 3, background: "#f0f0f0", borderRadius: 100, overflow: "hidden" },
    progressFill: { height: "100%", background: "#111", borderRadius: 100, transition: "width 0.3s" },
    selCard: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "20px", marginBottom: 16 },
    selLabel: { fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 8, display: "block" },
    select: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", fontSize: 15, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", cursor: "pointer" },
    selectDisabled: { width: "100%", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 12px", fontSize: 15, color: "#bbb", outline: "none", background: "#fafafa", fontFamily: "inherit", cursor: "not-allowed" },
    otherBtn: { marginTop: 10, fontSize: 14, color: "#2563eb", background: "none", border: "1px solid #dbeafe", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" },
    otherBtnActive: { marginTop: 10, fontSize: 14, color: "#fff", background: "#2563eb", border: "1px solid #2563eb", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" },
    textInput: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 12px", fontSize: 15, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", boxSizing: "border-box" as const, resize: "none" as const },
    secCard: { border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden", marginBottom: 12 },
    secTitle: { fontSize: 14, fontWeight: 600, color: "#555", padding: "12px 20px", borderBottom: "1px solid #f8f8f8", background: "#fafafa" },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderBottom: "1px solid #f8f8f8" },
    itemRowLast: { display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px" },
    checkbox: { width: 16, height: 16, marginTop: 1, flexShrink: 0, cursor: "pointer", accentColor: "#111" },
    itemLabel: { fontSize: 15, color: "#111", lineHeight: 1.5, flex: 1 },
    itemLabelMuted: { fontSize: 15, color: "#aaa", lineHeight: 1.5, flex: 1, textDecoration: "line-through" },
    reqStar: { color: "#dc2626", fontSize: 13, marginLeft: 3 },
    nameCard: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "20px", marginBottom: 12 },
    nameLabel: { fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 8, display: "block" },
    submitBtn: { width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
    submitBtnDisabled: { width: "100%", background: "#e5e5e5", color: "#aaa", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit" },
    successWrap: { textAlign: "center" as const, padding: "80px 0" },
    centerMsg: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontSize: 15, color: "#999" },
  };

  if (loading) return <div style={S.root}><div style={S.centerMsg}>Loading…</div></div>;
  if (error || !checklist) return <div style={S.root}><div style={S.centerMsg}>Checklist not found.</div></div>;

  if (submitted) return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>OfficeAdmin</span></div>
      <div style={S.main}>
        <div style={S.successWrap}>
          <div style={{ fontSize: 36, marginBottom: 20 }}>✓</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 8 }}>Submitted successfully</div>
          <p style={{ fontSize: 14, color: "#999", lineHeight: 1.7, marginBottom: 32 }}>
            Your response has been recorded.<br />Thank you, {submittedBy}.
          </p>
          <button
            style={{ fontSize: 14, color: "#666", background: "#f7f7f7", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontFamily: "inherit" }}
            onClick={handleReset}
          >
            Submit another response
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>OfficeAdmin</span></div>
      <div style={S.main}>
        <div style={S.title}>{checklist.title}</div>

        {total > 0 && (
          <div style={S.progressWrap}>
            <div style={S.progressLabel}>
              <span>Progress</span><span>{checked}/{total} checked</span>
            </div>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Department & User Selection */}
        <div style={S.selCard}>
          <label style={S.selLabel}>Department <span style={{ color: "#dc2626" }}>*</span></label>
          <select
            style={S.select}
            value={selectedDeptId}
            onChange={e => setSelectedDeptId(e.target.value)}
          >
            <option value="">Select a department…</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {selectedDeptId && (
            <div style={{ marginTop: 16 }}>
              <label style={S.selLabel}>User <span style={{ color: "#dc2626" }}>*</span></label>
              {loadingUsers ? (
                <div style={{ fontSize: 14, color: "#bbb", padding: "8px 0" }}>Loading users…</div>
              ) : (
                <>
                  <select
                    style={isOther ? S.selectDisabled : S.select}
                    value={selectedUserId}
                    onChange={e => { setSelectedUserId(e.target.value); setIsOther(false); }}
                    disabled={isOther}
                  >
                    <option value="">Select a user…</option>
                    {orgUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>

                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      style={isOther ? S.otherBtnActive : S.otherBtn}
                      onClick={() => { setIsOther(!isOther); setSelectedUserId(""); setOtherName(""); }}
                    >
                      {isOther ? "✓ Other" : "Other"}
                    </button>
                    {isOther && (
                      <span style={{ fontSize: 13, color: "#999" }}>Enter your name below</span>
                    )}
                  </div>

                  {isOther && (
                    <input
                      type="text"
                      style={{ ...S.textInput, marginTop: 10 }}
                      placeholder="Enter your name…"
                      value={otherName}
                      onChange={e => setOtherName(e.target.value)}
                      autoFocus
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Checklist sections */}
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
                          placeholder="Your answer…"
                          value={values[item.id] || ""}
                          onChange={e => handleText(item.id, e.target.value)}
                        />
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        <div style={{ ...S.itemLabel, marginBottom: 8 }}>
                          {item.label}{item.required && <span style={S.reqStar}>*</span>}
                        </div>
                        <textarea
                          style={{ ...S.textInput, minHeight: 80 }}
                          placeholder="Your answer…"
                          value={values[item.id] || ""}
                          onChange={e => handleText(item.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Reason */}
        <div style={S.nameCard}>
          <label style={S.nameLabel}>Reason</label>
          <textarea
            style={{ ...S.textInput, minHeight: 80 }}
            placeholder="Submit reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <button
          style={submitting ? S.submitBtnDisabled : S.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit checklist"}
        </button>
      </div>
    </div>
  );
}