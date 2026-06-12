"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AdminAuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleMagicLink() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const hash = window.location.hash;

      if (!hash || !hash.includes("access_token")) {
        setError("ログイントークンが無効または見つかりません。");
        setTimeout(() => router.replace("/admin/login?error=no_token"), 2000);
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (!access_token || !refresh_token) {
        setError("ログイントークンが不完全です。");
        setTimeout(() => router.replace("/admin/login?error=missing_token"), 2000);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        setError("ログインに失敗しました。もう一度お試しください。");
        setTimeout(() => router.replace("/admin/login?error=session_failed"), 2000);
        return;
      }

      window.history.replaceState({}, document.title, "/admin/login/callback");

      // Check if this user is a super admin — redirect accordingly
      const meRes = await fetch("/api/super-admin/workspaces");
      if (meRes.status === 200) {
        router.replace("/super-admin");
      } else {
        router.replace("/admin");
      }
    }

    handleMagicLink();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#fff", fontFamily: "system-ui, sans-serif", gap: 12,
    }}>
      {error ? (
        <>
          <div style={{ fontSize: 20, color: "#dc2626" }}>✕</div>
          <div style={{ fontSize: 14, color: "#dc2626" }}>{error}</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>ログインページにリダイレクトしています…</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, color: "#999" }}>ログインしています…</div>
          <div style={{
            width: 24, height: 24,
            border: "2px solid #f0f0f0",
            borderTopColor: "#111",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </div>
  );
}
