export const SLACK_CHANNELS = [
  { key: "approval_url" as const, label: "承認チャンネル",       description: "承認ボタン付きのチェックリスト送信を受信します",       channelParam: "approval" },
  { key: "security_url" as const, label: "セキュリティチャンネル", description: "未完了タスクの詳細を含む退勤ログを受信します",         channelParam: "security" },
  { key: "reminder_url" as const, label: "リマインダーチャンネル", description: "当日中に提出がない場合、毎日リマインダーを受信します", channelParam: "reminder" },
];

type ConnectedMap = Partial<Record<"approval_url" | "security_url" | "reminder_url", string | null | undefined>>;

type Props = {
  connectedMap: ConnectedMap;
  installUrl: (channelParam: string) => string;
  botConnected: boolean;
  showConnected?: string | null;
  note: string;
};

export function SlackConnectPanel({ connectedMap, installUrl, botConnected, showConnected, note }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5 pb-5 border-b border-[#ede9fe]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${botConnected ? "bg-[#059669]" : "bg-[#d1d5db]"}`} />
        <div className="text-xs text-[#9688c0]">
          {botConnected
            ? "ボットトークンが保存されています — アプリが認証済みです。"
            : "まだ認証されていません — 以下のいずれかのチャンネルを接続してください。"}
        </div>
      </div>

      <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-1.5">Slack連携</div>
      <div className="text-xs text-[#9688c0] mb-6">
        各チャンネルを個別に接続してください。「接続」をクリックし、Slackワークスペースと通知タイプのチャンネルを選択すると、Webhook URLが自動的に保存されます。
      </div>

      {showConnected && (
        <div className="text-xs text-[#059669] font-semibold mb-5 bg-[#ecfdf5] border border-[#6ee7b7] rounded-lg px-4 py-2.5">
          ✓ {showConnected} チャンネルが接続されました — Webhook URLが自動的に保存されました。
        </div>
      )}

      <div className="space-y-3">
        {SLACK_CHANNELS.map(ch => {
          const connected = !!connectedMap[ch.key];
          return (
            <div key={ch.key} className="flex items-center justify-between gap-2 sm:gap-4 py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl border-[1.5px] border-[#ede9fe] bg-[#faf9ff]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-[#059669]" : "bg-[#d1d5db]"}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1a1035]">{ch.label}</div>
                  <div className="text-xs text-[#9688c0] truncate">{ch.description}</div>
                </div>
              </div>
              <a
                href={installUrl(ch.channelParam)}
                className="shrink-0 text-[10px] sm:text-xs font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] rounded-lg py-1.5 sm:py-1.75 px-3 sm:px-4 no-underline inline-flex items-center gap-1.5 shadow-[0_1px_6px_rgba(109,40,217,0.25)]"
              >
                {connected ? "再接続" : "接続"}
              </a>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-[#a696f2] leading-relaxed bg-[#f5f0ff] border border-[#ede9fe] rounded-lg px-4 py-3">
        {note}
      </div>
    </div>
  );
}
