"use client";

import { useEffect, useState } from "react";
import { type Response } from "./types";

export function ApprovalsTab() {
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

  return (
    <div className="max-w-215 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">承認</div>
      <div className="text-sm text-[#6a5d8e] mb-9">提出されたチェックリストを確認・承認します。</div>
      <div className="flex gap-1.75 mb-6.5">
        <button
          className={filter === "pending"
            ? "text-sm font-bold text-[#4f35be] bg-linear-to-br from-[#ede9fe] to-[#ddd6fe] border-[1.5px] border-[#c4b5fd] rounded-[10px] py-1.5 sm:py-2 px-3 sm:px-4.5 cursor-pointer font-[inherit] shadow-[0_1px_6px_rgba(79,53,190,0.14)]"
            : "text-sm font-normal text-[#7a6aaa] bg-[#faf9ff] border-[1.5px] border-[#dfd5fb] rounded-[10px] py-1.5 sm:py-2 px-3 sm:px-4.5 cursor-pointer font-[inherit]"
          }
          onClick={() => setFilter("pending")}
        >
          承認待ち ({pending.length})
        </button>
        <button
          className={filter === "approved"
            ? "text-sm font-bold text-[#4f35be] bg-linear-to-br from-[#ede9fe] to-[#ddd6fe] border-[1.5px] border-[#c4b5fd] rounded-[10px] py-1.5 sm:py-2 px-3 sm:px-4.5 cursor-pointer font-[inherit] shadow-[0_1px_6px_rgba(79,53,190,0.14)]"
            : "text-sm font-normal text-[#7a6aaa] bg-[#faf9ff] border-[1.5px] border-[#dfd5fb] rounded-[10px] py-1.5 sm:py-2 px-3 sm:px-4.5 cursor-pointer font-[inherit]"
          }
          onClick={() => setFilter("approved")}
        >
          承認済み ({approved.length})
        </button>
      </div>
      {loading ? (
        <div className="py-20 text-center text-sm text-[#a696f2]">読み込み中…</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-sm text-[#a696f2]">
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
          <div
            key={resp.id}
            className="border-[1.5px] border-[#dfd5fb] hover:border-[#c4b5fd] rounded-2xl mb-3 overflow-hidden bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)] hover:shadow-[0_4px_20px_rgba(79,53,190,0.12)] transition-all duration-180 ease-in-out"
          >
            <div className="flex items-start justify-between py-4 sm:py-5 px-4 sm:px-6 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : resp.id)}>
              <div className="flex-1">
                <div className="text-base sm:text-lg font-semibold text-[#1a1035] mb-1.25">
                  {resp.submitted_by}
                  {resp.other_user_name && <span className="font-normal text-[#a78bfa] ml-1.5">(その他)</span>}
                  <span className="font-normal text-[#9688c0] ml-2">— {resp.checklists?.title || "不明"}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {resp.departments?.name && (
                    <span className="text-xs bg-linear-to-br from-[#ede9fe] to-[#ddd6fe] text-[#4f35be] border border-[#c4b5fd] rounded-full py-1 px-3 font-semibold">
                      {resp.departments.name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#7a6aaa] mb-1.75">
                  {new Date(resp.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}タスク完了 {completedCount}/{checkboxItems.length}
                  {incompleteItems.length > 0 && <span className="text-[#f97316] ml-1.5 font-semibold">· 未完了 {incompleteItems.length}件</span>}
                </div>
              </div>
              <span className="text-xs text-[#8c70e8] bg-transparent border-none cursor-pointer ml-2">{isExpanded ? "▲" : "▼"}</span>
            </div>
            {isExpanded && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 [border-top:1.5px_solid_#ede9fe]">
                {resp.reason?.trim() && (
                  <>
                    <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mt-5 mb-3">提出理由</div>
                    <div className="bg-linear-to-br from-[#f5f0fe] to-[#ede9fe] border-[1.5px] border-[#dfd5fb] rounded-[10px] py-3.5 px-4.5 text-sm text-[#4b3d80] mt-2.5">
                      {resp.reason}
                    </div>
                  </>
                )}
                {checkboxItems.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mt-5 mb-3">タスク</div>
                    {checkboxItems.map(item => (
                      <div key={item.id} className="flex items-start gap-2.5 py-2.5 border-b border-b-[#f5f0fe]">
                        <span className={`text-base font-black shrink-0 ${item.value === "true" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{item.value === "true" ? "✓" : "✗"}</span>
                        <span className="text-sm text-[#5e5090] min-w-50 shrink-0">{item.checklist_items?.label}</span>
                      </div>
                    ))}
                  </>
                )}
                {textItems.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mt-5 mb-3">テキスト回答</div>
                    {textItems.map(item => (
                      <div key={item.id} className="flex items-start gap-2.5 py-2.5 border-b border-b-[#f5f0fe]">
                        <span className="text-sm text-[#5e5090] min-w-50 shrink-0">{item.checklist_items?.label}</span>
                        <span className="text-sm text-[#1a1035] flex-1 font-medium">{item.value || <em className="text-[#c4b5fd]">未回答</em>}</span>
                      </div>
                    ))}
                  </>
                )}
                {filter === "approved" && approval && (
                  <>
                    <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mt-5 mb-3">承認詳細</div>
                    <div className="bg-linear-to-br from-[#f5f0fe] to-[#ede9fe] border-[1.5px] border-[#dfd5fb] rounded-[10px] py-3.5 px-4.5 text-sm text-[#4b3d80] mt-2.5">
                      <div className="text-sm text-[#1a1035] mb-1"><strong>承認者：</strong> {approval.approved_by || "—"}</div>
                      {approval.reason && <div className="text-sm text-[#4b3d80] mb-1"><strong>コメント：</strong> {approval.reason}</div>}
                      <div className="text-xs text-[#a78bfa]">
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
