import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  // Get Slack OAuth code
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Exchange code for access token
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
  if (!data.ok) {
    return NextResponse.json(data, { status: 400 });
  }

  // Extract bot token and webhook URL
  const botToken = data.access_token;
  const webhookUrl = data.incoming_webhook?.url;

  // Insert into Supabase table (multiple rows allowed)
  await supabaseAdmin
    .from("slack_tokens")
    .insert([
      {
        team_id: data.team.id,
        installation_id: data.authed_user?.id || null, // optional, unique per user
        team_name: data.team.name,
        bot_token: botToken,
        webhook_url: webhookUrl,
        installed_at: new Date().toISOString(),
      },
    ]);

 return new NextResponse(
  `
  <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h2>Slack Installed ✅</h2>

      <p>
        <b>Bot Token:</b><br/>
        <span id="botToken">${botToken}</span>
        <button onclick="copyText('botToken')">Copy</button>
      </p>

      <p>
        <b>Webhook URL:</b><br/>
        <span id="webhookUrl">${webhookUrl}</span>
        <button onclick="copyText('webhookUrl')">Copy</button>
      </p>

      <script>
        function copyText(id) {
          const text = document.getElementById(id).innerText;
          navigator.clipboard.writeText(text).then(() => {
            alert("Copied!");
          });
        }
      </script>
    </body>
  </html>
  `,
  {
    headers: { "Content-Type": "text/html" },
  }
);
}