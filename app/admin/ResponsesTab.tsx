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

  return (
    <div className="max-w-215 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">回答一覧</div>
      <div className="text-sm text-[#6a5d8e] mb-9">提出されたすべてのチェックリスト回答です。</div>
      <div className="flex items-center gap-2.5 justify-between mb-6 flex-wrap">
        <span className="text-sm text-[#8c70e8] font-semibold">{filtered.length}件の回答</span>
        <div className="flex gap-2">
          <select
            className="border-[1.5px] border-[#ccc0fa] rounded-[10px] py-1.5 sm:py-2.25 px-2.5 sm:px-3.75 text-xs sm:text-sm text-[#4b3d80] bg-[#faf9ff] outline-none cursor-pointer font-[inherit] font-medium"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
          >
            <option value="all">すべての部署</option>
            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <select
            className="border-[1.5px] border-[#ccc0fa] rounded-[10px] py-1.5 sm:py-2.25 px-2.5 sm:px-3.75 text-xs sm:text-sm text-[#4b3d80] bg-[#faf9ff] outline-none cursor-pointer font-[inherit] font-medium"
            value={filterChecklist}
            onChange={e => setFilterChecklist(e.target.value)}
          >
            <option value="all">すべてのチェックリスト</option>
            {checklists.map(cl => <option key={cl.id} value={String(cl.id)}>{cl.title}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="py-20 text-center text-sm text-[#c4b5fd]">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-sm text-[#c4b5fd]">回答がまだありません。</div>
      ) : filtered.map(resp => {
        const isExpanded = expanded === resp.id;
        const isApproved = (resp.response_approvals || []).length > 0;
        const checkboxItems = (resp.response_items || []).filter(i => i.checklist_items?.type === "checkbox");
        const textItems = (resp.response_items || []).filter(i => i.checklist_items?.type !== "checkbox");
        const completedCount = checkboxItems.filter(i => i.value === "true").length;
        return (
          <div
            key={resp.id}
            className="border-[1.5px] border-[#dfd5fb] hover:border-[#c4b5fd] rounded-2xl mb-3 overflow-hidden bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)] hover:shadow-[0_4px_20px_rgba(79,53,190,0.12)] transition-all duration-180 ease-in-out"
          >
            <div
              className="flex items-center justify-between py-4 sm:py-5 px-4 sm:px-6 cursor-pointer"
              onClick={() => setExpanded(isExpanded ? null : resp.id)}
            >
              <div className="flex flex-col gap-1.25">
                <div className="text-base sm:text-lg font-semibold text-[#1a1035]">
                  {resp.submitted_by}
                  {resp.other_user_name && <span className="font-normal text-[#a78bfa] ml-1.5">(その他)</span>}
                  <span className="font-normal text-[#9688c0] ml-2">— {resp.checklists?.title || "不明なチェックリスト"}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(resp.department_name || resp.departments?.name) && (
                    <span className="text-xs font-semibold bg-linear-to-br from-[#ede9fe] to-[#ddd6fe] text-[#4f35be] border border-[#c4b5fd] rounded-full py-1 px-3">
                      {resp.department_name || resp.departments?.name}
                    </span>
                  )}
                  <span className="text-xs text-[#7a6aaa]">
                    {new Date(resp.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}タスク完了 {completedCount}/{checkboxItems.length}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold py-1 px-3.25 rounded-full border ${
                    isApproved
                      ? "bg-linear-to-br from-[#f0fdf4] to-[#dcfce7] text-[#166534] border-[#bbf7d0]"
                      : "bg-linear-to-br from-[#fff7ed] to-[#ffedd5] text-[#9a3412] border-[#fed7aa]"
                  }`}
                >
                  {isApproved ? "承認済み" : "承認待ち"}
                </span>
                <span className="text-xs text-[#8c70e8] bg-transparent border-none cursor-pointer">{isExpanded ? "▲" : "▼"}</span>
              </div>
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
                        <span className="text-sm text-[#5e5090] min-w-45 shrink-0">{item.checklist_items?.label}</span>
                      </div>
                    ))}
                  </>
                )}
                {textItems.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mt-5 mb-3">テキスト回答</div>
                    {textItems.map(item => (
                      <div key={item.id} className="flex items-start gap-2.5 py-2.5 border-b border-b-[#f5f0fe]">
                        <span className="text-sm text-[#5e5090] min-w-45 shrink-0">{item.checklist_items?.label}</span>
                        <span className="text-sm text-[#1a1035] flex-1 font-medium">{item.value || <em className="text-[#c4b5fd]">未回答</em>}</span>
                      </div>
                    ))}
                  </>
                )}
                {isApproved && (resp.response_approvals || []).map(ap => (
                  <div key={ap.id}>
                    <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mt-5 mb-3">承認情報</div>
                    <div className="bg-linear-to-br from-[#f5f0fe] to-[#ede9fe] border-[1.5px] border-[#dfd5fb] rounded-[10px] py-3.5 px-4.5 text-sm text-[#4b3d80] mt-2.5">
                      <div className="text-sm text-[#1a1035] mb-1"><strong>承認者：</strong> {ap.approved_by || "—"}</div>
                      {ap.reason && <div className="text-sm text-[#4b3d80]"><strong>コメント：</strong> {ap.reason}</div>}
                      <div className="text-xs text-[#a78bfa] mt-1.5">
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
