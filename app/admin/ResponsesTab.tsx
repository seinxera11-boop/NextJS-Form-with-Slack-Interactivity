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
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 6 },
    pageSubtitle: { fontSize: 14, color: "#7c6fa0", marginBottom: 32 },
    toolbar: {
      display: "flex", alignItems: "center", gap: 10,
      justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap" as const
    },
    filterSelect: {
      border: "1.5px solid #ddd6fe", borderRadius: 10, padding: "8px 14px",
      fontSize: 13, color: "#4b3d80", background: "#faf9ff", outline: "none",
      cursor: "pointer", fontFamily: "inherit", fontWeight: 500
    },
    card: {
      border: "1.5px solid #ede9fe", borderRadius: 16, marginBottom: 12,
      overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 12px rgba(79,53,190,0.06)", transition: "all 0.18s ease"
    },
    cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", cursor: "pointer" },
    cardHeaderLeft: { display: "flex", flexDirection: "column", gap: 4 },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#1a1035" },
    cardMeta: { fontSize: 12, color: "#9688c0" },
    badge: { fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 100 },
    expandBtn: { fontSize: 12, color: "#a78bfa", background: "none", border: "none", cursor: "pointer" },
    cardBody: { padding: "0 22px 22px", borderTop: "1.5px solid #f5f0ff" },
    sectionTitle: {
      fontSize: 10, fontWeight: 700, color: "#a78bfa",
      textTransform: "uppercase", letterSpacing: "0.12em", margin: "18px 0 10px"
    },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid #faf8ff" },
    itemLabel: { fontSize: 14, color: "#6b5fa0", minWidth: 180, flexShrink: 0 },
    itemValue: { fontSize: 14, color: "#1a1035", flex: 1, fontWeight: 500 },
    reasonBox: {
      background: "linear-gradient(135deg, #faf9ff 0%, #f5f0ff 100%)",
      border: "1.5px solid #ede9fe", borderRadius: 10,
      padding: "12px 16px", fontSize: 14, color: "#4b3d80", marginTop: 8
    },
    deptBadge: {
      fontSize: 11, fontWeight: 600,
      background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      color: "#4f35be", border: "1px solid #c4b5fd",
      borderRadius: 100, padding: "3px 10px"
    },
    countLabel: { fontSize: 13, color: "#a78bfa", fontWeight: 500 },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>回答一覧</div>
      <div style={S.pageSubtitle}>提出されたすべてのチェックリスト回答です。</div>
      <div style={S.toolbar}>
        <span style={S.countLabel}>{filtered.length}件の回答</span>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={S.filterSelect} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="all">すべての部署</option>
            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <select style={S.filterSelect} value={filterChecklist} onChange={e => setFilterChecklist(e.target.value)}>
            <option value="all">すべてのチェックリスト</option>
            {checklists.map(cl => <option key={cl.id} value={String(cl.id)}>{cl.title}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#c4b5fd" }}>読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", fontSize: 14, color: "#c4b5fd" }}>回答がまだありません。</div>
      ) : filtered.map(resp => {
        const isExpanded = expanded === resp.id;
        const isApproved = (resp.response_approvals || []).length > 0;
        const checkboxItems = (resp.response_items || []).filter(i => i.checklist_items?.type === "checkbox");
        const textItems = (resp.response_items || []).filter(i => i.checklist_items?.type !== "checkbox");
        const completedCount = checkboxItems.filter(i => i.value === "true").length;
        return (
          <div key={resp.id} style={S.card}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4b5fd"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(79,53,190,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede9fe"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(79,53,190,0.06)"; }}
          >
            <div style={S.cardHeader} onClick={() => setExpanded(isExpanded ? null : resp.id)}>
              <div style={S.cardHeaderLeft}>
                <div style={S.cardTitle}>
                  {resp.submitted_by}
                  {resp.other_user_name && <span style={{ fontWeight: 400, color: "#a78bfa", marginLeft: 6 }}>(その他)</span>}
                  <span style={{ fontWeight: 400, color: "#9688c0", marginLeft: 8 }}>— {resp.checklists?.title || "不明なチェックリスト"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {resp.departments?.name && <span style={S.deptBadge}>{resp.departments.name}</span>}
                  <span style={S.cardMeta}>
                    {new Date(resp.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}タスク完了 {completedCount}/{checkboxItems.length}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  ...S.badge,
                  background: isApproved
                    ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                    : "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                  color: isApproved ? "#166534" : "#9a3412",
                  border: `1px solid ${isApproved ? "#bbf7d0" : "#fed7aa"}`
                }}>
                  {isApproved ? "承認済み" : "承認待ち"}
                </span>
                <span style={S.expandBtn}>{isExpanded ? "▲" : "▼"}</span>
              </div>
            </div>
            {isExpanded && (
              <div style={S.cardBody}>
                {resp.reason?.trim() && (
                  <><div style={S.sectionTitle}>提出理由</div><div style={S.reasonBox}>{resp.reason}</div></>
                )}
                {checkboxItems.length > 0 && (
                  <><div style={S.sectionTitle}>タスク</div>
                    {checkboxItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={{ fontSize: 15 }}>{item.value === "true" ? "✅" : "❌"}</span>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                      </div>
                    ))}</>
                )}
                {textItems.length > 0 && (
                  <><div style={S.sectionTitle}>テキスト回答</div>
                    {textItems.map(item => (
                      <div key={item.id} style={S.itemRow}>
                        <span style={S.itemLabel}>{item.checklist_items?.label}</span>
                        <span style={S.itemValue}>{item.value || <em style={{ color: "#c4b5fd" }}>未回答</em>}</span>
                      </div>
                    ))}</>
                )}
                {isApproved && (resp.response_approvals || []).map(ap => (
                  <div key={ap.id}>
                    <div style={S.sectionTitle}>承認情報</div>
                    <div style={S.reasonBox}>
                      <div style={{ fontSize: 14, color: "#1a1035", marginBottom: 4 }}><strong>承認者：</strong> {ap.approved_by || "—"}</div>
                      {ap.reason && <div style={{ fontSize: 14, color: "#4b3d80" }}><strong>理由：</strong> {ap.reason}</div>}
                      <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 6 }}>
                        {new Date(ap.approved_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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