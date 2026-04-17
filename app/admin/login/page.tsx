"use client";

import { useState, useEffect } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("error") === "session_failed") setError("ログインに失敗しました。もう一度お試しください。");
    if (p.get("error") === "no_token") setError("リンクが無効または期限切れです。新しいリンクをリクエストしてください。");
  }, []);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "リンクの送信に失敗しました");
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #faf9ff 0%, #f8f5ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Logo mark */}
        <div style={{ marginBottom: 40, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 9, height: 9, borderRadius: "50%",
            background: "linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)",
          }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#4f35be", letterSpacing: "-0.02em" }}>
オフィス管理者</span>
        </div>

        {sent ? (
          <div>
            <div style={{
              width: 44, height: 44, border: "1px solid #ede9fe", borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, marginBottom: 24, background: "#faf9ff",
            }}>
              ✉
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1035", letterSpacing: "-0.02em", marginBottom: 8 }}>
              メールをご確認ください
            </div>
            <p style={{ fontSize: 14, color: "#9688c0", lineHeight: 1.7, marginBottom: 24 }}>
              <strong style={{ color: "#4f35be", fontWeight: 500 }}>{email}</strong> にログインリンクを送信しました。<br />
              リンクをクリックして管理ダッシュボードにアクセスしてください。
            </p>
            <button
              onClick={() => setSent(false)}
              style={{ fontSize: 14, color: "#9688c0", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              ← 別のメールアドレスを使用する
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1035", letterSpacing: "-0.03em", marginBottom: 6 }}>
              ログイン
            </div>
            <p style={{ fontSize: 14, color: "#9688c0", marginBottom: 32, lineHeight: 1.6 }}>
              管理者メールアドレスを入力すると、マジックリンクが送信されます。
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#7c6fa0", marginBottom: 7 }}>
                メールアドレス
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{
                  width: "100%",
                  border: "1px solid #ede9fe",
                  borderRadius: 9,
                  padding: "11px 14px",
                  fontSize: 15,
                  color: "#1a1035",
                  outline: "none",
                  background: "#faf9ff",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                onFocus={e => { e.target.style.borderColor = "#6d28d9"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#ede9fe"; e.target.style.background = "#faf9ff"; }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 14 }}>⚠ {error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email}
              style={{
                width: "100%",
                background: loading || !email ? "#ede9fe" : "#4f35be",
                color: loading || !email ? "#c4b5fd" : "#fff",
                border: "none",
                borderRadius: 9,
                padding: "12px 0",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading || !email ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
                letterSpacing: "-0.01em",
              }}
            >
              {loading ? "送信中…" : "マジックリンクを送信"}
            </button>

            <p style={{ fontSize: 12, color: "#c4b5fd", marginTop: 20, lineHeight: 1.7, textAlign: "center" }}>
              パスワード不要。許可された管理者のみログインできます。<br />
              リンクの有効期限は1時間です。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}