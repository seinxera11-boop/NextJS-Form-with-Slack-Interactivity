"use client";

import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ChecklistsTab } from "./ChecklistsTab";
import { ResponsesTab } from "./ResponsesTab";
import { ApprovalsTab } from "./ApprovalsTab";
import { DepartmentsTab } from "./DepartmentsTab";

type Tab = "checklists" | "responses" | "approvals" | "departments";

// ─── Auth wrapper ────────────────────────────────────────────────────────────
export default function AdminDashboardWrapper() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/admin/login"; return; }
      setSession(data.session); setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { window.location.href = "/admin/login"; return; }
      setSession(session); setBooting(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (booting) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 15, color: "#999" }}>
      Loading…
    </div>
  );
  if (!session?.user?.email) return null;
  return <AdminDashboard userEmail={session.user.email} />;
}

// ─── Shell ───────────────────────────────────────────────────────────────────
function AdminDashboard({ userEmail }: { userEmail: string }) {
  const [tab, setTab] = useState<Tab>("checklists");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const S: Record<string, React.CSSProperties> = {
    root: { minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif", color: "#111" },
    nav: { height: 56, borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, background: "#fff", zIndex: 50 },
    navLeft: { display: "flex", alignItems: "center", gap: 24 },
    navLogo: { fontWeight: 700, fontSize: 16, color: "#111", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 },
    navDot: { width: 8, height: 8, borderRadius: "50%", background: "#111" },
    navRight: { display: "flex", alignItems: "center", gap: 16 },
    navEmail: { fontSize: 13, color: "#999" },
    signOutBtn: { fontSize: 13, color: "#666", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, padding: "5px 12px", cursor: "pointer" },
  };

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div style={S.navLeft}>
          <div style={S.navLogo}><div style={S.navDot} />OfficeAdmin</div>
          <TabNav tab={tab} setTab={setTab} />
        </div>
        <div style={S.navRight}>
          <span style={S.navEmail}>{userEmail}</span>
          <button style={S.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>
      {tab === "checklists"  && <ChecklistsTab userEmail={userEmail} />}
      {tab === "responses"   && <ResponsesTab />}
      {tab === "approvals"   && <ApprovalsTab userEmail={userEmail} />}
      {tab === "departments" && <DepartmentsTab />}
    </div>
  );
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────
function TabNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "checklists",  label: "Checklists"  },
    { key: "responses",   label: "Responses"   },
    { key: "approvals",   label: "Approvals"   },
    { key: "departments", label: "Departments" },
  ];
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
          color: tab === t.key ? "#111" : "#999",
          background: tab === t.key ? "#f5f5f5" : "none",
          border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: 6,
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}