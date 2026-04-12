"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  type Checklist,
  type ChecklistSection,
  type ChecklistTask,
  type ItemType,
  TYPE_LABELS,
  TYPE_COLOR,
} from "./types";

export function ChecklistsTab({ userEmail }: { userEmail: string }) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Checklist | null>(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<ChecklistSection[]>([
    { title: "", order_index: 0, tasks: [{ label: "", type: "checkbox", required: true, order_index: 0 }] },
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
    setSections([{ title: "", order_index: 0, tasks: [{ label: "", type: "checkbox", required: true, order_index: 0 }] }]);
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
      : [{ title: "", order_index: 0, tasks: [{ label: "", type: "checkbox", required: true, order_index: 0 }] }]
    );
    setSaveError(""); setEditTarget(cl); setView("edit");
  };

  const addSection = () =>
    setSections(p => [...p, { title: "", order_index: p.length, tasks: [{ label: "", type: "checkbox", required: true, order_index: 0 }] }]);
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
      ? { ...s, tasks: [...s.tasks, { label: "", type: "checkbox", required: true, order_index: s.tasks.length }] } : s));
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
  const updateTask = (si: number, ti: number, patch: Partial<ChecklistTask>) =>
    setSections(p => p.map((s, i) => i !== si ? s : {
      ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, ...patch } : t)
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
        { method: editTarget ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, sections, created_by: userEmail }) }
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
    pageTitle: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 14, color: "#999", marginBottom: 40 },
    toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    countLabel: { fontSize: 13, color: "#bbb" },
    newBtn: { fontSize: 14, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer" },
    card: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "20px 24px", marginBottom: 10, background: "#fff", transition: "border-color 0.15s" },
    cardTitle: { fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 3 },
    cardMeta: { fontSize: 12, color: "#bbb", marginBottom: 14 },
    cardRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    cardBtns: { display: "flex", gap: 6, flexShrink: 0 },
    editBtn: { fontSize: 13, color: "#555", background: "#f7f7f7", border: "1px solid #ebebeb", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    shareBtn: { fontSize: 13, color: "#2563eb", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    delBtn: { fontSize: 13, color: "#dc2626", background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    chipsRow: { display: "flex", flexWrap: "wrap", gap: 5 },
    chip: { fontSize: 12, padding: "2px 9px", borderRadius: 100, fontWeight: 500 },
    emptyWrap: { textAlign: "center", padding: "80px 0" },
    emptyTitle: { fontSize: 19, fontWeight: 600, color: "#111", marginBottom: 6 },
    emptyText: { fontSize: 14, color: "#aaa", marginBottom: 28 },
    back: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#999", cursor: "pointer", marginBottom: 32, background: "none", border: "none", padding: 0 },
    genSection: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "28px", marginBottom: 16 },
    sectionLabel: { fontSize: 12, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 },
    fieldLabel: { display: "block", fontSize: 13, fontWeight: 500, color: "#666", marginBottom: 7 },
    input: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 13px", fontSize: 15, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit" },
    secCard: { border: "1px solid #f0f0f0", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
    secHeader: { display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "#fafafa", borderBottom: "1px solid #f0f0f0" },
    secNum: { fontSize: 12, fontWeight: 600, color: "#bbb", minWidth: 20 },
    secTitleInput: { flex: 1, border: "1px solid #e5e5e5", borderRadius: 7, padding: "8px 12px", fontSize: 15, fontWeight: 600, color: "#111", outline: "none", background: "#fff", fontFamily: "inherit" },
    secActions: { display: "flex", gap: 4, flexShrink: 0 },
    iconBtn: { background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 13, padding: "4px 6px", borderRadius: 5, lineHeight: 1 },
    removeSec: { background: "none", border: "none", color: "#ddd", cursor: "pointer", fontSize: 18, padding: "2px 6px", lineHeight: 1 },
    tasksArea: { padding: "10px 18px 14px" },
    itemRow: { display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #f5f5f5", borderRadius: 8, padding: "9px 11px", marginBottom: 6 },
    itemNum: { fontSize: 12, color: "#ddd", minWidth: 18, textAlign: "right", flexShrink: 0 },
    itemInput: { flex: 1, border: "1px solid #e5e5e5", borderRadius: 7, padding: "7px 10px", fontSize: 14, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", minWidth: 0 },
    typeSelect: { border: "1px solid #e5e5e5", borderRadius: 7, padding: "7px 9px", fontSize: 13, color: "#555", background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit" },
    reqLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#888", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
    moveBtns: { display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 },
    moveBtn: { background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, padding: "1px 4px", lineHeight: 1 },
    removeBtn: { background: "none", border: "none", color: "#ddd", cursor: "pointer", fontSize: 18, padding: "2px 5px", lineHeight: 1, flexShrink: 0 },
    addTaskBtn: { width: "100%", border: "1.5px dashed #e5e5e5", borderRadius: 8, padding: 10, fontSize: 13, color: "#bbb", background: "none", cursor: "pointer", marginTop: 4, fontFamily: "inherit" },
    addSecBtn: { width: "100%", border: "1.5px dashed #d5d5d5", borderRadius: 12, padding: "13px 12px", fontSize: 14, color: "#aaa", background: "none", cursor: "pointer", marginTop: 4, fontFamily: "inherit", fontWeight: 500 },
    footer: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 20 },
    errText: { flex: 1, fontSize: 13, color: "#dc2626" },
    cancelBtn: { fontSize: 14, color: "#666", background: "#f7f7f7", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: "inherit" },
    saveBtn: { fontSize: 14, fontWeight: 600, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontFamily: "inherit" },
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
            <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#ccc" }}>Loading…</div>
          ) : checklists.length === 0 ? (
            <div style={S.emptyWrap}>
              <div style={{ fontSize: 40, marginBottom: 20, opacity: 0.2 }}>☑</div>
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
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#e0e0e0")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#f0f0f0")}
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
                    <span key={i} style={{ ...S.chip, background: TYPE_COLOR[it.type as ItemType] + "12", color: TYPE_COLOR[it.type as ItemType] }}>
                      {it.label}{it.required ? " *" : ""}
                    </span>
                  ))}
                  {extra > 0 && <span style={{ fontSize: 12, color: "#ccc", padding: "2px 4px" }}>+{extra} more</span>}
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
            <input style={S.input} placeholder="e.g. Office Closing Checklist" value={title} onChange={e => setTitle(e.target.value)} />
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
                    <input style={S.itemInput} placeholder="Task label" value={task.label} onChange={e => updateTask(si, ti, { label: e.target.value })} />
                    <select style={S.typeSelect} value={task.type} onChange={e => updateTask(si, ti, { type: e.target.value as ItemType })}>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <label style={S.reqLabel}>
                      <input type="checkbox" checked={task.required} onChange={e => updateTask(si, ti, { required: e.target.checked })} style={{ accentColor: "#111" }} />
                      Required
                    </label>
                    <div style={S.moveBtns}>
                      <button style={S.moveBtn} onClick={() => moveTask(si, ti, -1)}>↑</button>
                      <button style={S.moveBtn} onClick={() => moveTask(si, ti, 1)}>↓</button>
                    </div>
                    {sec.tasks.length > 1 && <button style={S.removeBtn} onClick={() => removeTask(si, ti)}>×</button>}
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