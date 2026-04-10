"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
type ItemType = "checkbox" | "text" | "textarea";

type ChecklistTask = {
  id?: number;
  label: string;
  type: ItemType;
  required: boolean;
  order_index: number;
};

type ChecklistSection = {
  id?: number;
  title: string;
  order_index: number;
  tasks: ChecklistTask[];
  checklist_items?: ChecklistTask[];
};

type Checklist = {
  id: number;
  title: string;
  created_by: string;
  created_at: string;
  checklist_sections?: ChecklistSection[];
};

type ResponseItem = {
  id: number;
  checklist_item_id: number;
  value: string;
  checklist_items?: { label: string; type: string };
};

type ResponseApproval = {
  id: number;
  reason: string;
  approved_by: string;
  approved_at: string;
};

type Response = {
  id: number;
  checklist_id: number;
  submitted_by: string;
  reason: string | null;
  created_at: string;
  checklists?: { title: string };
  response_items?: ResponseItem[];
  response_approvals?: ResponseApproval[];
};

const TYPE_LABELS: Record<ItemType, string> = {
  checkbox: "Checkbox",
  text: "Short text",
  textarea: "Long text",
};
const TYPE_COLOR: Record<ItemType, string> = {
  checkbox: "#16a34a",
  text: "#2563eb",
  textarea: "#7c3aed",
};

export default function AdminDashboardWrapper() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/admin/login"; return; }
      setSession(data.session);
      setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { window.location.href = "/admin/login"; return; }
      setSession(session);
      setBooting(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (booting) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#999" }}>
      Loading…
    </div>
  );
  if (!session?.user?.email) return null;
  return <AdminDashboard userEmail={session.user.email} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SHELL
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard({ userEmail }: { userEmail: string }) {
  const [tab, setTab] = useState<"checklists" | "responses" | "approvals">("checklists");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const S: Record<string, React.CSSProperties> = {
    root: { minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#111" },
    nav: { height: 56, borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, background: "#fff", zIndex: 50 },
    navLeft: { display: "flex", alignItems: "center", gap: 24 },
    navLogo: { fontWeight: 700, fontSize: 15, color: "#111", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 },
    navDot: { width: 8, height: 8, borderRadius: "50%", background: "#111" },
    navRight: { display: "flex", alignItems: "center", gap: 16 },
    navEmail: { fontSize: 12, color: "#999" },
    signOutBtn: { fontSize: 12, color: "#666", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
  };

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div style={S.navLeft}>
          <div style={S.navLogo}><div style={S.navDot} />OfficeAdmin</div>
          <TabNav tab={tab} setTab={setTab} />
        </div>
        <div style={S.navRight}>
          <span style={S.navEmail}>{userEmail}</span>
          <button style={S.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {tab === "checklists" && <ChecklistsTab userEmail={userEmail} />}
      {tab === "responses"  && <ResponsesTab />}
      {tab === "approvals"  && <ApprovalsTab userEmail={userEmail} />}
    </div>
  );
}

function TabNav({ tab, setTab }: { tab: string; setTab: (t: any) => void }) {
  const tabs = [
    { key: "checklists", label: "Checklists" },
    { key: "responses",  label: "Responses"  },
    { key: "approvals",  label: "Approvals"  },
  ];
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? "#111" : "#999",
            background: "none", border: "none", cursor: "pointer",
            padding: "6px 12px", borderRadius: 6,
            // background: tab === t.key ? "#f5f5f5" : "none",
          } as React.CSSProperties}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLISTS TAB  (your existing create/edit logic, unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function ChecklistsTab({ userEmail }: { userEmail: string }) {
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
      ? { ...s, tasks: [...s.tasks, { label: "", type: "checkbox", required: true, order_index: s.tasks.length }] }
      : s));

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
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 13, color: "#999", marginBottom: 40 },
    toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    countLabel: { fontSize: 12, color: "#bbb" },
    newBtn: { fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer" },
    card: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "20px 24px", marginBottom: 10, background: "#fff", transition: "border-color 0.15s" },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 3 },
    cardMeta: { fontSize: 11, color: "#bbb", marginBottom: 14 },
    cardRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    cardBtns: { display: "flex", gap: 6, flexShrink: 0 },
    editBtn: { fontSize: 12, color: "#555", background: "#f7f7f7", border: "1px solid #ebebeb", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    shareBtn: { fontSize: 12, color: "#2563eb", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    delBtn: { fontSize: 12, color: "#dc2626", background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    chipsRow: { display: "flex", flexWrap: "wrap", gap: 5 },
    chip: { fontSize: 11, padding: "2px 9px", borderRadius: 100, fontWeight: 500 },
    emptyWrap: { textAlign: "center", padding: "80px 0" },
    emptyTitle: { fontSize: 18, fontWeight: 600, color: "#111", marginBottom: 6 },
    emptyText: { fontSize: 13, color: "#aaa", marginBottom: 28 },
    back: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#999", cursor: "pointer", marginBottom: 32, background: "none", border: "none", padding: 0 },
    genSection: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "28px", marginBottom: 16 },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 },
    fieldLabel: { display: "block", fontSize: 12, fontWeight: 500, color: "#666", marginBottom: 7 },
    input: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 13px", fontSize: 14, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit" },
    secCard: { border: "1px solid #f0f0f0", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
    secHeader: { display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "#fafafa", borderBottom: "1px solid #f0f0f0" },
    secNum: { fontSize: 11, fontWeight: 600, color: "#bbb", minWidth: 20 },
    secTitleInput: { flex: 1, border: "1px solid #e5e5e5", borderRadius: 7, padding: "8px 12px", fontSize: 14, fontWeight: 600, color: "#111", outline: "none", background: "#fff", fontFamily: "inherit" },
    secActions: { display: "flex", gap: 4, flexShrink: 0 },
    iconBtn: { background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, padding: "4px 6px", borderRadius: 5, lineHeight: 1 },
    removeSec: { background: "none", border: "none", color: "#ddd", cursor: "pointer", fontSize: 18, padding: "2px 6px", lineHeight: 1 },
    tasksArea: { padding: "10px 18px 14px" },
    itemRow: { display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #f5f5f5", borderRadius: 8, padding: "9px 11px", marginBottom: 6 },
    itemNum: { fontSize: 11, color: "#ddd", minWidth: 18, textAlign: "right", flexShrink: 0 },
    itemInput: { flex: 1, border: "1px solid #e5e5e5", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", minWidth: 0 },
    typeSelect: { border: "1px solid #e5e5e5", borderRadius: 7, padding: "7px 9px", fontSize: 12, color: "#555", background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit" },
    reqLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#888", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
    moveBtns: { display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 },
    moveBtn: { background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, padding: "1px 4px", lineHeight: 1 },
    removeBtn: { background: "none", border: "none", color: "#ddd", cursor: "pointer", fontSize: 18, padding: "2px 5px", lineHeight: 1, flexShrink: 0 },
    addTaskBtn: { width: "100%", border: "1.5px dashed #e5e5e5", borderRadius: 8, padding: 10, fontSize: 12, color: "#bbb", background: "none", cursor: "pointer", marginTop: 4, fontFamily: "inherit" },
    addSecBtn: { width: "100%", border: "1.5px dashed #d5d5d5", borderRadius: 12, padding: "13px 12px", fontSize: 13, color: "#aaa", background: "none", cursor: "pointer", marginTop: 4, fontFamily: "inherit", fontWeight: 500 },
    footer: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 20 },
    errText: { flex: 1, fontSize: 12, color: "#dc2626" },
    cancelBtn: { fontSize: 13, color: "#666", background: "#f7f7f7", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: "inherit" },
    saveBtn: { fontSize: 13, fontWeight: 600, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontFamily: "inherit" },
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
            <div style={{ padding: "80px 0", textAlign: "center", fontSize: 13, color: "#ccc" }}>Loading…</div>
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
                  {extra > 0 && <span style={{ fontSize: 11, color: "#ccc", padding: "2px 4px" }}>+{extra} more</span>}
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

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSES TAB
// ─────────────────────────────────────────────────────────────────────────────
function ResponsesTab() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterChecklist, setFilterChecklist] = useState<string>("all");
  const [checklists, setChecklists] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    fetchResponses();
    fetchChecklistTitles();
  }, []);

  const fetchChecklistTitles = async () => {
    const { data } = await supabase.from("checklists").select("id, title").order("title");
    setChecklists(data || []);
  };

  const fetchResponses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("responses")
      .select(`
        *,
        checklists(title),
        response_items(*, checklist_items(label, type)),
        response_approvals(*)
      `)
      .order("created_at", { ascending: false });
    setResponses(data || []);
    setLoading(false);
  };

  const filtered = filterChecklist === "all"
    ? responses
    : responses.filter(r => String(r.checklist_id) === filterChecklist);

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 13, color: "#999", marginBottom: 32 },
    toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    filterSelect: { border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#555", background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit" },
    card: { border: "1px solid #f0f0f0", borderRadius: 12, marginBottom: 10, overflow: "hidden", background: "#fff" },
    cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer" },
    cardHeaderLeft: { display: "flex", flexDirection: "column", gap: 3 },
    cardTitle: { fontSize: 14, fontWeight: 600, color: "#111" },
    cardMeta: { fontSize: 11, color: "#bbb" },
    badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100 },
    expandBtn: { fontSize: 12, color: "#999", background: "none", border: "none", cursor: "pointer" },
    cardBody: { padding: "0 20px 20px", borderTop: "1px solid #f5f5f5" },
    sectionTitle: { fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 10px" },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f9f9f9" },
    itemLabel: { fontSize: 13, color: "#555", minWidth: 180, flexShrink: 0 },
    itemValue: { fontSize: 13, color: "#111", flex: 1 },
    reasonBox: { background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#555", marginTop: 8 },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>Responses</div>
      <div style={S.pageSubtitle}>All submitted checklist responses.</div>

      <div style={S.toolbar}>
        <span style={{ fontSize: 12, color: "#bbb" }}>{filtered.length} response{filtered.length !== 1 ? "s" : ""}</span>
        <select style={S.filterSelect} value={filterChecklist} onChange={e => setFilterChecklist(e.target.value)}>
          <option value="all">All checklists</option>
          {checklists.map(cl => <option key={cl.id} value={String(cl.id)}>{cl.title}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 13, color: "#ccc" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", fontSize: 13, color: "#bbb" }}>No responses yet.</div>
      ) : filtered.map(resp => {
        const isExpanded = expanded === resp.id;
        const isApproved = (resp.response_approvals || []).length > 0;
        const checkboxItems = (resp.response_items || []).filter(i => i.checklist_items?.type === "checkbox");
        const textItems = (resp.response_items || []).filter(i => i.checklist_items?.type !== "checkbox");
        const completedCount = checkboxItems.filter(i => i.value === "true").length;

        return (
          <div key={resp.id} style={S.card}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#e0e0e0")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#f0f0f0")}
          >
            <div style={S.cardHeader} onClick={() => setExpanded(isExpanded ? null : resp.id)}>
              <div style={S.cardHeaderLeft}>
                <div style={S.cardTitle}>
                  {resp.submitted_by}
                  <span style={{ fontWeight: 400, color: "#999", marginLeft: 8 }}>— {resp.checklists?.title || "Unknown checklist"}</span>
                </div>
                <div style={S.cardMeta}>
                  {new Date(resp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{completedCount}/{checkboxItems.length} tasks checked
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  ...S.badge,
                  background: isApproved ? "#f0fdf4" : "#fff7ed",
                  color: isApproved ? "#16a34a" : "#ea580c",
                  border: `1px solid ${isApproved ? "#bbf7d0" : "#fed7aa"}`,
                }}>
                  {isApproved ? "Approved" : "Pending"}
                </span>
                <span style={S.expandBtn}>{isExpanded ? "▲" : "▼"}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={S.cardBody}>
                {/* Submission reason */}
                {resp.reason?.trim() && (
                  <>
                    <div style={S.sectionTitle}>Submission Reason</div>
                    <div style={S.reasonBox}>{resp.reason}</div>
                  </>
                )}

                {/* Checkbox tasks */}
                {checkboxItems.length > 0 && (
                  <>
                    <div style={S.sectionTitle}>Tasks</div>
                    {checkboxItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={{ fontSize: 14 }}>{item.value === "true" ? "✅" : "❌"}</span>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Text answers */}
                {textItems.length > 0 && (
                  <>
                    <div style={S.sectionTitle}>Text Responses</div>
                    {textItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                        <span style={S.itemValue}>{item.value || <em style={{ color: "#ccc" }}>No response</em>}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Approval info */}
                {isApproved && (resp.response_approvals || []).map(ap => (
                  <div key={ap.id}>
                    <div style={S.sectionTitle}>Approval</div>
                    <div style={S.reasonBox}>
                      <div style={{ fontSize: 13, color: "#111", marginBottom: 4 }}>
                        <strong>Approved by:</strong> {ap.approved_by || "—"}
                      </div>
                      {ap.reason && <div style={{ fontSize: 13, color: "#555" }}><strong>Reason:</strong> {ap.reason}</div>}
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>
                        {new Date(ap.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVALS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalsTab({ userEmail }: { userEmail: string }) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved">("pending");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approvalReasons, setApprovalReasons] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { fetchResponses(); }, []);

  const fetchResponses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("responses")
      .select(`
        *,
        checklists(title),
        response_items(*, checklist_items(label, type)),
        response_approvals(*)
      `)
      .order("created_at", { ascending: false });
    setResponses(data || []);
    setLoading(false);
  };

  const handleApprove = async (resp: Response) => {
    setApprovingId(resp.id);
    try {
      const { error } = await supabase.from("response_approvals").insert({
        response_id: resp.id,
        reason: approvalReasons[resp.id] || "",
        approved_by: userEmail,
      });
      if (error) throw error;
      setApprovalReasons(p => { const n = { ...p }; delete n[resp.id]; return n; });
      await fetchResponses();
    } catch (err: any) {
      alert("Failed to approve: " + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const pending  = responses.filter(r => (r.response_approvals || []).length === 0);
  const approved = responses.filter(r => (r.response_approvals || []).length > 0);
  const displayed = filter === "pending" ? pending : approved;

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 13, color: "#999", marginBottom: 32 },
    filterRow: { display: "flex", gap: 6, marginBottom: 20 },
    filterBtnActive: { fontSize: 13, fontWeight: 600, color: "#111", background: "#f0f0f0", border: "1px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
    filterBtnInactive: { fontSize: 13, fontWeight: 400, color: "#999", background: "none", border: "1px solid #f0f0f0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
    card: { border: "1px solid #f0f0f0", borderRadius: 12, marginBottom: 10, overflow: "hidden", background: "#fff" },
    cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer" },
    cardHeaderLeft: { flex: 1 },
    cardTitle: { fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 3 },
    cardMeta: { fontSize: 11, color: "#bbb", marginBottom: 6 },
    cardBody: { padding: "0 20px 20px", borderTop: "1px solid #f5f5f5" },
    sectionTitle: { fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 10px" },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f9f9f9" },
    itemLabel: { fontSize: 13, color: "#555", minWidth: 200, flexShrink: 0 },
    itemValue: { fontSize: 13, color: "#111", flex: 1 },
    reasonInput: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", resize: "vertical", marginTop: 8, boxSizing: "border-box" },
    approveBtn: { fontSize: 13, fontWeight: 600, color: "#fff", background: "#16a34a", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
    reasonBox: { background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#555", marginTop: 8 },
    expandBtn: { fontSize: 12, color: "#999", background: "none", border: "none", cursor: "pointer", marginLeft: 8 },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>Approvals</div>
      <div style={S.pageSubtitle}>Review and approve submitted checklists.</div>

      <div style={S.filterRow}>
        <button style={filter === "pending" ? S.filterBtnActive : S.filterBtnInactive} onClick={() => setFilter("pending")}>
          Pending ({pending.length})
        </button>
        <button style={filter === "approved" ? S.filterBtnActive : S.filterBtnInactive} onClick={() => setFilter("approved")}>
          Approved ({approved.length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 13, color: "#ccc" }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", fontSize: 13, color: "#bbb" }}>
          {filter === "pending" ? "No pending approvals." : "No approved responses yet."}
        </div>
      ) : displayed.map(resp => {
        const isExpanded = expanded === resp.id;
        const checkboxItems = (resp.response_items || []).filter(i => i.checklist_items?.type === "checkbox");
        const textItems = (resp.response_items || []).filter(i => i.checklist_items?.type !== "checkbox");
        const completedCount = checkboxItems.filter(i => i.value === "true").length;
        const incompleteItems = checkboxItems.filter(i => i.value !== "true");
        const approval = (resp.response_approvals || [])[0];

        return (
          <div key={resp.id} style={S.card}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#e0e0e0")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#f0f0f0")}
          >
            <div style={S.cardHeader} onClick={() => setExpanded(isExpanded ? null : resp.id)}>
              <div style={S.cardHeaderLeft}>
                <div style={S.cardTitle}>
                  {resp.submitted_by}
                  <span style={{ fontWeight: 400, color: "#999", marginLeft: 8 }}>— {resp.checklists?.title || "Unknown"}</span>
                </div>
                <div style={S.cardMeta}>
                  {new Date(resp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{completedCount}/{checkboxItems.length} tasks checked
                  {incompleteItems.length > 0 && (
                    <span style={{ color: "#ea580c", marginLeft: 6 }}>· {incompleteItems.length} incomplete</span>
                  )}
                </div>
              </div>
              <span style={S.expandBtn}>{isExpanded ? "▲" : "▼"}</span>
            </div>

            {isExpanded && (
              <div style={S.cardBody}>
                {/* Submission reason */}
                {resp.reason?.trim() && (
                  <>
                    <div style={S.sectionTitle}>Submission Reason</div>
                    <div style={S.reasonBox}>{resp.reason}</div>
                  </>
                )}

                {/* Tasks */}
                {checkboxItems.length > 0 && (
                  <>
                    <div style={S.sectionTitle}>Tasks</div>
                    {checkboxItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={{ fontSize: 14 }}>{item.value === "true" ? "✅" : "❌"}</span>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Text answers */}
                {textItems.length > 0 && (
                  <>
                    <div style={S.sectionTitle}>Text Responses</div>
                    {textItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                        <span style={S.itemValue}>{item.value || <em style={{ color: "#ccc" }}>No response</em>}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Approve action (pending only) */}
                {filter === "pending" && (
                  <>
                    <div style={S.sectionTitle}>Approve</div>
                    <textarea
                      style={S.reasonInput}
                      rows={2}
                      placeholder="Optional: add a note for this approval…"
                      value={approvalReasons[resp.id] || ""}
                      onChange={e => setApprovalReasons(p => ({ ...p, [resp.id]: e.target.value }))}
                    />
                    <button
                      style={{ ...S.approveBtn, opacity: approvingId === resp.id ? 0.6 : 1 }}
                      onClick={() => handleApprove(resp)}
                      disabled={approvingId === resp.id}
                    >
                      {approvingId === resp.id ? "Approving…" : "Approve response"}
                    </button>
                  </>
                )}

                {/* Approval record (approved only) */}
                {filter === "approved" && approval && (
                  <>
                    <div style={S.sectionTitle}>Approval Details</div>
                    <div style={S.reasonBox}>
                      <div style={{ fontSize: 13, color: "#111", marginBottom: 4 }}>
                        <strong>Approved by:</strong> {approval.approved_by || "—"}
                      </div>
                      {approval.reason && (
                        <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
                          <strong>Note:</strong> {approval.reason}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#bbb" }}>
                        {new Date(approval.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}