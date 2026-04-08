import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const slackClientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth/callback`;

  const url = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=chat:write,incoming-webhook&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(url);
}