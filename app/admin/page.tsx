"use client";

import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ChecklistsTab } from "./ChecklistsTab";
import { ResponsesTab } from "./ResponsesTab";
import { ApprovalsTab } from "./ApprovalsTab";
import { DepartmentsTab } from "./DepartmentsTab";
import { SettingsTab } from "./SettingsTab";

type Tab = "checklists" | "responses" | "approvals" | "departments" | "settings";

type UserContext = {
  email: string;
  isMainAdmin: boolean;
  assignedDepartments: number[];
};

// ─── Auth wrapper ────────────────────────────────────────────────────────────
export default function AdminDashboardWrapper() {
  const [session, setSession] = useState<Session | null>(null);
  const [userCtx, setUserCtx] = useState<UserContext | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { window.location.href = "/admin/login"; return; }
      setSession(data.session);
      const ctx = await fetchUserContext();
      setUserCtx(ctx);
      setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { window.location.href = "/admin/login"; return; }
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (booting) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f5f0fe 0%, #ebe4fc 100%)",
      fontFamily: "system-ui, sans-serif", fontSize: 16, color: "#8c70e8"
    }}>
      読み込み中…
    </div>
  );
  if (!session?.user?.email || !userCtx) return null;
  return <AdminDashboard userCtx={userCtx} />;
}

async function fetchUserContext(): Promise<UserContext> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) throw new Error("context fetch failed");
    return await res.json();
  } catch {
    // Fallback: if context endpoint unreachable, treat as main admin so
    // the dashboard still loads (auth is still enforced per-route on the server).
    return { email: "", isMainAdmin: true, assignedDepartments: [] };
  }
}

// ─── Shell ───────────────────────────────────────────────────────────────────
function AdminDashboard({ userCtx }: { userCtx: UserContext }) {
  const { isMainAdmin, assignedDepartments } = userCtx;

  const allTabs: { key: Tab; label: string; mainAdminOnly: boolean }[] = [
    { key: "checklists",  label: "チェックリスト", mainAdminOnly: false },
    { key: "responses",   label: "回答一覧",        mainAdminOnly: false },
    { key: "approvals",   label: "承認",            mainAdminOnly: false },
    { key: "departments", label: "部署",            mainAdminOnly: true  },
    { key: "settings",    label: "設定",            mainAdminOnly: true  },
  ];

  const visibleTabs = allTabs.filter(t => isMainAdmin || !t.mainAdminOnly);
  const [tab, setTab] = useState<Tab>(visibleTabs[0]?.key ?? "responses");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const S: Record<string, React.CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f5f0fe 0%, #ede8fc 100%)",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1035"
    },
    nav: {
      height: 64, borderBottom: "1.5px solid #dfd5fb",
      display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 40px",
      position: "sticky", top: 0,
      background: "rgba(250,247,255,0.96)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      zIndex: 50,
      boxShadow: "0 1px 20px rgba(79,53,190,0.11)"
    },
    navLeft: { display: "flex", alignItems: "center", gap: 28 },
    navLogo: {
      fontWeight: 800, fontSize: 19, color: "#4f35be",
      letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 8
    },
    navDot: {
      width: 10, height: 10, borderRadius: "50%",
      background: "linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)"
    },
    navRight: { display: "flex", alignItems: "center", gap: 16 },
    navEmail: { fontSize: 13, color: "#7a6aaa", fontWeight: 500 },
    roleBadge: {
      fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100,
      background: isMainAdmin
        ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
        : "linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)",
      color: isMainAdmin ? "#4f35be" : "#92400e",
      border: isMainAdmin ? "1px solid #c4b5fd" : "1px solid #fbbf24",
    },
    signOutBtn: {
      fontSize: 13, color: "#6a5d8e", background: "#ede9fe",
      border: "1px solid #ccc0fa", borderRadius: 8, padding: "6px 16px", cursor: "pointer"
    },
  };

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div style={S.navLeft}>
          <div style={S.navLogo}><div style={S.navDot} />管理画面</div>
          <TabNav tab={tab} setTab={setTab} tabs={visibleTabs} />
        </div>
        <div style={S.navRight}>
          <span style={S.navEmail}>{userCtx.email}</span>
          <span style={S.roleBadge}>{isMainAdmin ? "メイン管理者" : "サブ管理者"}</span>
          <button style={S.signOutBtn} onClick={handleSignOut}>ログアウト</button>
        </div>
      </nav>
      {tab === "checklists"  && (
        <ChecklistsTab
          userEmail={userCtx.email}
          isMainAdmin={isMainAdmin}
          assignedDepartments={assignedDepartments}
        />
      )}
      {tab === "responses"   && (
        <ResponsesTab isMainAdmin={isMainAdmin} assignedDepartments={assignedDepartments} />
      )}
      {tab === "approvals"   && (
        <ApprovalsTab
          userEmail={userCtx.email}
          isMainAdmin={isMainAdmin}
          assignedDepartments={assignedDepartments}
        />
      )}
      {tab === "departments" && isMainAdmin && <DepartmentsTab />}
      {tab === "settings"    && isMainAdmin && <SettingsTab />}
    </div>
  );
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────
function TabNav({
  tab,
  setTab,
  tabs,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  tabs: { key: Tab; label: string }[];
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          fontSize: 15,
          fontWeight: tab === t.key ? 700 : 400,
          color: tab === t.key ? "#4f35be" : "#7a6aaa",
          background: tab === t.key
            ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
            : "none",
          border: "none", cursor: "pointer", padding: "7px 15px",
          borderRadius: 8,
          transition: "all 0.15s ease",
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
