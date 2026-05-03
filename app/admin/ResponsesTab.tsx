"use client";

import { useEffect, useState } from "react";
import { type Response } from "./types";

type Props = {
  isMainAdmin: boolean;
};

export function ResponsesTab({ isMainAdmin }: Props) {
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
    const [respRes, clRes, deptRes] = await Promise.all([
      fetch("/api/responses"),
      fetch("/api/checklists"),
      fetch("/api/departments"),
    ]);
    const [respData, clData, deptData] = await Promise.all([
      respRes.json(),
      clRes.json(),
      deptRes.json(),
    ]);
    const respArr = Array.isArray(respData) ? respData : [];
    const allDepts: { id: number; name: string }[] = Array.isArray(deptData) ? deptData : [];

    setResponses(respArr);
    setChecklists(Array.isArray(clData) ? clData : []);

    if (isMainAdmin) {
      setDepartments(allDepts);
    } else {
      // Responses are already server-filtered to the sub-admin's checklists.
      // Show only the departments that actually appear in those responses.
      const usedIds = new Set(respArr.map((r: any) => r.department_id).filter(Boolean));
      setDepartments(allDepts.filter(d => usedIds.has(d.id)));
    }

    setLoading(false);
  };

  const filtered = responses
    .filter(r => filterChecklist === "all" || String(r.checklist_id) === filterChecklist)
    .filter(r => filterDept === "all" || String((r as any).department_id) === filterDept);

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "-20px auto", padding: "56px 32px" },
    pageTitle: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 8 },
    pageSubtitle: { fontSize: 15, color: "#6a5d8e", marginBottom: 36 },
    toolbar: {
      display: "flex", alignItems: "center", gap: 10,
      justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap" as const
    },
    filterSelect: {
      border: "1.5px solid #ccc0fa", borderRadius: 10, padding: "9px 15px",
      fontSize: 14, color: "#4b3d80", background: "#faf9ff", outline: "none",
      cursor: "pointer", fontFamily: "inherit", fontWeight: 500
    },
    card: {
      border: "1.5px solid #dfd5fb", borderRadius: 16, marginBottom: 12,
      overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 14px rgba(79,53,190,0.09)", transition: "all 0.18s ease"
    },
    cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", cursor: "pointer" },
    cardHeaderLeft: { display: "flex", flexDirection: "column", gap: 5 },
    cardTitle: { fontSize: 17, fontWeight: 600, color: "#1a1035" },
    cardMeta: { fontSize: 13, color: "#7a6aaa" },
    badge: { fontSize: 12, fontWeight: 700, padding: "4px 13px", borderRadius: 100 },
    expandBtn: { fontSize: 13, color: "#8c70e8", background: "none", border: "none", cursor: "pointer" },
    cardBody: { padding: "0 24px 24px", borderTop: "1.5px solid #ede9fe" },
    sectionTitle: {
      fontSize: 12, fontWeight: 700, color: "#8c70e8",
      textTransform: "uppercase", letterSpacing: "0.12em", margin: "20px 0 12px"
    },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #f5f0fe" },
    itemLabel: { fontSize: 15, color: "#5e5090", minWidth: 180, flexShrink: 0 },
    itemValue: { fontSize: 15, color: "#1a1035", flex: 1, fontWeight: 500 },
    reasonBox: {
      background: "linear-gradient(135deg, #f5f0fe 0%, #ede9fe 100%)",
      border: "1.5px solid #dfd5fb", borderRadius: 10,
      padding: "14px 18px", fontSize: 15, color: "#4b3d80", marginTop: 10
    },
    deptBadge: {
      fontSize: 12, fontWeight: 600,
      background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      color: "#4f35be", border: "1px solid #c4b5fd",
      borderRadius: 100, padding: "4px 12px"
    },
    countLabel: { fontSize: 14, color: "#8c70e8", fontWeight: 600 },
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
