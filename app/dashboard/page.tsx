"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [botToken, setBotToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
const teamId = searchParams.get("team_id");
    fetch(`/api/slack/get-token?team_id=${teamId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("API data:", data);
        setBotToken(data.botToken);
        setWebhookUrl(data.webhookUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading Slack info...</p>;

  return (
    <div>
      <h1>Slack Dashboard</h1>
      <p>Bot Token: {botToken}</p>
      <p>Webhook URL: {webhookUrl}</p>
    </div>
  );
}