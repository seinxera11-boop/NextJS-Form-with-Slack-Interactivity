"use client";

import { useEffect, useState, useRef } from "react";
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
  assignedChecklists: number[];
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
    return { email: "", isMainAdmin: true, assignedChecklists: [] };
  }
}

// ─── Shell ───────────────────────────────────────────────────────────────────
function AdminDashboard({ userCtx }: { userCtx: UserContext }) {
  const { isMainAdmin } = userCtx;

  const allTabs: { key: Tab; label: string; mainAdminOnly: boolean }[] = [
    { key: "checklists",  label: "チェックリスト", mainAdminOnly: false },
    { key: "responses",   label: "回答一覧",        mainAdminOnly: false },
    { key: "approvals",   label: "承認",            mainAdminOnly: false },
    { key: "departments", label: "部署",            mainAdminOnly: true  },
    { key: "settings",    label: "設定",            mainAdminOnly: true  },
  ];

  const visibleTabs = allTabs.filter(t => isMainAdmin || !t.mainAdminOnly);
  const [tab, setTab] = useState<Tab>(visibleTabs[0]?.key ?? "responses");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Track breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setMenuOpen(false);
    };
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleTabSelect = (t: Tab) => {
    setTab(t);
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const activeLabel = visibleTabs.find(t => t.key === tab)?.label ?? "";

  const S: Record<string, React.CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f5f0fe 0%, #ede8fc 100%)",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1035"
    },
    nav: {
      height: 70, borderBottom: "1.5px solid #dfd5fb",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: isMobile ? "0 20px" : "0 40px",
      position: "sticky", top: 0,
      background: "rgba(250,247,255,0.96)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      zIndex: 50,
      boxShadow: "0 1px 20px rgba(79,53,190,0.11)"
    },
    navLeft: { display: "flex", alignItems: "center", gap: 20 },
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
      whiteSpace: "nowrap" as const,
      background: isMainAdmin
        ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
        : "linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)",
      color: isMainAdmin ? "#4f35be" : "#92400e",
      border: isMainAdmin ? "1px solid #c4b5fd" : "1px solid #fbbf24",
    },
    signOutBtn: {
      fontSize: 13, color: "#6a5d8e", background: "#ede9fe",
      border: "1px solid #ccc0fa", borderRadius: 8,
      padding: "6px 16px", cursor: "pointer", whiteSpace: "nowrap" as const,
    },
  };

  return (
    <div style={S.root}>
      <nav style={S.nav} ref={menuRef}>

        {/* ── Left ── */}
        <div style={S.navLeft}>
          <div style={S.navLogo}>
            <div style={S.navDot} />
            管理画面
          </div>

          {/* Desktop: inline tabs */}
          {!isMobile && (
            <TabNav tab={tab} setTab={handleTabSelect} tabs={visibleTabs} />
          )}

          {/* Mobile: active tab pill + hamburger */}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
              {/* Current tab name */}
              <span style={{
                fontSize: 13, fontWeight: 600, color: "#4f35be",
                background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
                border: "1px solid #c4b5fd",
                padding: "4px 12px", borderRadius: 8,
              }}>
                {activeLabel}
              </span>

              {/* Hamburger button */}
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
                style={{
                  width: 38, height: 38,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 5,
                  background: menuOpen
                    ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
                    : "#f5f0ff",
                  border: "1px solid #ccc0fa",
                  borderRadius: 8, cursor: "pointer", padding: 0,
                  transition: "background 0.15s",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  display: "block", width: 16, height: 2,
                  background: "#4f35be", borderRadius: 2,
                  transformOrigin: "center",
                  transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
                  transition: "transform 0.2s ease",
                }} />
                <span style={{
                  display: "block", width: 16, height: 2,
                  background: "#4f35be", borderRadius: 2,
                  opacity: menuOpen ? 0 : 1,
                  transition: "opacity 0.15s ease",
                }} />
                <span style={{
                  display: "block", width: 16, height: 2,
                  background: "#4f35be", borderRadius: 2,
                  transformOrigin: "center",
                  transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
                  transition: "transform 0.2s ease",
                }} />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 12px)",
                  left: 0,
                  minWidth: 220,
                  background: "rgba(250,247,255,0.98)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1.5px solid #dfd5fb",
                  borderRadius: 14,
                  boxShadow: "0 8px 32px rgba(79,53,190,0.14)",
                  overflow: "hidden",
                  zIndex: 100,
                  animation: "fadeSlideDown 0.15s ease",
                }}>
                  <style>{`
                    @keyframes fadeSlideDown {
                      from { opacity: 0; transform: translateY(-6px); }
                      to   { opacity: 1; transform: translateY(0); }
                    }
                    .menu-item:hover {
                      background: #f5f0ff !important;
                    }
                  `}</style>

                  {visibleTabs.map((t, i) => (
                    <button
                      key={t.key}
                      className="menu-item"
                      onClick={() => handleTabSelect(t.key)}
                      style={{
                        width: "100%",
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "13px 18px",
                        background: tab === t.key
                          ? "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)"
                          : "transparent",
                        border: "none",
                        borderTop: i === 0 ? "none" : "1px solid #ede9fe",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "background 0.12s",
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: tab === t.key ? "#7F77DD" : "#ccc0fa",
                        transition: "background 0.12s",
                      }} />
                      <span style={{
                        fontSize: 15,
                        fontWeight: tab === t.key ? 700 : 400,
                        color: tab === t.key ? "#4f35be" : "#7a6aaa",
                        flex: 1,
                      }}>
                        {t.label}
                      </span>
                      {tab === t.key && (
                        <span style={{ fontSize: 13, color: "#a78bfa" }}>✓</span>
                      )}
                    </button>
                  ))}

                  {/* Sign out + email footer inside dropdown */}
                  <div style={{
                    borderTop: "1.5px solid #dfd5fb",
                    padding: "12px 18px",
                    background: "#faf8ff",
                  }}>
                    <div style={{
                      fontSize: 12, color: "#9688c0",
                      marginBottom: 10, wordBreak: "break-all",
                    }}>
                      {userCtx.email}
                    </div>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: "100%", fontSize: 13, fontWeight: 600,
                        color: "#6a5d8e", background: "#ede9fe",
                        border: "1px solid #ccc0fa", borderRadius: 8,
                        padding: "8px 0", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      ログアウト
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right ── */}
        {!isMobile ? (
          // Desktop: email + badge + sign out
          <div style={S.navRight}>
            <span style={S.navEmail}>{userCtx.email}</span>
            <span style={S.roleBadge}>{isMainAdmin ? "メイン管理者" : "サブ管理者"}</span>
            <button style={S.signOutBtn} onClick={handleSignOut}>ログアウト</button>
          </div>
        ) : (
          // Mobile: role badge only (email + logout moved to dropdown)
          <span style={S.roleBadge}>{isMainAdmin ? "メイン管理者" : "サブ管理者"}</span>
        )}
      </nav>

      {/* ── Page content ── */}
      {tab === "checklists"  && (
        <ChecklistsTab
          userEmail={userCtx.email}
          isMainAdmin={isMainAdmin}
        />
      )}
      {tab === "responses"   && (
        <ResponsesTab isMainAdmin={isMainAdmin} />
      )}
      {tab === "approvals"   && <ApprovalsTab />}
      {tab === "departments" && isMainAdmin && <DepartmentsTab />}
      {tab === "settings"    && isMainAdmin && <SettingsTab />}
    </div>
  );
}

// ─── Tab nav (desktop only) ───────────────────────────────────────────────────
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