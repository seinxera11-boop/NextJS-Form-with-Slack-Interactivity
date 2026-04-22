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
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approvalReasons, setApprovalReasons] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { fetchResponses(); }, []);

  const fetchResponses = async () => {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setResponses(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const handleApprove = async (resp: Response) => {
    setApprovingId(resp.id);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_id: resp.id,
          reason: approvalReasons[resp.id] || "",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "承認に失敗しました");
      }
      setApprovalReasons(p => { const n = { ...p }; delete n[resp.id]; return n; });
      await fetchResponses();
    } catch (err: any) {
      alert("承認に失敗しました: " + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const pending  = responses.filter(r => (r.response_approvals || []).length === 0);
  const approved = responses.filter(r => (r.response_approvals || []).length > 0);
  const displayed = filter === "pending" ? pending : approved;

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "0 auto", padding: "52px 32px" },
    pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 6 },
    pageSubtitle: { fontSize: 14, color: "#7c6fa0", marginBottom: 32 },
    filterRow: { display: "flex", gap: 6, marginBottom: 24 },
    filterBtnActive: {
      fontSize: 13, fontWeight: 600, color: "#4f35be",
      background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      border: "1.5px solid #c4b5fd", borderRadius: 10, padding: "7px 16px",
      cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 4px rgba(79,53,190,0.12)"
    } as React.CSSProperties,
    filterBtnInactive: {
      fontSize: 13, fontWeight: 400, color: "#9688c0",
      background: "#faf9ff", border: "1.5px solid #ede9fe",
      borderRadius: 10, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit"
    } as React.CSSProperties,
    card: {
      border: "1.5px solid #ede9fe", borderRadius: 16, marginBottom: 12,
      overflow: "hidden", background: "#fff",
      boxShadow: "0 2px 12px rgba(79,53,190,0.06)", transition: "all 0.18s ease"
    },
    cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px", cursor: "pointer" },
    cardHeaderLeft: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#1a1035", marginBottom: 4 },
    cardMeta: { fontSize: 12, color: "#9688c0", marginBottom: 6 },
    cardBody: { padding: "0 22px 22px", borderTop: "1.5px solid #f5f0ff" },
    sectionTitle: {
      fontSize: 10, fontWeight: 700, color: "#a78bfa",
      textTransform: "uppercase", letterSpacing: "0.12em", margin: "18px 0 10px"
    },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid #faf8ff" },
    itemLabel: { fontSize: 14, color: "#6b5fa0", minWidth: 200, flexShrink: 0 },
    itemValue: { fontSize: 14, color: "#1a1035", flex: 1, fontWeight: 500 },
    reasonInput: {
      width: "100%", border: "1.5px solid #ddd6fe", borderRadius: 10,
      padding: "10px 14px", fontSize: 14, color: "#1a1035", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", resize: "vertical",
      marginTop: 8, boxSizing: "border-box" as const,
      transition: "border-color 0.15s"
    },
    approveBtn: {
      fontSize: 14, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      border: "none", borderRadius: 10, padding: "10px 20px",
      cursor: "pointer", fontFamily: "inherit", marginTop: 10,
      boxShadow: "0 2px 8px rgba(5,150,105,0.3)"
    },
    reasonBox: {
      background: "linear-gradient(135deg, #faf9ff 0%, #f5f0ff 100%)",
      border: "1.5px solid #ede9fe", borderRadius: 10,
      padding: "12px 16px", fontSize: 14, color: "#4b3d80", marginTop: 8
    },
    expandBtn: { fontSize: 12, color: "#a78bfa", background: "none", border: "none", cursor: "pointer", marginLeft: 8 },
    deptBadge: {
      fontSize: 11, background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      color: "#4f35be", border: "1px solid #c4b5fd",
      borderRadius: 100, padding: "3px 10px", fontWeight: 600
    },
    loadingWrap: { padding: "80px 0", textAlign: "center", fontSize: 14, color: "#c4b5fd" },
    emptyWrap: { textAlign: "center", padding: "80px 0", fontSize: 14, color: "#c4b5fd" },
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
                {filter === "pending" && (
                  <>
                    <div style={S.sectionTitle}>承認</div>
                    <textarea
                      style={S.reasonInput} rows={2}
                      placeholder="任意：承認に関するメモを入力…"
                      value={approvalReasons[resp.id] || ""}
                      onChange={e => setApprovalReasons(p => ({ ...p, [resp.id]: e.target.value }))}
                      onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                      onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
                    />
                    <button
                      style={{ ...S.approveBtn, opacity: approvingId === resp.id ? 0.6 : 1 }}
                      onClick={() => handleApprove(resp)}
                      disabled={approvingId === resp.id}
                    >
                      {approvingId === resp.id ? "承認中…" : "回答を承認する"}
                    </button>
                  </>
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
