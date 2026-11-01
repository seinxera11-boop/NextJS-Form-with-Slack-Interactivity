"use client";

import { useEffect, useState } from "react";

type Installation = {
  conversation_id: string;
  display_name: string | null;
  conversation_type: string | null;
};

type Role = "approval" | "security" | "reminder";

type TeamsSettings = {
  messaging_provider: "slack" | "teams";
  tenant_connected: boolean;
  approval_conversation_id: string | null;
  security_conversation_id: string | null;
  reminder_conversation_id: string | null;
  installations: Installation[];
};

const ROLES: { role: Role; label: string; description: string }[] = [
  { role: "approval", label: "承認チャンネル",       description: "承認ボタン付きのチェックリスト送信を受信します" },
  { role: "security", label: "セキュリティチャンネル", description: "未完了タスクの詳細を含む退勤ログを受信します" },
  { role: "reminder", label: "リマインダーチャンネル", description: "当日中に提出がない場合、毎日リマインダーを受信します" },
];

export function TeamsConnectPanel() {
  const [settings, setSettings] = useState<TeamsSettings | null>(null);
  const [assign, setAssign]     = useState<Record<Role, string>>({ approval: "", security: "", reminder: "" });
  const [provider, setProvider] = useState<"slack" | "teams">("slack");
  const [code, setCode]         = useState<{ code: string; expires_at: string } | null>(null);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch("/api/teams/settings")
      .then(r => r.json())
      .then((data: TeamsSettings) => {
        setSettings(data);
        setProvider(data.messaging_provider);
        setAssign({
          approval: data.approval_conversation_id ?? "",
          security: data.security_conversation_id ?? "",
          reminder: data.reminder_conversation_id ?? "",
        });
      })
      .catch(() => setMessage({ ok: false, text: "設定の読み込みに失敗しました。" }));

  useEffect(() => { load(); }, []);

  const issueCode = async () => {
    setMessage(null);
    const res = await fetch("/api/teams/claim-code", { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage({ ok: false, text: data.error || "コードの発行に失敗しました。" });
    setCode(data);
  };

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/teams/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_provider: provider,
          approval_conversation_id: assign.approval || null,
          security_conversation_id: assign.security || null,
          reminder_conversation_id: assign.reminder || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存に失敗しました");
      setMessage({ ok: true, text: "保存しました。" });
      load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="py-6 text-center text-sm text-[#c4b5fd]">読み込み中…</div>;

  const hasInstallations = settings.installations.length > 0;
  const channelName = (i: Installation) => i.display_name || i.conversation_type || i.conversation_id.slice(0, 24);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5 pb-5 border-b border-[#ede9fe]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${hasInstallations ? "bg-[#059669]" : "bg-[#d1d5db]"}`} />
        <div className="text-xs text-[#9688c0]">
          {hasInstallations
            ? `${settings.installations.length}件のチャンネルが連携されています。`
            : "まだチャンネルが連携されていません — 以下の手順で連携してください。"}
        </div>
      </div>

      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">Microsoft Teams連携</div>
      <div className="text-xs text-[#9688c0] mb-5">
        TeamsアプリをチャンネルにインストールしたあとTeamsで連携コードを送信すると、チャンネルがこのワークスペースに紐づきます。
      </div>

      <div className="mb-6 rounded-xl border-[1.5px] border-[#ede9fe] bg-[#faf9ff] p-4">
        <div className="text-sm font-semibold text-[#1a1035] mb-1">1. 連携コードを発行</div>
        <div className="text-xs text-[#9688c0] mb-3">
          Teamsアプリをインストール済みのチャンネルで、このコードを <b>@メンション付き</b> で送信してください（30分間有効・1回のみ）。
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="text-xs font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-lg py-2 px-4 cursor-pointer font-[inherit] shadow-[0_1px_6px_rgba(109,40,217,0.25)]"
            onClick={issueCode}
          >
            {code ? "新しいコードを発行" : "コードを発行"}
          </button>
          {code && (
            <span className="font-mono text-lg font-bold tracking-[0.2em] text-[#4f35be] select-all">{code.code}</span>
          )}
        </div>
      </div>

      <div className="text-sm font-semibold text-[#1a1035] mb-3">2. チャンネルの用途を設定</div>
      {!hasInstallations ? (
        <div className="text-xs text-[#a696f2] mb-5 bg-[#f5f0ff] border border-[#ede9fe] rounded-lg px-4 py-3">
          連携済みのチャンネルがありません。先に手順1を完了してください。
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          {ROLES.map(r => (
            <div key={r.role} className="py-3 px-4 rounded-xl border-[1.5px] border-[#ede9fe] bg-[#faf9ff]">
              <div className="text-sm font-semibold text-[#1a1035]">{r.label}</div>
              <div className="text-xs text-[#9688c0] mb-2">{r.description}</div>
              <select
                className="w-full border-[1.5px] border-[#ccc0fa] rounded-lg py-2 px-3 text-sm text-[#1a1035] bg-white font-[inherit] outline-none"
                value={assign[r.role]}
                onChange={e => setAssign(a => ({ ...a, [r.role]: e.target.value }))}
              >
                <option value="">未設定</option>
                {settings.installations.map(i => (
                  <option key={i.conversation_id} value={i.conversation_id}>{channelName(i)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm font-semibold text-[#1a1035] mb-2">3. 通知の送信先</div>
      <div className="flex gap-2 mb-5">
        {(["slack", "teams"] as const).map(p => (
          <button
            key={p}
            className={`text-xs font-semibold py-2 px-4 rounded-lg border-[1.5px] cursor-pointer font-[inherit] ${provider === p ? "border-[#c4b5fd] bg-[#ede9fe] text-[#4f35be]" : "border-[#ccc0fa] bg-[#faf9ff] text-[#7a6aaa]"}`}
            onClick={() => setProvider(p)}
          >
            {p === "slack" ? "Slack" : "Microsoft Teams"}
          </button>
        ))}
      </div>

      {message && (
        <div className={`text-xs font-semibold mb-4 rounded-lg px-4 py-2.5 border ${message.ok ? "text-[#059669] bg-[#ecfdf5] border-[#6ee7b7]" : "text-[#dc2626] bg-[#fff5f5] border-[#fecaca]"}`}>
          {message.ok ? "✓" : "✗"} {message.text}
        </div>
      )}

      <button
        className={`text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-5 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(109,40,217,0.28)] ${saving ? "opacity-60" : ""}`}
        onClick={save}
        disabled={saving}
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
