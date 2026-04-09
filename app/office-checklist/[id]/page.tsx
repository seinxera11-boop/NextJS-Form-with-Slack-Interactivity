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
  checklist_sections: ChecklistSection[];
};

export default function ChecklistPage() {
  const params = useParams();
  const id = params?.id as string;

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [submittedBy, setSubmittedBy] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/checklists/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setChecklist(data);
        const init: Record<number, string> = {};
        (data.checklist_sections || []).forEach((sec: ChecklistSection) => {
          (sec.checklist_items || []).forEach((item: ChecklistTask) => {
            init[item.id] = item.type === "checkbox" ? "false" : "";
          });
        });
        setValues(init);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const sections = checklist
    ? [...checklist.checklist_sections].sort((a, b) => a.order_index - b.order_index)
    : [];

  const allTasks = sections.flatMap((s) =>
    [...s.checklist_items].sort((a, b) => a.order_index - b.order_index)
  );
  const checkboxTasks = allTasks.filter((t) => t.type === "checkbox");
  const checked = checkboxTasks.filter((t) => values[t.id] === "true").length;
  const total = checkboxTasks.length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const toggleCheck = (id: number) =>
    setValues((p) => ({ ...p, [id]: p[id] === "true" ? "false" : "true" }));

  const handleText = (id: number, val: string) =>
    setValues((p) => ({ ...p, [id]: val }));

  const handleSubmit = async () => {
    if (!submittedBy.trim()) { alert("Please enter your name."); return; }
    const missing = allTasks.filter(
      (it) => it.required && it.type !== "checkbox" && !values[it.id]?.trim()
    );
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id: checklist?.id,
          submitted_by: submittedBy,
          reason,
          values,
          completedItems: checked,
          totalItems: total,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSubmitted(true);
    } catch (err: any) {
      alert("Failed to submit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    const init: Record<number, string> = {};
    allTasks.forEach((it) => { init[it.id] = it.type === "checkbox" ? "false" : ""; });
    setValues(init);
    setSubmittedBy("");
    setReason("");
    setSubmitted(false);
  };

  const S: Record<string, React.CSSProperties> = {
    root: { minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#111" },
    header: { borderBottom: "1px solid #f0f0f0", padding: "16px 32px", display: "flex", alignItems: "center", gap: 8 },
    headerDot: { width: 8, height: 8, borderRadius: "50%", background: "#111" },
    headerName: { fontSize: 14, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" },
    main: { maxWidth: 640, margin: "0 auto", padding: "48px 24px" },
    title: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    progressWrap: { marginBottom: 36 },
    progressLabel: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginBottom: 8 },
    progressTrack: { height: 3, background: "#f0f0f0", borderRadius: 100, overflow: "hidden" },
    progressFill: { height: "100%", background: "#111", borderRadius: 100, transition: "width 0.3s" },
    // Section card
    secCard: { border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden", marginBottom: 12 },
    secTitle: { fontSize: 13, fontWeight: 600, color: "#555", padding: "12px 20px", borderBottom: "1px solid #f8f8f8", background: "#fafafa", letterSpacing: "-0.01em" },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderBottom: "1px solid #f8f8f8" },
    itemRowLast: { display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px" },
    checkbox: { width: 16, height: 16, marginTop: 1, flexShrink: 0, cursor: "pointer", accentColor: "#111" },
    itemLabel: { fontSize: 14, color: "#111", lineHeight: 1.5, flex: 1 },
    itemLabelMuted: { fontSize: 14, color: "#aaa", lineHeight: 1.5, flex: 1, textDecoration: "line-through" },
    reqStar: { color: "#dc2626", fontSize: 12, marginLeft: 3 },
    textInput: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", boxSizing: "border-box", resize: "none" },
    nameCard: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "20px", marginBottom: 12 },
    nameLabel: { fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 8, display: "block" },
    submitBtn: { width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em" },
    submitBtnDisabled: { width: "100%", background: "#e5e5e5", color: "#aaa", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit" },
    successWrap: { textAlign: "center", padding: "80px 0" },
    successIcon: { fontSize: 36, marginBottom: 20 },
    successTitle: { fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.02em", marginBottom: 8 },
    successText: { fontSize: 13, color: "#999", lineHeight: 1.7, marginBottom: 32 },
    resetBtn: { fontSize: 13, color: "#666", background: "#f7f7f7", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontFamily: "inherit" },
    centerMsg: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontSize: 14, color: "#999" },
  };

  if (loading) return <div style={S.root}><div style={S.centerMsg}>Loading…</div></div>;
  if (error || !checklist) return <div style={S.root}><div style={S.centerMsg}>Checklist not found.</div></div>;

  if (submitted) return (
    <div style={S.root}>
      <div style={S.header}><div style={S.headerDot} /><span style={S.headerName}>OfficeAdmin</span></div>
      <div style={S.main}>
        <div style={S.successWrap}>
          <div style={S.successIcon}>✓</div>
          <div style={S.successTitle}>Submitted successfully</div>
          <p style={S.successText}>Your response has been recorded.<br />Thank you, {submittedBy}.</p>
          <button style={S.resetBtn} onClick={handleReset}>Submit another response</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerDot} />
        <span style={S.headerName}>OfficeAdmin</span>
      </div>

      <div style={S.main}>
        <div style={S.title}>{checklist.title}</div>

        {total > 0 && (
          <div style={S.progressWrap}>
            <div style={S.progressLabel}>
              <span>Progress</span>
              <span>{checked}/{total} checked</span>
            </div>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* One card per section */}
        {sections.map((sec) => {
          const tasks = [...sec.checklist_items].sort((a, b) => a.order_index - b.order_index);
          return (
            <div key={sec.id} style={S.secCard}>
              <div style={S.secTitle}>{sec.title}</div>
              {tasks.map((item, idx) => {
                const isLast = idx === tasks.length - 1;
                const rowStyle = isLast ? S.itemRowLast : S.itemRow;
                const isDone = item.type === "checkbox" && values[item.id] === "true";
                return (
                  <div key={item.id} style={rowStyle}>
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
                          {item.label}
                          {item.required && <span style={S.reqStar}>*</span>}
                        </div>
                        <input
                          type="text"
                          style={S.textInput}
                          placeholder="Your answer…"
                          value={values[item.id] || ""}
                          onChange={(e) => handleText(item.id, e.target.value)}
                        />
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        <div style={{ ...S.itemLabel, marginBottom: 8 }}>
                          {item.label}
                          {item.required && <span style={S.reqStar}>*</span>}
                        </div>
                        <textarea
                          style={{ ...S.textInput, minHeight: 80 }}
                          placeholder="Your answer…"
                          value={values[item.id] || ""}
                          onChange={(e) => handleText(item.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Name */}
        <div style={S.nameCard}>
          <label style={S.nameLabel}>Your name <span style={S.reqStar}>*</span></label>
          <input
            type="text"
            style={S.textInput}
            placeholder="Who is submitting this?"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
          />
        </div>

        {/* Reason */}
        <div style={S.nameCard}>
          <label style={S.nameLabel}>Reason</label>
          <textarea
            style={{ ...S.textInput, minHeight: 80 }}
            placeholder="Submit reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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