"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type Checklist, type ChecklistSection, type ChecklistTask } from "./types";

export function ChecklistsTab({ userEmail }: { userEmail: string }) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Checklist | null>(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<ChecklistSection[]>([
    { title: "", order_index: 0, tasks: [{ label: "", order_index: 0 }] },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { fetchChecklists(); }, []);

  const fetchChecklists = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("checklists")
      .select("*, checklist_sections(*, checklist_items(*))")
      .order("created_at", { ascending: false });
    setChecklists(data || []);
    setLoading(false);
  };

  const startCreate = () => {
    setTitle("");
    setSections([{ title: "", order_index: 0, tasks: [{ label: "", order_index: 0 }] }]);
    setSaveError(""); setEditTarget(null); setView("create");
  };

  const startEdit = (cl: Checklist) => {
    setTitle(cl.title);
    const sorted = [...(cl.checklist_sections || [])].sort((a, b) => a.order_index - b.order_index);
    setSections(sorted.length
      ? sorted.map(sec => ({
          id: sec.id, title: sec.title, order_index: sec.order_index,
          tasks: [...(sec.checklist_items || [])].sort((a, b) => a.order_index - b.order_index),
        }))
      : [{ title: "", order_index: 0, tasks: [{ label: "", order_index: 0 }] }]
    );
    setSaveError(""); setEditTarget(cl); setView("edit");
  };

  const addSection = () =>
    setSections(p => [...p, { title: "", order_index: p.length, tasks: [{ label: "", order_index: 0 }] }]);
  const removeSection = (si: number) => {
    if (sections.length === 1) return;
    setSections(p => p.filter((_, i) => i !== si).map((s, i) => ({ ...s, order_index: i })));
  };
  const moveSection = (si: number, dir: -1 | 1) => {
    const ns = [...sections]; const target = si + dir;
    if (target < 0 || target >= ns.length) return;
    [ns[si], ns[target]] = [ns[target], ns[si]];
    setSections(ns.map((s, i) => ({ ...s, order_index: i })));
  };
  const updateSectionTitle = (si: number, val: string) =>
    setSections(p => p.map((s, i) => i === si ? { ...s, title: val } : s));
  const addTask = (si: number) =>
    setSections(p => p.map((s, i) => i === si
      ? { ...s, tasks: [...s.tasks, { label: "", order_index: s.tasks.length }] } : s));
  const removeTask = (si: number, ti: number) =>
    setSections(p => p.map((s, i) => i !== si ? s : {
      ...s, tasks: s.tasks.filter((_, j) => j !== ti).map((t, j) => ({ ...t, order_index: j }))
    }));
  const moveTask = (si: number, ti: number, dir: -1 | 1) =>
    setSections(p => p.map((s, i) => {
      if (i !== si) return s;
      const t = [...s.tasks]; const target = ti + dir;
      if (target < 0 || target >= t.length) return s;
      [t[ti], t[target]] = [t[target], t[ti]];
      return { ...s, tasks: t.map((x, j) => ({ ...x, order_index: j })) };
    }));
  const updateTaskLabel = (si: number, ti: number, label: string) =>
    setSections(p => p.map((s, i) => i !== si ? s : {
      ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, label } : t)
    }));

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("Title is required."); return; }
    for (const sec of sections) {
      if (!sec.title.trim()) { setSaveError("All sections need a title."); return; }
      for (const task of sec.tasks) {
        if (!task.label.trim()) { setSaveError("All tasks need a label."); return; }
      }
    }
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(
        editTarget ? `/api/checklists/${editTarget.id}` : "/api/checklists",
        {
          method: editTarget ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, sections, created_by: userEmail }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Save failed");
      await fetchChecklists(); setView("list");
    } catch (err: any) { setSaveError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this checklist?")) return;
    await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    await fetchChecklists();
  };

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 780, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 6 },
    pageSubtitle: { fontSize: 14, color: "#7c6fa0", marginBottom: 40 },
    toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
    countLabel: { fontSize: 13, color: "#a78bfa", fontWeight: 500 },
    newBtn: {
      fontSize: 14, fontWeight: 600,
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px",
      cursor: "pointer", boxShadow: "0 2px 10px rgba(109,40,217,0.3)"
    },
    card: {
      border: "1.5px solid #ede9fe", borderRadius: 16, padding: "20px 24px",
      marginBottom: 12, background: "#fff",
      boxShadow: "0 2px 12px rgba(79,53,190,0.06)", transition: "all 0.18s ease"
    },
    cardTitle: { fontSize: 16, fontWeight: 600, color: "#1a1035", marginBottom: 4 },
    cardMeta: { fontSize: 12, color: "#9688c0", marginBottom: 14 },
    cardRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    cardBtns: { display: "flex", gap: 6, flexShrink: 0 },
    editBtn: {
      fontSize: 12, color: "#4b3d80", background: "#f5f0ff",
      border: "1px solid #ddd6fe", borderRadius: 8, padding: "5px 12px", cursor: "pointer"
    },
    shareBtn: {
      fontSize: 12, color: "#1d4ed8", background: "#eff6ff",
      border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 12px", cursor: "pointer"
    },
    delBtn: {
      fontSize: 12, color: "#b91c1c", background: "#fef2f2",
      border: "1px solid #fecaca", borderRadius: 8, padding: "5px 12px", cursor: "pointer"
    },
    chipsRow: { display: "flex", flexWrap: "wrap", gap: 5 },
    chip: {
      fontSize: 11, padding: "3px 10px", borderRadius: 100, fontWeight: 500,
      background: "linear-gradient(135deg, #f5f0ff 0%, #ede9fe 100%)",
      color: "#6d28d9", border: "1px solid #ddd6fe"
    },
    emptyWrap: { textAlign: "center", padding: "80px 0" },
    emptyTitle: { fontSize: 20, fontWeight: 700, color: "#1a1035", marginBottom: 8 },
    emptyText: { fontSize: 14, color: "#a78bfa", marginBottom: 28 },
    emptyIcon: { fontSize: 48, marginBottom: 20, opacity: 0.3 },
    back: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#7c6fa0", cursor: "pointer", marginBottom: 32, background: "none", border: "none", padding: 0 },
    genSection: { border: "1.5px solid #ede9fe", borderRadius: 14, padding: "28px", marginBottom: 16, background: "#faf9ff" },
    sectionLabel: {
      fontSize: 10, fontWeight: 700, color: "#a78bfa",
      textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16
    },
    fieldLabel: { display: "block", fontSize: 13, fontWeight: 600, color: "#4b3d80", marginBottom: 8 },
    input: {
      width: "100%", border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "10px 14px", fontSize: 15, color: "#1a1035", outline: "none",
      background: "#fff", fontFamily: "inherit", transition: "border-color 0.15s"
    },
    secCard: { border: "1.5px solid #ede9fe", borderRadius: 14, marginBottom: 12, overflow: "hidden" },
    secHeader: {
      display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
      background: "linear-gradient(135deg, #faf9ff 0%, #f5f0ff 100%)",
      borderBottom: "1.5px solid #ede9fe"
    },
    secNum: { fontSize: 11, fontWeight: 700, color: "#a78bfa", minWidth: 20 },
    secTitleInput: {
      flex: 1, border: "1.5px solid #ddd6fe", borderRadius: 8,
      padding: "8px 12px", fontSize: 14, fontWeight: 600, color: "#1a1035",
      outline: "none", background: "#fff", fontFamily: "inherit"
    },
    secActions: { display: "flex", gap: 4, flexShrink: 0 },
    iconBtn: {
      background: "#f5f0ff", border: "1px solid #ddd6fe",
      color: "#a78bfa", cursor: "pointer", fontSize: 12,
      padding: "4px 8px", borderRadius: 6, lineHeight: 1
    },
    removeSec: {
      background: "#fef2f2", border: "1px solid #fecaca",
      color: "#f87171", cursor: "pointer", fontSize: 16,
      padding: "2px 8px", lineHeight: 1, borderRadius: 6
    },
    tasksArea: { padding: "10px 18px 14px", background: "#fff" },
    itemRow: {
      display: "flex", alignItems: "center", gap: 8,
      background: "#faf9ff", border: "1px solid #ede9fe",
      borderRadius: 10, padding: "9px 11px", marginBottom: 6
    },
    itemNum: { fontSize: 11, color: "#c4b5fd", minWidth: 18, textAlign: "right", flexShrink: 0 },
    itemInput: {
      flex: 1, border: "1.5px solid #e9e4f8", borderRadius: 8,
      padding: "7px 10px", fontSize: 14, color: "#1a1035", outline: "none",
      background: "#fff", fontFamily: "inherit", minWidth: 0
    },
    moveBtns: { display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 },
    moveBtn: { background: "none", border: "none", color: "#c4b5fd", cursor: "pointer", fontSize: 11, padding: "1px 4px", lineHeight: 1 },
    removeBtn: {
      background: "none", border: "none", color: "#fca5a5",
      cursor: "pointer", fontSize: 16, padding: "2px 5px", lineHeight: 1, flexShrink: 0
    },
    addTaskBtn: {
      width: "100%", border: "1.5px dashed #ddd6fe", borderRadius: 10,
      padding: 10, fontSize: 13, color: "#a78bfa", background: "none",
      cursor: "pointer", marginTop: 4, fontFamily: "inherit"
    },
    addSecBtn: {
      width: "100%", border: "1.5px dashed #c4b5fd", borderRadius: 14,
      padding: "13px 12px", fontSize: 14, color: "#7c6fa0", background: "none",
      cursor: "pointer", marginTop: 4, fontFamily: "inherit", fontWeight: 500
    },
    footer: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 24 },
    errText: { flex: 1, fontSize: 13, color: "#dc2626", fontWeight: 500 },
    cancelBtn: {
      fontSize: 14, color: "#7c6fa0", background: "#f5f0ff",
      border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "10px 18px", cursor: "pointer", fontFamily: "inherit"
    },
    saveBtn: {
      fontSize: 14, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      border: "none", borderRadius: 10, padding: "10px 24px",
      cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 2px 10px rgba(109,40,217,0.3)"
    },
  };

  return (
    <div style={S.main}>
      {view === "list" && (
        <>
          <div style={S.pageTitle}>Checklists</div>
          <div style={S.pageSubtitle}>Create and manage checklists for your team.</div>
          <div style={S.toolbar}>
            <span style={S.countLabel}>{checklists.length} checklist{checklists.length !== 1 ? "s" : ""}</span>
            <button style={S.newBtn} onClick={startCreate}>+ New checklist</button>
          </div>
          {loading ? (
            <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#c4b5fd" }}>Loading…</div>
          ) : checklists.length === 0 ? (
            <div style={S.emptyWrap}>
              <div style={S.emptyIcon}>☑</div>
              <div style={S.emptyTitle}>No checklists yet</div>
              <div style={S.emptyText}>Create your first checklist to get started.</div>
              <button style={S.newBtn} onClick={startCreate}>+ New checklist</button>
            </div>
          ) : checklists.map(cl => {
            const allTasks = (cl.checklist_sections || [])
              .sort((a, b) => a.order_index - b.order_index)
              .flatMap(s => [...(s.checklist_items || [])].sort((a, b) => a.order_index - b.order_index));
            const preview = allTasks.slice(0, 5);
            const extra = allTasks.length - preview.length;
            return (
              <div key={cl.id} style={S.card}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4b5fd"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(79,53,190,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede9fe"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(79,53,190,0.06)"; }}
              >
                <div style={S.cardRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.cardTitle}>{cl.title}</div>
                    <div style={S.cardMeta}>
                      {(cl.checklist_sections || []).length} section{(cl.checklist_sections || []).length !== 1 ? "s" : ""} · {allTasks.length} tasks · {cl.created_by} ·{" "}
                      {new Date(cl.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <div style={S.cardBtns}>
                    <button style={S.shareBtn} onClick={() => {
                      const url = `${window.location.origin}/office-checklist/${cl.id}`;
                      navigator.clipboard.writeText(url).then(() => alert("Link copied: " + url));
                    }}>Copy link</button>
                    <button style={S.editBtn} onClick={() => startEdit(cl)}>Edit</button>
                    <button style={S.delBtn} onClick={() => handleDelete(cl.id)}>Delete</button>
                  </div>
                </div>
                <div style={S.chipsRow}>
                  {preview.map((it, i) => (
                    <span key={i} style={S.chip}>{it.label}</span>
                  ))}
                  {extra > 0 && <span style={{ fontSize: 12, color: "#a78bfa", padding: "3px 6px" }}>+{extra} more</span>}
                </div>
              </div>
            );
          })}
        </>
      )}
      {(view === "create" || view === "edit") && (
        <>
          <button style={S.back} onClick={() => setView("list")}>← Back to checklists</button>
          <div style={S.pageTitle}>{view === "create" ? "New checklist" : "Edit checklist"}</div>
          <div style={{ ...S.pageSubtitle, marginBottom: 32 }}>
            {view === "create" ? "Add sections and define tasks your team will complete." : "Update sections, tasks and settings."}
          </div>
          <div style={S.genSection}>
            <div style={S.sectionLabel}>General</div>
            <label style={S.fieldLabel}>Title</label>
            <input style={S.input} placeholder="e.g. Office Closing Checklist" value={title} onChange={e => setTitle(e.target.value)}
              onFocus={e => (e.target.style.borderColor = "#a78bfa")}
              onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
            />
          </div>
          <div style={{ ...S.sectionLabel, marginBottom: 12 }}>Sections & Tasks</div>
          {sections.map((sec, si) => (
            <div key={si} style={S.secCard}>
              <div style={S.secHeader}>
                <span style={S.secNum}>{si + 1}</span>
                <input style={S.secTitleInput} placeholder="Section title (e.g. Closing Tasks)" value={sec.title} onChange={e => updateSectionTitle(si, e.target.value)} />
                <div style={S.secActions}>
                  <button style={S.iconBtn} onClick={() => moveSection(si, -1)}>↑</button>
                  <button style={S.iconBtn} onClick={() => moveSection(si, 1)}>↓</button>
                  {sections.length > 1 && <button style={S.removeSec} onClick={() => removeSection(si)}>×</button>}
                </div>
              </div>
              <div style={S.tasksArea}>
                {sec.tasks.map((task, ti) => (
                  <div key={ti} style={S.itemRow}>
                    <span style={S.itemNum}>{ti + 1}</span>
                    <input
                      style={S.itemInput}
                      placeholder="Task label"
                      value={task.label}
                      onChange={e => updateTaskLabel(si, ti, e.target.value)}
                    />
                    <div style={S.moveBtns}>
                      <button style={S.moveBtn} onClick={() => moveTask(si, ti, -1)}>↑</button>
                      <button style={S.moveBtn} onClick={() => moveTask(si, ti, 1)}>↓</button>
                    </div>
                    {sec.tasks.length > 1 && (
                      <button style={S.removeBtn} onClick={() => removeTask(si, ti)}>×</button>
                    )}
                  </div>
                ))}
                <button style={S.addTaskBtn} onClick={() => addTask(si)}>+ Add task</button>
              </div>
            </div>
          ))}
          <button style={S.addSecBtn} onClick={addSection}>+ Add section</button>
          <div style={S.footer}>
            {saveError && <span style={S.errText}>⚠ {saveError}</span>}
            <button style={S.cancelBtn} onClick={() => setView("list")}>Cancel</button>
            <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : view === "create" ? "Create" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}