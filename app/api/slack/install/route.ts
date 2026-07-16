import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const workspace    = searchParams.get("workspace") ?? "";
  const channel      = searchParams.get("channel") ?? "approval";
  const departmentId = searchParams.get("department_id") ?? "";

  const slackClientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/oauth/callback`;

  const state = departmentId
    ? `${workspace}:${channel}:${departmentId}`
    : `${workspace}:${channel}`;

  const url =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${slackClientId}` +
    `&scope=chat:write,incoming-webhook,channels:read,users:read,users.profile:read` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
