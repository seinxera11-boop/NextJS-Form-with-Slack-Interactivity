import { NextRequest, NextResponse } from "next/server";
import { getTeamsHandler } from "@/lib/teams-app";

export const runtime = "nodejs";

/**
 * The bot messaging endpoint — register this URL with
 * `teams app bot update <appId> --endpoint https://<domain>/api/teams/activities`.
 *
 * Replaces /api/slack/interactivity, and additionally receives installation
 * events (which is how channels become addressable at all).
 */
export async function POST(req: NextRequest) {
  let handler;
  try {
    handler = await getTeamsHandler();
  } catch (err) {
    // Missing/invalid credentials surface here rather than as a 200, so a
    // misconfigured deploy is visible instead of silently dropping activities.
    console.error("[teams/activities] app init failed:", err);
    return NextResponse.json({ error: "teams app not initialized" }, { status: 500 });
  }

  const res = await handler({
    body: await req.json(),
    headers: Object.fromEntries(req.headers),
    // `token` is intentionally left unset: that is what makes IHttpServer run
    // Authorization-header JWT validation. Setting it bypasses inbound auth.
  });

  return NextResponse.json(res.body ?? {}, { status: res.status });
}

/** Lets you confirm the route is deployed without sending an activity. */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "teams/activities" });
}
