"use client";

import { useEffect, useState } from "react";
import { type Department, type OrgUser } from "./types";

export function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "users">("list");
  const [activeDept, setActiveDept] = useState<Department | null>(null);
  const [deptUsers, setDeptUsers] = useState<OrgUser[]>([]);

  const [bulkDeptNames, setBulkDeptNames] = useState("");
  const [addingDept, setAddingDept] = useState(false);
  const [deptError, setDeptError] = useState("");

  const [bulkUserNames, setBulkUserNames] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [userError, setUserError] = useState("");

  const [skippedUser, setSkippedUser] = useState<string[]>([]);

  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [savingDept, setSavingDept] = useState(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [deptsRes, usersRes] = await Promise.all([
      fetch("/api/departments"),
      fetch("/api/org-users"),
    ]);
    const [depts, users] = await Promise.all([deptsRes.json(), usersRes.json()]);
    setDepartments(Array.isArray(depts) ? depts : []);
    setOrgUsers(Array.isArray(users) ? users : []);
    setLoading(false);
  };

  const fetchUsersForDept = async (deptId: number) => {
    const res = await fetch(`/api/org-users?department_id=${deptId}`);
    const data = await res.json();
    setDeptUsers(Array.isArray(data) ? data : []);
  };

  const handleAddDept = async () => {
    const bulkDept = bulkDeptNames.split("\n").map(name => name.trim()).filter(name => name !== "");
    if (bulkDept.length == 0) { setDeptError("名前は必須です。"); return; }
    setAddingDept(true); setDeptError("");
    try {
      const res = await fetch("/api/departments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: bulkDept }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      if (result.skipped?.length > 0) setSkippedUser(result.skipped);
      setTimeout(() => setSkippedUser([]),5000)
      setBulkDeptNames("");
      await fetchAll();
    } catch (err: any) { setDeptError(err.message); }
    finally { setAddingDept(false); }
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm("この部署を削除しますか？所属するユーザーもすべて削除されます。")) return;
    await fetch("/api/departments", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchAll();
  };

  const handleAddUser = async () => {
    const deptId = activeDept?.id;
    const bulkUsers = bulkUserNames.split("\n").map(name => name.trim()).filter(name => name !== "");
    if (bulkUsers.length == 0) { setUserError("名前は必須です。"); return; }
    if (!deptId) { setUserError("部署を選択してください。"); return; }
    setAddingUser(true); setUserError("");
    try {
      const res = await fetch("/api/org-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: bulkUsers, department_id: deptId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      if (result.skipped?.length > 0) setSkippedUser(result.skipped);
      setTimeout(() => setSkippedUser([]),5000)

      setBulkUserNames("");
      if (activeDept) await fetchUsersForDept(activeDept.id);
      else await fetchAll();
    } catch (err: any) { setUserError(err.message); }
    finally { setAddingUser(false); }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("このユーザーを削除しますか？")) return;
    await fetch("/api/org-users", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (activeDept) await fetchUsersForDept(activeDept.id);
    else await fetchAll();
  };

  const handleEditDept = async (id: number) => {
    if (!editDeptName.trim()) return;
    setSavingDept(true);
    try {
      const res = await fetch("/api/departments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editDeptName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingDeptId(null);
      await fetchAll();
    } catch { /* silent */ }
    finally { setSavingDept(false); }
  };

  const handleEditUser = async (id: number) => {
    if (!editUserName.trim()) return;
    setSavingUser(true);
    try {
      const res = await fetch("/api/org-users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editUserName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingUserId(null);
      if (activeDept) await fetchUsersForDept(activeDept.id);
    } catch { /* silent */ }
    finally { setSavingUser(false); }
  };

  const openDept = (dept: Department) => {
    setActiveDept(dept);
    fetchUsersForDept(dept.id);
    setView("users");
  };

  if (loading) return (
    <div className="max-w-215 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <div className="py-20 text-center text-sm text-[#c4b5fd]">読み込み中…</div>
    </div>
  );

  if (view === "users" && activeDept) {
    return (
      <div className="max-w-215 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
        <button
          className="inline-flex items-center gap-1.5 text-sm text-[#6a5d8e] cursor-pointer mb-7.5 bg-transparent border-none p-0"
          onClick={() => { setView("list"); setActiveDept(null); setDeptUsers([]); fetchAll(); }}
        >
          ← 部署一覧に戻る
        </button>
        <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">{activeDept.name}</div>
        <div className="text-sm text-[#6a5d8e] mb-9">この部署のユーザーを管理します。</div>
        <div className="border-[1.5px] border-[#dfd5fb] rounded-[14px] overflow-hidden bg-white shadow-[0_2px_14px_rgba(79,53,190,0.09)]">
          <div className="py-3.5 px-5.5 [border-bottom:1.5px_solid_#dfd5fb] bg-linear-to-br from-[#f5f0fe] to-[#ede9fe] text-xs font-bold text-[#6a5d8e] uppercase tracking-widest">
            ユーザー ({deptUsers.length})
          </div>
          <div className="py-3 sm:py-4.5 px-4 sm:px-5.5">
            {deptUsers.length === 0 ? (
              <div className="text-sm text-[#a696f2] py-5.5 text-center">ユーザーがいません。下記から追加してください。</div>
            ) : deptUsers.map((u, i) => (
              <div key={u.id} className={`flex items-center justify-between py-2.75 ${i === deptUsers.length - 1 ? "" : "border-b border-b-[#f5f0fe]"}`}>
                {editingUserId === u.id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input
                      className="flex-1 border-[1.5px] border-[#a78bfa] rounded-lg py-1.5 px-2.75 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit]"
                      value={editUserName}
                      onChange={e => setEditUserName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleEditUser(u.id); if (e.key === "Escape") setEditingUserId(null); }}
                      autoFocus
                    />
                    <button
                      className="text-[10px] sm:text-xs text-white bg-linear-to-br from-[#6d28d9] to-[#4f35be] border-none rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer font-semibold"
                      onClick={() => handleEditUser(u.id)}
                      disabled={savingUser}
                    >
                      {savingUser ? "…" : "保存"}
                    </button>
                    <button
                      className="text-[10px] sm:text-xs text-[#6a5d8e] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                      onClick={() => setEditingUserId(null)}
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-[#1a1035] font-semibold">{u.name}</div>
                )}
                {editingUserId !== u.id && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      className="text-[10px] sm:text-xs text-[#4f35be] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                      onClick={() => { setEditingUserId(u.id); setEditUserName(u.name); }}
                    >
                      編集
                    </button>
                    <button
                      className="text-[10px] sm:text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 [border-top:1.5px_solid_#f5f0ff] pt-4">
              <div className="text-xs font-semibold text-[#4b3d80] mb-2">ユーザーを追加</div>
              <div className="flex gap-2 mt-4">
                <textarea
                  className="flex-1 border-[1.5px] border-[#ccc0fa] focus:border-[#a78bfa] rounded-[10px] py-2.5 px-3.25 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit] transition-colors duration-150"
                  placeholder="ユーザー名…"
                  value={bulkUserNames}
                  rows={3}
                  onChange={e => setBulkUserNames(e.target.value)} 
                >
                </textarea>
                <button
                  className="text-sm font-semibold text-white bg-linear-to-br from-[#6d28d9] to-[#4f35be] border-none rounded-[10px] py-2.5 px-4.5 cursor-pointer font-[inherit] shrink-0 shadow-[0_2px_10px_rgba(109,40,217,0.28)]"
                  onClick={handleAddUser}
                  disabled={addingUser}
                >
                  {addingUser ? "追加中…" : "追加"}
                </button>
              </div>
              {userError && <div className="text-sm text-[#dc2626] mt-1.75 font-medium">⚠ {userError}</div>}
              {skippedUser.length > 0 && <div className="text-sm text-[#d97706] mt-1.75 font-medium">⚠ ユーザー名の重複は許可されていません。そのためスキップしました。: {skippedUser.join(", ")}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userCountByDept = (deptId: number) => orgUsers.filter(u => u.department_id === deptId).length;

  return (
    <div className="max-w-215 -my-5 mx-auto py-8 sm:py-14 px-4 sm:px-8">
      <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-2">部署＆ユーザー</div>
      <div className="text-sm text-[#6a5d8e] mb-9">部署と所属ユーザーを管理します。</div>

      <div className="text-xs font-bold text-[#8c70e8] uppercase tracking-[0.12em] mb-4">部署 ({departments.length})</div>
      {departments.length === 0 ? (
        <div className="text-sm text-[#a78bfa] mb-4">部署がまだありません。</div>
      ) : departments.map(dept => (
        <div
          key={dept.id}
          className="border-[1.5px] border-[#dfd5fb] hover:border-[#c4b5fd] rounded-[14px] py-4 sm:py-5 px-4 sm:px-5.5 mb-2.5 bg-white shadow-[0_2px_10px_rgba(79,53,190,0.08)] hover:shadow-[0_4px_16px_rgba(79,53,190,0.1)] transition-all duration-180 ease-in-out"
        >
          <div className="flex items-start justify-between gap-3">
            {editingDeptId === dept.id ? (
              <div className="flex items-center gap-2 flex-1 mr-2">
                <input
                  className="flex-1 border-[1.5px] border-[#a78bfa] rounded-lg py-1.5 px-2.75 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit]"
                  value={editDeptName}
                  onChange={e => setEditDeptName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleEditDept(dept.id); if (e.key === "Escape") setEditingDeptId(null); }}
                  autoFocus
                />
                <button
                  className="text-[10px] sm:text-xs text-white bg-linear-to-br from-[#6d28d9] to-[#4f35be] border-none rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer font-semibold"
                  onClick={() => handleEditDept(dept.id)}
                  disabled={savingDept}
                >
                  {savingDept ? "…" : "保存"}
                </button>
                <button
                  className="text-[10px] sm:text-xs text-[#6a5d8e] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                  onClick={() => setEditingDeptId(null)}
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="text-base sm:text-lg font-semibold text-[#1a1035] mb-1.25">{dept.name}</div>
                <div className="text-xs text-[#8c70e8] font-medium">{userCountByDept(dept.id)}名</div>
              </div>
            )}
            {editingDeptId !== dept.id && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  className="text-[10px] sm:text-xs text-[#4f35be] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                  onClick={() => { setEditingDeptId(dept.id); setEditDeptName(dept.name); }}
                >
                  編集
                </button>
                <button
                  className="text-[10px] sm:text-xs text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                  onClick={() => openDept(dept)}
                >
                  ユーザーを管理
                </button>
                <button
                  className="text-[10px] sm:text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg py-1 px-2 sm:py-1.25 sm:px-3 cursor-pointer"
                  onClick={() => handleDeleteDept(dept.id)}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="mt-2">
        <div className="flex gap-2 mt-4">
          <textarea
            className="flex-1 border-[1.5px] border-[#ccc0fa] focus:border-[#a78bfa] rounded-[10px] py-2.5 px-3.25 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit] transition-colors duration-150"
            placeholder="新しい部署名…"
            value={bulkDeptNames}
            onChange={e => setBulkDeptNames(e.target.value)}
            rows ={2}
          >
          </textarea>
          <button
            className="text-sm font-semibold text-white bg-linear-to-br from-[#6d28d9] to-[#4f35be] border-none rounded-[10px] py-2.5 px-4.5 cursor-pointer font-[inherit] shrink-0 shadow-[0_2px_10px_rgba(109,40,217,0.28)]"
            onClick={handleAddDept}
            disabled={addingDept}
          >
            {addingDept ? "追加中…" : "追加"}
          </button>
        </div>
        {deptError && <div className="text-sm text-[#dc2626] mt-1.75 font-medium">⚠ {deptError}</div>}
        {skippedUser.length > 0 && <div className="text-sm text-[#d97706] mt-1.75 font-medium">⚠ 部署名の重複は認められていません。そのため、この項目はスキップされました。。: {skippedUser.join(", ")}</div>}
      </div>
    </div>
  );
}
