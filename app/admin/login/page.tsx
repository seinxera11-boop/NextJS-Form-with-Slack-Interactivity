"use client";

import { useState, useEffect } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("error") === "session_failed") setError("Sign-in failed. Please try again.");
    if (p.get("error") === "no_token") setError("Invalid or expired link. Please request a new one.");
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
      if (!res.ok) throw new Error(result.error || "Failed to send link");
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
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Logo mark */}
        <div style={{ marginBottom: 40, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#111" }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>OfficeAdmin</span>
        </div>

        {sent ? (
          <div>
            <div style={{ width: 44, height: 44, border: "1px solid #e5e5e5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 24 }}>
              ✉
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.02em", marginBottom: 8 }}>
              Check your inbox
            </div>
            <p style={{ fontSize: 14, color: "#999", lineHeight: 1.7, marginBottom: 24 }}>
              We sent a sign-in link to <strong style={{ color: "#555", fontWeight: 500 }}>{email}</strong>.<br />
              Click it to access the admin dashboard.
            </p>
            <button
              onClick={() => setSent(false)}
              style={{ fontSize: 14, color: "#999", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              ← Use a different email
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#111", letterSpacing: "-0.03em", marginBottom: 6 }}>
              Sign in
            </div>
            <p style={{ fontSize: 14, color: "#999", marginBottom: 32, lineHeight: 1.6 }}>
              Enter your admin email to receive a magic sign-in link.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 7 }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{
                  width: "100%",
                  border: "1px solid #e5e5e5",
                  borderRadius: 9,
                  padding: "11px 14px",
                  fontSize: 15,
                  color: "#111",
                  outline: "none",
                  background: "#fafafa",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                onFocus={e => { e.target.style.borderColor = "#111"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#e5e5e5"; e.target.style.background = "#fafafa"; }}
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
                background: loading || !email ? "#e5e5e5" : "#111",
                color: loading || !email ? "#aaa" : "#fff",
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
              {loading ? "Sending…" : "Send magic link"}
            </button>

            <p style={{ fontSize: 12, color: "#ccc", marginTop: 20, lineHeight: 1.7, textAlign: "center" }}>
              No password required. Only authorised admins can sign in.<br />
              Link expires after 1 hour.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}