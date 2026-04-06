"use client";

import { useState, useEffect } from "react";
import { createClient, Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ItemType = "checkbox" | "text" | "textarea";
type ChecklistItem = { id?: number; label: string; type: ItemType; required: boolean; order_index: number; };
type Checklist = { id: number; title: string; created_by: string; created_at: string; checklist_items?: ChecklistItem[]; };

const TYPE_LABELS: Record<ItemType, string> = { checkbox: "Checkbox", text: "Short text", textarea: "Long text" };
const TYPE_COLOR: Record<ItemType, string> = { checkbox: "#16a34a", text: "#2563eb", textarea: "#7c3aed" };

export default function AdminDashboardWrapper() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) { window.location.href = "/admin/login"; return; }
      setSession(session);
      setBooting(false);
    });
  }, []);

  if (booting) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#999" }}>
      Loading…
    </div>
  );
  if (!session?.user?.email) return null;
  return <AdminDashboard userEmail={session.user.email} />;
}

function AdminDashboard({ userEmail }: { userEmail: string }) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Checklist | null>(null);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([{ label: "", type: "checkbox", required: true, order_index: 0 }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { fetchChecklists(); }, []);

  const fetchChecklists = async () => {
    setLoading(true);
    const { data } = await supabase.from("checklists").select("*, checklist_items(*)").order("created_at", { ascending: false });
    setChecklists(data || []);
    setLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = "/admin/login"; };

  const startCreate = () => {
    setTitle(""); setItems([{ label: "", type: "checkbox", required: true, order_index: 0 }]);
    setSaveError(""); setEditTarget(null); setView("create");
  };

  const startEdit = (cl: Checklist) => {
    setTitle(cl.title);
    const sorted = [...(cl.checklist_items || [])].sort((a, b) => a.order_index - b.order_index);
    setItems(sorted.length ? sorted : [{ label: "", type: "checkbox", required: true, order_index: 0 }]);
    setSaveError(""); setEditTarget(cl); setView("edit");
  };

  const addItem = () => setItems(p => [...p, { label: "", type: "checkbox", required: true, order_index: p.length }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i).map((x, j) => ({ ...x, order_index: j })));
  const updateItem = (i: number, patch: Partial<ChecklistItem>) => setItems(p => p.map((x, j) => j === i ? { ...x, ...patch } : x));
  const moveItem = (i: number, dir: -1 | 1) => {
    const n = [...items]; const s = i + dir;
    if (s < 0 || s >= n.length) return;
    [n[i], n[s]] = [n[s], n[i]];
    setItems(n.map((x, j) => ({ ...x, order_index: j })));
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("Title is required."); return; }
    if (items.some(x => !x.label.trim())) { setSaveError("All items need a label."); return; }
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(editTarget ? `/api/checklists/${editTarget.id}` : "/api/checklists", {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, items, created_by: userEmail }),
      });
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
    root: { minHeight: "100vh", background: "#ffffff", fontFamily: "'Inter', system-ui, sans-serif", color: "#111" },
    nav: { height: 56, borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky" as const, top: 0, background: "#fff", zIndex: 50 },
    navLogo: { fontWeight: 700, fontSize: 15, color: "#111", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 },
    navDot: { width: 8, height: 8, borderRadius: "50%", background: "#111" },
    navRight: { display: "flex", alignItems: "center", gap: 16 },
    navEmail: { fontSize: 12, color: "#999" },
    signOutBtn: { fontSize: 12, color: "#666", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    main: { maxWidth: 780, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 13, color: "#999", marginBottom: 40 },
    toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
    countLabel: { fontSize: 12, color: "#bbb" },
    newBtn: { fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer" },
    card: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "20px 24px", marginBottom: 10, background: "#fff", transition: "border-color 0.15s" },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 3, letterSpacing: "-0.01em" },
    cardMeta: { fontSize: 11, color: "#bbb", marginBottom: 14 },
    cardRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    cardBtns: { display: "flex", gap: 6, flexShrink: 0 },
    editBtn: { fontSize: 12, color: "#555", background: "#f7f7f7", border: "1px solid #ebebeb", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    shareBtn: { fontSize: 12, color: "#2563eb", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    delBtn: { fontSize: 12, color: "#dc2626", background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
    chipsRow: { display: "flex", flexWrap: "wrap" as const, gap: 5 },
    chip: { fontSize: 11, padding: "2px 9px", borderRadius: 100, fontWeight: 500 },
    emptyWrap: { textAlign: "center" as const, padding: "80px 0" },
    emptyTitle: { fontSize: 18, fontWeight: 600, color: "#111", marginBottom: 6 },
    emptyText: { fontSize: 13, color: "#aaa", marginBottom: 28 },
    back: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#999", cursor: "pointer", marginBottom: 32, background: "none", border: "none", padding: 0 },
    section: { border: "1px solid #f0f0f0", borderRadius: 12, padding: "28px", marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 20 },
    fieldLabel: { display: "block", fontSize: 12, fontWeight: 500, color: "#666", marginBottom: 7 },
    input: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 13px", fontSize: 14, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit" },
    itemRow: { display: "flex", alignItems: "center", gap: 8, background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 9, padding: "10px 12px", marginBottom: 8 },
    itemNum: { fontSize: 11, color: "#ccc", minWidth: 20, textAlign: "right" as const, flexShrink: 0 },
    itemInput: { flex: 1, border: "1px solid #e5e5e5", borderRadius: 7, padding: "8px 11px", fontSize: 13, color: "#111", outline: "none", background: "#fff", fontFamily: "inherit", minWidth: 0 },
    typeSelect: { border: "1px solid #e5e5e5", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#555", background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit" },
    reqLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#888", cursor: "pointer", flexShrink: 0 },
    moveBtns: { display: "flex", flexDirection: "column" as const, gap: 1, flexShrink: 0 },
    moveBtn: { background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, padding: "1px 4px", lineHeight: 1 },
    removeBtn: { background: "none", border: "none", color: "#ddd", cursor: "pointer", fontSize: 18, padding: "2px 5px", lineHeight: 1, flexShrink: 0 },
    addBtn: { width: "100%", border: "1.5px dashed #e5e5e5", borderRadius: 9, padding: 12, fontSize: 13, color: "#bbb", background: "none", cursor: "pointer", marginTop: 4, fontFamily: "inherit" },
    footer: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 },
    errText: { flex: 1, fontSize: 12, color: "#dc2626" },
    cancelBtn: { fontSize: 13, color: "#666", background: "#f7f7f7", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: "inherit" },
    saveBtn: { fontSize: 13, fontWeight: 600, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontFamily: "inherit" },
  };

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div style={S.navLogo}>
          <div style={S.navDot} />
          OfficeAdmin
        </div>
        <div style={S.navRight}>
          <span style={S.navEmail}>{userEmail}</span>
          <button style={S.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

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
              const sorted = [...(cl.checklist_items || [])].sort((a, b) => a.order_index - b.order_index);
              const preview = sorted.slice(0, 5);
              const extra = sorted.length - preview.length;
              return (
                <div key={cl.id} style={S.card}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#e0e0e0")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#f0f0f0")}
                >
                  <div style={S.cardRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardTitle}>{cl.title}</div>
                      <div style={S.cardMeta}>{sorted.length} items · {cl.created_by} · {new Date(cl.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div style={S.cardBtns}>
                      <button style={S.shareBtn} onClick={() => { const url = `${window.location.origin}/office-checklist/${cl.id}`; navigator.clipboard.writeText(url).then(() => alert("Link copied: " + url)); }}>Copy link</button>
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
            <div style={{ ...S.pageSubtitle, marginBottom: 32 }}>{view === "create" ? "Define the tasks your team will complete." : "Update tasks and settings."}</div>

            <div style={S.section}>
              <div style={S.sectionTitle}>General</div>
              <label style={S.fieldLabel}>Title</label>
              <input style={S.input} placeholder="e.g. Office Closing Checklist" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Items</div>
              {items.map((item, idx) => (
                <div key={idx} style={S.itemRow}>
                  <span style={S.itemNum}>{idx + 1}</span>
                  <input style={S.itemInput} placeholder="Task label" value={item.label} onChange={e => updateItem(idx, { label: e.target.value })} />
                  <select style={S.typeSelect} value={item.type} onChange={e => updateItem(idx, { type: e.target.value as ItemType })}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <label style={S.reqLabel}>
                    <input type="checkbox" checked={item.required} onChange={e => updateItem(idx, { required: e.target.checked })} style={{ accentColor: "#111" }} />
                    Required
                  </label>
                  <div style={S.moveBtns}>
                    <button style={S.moveBtn} onClick={() => moveItem(idx, -1)}>↑</button>
                    <button style={S.moveBtn} onClick={() => moveItem(idx, 1)}>↓</button>
                  </div>
                  <button style={S.removeBtn} onClick={() => removeItem(idx)}>×</button>
                </div>
              ))}
              <button style={S.addBtn} onClick={addItem}>+ Add item</button>
            </div>

            <div style={S.footer}>
              {saveError && <span style={S.errText}>⚠ {saveError}</span>}
              <button style={S.cancelBtn} onClick={() => setView("list")}>Cancel</button>
              <button style={S.saveBtn} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : view === "create" ? "Create" : "Save changes"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}