"use client";

import { useEffect, useState } from "react";
import { type Response } from "./types";

type Props = {
  userEmail: string;
  isMainAdmin: boolean;
  assignedDepartments: number[];
};

export function ApprovalsTab({ userEmail, isMainAdmin, assignedDepartments }: Props) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved">("pending");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { fetchResponses(); }, []);

  const fetchResponses = async () => {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setResponses(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const pending  = responses.filter(r => (r.response_approvals || []).length === 0);
  const approved = responses.filter(r => (r.response_approvals || []).length > 0);
  const displayed = filter === "pending" ? pending : approved;

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "-20px auto", padding: "56px 32px" },
    pageTitle: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 8 },
    pageSubtitle: { fontSize: 15, color: "#6a5d8e", marginBottom: 36 },
    filterRow: { display: "flex", gap: 7, marginBottom: 26 },
    filterBtnActive: {
      fontSize: 14, fontWeight: 700, color: "#4f35be",
      background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "8px 18px",
      cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 6px rgba(79,53,190,0.14)"
    } as React.CSSProperties,
    filterBtnInactive: {
      fontSize: 14, fontWeight: 400, color: "#7a6aaa",
      background: "#faf9ff", border: "1.5px solid #dfd5fb",
      borderRadius: 10, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit"
    } as React.CSSProperties,
    card: {
      border: "1.5px solid #dfd5fb", borderRadius: 16, marginBottom: 12,
      overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 14px rgba(79,53,190,0.09)", transition: "all 0.18s ease"
    },
    cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px", cursor: "pointer" },
    cardHeaderLeft: { flex: 1 },
    cardTitle: { fontSize: 17, fontWeight: 600, color: "#1a1035", marginBottom: 5 },
    cardMeta: { fontSize: 13, color: "#7a6aaa", marginBottom: 7 },
    cardBody: { padding: "0 24px 24px", borderTop: "1.5px solid #ede9fe" },
    sectionTitle: {
      fontSize: 12, fontWeight: 700, color: "#8c70e8",
      textTransform: "uppercase", letterSpacing: "0.12em", margin: "20px 0 12px"
    },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #f5f0fe" },
    itemLabel: { fontSize: 15, color: "#5e5090", minWidth: 200, flexShrink: 0 },
    itemValue: { fontSize: 15, color: "#1a1035", flex: 1, fontWeight: 500 },
    reasonBox: {
      background: "linear-gradient(135deg, #f5f0fe 0%, #ede9fe 100%)",
      border: "1.5px solid #dfd5fb", borderRadius: 10,
      padding: "14px 18px", fontSize: 15, color: "#4b3d80", marginTop: 10
    },
    expandBtn: { fontSize: 13, color: "#8c70e8", background: "none", border: "none", cursor: "pointer", marginLeft: 8 },
    deptBadge: {
      fontSize: 12, background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      color: "#4f35be", border: "1px solid #c4b5fd",
      borderRadius: 100, padding: "4px 12px", fontWeight: 600
    },
    loadingWrap: { padding: "80px 0", textAlign: "center", fontSize: 15, color: "#a696f2" },
    emptyWrap: { textAlign: "center", padding: "80px 0", fontSize: 15, color: "#a696f2" },
  };

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>承認</div>
      <div style={S.pageSubtitle}>提出されたチェックリストを確認・承認します。</div>
      <div style={S.filterRow}>
        <button style={filter === "pending" ? S.filterBtnActive : S.filterBtnInactive} onClick={() => setFilter("pending")}>
          承認待ち ({pending.length})
        </button>
        <button style={filter === "approved" ? S.filterBtnActive : S.filterBtnInactive} onClick={() => setFilter("approved")}>
          承認済み ({approved.length})
        </button>
      </div>
      {loading ? (
        <div style={S.loadingWrap}>読み込み中…</div>
      ) : displayed.length === 0 ? (
        <div style={S.emptyWrap}>
          {filter === "pending" ? "承認待ちの項目はありません。" : "承認済みの回答はまだありません。"}
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
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4b5fd"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(79,53,190,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede9fe"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(79,53,190,0.06)"; }}
          >
            <div style={S.cardHeader} onClick={() => setExpanded(isExpanded ? null : resp.id)}>
              <div style={S.cardHeaderLeft}>
                <div style={S.cardTitle}>
                  {resp.submitted_by}
                  {resp.other_user_name && <span style={{ fontWeight: 400, color: "#a78bfa", marginLeft: 6 }}>(その他)</span>}
                  <span style={{ fontWeight: 400, color: "#9688c0", marginLeft: 8 }}>— {resp.checklists?.title || "不明"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  {resp.departments?.name && <span style={S.deptBadge}>{resp.departments.name}</span>}
                </div>
                <div style={S.cardMeta}>
                  {new Date(resp.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}タスク完了 {completedCount}/{checkboxItems.length}
                  {incompleteItems.length > 0 && <span style={{ color: "#f97316", marginLeft: 6, fontWeight: 600 }}>· 未完了 {incompleteItems.length}件</span>}
                </div>
              </div>
              <span style={S.expandBtn}>{isExpanded ? "▲" : "▼"}</span>
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
                {filter === "approved" && approval && (
                  <>
                    <div style={S.sectionTitle}>承認詳細</div>
                    <div style={S.reasonBox}>
                      <div style={{ fontSize: 14, color: "#1a1035", marginBottom: 4 }}><strong>承認者：</strong> {approval.approved_by || "—"}</div>
                      {approval.reason && <div style={{ fontSize: 14, color: "#4b3d80", marginBottom: 4 }}><strong>メモ：</strong> {approval.reason}</div>}
                      <div style={{ fontSize: 12, color: "#a78bfa" }}>
                        {new Date(approval.approved_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
