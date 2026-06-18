"use client";

import { useEffect, useState } from "react";
import { type Checklist, type ChecklistSection, type ChecklistTask } from "./types";

type Department = { id: number; name: string };

let _uid = 0;
const uid = () => `new-${++_uid}`;

type TaskState    = ChecklistTask    & { _key: string };
type SectionState = Omit<ChecklistSection, "tasks"> & { _key: string; tasks: TaskState[] };

export function ChecklistsTab({
  userEmail,
  isMainAdmin,
}: {
  userEmail: string;
  isMainAdmin: boolean;
}) {
  const [checklists,   setChecklists]   = useState<Checklist[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState<"list" | "create" | "edit">("list");
  const [editTarget,   setEditTarget]   = useState<Checklist | null>(null);

  // Form state
  const [title,            setTitle]            = useState("");
  const [selectedDeptIds,  setSelectedDeptIds]  = useState<number[]>([]);
  const [sections,         setSections]         = useState<SectionState[]>([
    { title: "", order_index: 0, tasks: [{ label: "", order_index: 0, _key: uid() }], _key: uid() },
  ]);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState("");
  const [tooltipId,  setTooltipId]  = useState<number | null>(null);

  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");


  useEffect(() => {
    fetchChecklists();
    fetch("/api/departments")
      .then(r => r.json())
      .then((d: Department[]) => setDepartments(d || []));
  }, []);

  const fetchChecklists = async () => {
    setLoading(true);
    const res = await fetch("/api/checklists");
    const data = res.ok ? await res.json() : [];
    setChecklists(data || []);
    setLoading(false);
  };

  const startCreate = () => {
    setTitle(""); setSelectedDeptIds([]);
    setSections([{ title: "", order_index: 0, tasks: [{ label: "", order_index: 0, _key: uid() }], _key: uid() }]);
    setSaveError(""); setEditTarget(null); setView("create");
  };

  const startEdit = (cl: Checklist) => {
    setTitle(cl.title);
    const mappings: { department_id: number }[] = (cl as any).checklist_departments || [];
    setSelectedDeptIds(mappings.map(m => m.department_id));
    const sorted = [...(cl.checklist_sections || [])].sort((a, b) => a.order_index - b.order_index);
    setSections(sorted.length
      ? sorted.map(sec => ({
          id: sec.id, title: sec.title, order_index: sec.order_index, _key: uid(),
          tasks: [...(sec.checklist_items || [])].sort((a, b) => a.order_index - b.order_index)
                   .map(t => ({ ...t, _key: uid() })),
        }))
      : [{ title: "", order_index: 0, tasks: [{ label: "", order_index: 0, _key: uid() }], _key: uid() }]
    );
    setSaveError(""); setEditTarget(cl); setView("edit");
  };

  // Section/task mutation helpers (unchanged)
  const addSection    = () => setSections(p => [...p, { title: "", order_index: p.length, tasks: [{ label: "", order_index: 0, _key: uid() }], _key: uid() }]);
  const removeSection = (si: number) => {
    if (sections.length === 1) return;
    setSections(p => p.filter((_, i) => i !== si).map((s, i) => ({ ...s, order_index: i })));
  };
  const moveSection = (si: number, dir: -1 | 1) => {
    const ns = [...sections]; const target = si + dir;
    if (target < 0 || target >= ns.length) return;
    [ns[si], ns[target]] = [ns[target], ns[si]];
    setSections(ns.map((s, i) => ({ ...s, order_index: i })));
  };
  const updateSectionTitle = (si: number, val: string) =>
    setSections(p => p.map((s, i) => i === si ? { ...s, title: val } : s));
  const addTask = (si: number) =>
    setSections(p => p.map((s, i) => i === si ? { ...s, tasks: [...s.tasks, { label: "", order_index: s.tasks.length, _key: uid() }] } : s));
  const removeTask = (si: number, ti: number) =>
    setSections(p => p.map((s, i) => i !== si ? s : { ...s, tasks: s.tasks.filter((_, j) => j !== ti).map((t, j) => ({ ...t, order_index: j })) }));
  const moveTask = (si: number, ti: number, dir: -1 | 1) =>
    setSections(p => p.map((s, i) => {
      if (i !== si) return s;
      const t = [...s.tasks]; const target = ti + dir;
      if (target < 0 || target >= t.length) return s;
      [t[ti], t[target]] = [t[target], t[ti]];
      return { ...s, tasks: t.map((x, j) => ({ ...x, order_index: j })) };
    }));
  const updateTaskLabel = (si: number, ti: number, label: string) =>
    setSections(p => p.map((s, i) => i !== si ? s : { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, label } : t) }));

  const toggleLargeDept = (deptId: number) => {
    setSelectedDeptIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("タイトルは必須です。"); return; }
    if (selectedDeptIds.length === 0) { setSaveError("少なくとも1つの部署を選択してください。"); return; }
    for (const sec of sections) {
      if (!sec.title.trim()) { setSaveError("すべてのセクションにタイトルを入力してください。"); return; }
      for (const task of sec.tasks) {
        if (!task.label.trim()) { setSaveError("すべてのタスクにラベルを入力してください。"); return; }
      }
    }
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(
        editTarget ? `/api/checklists/${editTarget.id}` : "/api/checklists",
        {
          method: editTarget ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            sections,
            created_by: userEmail,
            is_large_checklist: selectedDeptIds.length > 1,
            department_ids: selectedDeptIds,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "保存に失敗しました");
      await fetchChecklists(); setView("list");
    } catch (err: any) { setSaveError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このチェックリストを削除しますか？ このチェックリストを削除すると、このチェックリストに関連する回答もすべて削除されます。")) return;
    await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    await fetchChecklists();
  };

  const handleCopy = async (id: number) => {
    setCopyingId(id);
    try {
      const res = await fetch (`/api/checklists/${id}/copy`, {method: "POST"});
      await fetchChecklists();
      setSuccessMsg("コピーを作成しました")
      const t = setTimeout(() => setSuccessMsg(""),2000)
    } catch (err: any) { alert(err.message);}
    finally {
      setCopyingId(null)
    }
  };

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div className="max-w-195 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">チェックリスト</div>
      <div className="text-sm text-[#6a5d8e] mb-11">チームのチェックリストを作成・管理します。</div>
      
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <span className="text-sm text-[#8c70e8] font-semibold">{checklists.length}件のチェックリスト</span>
        {successMsg && <span className="text-sm text-[#059669] font-medium">✓ {successMsg}</span>}

        
        {isMainAdmin && (
          <button
            className="text-sm font-semibold bg-linear-to-br from-[#6d28d9] to-[#4f35be] text-white border-none rounded-[10px] py-2.5 px-5.5 cursor-pointer shadow-[0_2px_12px_rgba(109,40,217,0.32)]"
            onClick={startCreate}
          >
            ＋ 新規作成
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-20 text-center text-sm text-[#c4b5fd]">読み込み中…</div>
      ) : checklists.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-5 opacity-[0.35]">☑</div>
          <div className="text-xl sm:text-2xl font-bold text-[#1a1035] mb-2.5">チェックリストがありません</div>
          <div className="text-sm text-[#8c70e8] mb-7">
            {isMainAdmin ? "最初のチェックリストを作成して始めましょう。" : "担当部署のチェックリストはありません。"}
          </div>
          {isMainAdmin && (
            <button
              className="text-sm font-semibold bg-linear-to-br from-[#6d28d9] to-[#4f35be] text-white border-none rounded-[10px] py-2.5 px-5.5 cursor-pointer shadow-[0_2px_12px_rgba(109,40,217,0.32)]"
              onClick={startCreate}
            >
              ＋ 新規作成
            </button>
          )}
        </div>
      ) : checklists.map(cl => {
        const depts = ((cl as any).checklist_departments || [])
          .map((cd: any) => departments.find(d => d.id === cd.department_id)?.name)
          .filter(Boolean) as string[];
        const multiDept = depts.length > 1;
        const allTasks  = (cl.checklist_sections || [])
          .sort((a, b) => a.order_index - b.order_index)
          .flatMap(s => [...(s.checklist_items || [])].sort((a, b) => a.order_index - b.order_index));
        const preview   = allTasks.filter(t => t.label.length <= 20).slice(0, 2);
        const extra     = allTasks.length - preview.length;
        return (
          <div
            key={cl.id}
            className="border-[1.5px] border-[#dfd5fb] hover:border-[#c4b5fd] rounded-2xl py-4 sm:py-5.5 px-4 sm:px-7 mb-3 bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)] transition-all duration-180 ease-in-out"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-base sm:text-lg font-semibold text-[#1a1035]">{cl.title}</span>
                  <span
                    className="relative inline-block"
                    onMouseEnter={() => setTooltipId(cl.id)}
                    onMouseLeave={() => setTooltipId(null)}
                  >
                    <span
                      className={`text-xs py-1 px-2.75 rounded-full font-semibold border cursor-default whitespace-nowrap ${
                        multiDept
                          ? "text-[#6d28d9] bg-[#f5f0ff] border-[#ddd6fe]"
                          : "text-[#0f6e56] bg-[#e1f5ee] border-[#9fe1cb]"
                      }`}
                    >
                      {depts.length > 1 ? "複数の部署" : "１部署"}
                    </span>
                    {tooltipId === cl.id && (
                      <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[#2a1f4a] rounded-lg py-2 px-3 pointer-events-none z-50 shadow-[0_4px_16px_rgba(0,0,0,0.18)] whitespace-nowrap">
                        {depts.length > 0
                          ? depts.map((n: string) => (
                              <span key={n} className="text-xs text-[#e9e4fb] font-medium leading-[1.8] block">{n}</span>
                            ))
                          : <span className="text-xs text-[#e9e4fb] font-medium leading-[1.8] block opacity-50">未設定</span>
                        }
                        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#2a1f4a]" />
                      </div>
                    )}
                  </span>
                </div>
                <div className="text-xs text-[#7a6aaa] mb-4">
                  {(cl.checklist_sections || []).length}セクション · {allTasks.length}タスク · {cl.created_by} ·{" "}
                  {new Date(cl.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  className="text-[10px] sm:text-xs text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] rounded-lg py-1 px-2 sm:py-1.5 sm:px-3.5 cursor-pointer"
                  onClick={() => {
                    const url = `${window.location.origin}/office-checklist/${cl.id}`;
                    navigator.clipboard.writeText(url).then(() => alert("リンクをコピーしました: " + url));
                  }}
                >
                  リンクをコピー
                </button>
                <button
                  className="text-[10px] sm:text-xs text-[#4b3d80] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1 px-2 sm:py-1.5 sm:px-3.5 cursor-pointer"
                  onClick={() => startEdit(cl)}
                >
                  編集
                </button>
                {isMainAdmin && (
                  <button
                    className="text-[10px] sm:text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg py-1 px-2 sm:py-1.5 sm:px-3.5 cursor-pointer"
                    onClick={() => handleDelete(cl.id)}
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
         

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.25 flex-1 min-w-0 overflow-hidden">
                {preview.map((it, i) => (
                  <span
                    key={i}
                    className="text-xs py-1 px-2.75 rounded-full font-medium bg-linear-to-br from-[#ede9fe] to-[#ddd6fe] text-[#6d28d9] border border-[#ccc0fa] whitespace-nowrap shrink-0"
                  >
                    {it.label}
                  </span>
                ))}
                {extra > 0 && <span className="text-xs text-[#a78bfa] py-0.75 px-1.5 shrink-0 whitespace-nowrap">他{extra}件</span>}
              </div>
              {isMainAdmin && (
                <button
                  className="text-xs text-[#059669] bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg py-1 px-2 cursor-pointer shrink-0"
                  onClick={() => handleCopy(cl.id)}
                  disabled={copyingId === cl.id}
                >
                  {copyingId === cl.id ? "コピーする....." : "コピーを作成" }
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Create / edit view ─────────────────────────────────────────────────────
  return (
    <div className="max-w-195 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <button
        className="inline-flex items-center gap-1.5 text-sm text-[#6a5d8e] cursor-pointer mb-8 bg-transparent border-none p-0"
        onClick={() => setView("list")}
      >
        ← チェックリストに戻る
      </button>
      <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">
        {view === "create" ? "新規チェックリスト" : "チェックリストを編集"}
      </div>
      <div className="text-sm text-[#6a5d8e] mb-8">
        {view === "create" ? "セクションを追加し、チームが実施するタスクを定義します。" : "セクション・タスク・設定を更新します。"}
      </div>

      {/* ── Basic info ── */}
      <div className="border-[1.5px] border-[#dfd5fb] rounded-[14px] p-4 sm:p-7 mb-4 bg-[#faf9ff]">
        <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mb-4.5">基本情報</div>

        <label className="block text-sm font-semibold text-[#4b3d80] mb-2.25">タイトル</label>
        <input
          className="w-full border-[1.5px] border-[#ccc0fa] focus:border-[#a78bfa] rounded-[10px] py-2.75 px-3.75 text-base text-[#1a1035] outline-none bg-white font-[inherit] transition-colors duration-150"
          value={title}
          placeholder="例）オフィス閉館チェックリスト"
          onChange={e => setTitle(e.target.value)}
        />

        {/* Department multi-select */}
        <div className="mt-5">
          <label className="block text-sm font-semibold text-[#4b3d80] mb-2.25">
            部門（複数選択可） <span className="text-[#dc2626]">*</span>
          </label>
          {departments.length === 0 ? (
            <div className="text-sm text-[#9688c0]">部署が登録されていません。</div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {departments.map(d => {
                const active = selectedDeptIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={!isMainAdmin}
                    className={`text-xs font-medium py-1.75 px-3.5 rounded-full border-[1.5px] transition-all duration-150 select-none leading-[1.4] ${
                      !isMainAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    } ${
                      active
                        ? "bg-linear-to-br from-[#6d28d9] to-[#4f35be] border-transparent text-white shadow-[0_2px_8px_rgba(109,40,217,0.28)]"
                        : "border-[#ccc0fa] bg-white text-[#4b3d80]"
                    }`}
                    onClick={() => isMainAdmin && toggleLargeDept(d.id)}
                  >
                    {active && <span className="mr-1.25 text-xs">✓</span>}
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
          {selectedDeptIds.length > 0 && (
            <div className="mt-2.5 text-xs text-[#6d28d9] font-semibold">{selectedDeptIds.length}部署を選択中</div>
          )}
        </div>
      </div>

      {/* ── Sections & tasks ── */}
      <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mb-3">セクション＆タスク</div>
      {sections.map((sec, si) => (
        <div key={sec._key} className="border-[1.5px] border-[#dfd5fb] rounded-[14px] mb-3 overflow-hidden">
          <div className="flex items-center gap-2.5 py-3.25 px-5 bg-linear-to-br from-[#f5f0fe] to-[#ede9fe] [border-bottom:1.5px_solid_#dfd5fb]">
            <span className="text-xs font-bold text-[#8c70e8] min-w-5">{si + 1}</span>
            <input
              className="flex-1 border-[1.5px] border-[#ccc0fa] rounded-lg py-2.25 px-3.25 text-sm font-semibold text-[#1a1035] outline-none bg-white font-[inherit]"
              placeholder="セクションタイトル（例）閉館作業"
              value={sec.title}
              onChange={e => updateSectionTitle(si, e.target.value)}
            />
            <div className="flex gap-1 shrink-0">
              <button className="bg-[#ede9fe] border border-[#ccc0fa] text-[#8c70e8] cursor-pointer text-xs py-1 px-2.25 rounded-md leading-none" onClick={() => moveSection(si, -1)}>↑</button>
              <button className="bg-[#ede9fe] border border-[#ccc0fa] text-[#8c70e8] cursor-pointer text-xs py-1 px-2.25 rounded-md leading-none" onClick={() => moveSection(si,  1)}>↓</button>
              {sections.length > 1 && (
                <button
                  className="bg-[#fef2f2] border border-[#fecaca] text-[#f87171] cursor-pointer text-base py-0.5 px-2 leading-none rounded-md"
                  onClick={() => removeSection(si)}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="pt-3 px-5 pb-4 bg-white">
            {sec.tasks.map((task, ti) => (
              <div key={task._key} className="flex items-center gap-2 bg-[#faf9ff] border border-[#dfd5fb] rounded-[10px] py-2.5 px-3.25 mb-1.75">
                <span className="text-xs text-[#a696f2] min-w-4.5 text-right shrink-0">{ti + 1}</span>
                <input
                  className="flex-1 border-[1.5px] border-[#ddd6fe] rounded-lg py-2 px-2.75 text-sm text-[#1a1035] outline-none bg-white font-[inherit] min-w-0"
                  placeholder="タスク名"
                  value={task.label}
                  onChange={e => updateTaskLabel(si, ti, e.target.value)}
                />
                <div className="flex flex-col gap-px shrink-0">
                  <button className="bg-transparent border-none text-[#a696f2] cursor-pointer text-xs py-px px-1 leading-none" onClick={() => moveTask(si, ti, -1)}>↑</button>
                  <button className="bg-transparent border-none text-[#a696f2] cursor-pointer text-xs py-px px-1 leading-none" onClick={() => moveTask(si, ti,  1)}>↓</button>
                </div>
                {sec.tasks.length > 1 && (
                  <button
                    className="bg-transparent border-none text-[#fca5a5] cursor-pointer text-lg py-0.5 px-1.25 leading-none shrink-0"
                    onClick={() => removeTask(si, ti)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              className="w-full border-[1.5px] border-dashed border-[#ccc0fa] rounded-[10px] p-2.75 text-sm text-[#8c70e8] bg-transparent cursor-pointer mt-1 font-[inherit]"
              onClick={() => addTask(si)}
            >
              ＋ タスクを追加
            </button>
          </div>
        </div>
      ))}
      <button
        className="w-full border-[1.5px] border-dashed border-[#a696f2] rounded-[14px] py-3.5 px-3 text-sm text-[#6a5d8e] bg-transparent cursor-pointer mt-1 font-[inherit] font-medium"
        onClick={addSection}
      >
        ＋ セクションを追加
      </button>

      <div className="flex items-center justify-end gap-2 mt-7">
        {saveError && <span className="flex-1 text-sm text-[#dc2626] font-medium">⚠ {saveError}</span>}
        <button
          className="text-sm text-[#6a5d8e] bg-[#ede9fe] border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.75 px-5 cursor-pointer font-[inherit]"
          onClick={() => setView("list")}
        >
          キャンセル
        </button>
        <button
          className="text-sm font-semibold text-white bg-linear-to-br from-[#6d28d9] to-[#4f35be] border-none rounded-[10px] py-2.75 px-6.5 cursor-pointer font-[inherit] shadow-[0_2px_12px_rgba(109,40,217,0.32)]"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中…" : view === "create" ? "作成" : "変更を保存"}
        </button>
      </div>
    </div>
  );
}
