"use client";

import { useState, useEffect, useRef } from "react";

type CustomSelectOption = { value: string; label: string };

function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  options: CustomSelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={`w-full border-[1.5px] ${open ? "border-[#a78bfa]" : disabled ? "border-[#dfd5fb]" : "border-[#ccc0fa]"} rounded-[10px] py-3 pr-9.5 pl-3.75 text-base ${selected ? "text-[#1a1035]" : disabled ? "text-[#a696f2]" : "text-[#6b7280]"} outline-none bg-[#faf9ff] font-[inherit] ${disabled ? "cursor-not-allowed" : "cursor-pointer"} text-left flex items-center justify-between transition-[border-color] duration-150`}
      >
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {selected ? selected.label : placeholder}
        </span>
        <span className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${open ? "rotate-180" : "rotate-0"} transition-transform duration-200 text-[#a78bfa] text-xs pointer-events-none`}>▼</span>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-100 bg-white border-[1.5px] border-[#ccc0fa] rounded-xl shadow-[0_8px_32px_rgba(79,53,190,0.18)] max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="py-3.25 px-4.5 text-sm text-[#a696f2] italic">ユーザーが見つかりません</div>
          ) : options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`py-3.25 px-4.5 text-sm cursor-pointer transition-[background] duration-120 ${opt.value === value ? "bg-[linear-gradient(90deg,#6d28d9,#a78bfa)] text-white font-semibold" : "bg-transparent hover:bg-[#f5f0fe] text-[#1a1035] font-normal"}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useParams } from "next/navigation";

type ItemType = "checkbox" | "text" | "textarea";

type ChecklistTask = {
  id: number;
  label: string;
  type: ItemType;
  required: boolean;
  order_index: number;
};

type ChecklistSection = {
  id: number;
  title: string;
  order_index: number;
  checklist_items: ChecklistTask[];
};

type Checklist = {
  id: number;
  title: string;
  is_large_checklist: boolean;
  department_id: number | null;
  checklist_sections: ChecklistSection[];
  checklist_departments?: { department_id: number }[];
};

type Department = { id: number; name: string };
type OrgUser    = { id: number; name: string; department_id: number };

// Step type for large flow only
type LargeStep = "department" | "user" | "form";

export default function ChecklistPage() {
  const params = useParams();
  const id = params?.id as string;

  // ── Core data ──────────────────────────────────────────────────────────────
  const [checklist,    setChecklist]    = useState<Checklist | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [values,       setValues]       = useState<Record<number, string>>({});

  // ── Department / user ──────────────────────────────────────────────────────
  const [departments,     setDepartments]     = useState<Department[]>([]);
  const [orgUsers,        setOrgUsers]        = useState<OrgUser[]>([]);
  const [selectedDeptId,  setSelectedDeptId]  = useState<string>("");
  const [selectedUserId,  setSelectedUserId]  = useState<string>("");
  const [isOther,         setIsOther]         = useState(false);
  const [otherName,       setOtherName]       = useState("");
  const [loadingUsers,    setLoadingUsers]    = useState(false);

  // ── Large flow step ────────────────────────────────────────────────────────
  const [largeStep, setLargeStep] = useState<LargeStep>("department");

  // ── Submission ─────────────────────────────────────────────────────────────
  const [reason,        setReason]        = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [submittedBy,   setSubmittedBy]   = useState("");
  const [confirmModal,  setConfirmModal]  = useState<string[] | null>(null);

  // ── Computed helpers ───────────────────────────────────────────────────────
  const sections = checklist
    ? [...checklist.checklist_sections].sort((a, b) => a.order_index - b.order_index)
    : [];

  const allTasks     = sections.flatMap(s => [...s.checklist_items].sort((a, b) => a.order_index - b.order_index));
  const checkboxTasks = allTasks.filter(t => t.type === "checkbox");
  const checked       = checkboxTasks.filter(t => values[t.id] === "true").length;
  const total         = checkboxTasks.length;
  const pct           = total > 0 ? Math.round((checked / total) * 100) : 0;

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetch(`/api/checklists/${id}`)
      .then(r => r.json())
      .then((clData) => {
      if (clData.error) throw new Error(clData.error);

      setChecklist(clData);
      setDepartments(clData.departments || []);

      // Initialise form values
      const init: Record<number, string> = {};
      (clData.checklist_sections || []).forEach((sec: ChecklistSection) =>
        sec.checklist_items.forEach(item => {
          init[item.id] = item.type === "checkbox" ? "false" : "";
        })
      );
      setValues(init);

      // For the SMALL flow: pre-select the fixed department
      if (!clData.is_large_checklist && clData.department_id) {
        setSelectedDeptId(String(clData.department_id));
      }

      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  // ── Load users when dept changes ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedDeptId) {
      setOrgUsers([]); setSelectedUserId(""); setIsOther(false); return;
    }
    setLoadingUsers(true);
    fetch(`/api/org-users?department_id=${selectedDeptId}&checklist_id=${id}`)
      .then(r => r.json())
      .then(data => {
        setOrgUsers(data || []);
        setSelectedUserId("");
        setIsOther(false);
        setLoadingUsers(false);
      });
  }, [selectedDeptId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleCheck = (id: number) =>
    setValues(p => ({ ...p, [id]: p[id] === "true" ? "false" : "true" }));

  const handleText = (id: number, val: string) =>
    setValues(p => ({ ...p, [id]: val }));

  // Large flow navigation
  const handleDeptContinue = () => {
    if (!selectedDeptId) { alert("部署を選択してください。"); return; }
    setLargeStep("user");
  };

  const handleUserContinue = () => {
    if (!isOther && !selectedUserId) { alert("ユーザーを選択するか、「その他」を選んでください。"); return; }
    if (isOther && !otherName.trim())  { alert("お名前を入力してください。"); return; }
    setLargeStep("form");
  };

  const doSubmit = async () => {
    const resolvedName = isOther
      ? otherName.trim()
      : (orgUsers.find(u => String(u.id) === selectedUserId)?.name || "");

    setConfirmModal(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id:  checklist?.id,
          submitted_by:  resolvedName,
          department_id: Number(selectedDeptId),
          user_id:       isOther ? null : Number(selectedUserId),
          reason,
          values,
          completedItems: checked,
          totalItems:     total,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSubmittedBy(resolvedName);
      setSubmitted(true);
    } catch (err: any) {
      alert("送信に失敗しました：" + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    // Validate required text/textarea fields
    const missing = allTasks.filter(
      it => it.required && it.type !== "checkbox" && !values[it.id]?.trim()
    );
    if (missing.length > 0) {
      alert(`以下の項目を入力してください：${missing.map(m => m.label).join("、")}`);
      return;
    }

    // For small flow: user selection is inline so validate here too
    if (!checklist?.is_large_checklist) {
      if (!isOther && !selectedUserId) { alert("ユーザーを選択するか、「その他」を選んでください。"); return; }
      if (isOther && !otherName.trim())  { alert("お名前を入力してください。"); return; }
    }

    // If any checkboxes are unchecked, show confirmation modal
    const unchecked = checkboxTasks.filter(t => values[t.id] !== "true").map(t => t.label);
    if (unchecked.length > 0) {
      setConfirmModal(unchecked);
      return;
    }

    doSubmit();
  };

  const handleReset = () => {
    const init: Record<number, string> = {};
    allTasks.forEach(it => { init[it.id] = it.type === "checkbox" ? "false" : ""; });
    setValues(init);
    setSelectedUserId(""); setIsOther(false);
    setOtherName(""); setReason("");
    setSubmitted(false); setSubmittedBy("");

    if (checklist?.is_large_checklist) {
      setSelectedDeptId("");
      setLargeStep("department");
    }
    // Small flow: keep selectedDeptId (it comes from the DB, not the user)
  };

  // ── Shared class strings ───────────────────────────────────────────────────
  const rootCls   = "min-h-screen bg-[linear-gradient(160deg,#f5f0fe_0%,#e8e0fc_50%,#f8f0ff_100%)] [font-family:'Inter',system-ui,sans-serif] text-[#1a1035]";
  const headerCls = "[border-bottom:1.5px_solid_#dfd5fb] py-4.5 px-8 flex items-center gap-2.5 bg-[rgba(250,247,255,0.92)] backdrop-blur-[10px]";
  const mainCls   = "max-w-155 mx-auto py-13 px-6";
  const inputCls  = "w-full border-[1.5px] border-[#ccc0fa] focus:border-[#a78bfa] rounded-[10px] py-2.75 px-3.5 text-base text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit] box-border transition-[border-color] duration-150";

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) return (
    <div className={rootCls}>
      <div className="flex items-center justify-center min-h-[60vh] text-base text-[#8c70e8]">読み込み中…</div>
    </div>
  );
  if (error || !checklist) return (
    <div className={rootCls}>
      <div className="flex items-center justify-center min-h-[60vh] text-base text-[#8c70e8]">チェックリストが見つかりません。</div>
    </div>
  );

  const isLarge = checklist.is_large_checklist;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) return (
    <div className={rootCls}>
      <div className={headerCls}>
        <div className="w-2.5 h-2.5 rounded-full bg-[linear-gradient(135deg,#6d28d9_0%,#a78bfa_100%)]" />
        <span className="text-lg font-extrabold text-[#4f35be] tracking-[-0.03em]">オフィス管理者</span>
      </div>
      <div className={mainCls}>
        <div className="text-center py-20">
          <div className="w-17 h-17 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#a78bfa_100%)] flex items-center justify-center text-3xl mx-auto mb-7 text-white">✓</div>
          <div className="text-2xl font-bold text-[#1a1035] mb-3">送信が完了しました</div>
          <p className="text-sm text-[#6a5d8e] leading-[1.8] mb-10">
            回答が記録されました。<br />
            <strong className="text-[#4f35be]">{submittedBy}</strong>さん、ありがとうございました。
          </p>
          <button
            className="text-sm text-[#4b3d80] bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-[10px] py-3 px-6.5 cursor-pointer font-[inherit]"
            onClick={handleReset}
          >
            別の回答を送信する
          </button>
        </div>
      </div>
    </div>
  );

  // ── Helper: user selector (shared between both flows) ──────────────────────
  const renderUserSelector = () => (
    <div>
      {loadingUsers ? (
        <div className="text-sm text-[#a696f2] py-2">ユーザーを読み込み中…</div>
      ) : (
        <>
          <CustomSelect
            options={orgUsers.map(u => ({ value: String(u.id), label: u.name }))}
            value={selectedUserId}
            onChange={val => { setSelectedUserId(val); setIsOther(false); }}
            placeholder="名前を選択してください"
            disabled={isOther}
          />

          <div className="mt-2.5 flex items-center gap-2.5">
            <button
              className={isOther
                ? "mt-2.75 text-sm text-white bg-[linear-gradient(135deg,#7c3aed_0%,#6d28d9_100%)] border-[1.5px] border-[#7c3aed] rounded-lg py-2 px-4 cursor-pointer font-[inherit]"
                : "mt-2.75 text-sm text-[#6d28d9] bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-lg py-2 px-4 cursor-pointer font-[inherit]"
              }
              onClick={() => { setIsOther(v => !v); setSelectedUserId(""); setOtherName(""); }}
            >
              {isOther ? "✓ その他" : "その他"}
            </button>
            {isOther && <span className="text-sm text-[#7a6aaa]">以下にお名前を入力してください</span>}
          </div>

          {isOther && (
            <input
              type="text"
              className={`${inputCls} mt-2.5`}
              placeholder="お名前を入力してください…"
              value={otherName}
              onChange={e => setOtherName(e.target.value)}
              autoFocus
            />
          )}
        </>
      )}
    </div>
  );

  // ── Helper: checklist form body ────────────────────────────────────────────
  const renderForm = () => (
    <>
      {total > 0 && (
        <div className="mb-9">
          <div className="flex justify-between text-xs text-[#7a6aaa] mb-2.25 font-medium">
            <span>進捗</span>
            <span className="text-[#6d28d9] font-bold">{checked}/{total} 完了</span>
          </div>
          <div className="h-1.75 bg-[#dfd5fb] rounded-full overflow-hidden">
            <div
              className="h-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)] rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {sections.map(sec => {
        const tasks = [...sec.checklist_items].sort((a, b) => a.order_index - b.order_index);
        return (
          <div key={sec.id} className="border-[1.5px] border-[#dfd5fb] rounded-[14px] overflow-hidden mb-3.25 bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)]">
            <div className="text-sm font-bold text-[#6d28d9] py-3.25 px-5.5 [border-bottom:1.5px_solid_#ede9fe] bg-[linear-gradient(135deg,#f5f0fe_0%,#ede9fe_100%)]">{sec.title}</div>
            {tasks.map((item, idx) => {
              const isLast  = idx === tasks.length - 1;
              const isDone  = item.type === "checkbox" && values[item.id] === "true";
              return (
                <div key={item.id} className={`flex items-start gap-3 py-4 px-5.5${!isLast ? " [border-bottom:1.5px_solid_#f5f0fe]" : ""}`}>
                  {item.type === "checkbox" ? (
                    <>
                      <input
                        type="checkbox"
                        className="w-4.25 h-4.25 mt-0.5 shrink-0 cursor-pointer accent-[#7c3aed]"
                        checked={values[item.id] === "true"}
                        onChange={() => toggleCheck(item.id)}
                      />
                      <span className={isDone ? "text-base text-[#b09af8] leading-[1.55] flex-1 line-through" : "text-base text-[#1a1035] leading-[1.55] flex-1"}>{item.label}</span>
                    </>
                  ) : item.type === "text" ? (
                    <div className="flex-1">
                      <div className="text-base text-[#1a1035] leading-[1.55] mb-2">
                        {item.label}{item.required && <span className="text-[#dc2626] text-xs ml-0.75">*</span>}
                      </div>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="回答を入力してください…"
                        value={values[item.id] || ""}
                        onChange={e => handleText(item.id, e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="text-base text-[#1a1035] leading-[1.55] mb-2">
                        {item.label}{item.required && <span className="text-[#dc2626] text-xs ml-0.75">*</span>}
                      </div>
                      <textarea
                        className={`${inputCls} resize-none min-h-20`}
                        placeholder="回答を入力してください…"
                        value={values[item.id] || ""}
                        onChange={e => handleText(item.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="border-[1.5px] border-[#dfd5fb] rounded-[14px] p-6 mb-3.25 bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)]">
        <label className="text-sm font-semibold text-[#4b3d80] mb-2.75 block">理由</label>
        <textarea
          className={`${inputCls} resize-none min-h-20`}
          placeholder="送信理由を入力してください"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>

      <button
        className={`w-full ${submitting ? "bg-[#ddd6fe] text-[#a894f0] cursor-not-allowed" : "bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] text-white cursor-pointer shadow-[0_4px_18px_rgba(109,40,217,0.38)] transition-opacity duration-150"} border-none rounded-xl py-4 text-base font-bold font-[inherit]`}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "送信中…" : "チェックリストを送信"}
      </button>
    </>
  );

  // ── Dept name for display ──────────────────────────────────────────────────
  const deptName = departments.find(d => String(d.id) === selectedDeptId)?.name || "";
  const userName = isOther ? otherName : (orgUsers.find(u => String(u.id) === selectedUserId)?.name || "");

  // ── Incomplete-task confirmation modal ─────────────────────────────────────
  const renderConfirmModal = () => confirmModal && (
    <div className="fixed inset-0 z-1000 bg-[rgba(26,16,53,0.55)] backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-[18px] py-8 px-7 max-w-120 w-full shadow-[0_20px_60px_rgba(79,53,190,0.28)] border-[1.5px] border-[#dfd5fb]">
        <div className="text-xl font-bold text-[#1a1035] mb-2">
          未完了のタスクがあります
        </div>
        <div className="text-sm text-[#6a5d8e] mb-4.5">
          以下の項目がまだチェックされていません。このまま送信しますか？
        </div>

        <div className="bg-[#faf9ff] border-[1.5px] border-[#ede9fe] rounded-xl py-1 max-h-55 overflow-y-auto mb-6">
          {confirmModal.map((label, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 py-2.75 px-4${i < confirmModal.length - 1 ? " border-b border-b-[#ede9fe]" : ""}`}
            >
              <span className="shrink-0 w-5 h-5 rounded-[5px] border-2 border-[#ccc0fa] mt-px flex items-center justify-center bg-[#ede9fe]" />
              <span className="text-sm text-[#4b3d80] leading-normal">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => setConfirmModal(null)}
            className="flex-1 py-3.25 rounded-[10px] text-sm font-semibold bg-[#ede9fe] text-[#6d28d9] border-[1.5px] border-[#ccc0fa] cursor-pointer font-[inherit]"
          >
            戻る
          </button>
          <button
            onClick={doSubmit}
            className="flex-1 py-3.25 rounded-[10px] text-sm font-bold bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] text-white border-none cursor-pointer font-[inherit] shadow-[0_4px_14px_rgba(109,40,217,0.35)]"
          >
            このまま送信
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SMALL FLOW — form + user selector shown immediately, dept is hidden/fixed
  // ══════════════════════════════════════════════════════════════════════════
  if (!isLarge) {
    return (
      <div className={rootCls}>
        {renderConfirmModal()}
        <div className={headerCls}>
          <div className="w-2.5 h-2.5 rounded-full bg-[linear-gradient(135deg,#6d28d9_0%,#a78bfa_100%)]" />
          <span className="text-lg font-extrabold text-[#4f35be] tracking-[-0.03em]">オフィス管理者</span>
        </div>
        <div className={mainCls}>
          <div className="text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-7">{checklist.title}</div>

          {/* Read-only dept chip */}
          {deptName && (
            <div className="mb-5">
              <span className="inline-flex items-center gap-1.5 bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] border border-[#ccc0fa] rounded-[10px] py-1.75 px-4 text-sm text-[#4b3d80] font-medium mb-5.5">
                <span className="text-[#a78bfa]">部署</span> {deptName}
              </span>
            </div>
          )}

          {/* Inline user selector */}
          <div className="border-[1.5px] border-[#dfd5fb] rounded-[14px] py-5 px-6 mb-5.5 bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)]">
            <label className="text-sm font-semibold text-[#4b3d80] mb-3 block">名前 <span className="text-[#dc2626]">*</span></label>
            {renderUserSelector()}
          </div>

          {/* Checklist form rendered immediately */}
          {renderForm()}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LARGE FLOW — step-by-step: dept → user → form
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className={rootCls}>
      {renderConfirmModal()}
      <div className={headerCls}>
        <div className="w-2.5 h-2.5 rounded-full bg-[linear-gradient(135deg,#6d28d9_0%,#a78bfa_100%)]" />
        <span className="text-lg font-extrabold text-[#4f35be] tracking-[-0.03em]">オフィス管理者</span>
      </div>
      <div className={mainCls}>
        <div className="text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-7">{checklist.title}</div>

        {/* ── Step 1: Department ── */}
        {largeStep === "department" && (
          <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-6 mb-4.5 bg-white shadow-[0_4px_22px_rgba(79,53,190,0.10)]">
            <label className="text-sm font-semibold text-[#4b3d80] mb-3 block">部署 <span className="text-[#dc2626]">*</span></label>
            <CustomSelect
              options={departments.map(d => ({ value: String(d.id), label: d.name }))}
              value={selectedDeptId}
              onChange={setSelectedDeptId}
              placeholder="部署を選択してください"
            />
            <button
              className="w-full bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] text-white border-none rounded-xl py-3.75 text-base font-bold cursor-pointer font-[inherit] mt-3.5 shadow-[0_3px_14px_rgba(109,40,217,0.33)]"
              onClick={handleDeptContinue}
            >
              次へ
            </button>
          </div>
        )}

        {/* ── Step 2: User ── */}
        {largeStep === "user" && (
          <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-6 mb-4.5 bg-white shadow-[0_4px_22px_rgba(79,53,190,0.10)]">
            <button
              className="text-sm text-[#6a5d8e] bg-transparent border-none cursor-pointer font-[inherit] py-2 inline-block mb-4.5"
              onClick={() => setLargeStep("department")}
            >
              ← {deptName}
            </button>
            <label className="text-sm font-semibold text-[#4b3d80] mb-3 block">名前 <span className="text-[#dc2626]">*</span></label>
            {renderUserSelector()}
            <button
              className="w-full bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] text-white border-none rounded-xl py-3.75 text-base font-bold cursor-pointer font-[inherit] mt-3.5 shadow-[0_3px_14px_rgba(109,40,217,0.33)]"
              onClick={handleUserContinue}
            >
              次へ
            </button>
          </div>
        )}

        {/* ── Step 3: Form ── */}
        {largeStep === "form" && (
          <>
            <div className="mb-6 flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] border border-[#ccc0fa] rounded-[10px] py-1.75 px-4 text-sm text-[#4b3d80] font-medium">
                <span className="text-[#a78bfa]">部署</span> {deptName}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] border border-[#ccc0fa] rounded-[10px] py-1.75 px-4 text-sm text-[#4b3d80] font-medium">
                <span className="text-[#a78bfa]">ユーザー</span> {userName}
              </span>
              <button
                className="text-sm text-[#6a5d8e] bg-transparent border-none cursor-pointer font-[inherit] py-2 inline-block m-0 self-center"
                onClick={() => setLargeStep("user")}
              >
                変更
              </button>
            </div>
            {renderForm()}
          </>
        )}
      </div>
    </div>
  );
}