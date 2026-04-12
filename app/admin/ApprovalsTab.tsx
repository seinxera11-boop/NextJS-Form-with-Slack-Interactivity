"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type Response } from "./types";

export function ApprovalsTab({ userEmail }: { userEmail: string }) {
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
      .select(`*, checklists(title), departments(name), org_users(name), response_items(*, checklist_items(label, type)), response_approvals(*)`)
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
    pageTitle: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "#111", marginBottom: 4 },
    pageSubtitle: { fontSize: 14, color: "#999", marginBottom: 32 },
    filterRow: { display: "flex", gap: 6, marginBottom: 20 },
    filterBtnActive: { fontSize: 14, fontWeight: 600, color: "#111", background: "#f0f0f0", border: "1px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
    filterBtnInactive: { fontSize: 14, fontWeight: 400, color: "#999", background: "none", border: "1px solid #f0f0f0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
    card: { border: "1px solid #f0f0f0", borderRadius: 12, marginBottom: 10, overflow: "hidden", background: "#fff" },
    cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer" },
    cardHeaderLeft: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 3 },
    cardMeta: { fontSize: 12, color: "#bbb", marginBottom: 6 },
    cardBody: { padding: "0 20px 20px", borderTop: "1px solid #f5f5f5" },
    sectionTitle: { fontSize: 12, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 10px" },
    itemRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f9f9f9" },
    itemLabel: { fontSize: 14, color: "#555", minWidth: 200, flexShrink: 0 },
    itemValue: { fontSize: 14, color: "#111", flex: 1 },
    reasonInput: { width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 13px", fontSize: 14, color: "#111", outline: "none", background: "#fafafa", fontFamily: "inherit", resize: "vertical", marginTop: 8, boxSizing: "border-box" as const },
    approveBtn: { fontSize: 14, fontWeight: 600, color: "#fff", background: "#16a34a", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
    reasonBox: { background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#555", marginTop: 8 },
    expandBtn: { fontSize: 13, color: "#999", background: "none", border: "none", cursor: "pointer", marginLeft: 8 },
    deptBadge: { fontSize: 12, background: "#f0f4ff", color: "#3b5bdb", border: "1px solid #d0d9ff", borderRadius: 100, padding: "2px 8px", fontWeight: 500 },
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
        <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#ccc" }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", fontSize: 14, color: "#bbb" }}>
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
                  {resp.other_user_name && <span style={{ fontWeight: 400, color: "#999", marginLeft: 6 }}>(other)</span>}
                  <span style={{ fontWeight: 400, color: "#999", marginLeft: 8 }}>— {resp.checklists?.title || "Unknown"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  {resp.departments?.name && <span style={S.deptBadge}>{resp.departments.name}</span>}
                </div>
                <div style={S.cardMeta}>
                  {new Date(resp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{completedCount}/{checkboxItems.length} tasks checked
                  {incompleteItems.length > 0 && <span style={{ color: "#ea580c", marginLeft: 6 }}>· {incompleteItems.length} incomplete</span>}
                </div>
              </div>
              <span style={S.expandBtn}>{isExpanded ? "▲" : "▼"}</span>
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
                {filter === "pending" && (
                  <>
                    <div style={S.sectionTitle}>Approve</div>
                    <textarea
                      style={S.reasonInput} rows={2}
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
                {filter === "approved" && approval && (
                  <>
                    <div style={S.sectionTitle}>Approval Details</div>
                    <div style={S.reasonBox}>
                      <div style={{ fontSize: 14, color: "#111", marginBottom: 4 }}><strong>Approved by:</strong> {approval.approved_by || "—"}</div>
                      {approval.reason && <div style={{ fontSize: 14, color: "#555", marginBottom: 4 }}><strong>Note:</strong> {approval.reason}</div>}
                      <div style={{ fontSize: 12, color: "#bbb" }}>
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