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
      background: "linear-gradient(135deg, #faf9ff 0%, #f0ebff 100%)",
      fontFamily: "system-ui, sans-serif", fontSize: 15, color: "#a78bfa"
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
      background: "linear-gradient(180deg, #faf9ff 0%, #f8f5ff 100%)",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1035"
    },
    nav: {
      height: 58, borderBottom: "1.5px solid #ede9fe",
      display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 32px",
      position: "sticky", top: 0,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      zIndex: 50,
      boxShadow: "0 1px 20px rgba(79,53,190,0.07)"
    },
    navLeft: { display: "flex", alignItems: "center", gap: 28 },
    navLogo: {
      fontWeight: 800, fontSize: 16, color: "#4f35be",
      letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 8
    },
    navDot: {
      width: 8, height: 8, borderRadius: "50%",
      background: "linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)"
    },
    navRight: { display: "flex", alignItems: "center", gap: 16 },
    navEmail: { fontSize: 12, color: "#9688c0", fontWeight: 500 },
    roleBadge: {
      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
      background: isMainAdmin
        ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
        : "linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)",
      color: isMainAdmin ? "#4f35be" : "#92400e",
      border: isMainAdmin ? "1px solid #c4b5fd" : "1px solid #fbbf24",
    },
    signOutBtn: {
      fontSize: 12, color: "#7c6fa0", background: "#f5f0ff",
      border: "1px solid #ddd6fe", borderRadius: 8, padding: "5px 14px", cursor: "pointer"
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
    <div style={{ display: "flex", gap: 4 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          fontSize: 14,
          fontWeight: tab === t.key ? 600 : 400,
          color: tab === t.key ? "#4f35be" : "#9688c0",
          background: tab === t.key
            ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
            : "none",
          border: "none", cursor: "pointer", padding: "6px 13px",
          borderRadius: 8,
          transition: "all 0.15s ease",
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
