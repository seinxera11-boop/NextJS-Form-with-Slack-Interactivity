"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type Response } from "./types";
export function ResponsesTab() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterChecklist, setFilterChecklist] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [checklists, setChecklists] = useState<{ id: number; title: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [respData, clData, deptData] = await Promise.all([
      supabase.from("responses").select(`*, checklists(title), departments(name), org_users(name), response_items(*, checklist_items(label, type)), response_approvals(*)`).order("created_at", { ascending: false }),
      supabase.from("checklists").select("id, title").order("title"),
      supabase.from("departments").select("id, name").order("name"),
    ]);
    setResponses(respData.data || []);
    setChecklists(clData.data || []);
    setDepartments(deptData.data || []);
    setLoading(false);
  };

  const filtered = responses
    .filter(r => filterChecklist === "all" || String(r.checklist_id) === filterChecklist)
    .filter(r => filterDept === "all" || String((r as any).department_id) === filterDept);

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 14, color: "#999", marginBottom: 32 },
    toolbar: { display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap" as const },
    filterSelect: { border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#555", background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit" },
    card: { border: "1px solid #f0f0f0", borderRadius: 12, marginBottom: 10, overflow: "hidden", background: "#fff" },
    cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer" },
    cardHeaderLeft: { display: "flex", flexDirection: "column", gap: 3 },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#111" },
    cardMeta: { fontSize: 12, color: "#bbb" },
    badge: { fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100 },
    expandBtn: { fontSize: 13, color: "#999", background: "none", border: "none", cursor: "pointer" },
    cardBody: { padding: "0 20px 20px", borderTop: "1px solid #f5f5f5" },
    sectionTitle: { fontSize: 12, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 10px" },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f9f9f9" },
    itemLabel: { fontSize: 14, color: "#555", minWidth: 180, flexShrink: 0 },
    itemValue: { fontSize: 14, color: "#111", flex: 1 },
    reasonBox: { background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#555", marginTop: 8 },
    deptBadge: { fontSize: 12, background: "#f0f4ff", color: "#3b5bdb", border: "1px solid #d0d9ff", borderRadius: 100, padding: "2px 8px", fontWeight: 500 },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>Responses</div>
      <div style={S.pageSubtitle}>All submitted checklist responses.</div>
      <div style={S.toolbar}>
        <span style={{ fontSize: 13, color: "#bbb" }}>{filtered.length} response{filtered.length !== 1 ? "s" : ""}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={S.filterSelect} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="all">All departments</option>
            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <select style={S.filterSelect} value={filterChecklist} onChange={e => setFilterChecklist(e.target.value)}>
            <option value="all">All checklists</option>
            {checklists.map(cl => <option key={cl.id} value={String(cl.id)}>{cl.title}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#ccc" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", fontSize: 14, color: "#bbb" }}>No responses yet.</div>
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
                  {resp.other_user_name && <span style={{ fontWeight: 400, color: "#999", marginLeft: 6 }}>(other)</span>}
                  <span style={{ fontWeight: 400, color: "#999", marginLeft: 8 }}>— {resp.checklists?.title || "Unknown checklist"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {resp.departments?.name && <span style={S.deptBadge}>{resp.departments.name}</span>}
                  <span style={S.cardMeta}>
                    {new Date(resp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{completedCount}/{checkboxItems.length} tasks checked
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...S.badge, background: isApproved ? "#f0fdf4" : "#fff7ed", color: isApproved ? "#16a34a" : "#ea580c", border: `1px solid ${isApproved ? "#bbf7d0" : "#fed7aa"}` }}>
                  {isApproved ? "Approved" : "Pending"}
                </span>
                <span style={S.expandBtn}>{isExpanded ? "▲" : "▼"}</span>
              </div>
            </div>
            {isExpanded && (
              <div style={S.cardBody}>
                {resp.reason?.trim() && (
                  <><div style={S.sectionTitle}>Submission Reason</div><div style={S.reasonBox}>{resp.reason}</div></>
                )}
                {checkboxItems.length > 0 && (
                  <><div style={S.sectionTitle}>Tasks</div>
                    {checkboxItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={{ fontSize: 15 }}>{item.value === "true" ? "✅" : "❌"}</span>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                      </div>
                    ))}</>
                )}
                {textItems.length > 0 && (
                  <><div style={S.sectionTitle}>Text Responses</div>
                    {textItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                        <span style={S.itemValue}>{item.value || <em style={{ color: "#ccc" }}>No response</em>}</span>
                      </div>
                    ))}</>
                )}
                {isApproved && (resp.response_approvals || []).map(ap => (
                  <div key={ap.id}>
                    <div style={S.sectionTitle}>Approval</div>
                    <div style={S.reasonBox}>
                      <div style={{ fontSize: 14, color: "#111", marginBottom: 4 }}><strong>Approved by:</strong> {ap.approved_by || "—"}</div>
                      {ap.reason && <div style={{ fontSize: 14, color: "#555" }}><strong>Reason:</strong> {ap.reason}</div>}
                      <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>
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