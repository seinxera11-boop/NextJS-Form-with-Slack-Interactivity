"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  assignedChecklists: number[];
};

// ─── Auth wrapper ────────────────────────────────────────────────────────────
export default function AdminDashboardWrapper() {
  const [session, setSession] = useState<Session | null>(null);
  const [userCtx, setUserCtx] = useState<UserContext | null>(null); // null = not yet loaded or auth failed
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { window.location.href = "/admin/login"; return; }
      setSession(data.session);
      const ctx = await fetchUserContext();
      if (!ctx) { window.location.href = "/admin/login"; return; }
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
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,#f5f0fe_0%,#ebe4fc_100%)] font-[system-ui,sans-serif] text-base text-[#8c70e8]">
      読み込み中…
    </div>
  );
  if (!session?.user?.email || !userCtx) return null;
  return <AdminDashboard userCtx={userCtx} />;
}

async function fetchUserContext(): Promise<UserContext | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Shell ───────────────────────────────────────────────────────────────────
function AdminDashboard({ userCtx }: { userCtx: UserContext }) {
  const { isMainAdmin } = userCtx;
  const searchParams = useSearchParams();

  const allTabs: { key: Tab; label: string; mainAdminOnly: boolean }[] = [
    { key: "checklists",  label: "チェックリスト", mainAdminOnly: false },
    { key: "responses",   label: "回答一覧",        mainAdminOnly: false },
    { key: "approvals",   label: "承認",            mainAdminOnly: false },
    { key: "departments", label: "部署",            mainAdminOnly: true  },
    { key: "settings",    label: "設定",            mainAdminOnly: true  },
  ];

  const visibleTabs = allTabs.filter(t => isMainAdmin || !t.mainAdminOnly);

  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const initialTab = (tabFromUrl && visibleTabs.some(t => t.key === tabFromUrl))
    ? tabFromUrl
    : (visibleTabs[0]?.key ?? "responses");

  const [tab, setTab] = useState<Tab>(initialTab);
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f0fe_0%,#ede8fc_100%)] font-['Inter',system-ui,sans-serif] text-[#1a1035]">
      <nav
        className={`h-17.5 [border-bottom:1.5px_solid_#dfd5fb] flex items-center justify-between sticky top-0 bg-[rgba(250,247,255,0.96)] backdrop-blur-md z-50 shadow-[0_1px_20px_rgba(79,53,190,0.11)] ${isMobile ? "px-3" : "px-10"}`}
        ref={menuRef}
      >

        {/* ── Left ── */}
        <div className="flex items-center gap-2 sm:gap-5">
          <div className="font-extrabold text-base sm:text-xl text-[#4f35be] tracking-[-0.03em] flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[linear-gradient(135deg,#6d28d9_0%,#a78bfa_100%)]" />
            {userCtx.workspaceName || "管理画面"}
          </div>

          {/* Desktop: inline tabs */}
          {!isMobile && (
            <TabNav tab={tab} setTab={handleTabSelect} tabs={visibleTabs} />
          )}

          {/* Mobile: active tab pill + hamburger */}
          {isMobile && (
            <div className="flex items-center gap-2 relative">
              {/* Current tab name */}
              <span className="text-xs font-semibold text-[#4f35be] bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] border border-[#c4b5fd] py-1 px-3 rounded-lg whitespace-nowrap">
                {activeLabel}
              </span>

              {/* Hamburger button */}
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
                className={`w-9.5 h-9.5 flex flex-col items-center justify-center gap-1.25 ${menuOpen ? "bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)]" : "bg-[#f5f0ff]"} border border-[#ccc0fa] rounded-lg cursor-pointer p-0 transition-[background] duration-150 shrink-0`}
              >
                <span className={`block w-4 h-0.5 bg-[#4f35be] rounded-sm origin-center transition-transform duration-200 ease-in-out${menuOpen ? " translate-y-1.75 rotate-45" : ""}`} />
                <span className={`block w-4 h-0.5 bg-[#4f35be] rounded-sm transition-opacity duration-150 ease-in-out${menuOpen ? " opacity-0" : " opacity-100"}`} />
                <span className={`block w-4 h-0.5 bg-[#4f35be] rounded-sm origin-center transition-transform duration-200 ease-in-out${menuOpen ? " -translate-y-1.75 -rotate-45" : ""}`} />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className="absolute top-[calc(100%+12px)] left-0 min-w-55 bg-[rgba(250,247,255,0.98)] backdrop-blur-lg border-[1.5px] border-[#dfd5fb] rounded-[14px] shadow-[0_8px_32px_rgba(79,53,190,0.14)] overflow-hidden z-100 animate-[fadeSlideDown_0.15s_ease]">
                  <style>{`
                    @keyframes fadeSlideDown {
                      from { opacity: 0; transform: translateY(-6px); }
                      to   { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>

                  {visibleTabs.map((t, i) => (
                    <button
                      key={t.key}
                      onClick={() => handleTabSelect(t.key)}
                      className={`w-full flex items-center gap-2.5 py-3.25 px-4.5 ${tab === t.key ? "bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)]" : "bg-transparent hover:bg-[#f5f0ff]"} border-none ${i > 0 ? "[border-top:1px_solid_#ede9fe]" : ""} cursor-pointer text-left font-[inherit] transition-[background] duration-120`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-120 ${tab === t.key ? "bg-[#7F77DD]" : "bg-[#ccc0fa]"}`} />
                      <span className={`text-sm flex-1 ${tab === t.key ? "font-bold text-[#4f35be]" : "font-normal text-[#7a6aaa]"}`}>
                        {t.label}
                      </span>
                      {tab === t.key && (
                        <span className="text-xs text-[#a78bfa]">✓</span>
                      )}
                    </button>
                  ))}

                  {/* Sign out + email footer inside dropdown */}
                  <div className="[border-top:1.5px_solid_#dfd5fb] py-3 px-4.5 bg-[#faf8ff]">
                    <div className="text-xs text-[#9688c0] mb-2.5 break-all">
                      {userCtx.email}
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-xs font-semibold text-[#6a5d8e] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-2 cursor-pointer font-[inherit]"
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
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#7a6aaa] font-medium">{userCtx.email}</span>
            <span className={`text-xs font-bold py-1 px-3 rounded-full whitespace-nowrap ${isMainAdmin ? "bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] text-[#4f35be] border border-[#c4b5fd]" : "bg-[linear-gradient(135deg,#fef9c3_0%,#fde68a_100%)] text-[#92400e] border border-[#fbbf24]"}`}>
              {isMainAdmin ? "メイン管理者" : "サブ管理者"}
            </span>
            <button
              className="text-xs text-[#6a5d8e] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1.5 px-4 cursor-pointer whitespace-nowrap font-[inherit]"
              onClick={handleSignOut}
            >
              ログアウト
            </button>
          </div>
        ) : (
          // Mobile: role badge only (email + logout moved to dropdown)
          <span className={`text-xs font-bold py-1 px-3 rounded-full whitespace-nowrap ${isMainAdmin ? "bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)] text-[#4f35be] border border-[#c4b5fd]" : "bg-[linear-gradient(135deg,#fef9c3_0%,#fde68a_100%)] text-[#92400e] border border-[#fbbf24]"}`}>
            {isMainAdmin ? "メイン管理者" : "サブ管理者"}
          </span>
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
      {tab === "departments" && isMainAdmin && <DepartmentsTab workspaceSlug={userCtx.workspaceSlug} />}
      {tab === "settings"    && isMainAdmin && <SettingsTab workspaceSlug={userCtx.workspaceSlug} />}
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
    <div className="flex gap-2.5">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`text-sm border-none cursor-pointer py-1.75 px-3.75 rounded-lg transition-all duration-150 ease-in-out font-[inherit] ${tab === t.key ? "font-bold text-[#4f35be] bg-[linear-gradient(135deg,#ede9fe_0%,#ddd6fe_100%)]" : "font-normal text-[#7a6aaa] bg-transparent"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
