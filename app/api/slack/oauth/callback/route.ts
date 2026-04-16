import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth/callback`,
    }),
  });

  const data = await response.json();
  if (!data.ok) return NextResponse.json(data, { status: 400 });

  const botToken  = data.access_token ?? "";
  const webhookUrl = data.incoming_webhook?.url ?? "";

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <title>Slack Installed</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 60px auto; padding: 0 24px; color: #111; }
    h2 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .sub { font-size: 14px; color: #888; margin-bottom: 32px; }
    .field { margin-bottom: 20px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
    .row { display: flex; gap: 8px; }
    input { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 13px; font-size: 13px; font-family: monospace; background: #fafafa; color: #111; outline: none; }
    button { font-size: 13px; font-weight: 600; background: #111; color: #fff; border: none; border-radius: 8px; padding: 10px 16px; cursor: pointer; white-space: nowrap; }
    .note { font-size: 13px; color: #888; background: #f5f5f5; border-radius: 8px; padding: 14px 16px; margin-top: 28px; line-height: 1.6; }
  </style>
</head>
<body>
  <h2>Slack installed </h2>
  <div class="sub">Copy these values and paste them into Admin - Settings.</div>

  <div class="field">
    <label>Bot Token</label>
    <div class="row">
      <input id="botToken" type="text" value="${botToken}" readonly />
      <button onclick="copy('botToken', this)">Copy</button>
    </div>
  </div>

  <div class="field">
    <label>Webhook URL</label>
    <div class="row">
      <input id="webhookUrl" type="text" value="${webhookUrl}" readonly />
      <button onclick="copy('webhookUrl', this)">Copy</button>
    </div>
  </div>

  <div class="note">
    Slack returns one webhook per OAuth install. To get separate URLs for the
    Approval, Security and Reminder channels, install the app three times
    (once per channel) and paste each URL into the correct field in
    Admin - Settings.
  </div>

  <script>
    function copy(id, btn) {
      const val = document.getElementById(id).value;
      navigator.clipboard.writeText(val).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1500);
      });
    }
  </script>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}