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

  const [newDeptName, setNewDeptName] = useState("");
  const [addingDept, setAddingDept] = useState(false);
  const [deptError, setDeptError] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserDeptId, setNewUserDeptId] = useState<string>("");
  const [addingUser, setAddingUser] = useState(false);
  const [userError, setUserError] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [depts, users] = await Promise.all([
      fetch("/api/departments").then(r => r.json()),
      fetch("/api/org-users").then(r => r.json()),
    ]);
    setDepartments(depts || []);
    setOrgUsers(users || []);
    setLoading(false);
  };

  const fetchUsersForDept = async (deptId: number) => {
    const data = await fetch(`/api/org-users?department_id=${deptId}`).then(r => r.json());
    setDeptUsers(data || []);
  };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) { setDeptError("名前は必須です。"); return; }
    setAddingDept(true); setDeptError("");
    try {
      const res = await fetch("/api/departments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setNewDeptName("");
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
    const deptId = activeDept ? activeDept.id : Number(newUserDeptId);
    if (!newUserName.trim()) { setUserError("名前は必須です。"); return; }
    if (!deptId) { setUserError("部署を選択してください。"); return; }
    setAddingUser(true); setUserError("");
    try {
      const res = await fetch("/api/org-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUserName.trim(), department_id: deptId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setNewUserName("");
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

  const openDept = (dept: Department) => {
    setActiveDept(dept);
    fetchUsersForDept(dept.id);
    setView("users");
  };

  const S: Record<string, React.CSSProperties> = {
    main: { maxWidth: 860, margin: "-20px auto", padding: "56px 32px" },
    pageTitle: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#1a1035", marginBottom: 8 },
    pageSubtitle: { fontSize: 15, color: "#6a5d8e", marginBottom: 36 },
    back: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: "#6a5d8e", cursor: "pointer", marginBottom: 30, background: "none", border: "none", padding: 0 },
    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 },
    panel: { border: "1.5px solid #dfd5fb", borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 2px 14px rgba(79,53,190,0.09)" },
    panelHeader: {
      padding: "14px 22px", borderBottom: "1.5px solid #dfd5fb",
      background: "linear-gradient(135deg, #f5f0fe 0%, #ede9fe 100%)",
      fontSize: 12, fontWeight: 700, color: "#6a5d8e",
      textTransform: "uppercase" as const, letterSpacing: "0.1em"
    },
    panelBody: { padding: "18px 22px" },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f5f0fe" },
    rowLast: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0" },
    rowName: { fontSize: 15, color: "#1a1035", fontWeight: 600 },
    rowMeta: { fontSize: 13, color: "#8c70e8" },
    rowBtns: { display: "flex", gap: 6, flexShrink: 0 },
    viewBtn: { fontSize: 13, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 12px", cursor: "pointer" },
    delBtn: { fontSize: 13, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 12px", cursor: "pointer" },
    addRow: { display: "flex", gap: 8, marginTop: 16 },
    addInput: {
      flex: 1, border: "1.5px solid #ccc0fa", borderRadius: 10,
      padding: "10px 13px", fontSize: 15, color: "#1a1035", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", transition: "border-color 0.15s"
    },
    addSelect: {
      width: "100%", border: "1.5px solid #ccc0fa", borderRadius: 10,
      padding: "10px 13px", fontSize: 15, color: "#4b3d80", outline: "none",
      background: "#faf9ff", fontFamily: "inherit", cursor: "pointer"
    },
    addBtn: {
      fontSize: 15, fontWeight: 600, color: "#fff",
      background: "linear-gradient(135deg, #6d28d9 0%, #4f35be 100%)",
      border: "none", borderRadius: 10, padding: "10px 18px",
      cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
      boxShadow: "0 2px 10px rgba(109,40,217,0.28)"
    },
    errText: { fontSize: 14, color: "#dc2626", marginTop: 7, fontWeight: 500 },
    deptCard: {
      border: "1.5px solid #dfd5fb", borderRadius: 14, padding: "20px 22px",
      marginBottom: 10, background: "#fff",
      boxShadow: "0 2px 10px rgba(79,53,190,0.08)", transition: "all 0.18s ease"
    },
    deptName: { fontSize: 17, fontWeight: 600, color: "#1a1035", marginBottom: 5 },
    deptMeta: { fontSize: 13, color: "#8c70e8", fontWeight: 500 },
    emptyText: { fontSize: 15, color: "#a696f2", padding: "22px 0", textAlign: "center" as const },
    secLabel: {
      fontSize: 12, fontWeight: 700, color: "#8c70e8",
      textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 16
    },
  };

  if (loading) return (
    <div style={S.main}>
      <div style={{ padding: "80px 0", textAlign: "center", fontSize: 14, color: "#c4b5fd" }}>読み込み中…</div>
    </div>
  );

  if (view === "users" && activeDept) {
    return (
      <div style={S.main}>
        <button style={S.back} onClick={() => { setView("list"); setActiveDept(null); setDeptUsers([]); fetchAll(); }}>
          ← 部署一覧に戻る
        </button>
        <div style={S.pageTitle}>{activeDept.name}</div>
        <div style={S.pageSubtitle}>この部署のユーザーを管理します。</div>
        <div style={S.panel}>
          <div style={S.panelHeader}>ユーザー ({deptUsers.length})</div>
          <div style={S.panelBody}>
            {deptUsers.length === 0 ? (
              <div style={S.emptyText}>ユーザーがいません。下記から追加してください。</div>
            ) : deptUsers.map((u, i) => (
              <div key={u.id} style={i === deptUsers.length - 1 ? S.rowLast : S.row}>
                <div style={S.rowName}>{u.name}</div>
                <button style={S.delBtn} onClick={() => handleDeleteUser(u.id)}>削除</button>
              </div>
            ))}
            <div style={{ marginTop: 16, borderTop: "1.5px solid #f5f0ff", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4b3d80", marginBottom: 8 }}>ユーザーを追加</div>
              <div style={S.addRow}>
                <input
                  style={S.addInput} placeholder="ユーザー名…"
                  value={newUserName} onChange={e => setNewUserName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddUser()}
                  onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                  onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
                />
                <button style={S.addBtn} onClick={handleAddUser} disabled={addingUser}>
                  {addingUser ? "追加中…" : "追加"}
                </button>
              </div>
              {userError && <div style={S.errText}>⚠ {userError}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userCountByDept = (deptId: number) => orgUsers.filter(u => u.department_id === deptId).length;

  return (
    <div style={S.main}>
      <div style={S.pageTitle}>部署＆ユーザー</div>
      <div style={S.pageSubtitle}>部署と所属ユーザーを管理します。</div>

      <div style={S.grid}>
        <div>
          <div style={S.secLabel}>部署 ({departments.length})</div>
          {departments.length === 0 ? (
            <div style={{ fontSize: 14, color: "#a78bfa", marginBottom: 16 }}>部署がまだありません。</div>
          ) : departments.map(dept => (
            <div key={dept.id} style={S.deptCard}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4b5fd"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(79,53,190,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede9fe"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(79,53,190,0.05)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.deptName}>{dept.name}</div>
                  <div style={S.deptMeta}>{userCountByDept(dept.id)}名</div>
                </div>
                <div style={S.rowBtns}>
                  <button style={S.viewBtn} onClick={() => openDept(dept)}>ユーザーを管理</button>
                  <button style={S.delBtn} onClick={() => handleDeleteDept(dept.id)}>削除</button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <div style={S.addRow}>
              <input
                style={S.addInput} placeholder="新しい部署名…"
                value={newDeptName} onChange={e => setNewDeptName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddDept()}
                onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
              />
              <button style={S.addBtn} onClick={handleAddDept} disabled={addingDept}>
                {addingDept ? "追加中…" : "追加"}
              </button>
            </div>
            {deptError && <div style={S.errText}>⚠ {deptError}</div>}
          </div>
        </div>

        <div>
          <div style={S.secLabel}>全ユーザー ({orgUsers.length})</div>
          <div style={S.panel}>
            <div style={S.panelBody}>
              {orgUsers.length === 0 ? (
                <div style={S.emptyText}>ユーザーがまだいません。</div>
              ) : orgUsers.map((u, i) => (
                <div key={u.id} style={i === orgUsers.length - 1 ? S.rowLast : S.row}>
                  <div>
                    <div style={S.rowName}>{u.name}</div>
                    <div style={S.rowMeta}>{u.departments?.name || "—"}</div>
                  </div>
                  <button style={S.delBtn} onClick={() => handleDeleteUser(u.id)}>削除</button>
                </div>
              ))}
              <div style={{ marginTop: 16, borderTop: "1.5px solid #f5f0ff", paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#4b3d80", marginBottom: 8 }}>ユーザーを追加</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <select style={S.addSelect} value={newUserDeptId} onChange={e => setNewUserDeptId(e.target.value)}>
                    <option value="">部署を選択…</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div style={S.addRow}>
                    <input
                      style={S.addInput} placeholder="ユーザー名…"
                      value={newUserName} onChange={e => setNewUserName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddUser()}
                      onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                      onBlur={e => (e.target.style.borderColor = "#ddd6fe")}
                    />
                    <button style={S.addBtn} onClick={handleAddUser} disabled={addingUser}>
                      {addingUser ? "追加中…" : "追加"}
                    </button>
                  </div>
                </div>
                {userError && <div style={S.errText}>⚠ {userError}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}