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

  const botToken   = data.access_token ?? "";
  const webhookUrl = data.incoming_webhook?.url ?? "";

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <title>Slack Installed</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      max-width: 560px;
      margin: 60px auto;
      padding: 0 24px;
      color: #1a1035;
      background: linear-gradient(180deg, #faf9ff 0%, #f8f5ff 100%);
      min-height: 100vh;
    }
    nav {
      height: 58px;
      border-bottom: 1.5px solid #ede9fe;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .nav-logo {
      font-weight: 800;
      font-size: 16px;
      color: #4f35be;
      letter-spacing: -0.03em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%);
    }
    .nav-right { display: flex; align-items: center; gap: 16px; }
    .nav-email { font-size: 12px; color: #9688c0; font-weight: 500; }
    .sign-out {
      font-size: 12px; color: #7c6fa0; background: #f5f0ff;
      border: 1px solid #ddd6fe; border-radius: 8px;
      padding: 5px 14px; cursor: pointer;
    }
    h2 { font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #1a1035; }
    .sub { font-size: 14px; color: #9688c0; margin-bottom: 32px; }
    .field { margin-bottom: 20px; }
    label {
      display: block; font-size: 12px; font-weight: 600; color: #9688c0;
      text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px;
    }
    .row { display: flex; gap: 8px; }
    input {
      flex: 1; border: 1px solid #ede9fe; border-radius: 8px;
      padding: 10px 13px; font-size: 13px; font-family: monospace;
      background: #faf9ff; color: #1a1035; outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #6d28d9; }
    button {
      font-size: 13px; font-weight: 600; background: #4f35be;
      color: #fff; border: none; border-radius: 8px;
      padding: 10px 16px; cursor: pointer; white-space: nowrap;
      transition: background 0.15s;
    }
    button:hover { background: #6d28d9; }
    .note {
      font-size: 13px; color: #7c6fa0; background: #f5f0ff;
      border: 1px solid #ede9fe; border-radius: 8px;
      padding: 14px 16px; margin-top: 28px; line-height: 1.6;
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-logo">
      <div class="nav-dot"></div>
      OfficeAdmin
    </div>
  </nav>

  <h2>Slack installed</h2>
  <div class="sub">Copy these values and paste them into Admin › Settings.</div>

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
    Admin › Settings.
  </div>

  <script>
    function copy(id, btn) {
      const val = document.getElementById(id).value;
      navigator.clipboard.writeText(val).then(() => {
        btn.textContent = "Copied!";
        btn.style.background = "#7c3aed";
        setTimeout(() => { btn.textContent = "Copy"; btn.style.background = "#4f35be"; }, 1500);
      });
    }
  </script>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}