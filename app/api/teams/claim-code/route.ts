import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { createClaimCode } from "@/lib/teams-installations";

export const runtime = "nodejs";

/** Issue a one-time code the admin posts in a Teams channel to link it. */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!ctx.isMainAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { code, expiresAt } = await createClaimCode(ctx.workspaceId, ctx.email);
  return NextResponse.json({ code, expires_at: expiresAt });
}
