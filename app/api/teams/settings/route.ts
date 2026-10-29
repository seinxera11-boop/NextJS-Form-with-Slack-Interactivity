import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const ROLES = ["approval", "security", "reminder"] as const;

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const [{ data: workspace }, { data: config }, { data: installations }] = await Promise.all([
    supabaseAdmin
      .from("workspaces")
      .select("messaging_provider, teams_tenant_id")
      .eq("id", ctx.workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from("teams_configs")
      .select("approval_conversation_id, security_conversation_id, reminder_conversation_id")
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from("teams_installations")
      .select("conversation_id, display_name, conversation_type")
      .eq("workspace_id", ctx.workspaceId)
      .is("removed_at", null)
      .order("installed_at", { ascending: false }),
  ]);

  return NextResponse.json({
    messaging_provider: workspace?.messaging_provider ?? "slack",
    tenant_connected: !!workspace?.teams_tenant_id,
    approval_conversation_id: config?.approval_conversation_id ?? null,
    security_conversation_id: config?.security_conversation_id ?? null,
    reminder_conversation_id: config?.reminder_conversation_id ?? null,
    installations: installations ?? [],
  });
}

/** Save the provider and the channel assigned to each role (main admin only). */
export async function PUT(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!ctx.isMainAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await req.json();

  const provider = body.messaging_provider;
  if (provider !== "slack" && provider !== "teams") {
    return NextResponse.json({ error: "無効なプロバイダーです" }, { status: 400 });
  }

  // Only conversations this workspace has itself claimed may be assigned.
  // Without this an admin could point notifications at any conversation id,
  // including another tenant's channel.
  const { data: owned } = await supabaseAdmin
    .from("teams_installations")
    .select("conversation_id")
    .eq("workspace_id", ctx.workspaceId)
    .is("removed_at", null);
  const ownedIds = new Set((owned ?? []).map((r) => r.conversation_id));

  const update: Record<string, string | null> = {};
  for (const role of ROLES) {
    const key = `${role}_conversation_id`;
    const value = body[key] ?? null;
    if (value !== null && (typeof value !== "string" || !ownedIds.has(value))) {
      return NextResponse.json({ error: "無効なチャンネルです" }, { status: 400 });
    }
    update[key] = value;
  }

  if (provider === "teams" && !update.approval_conversation_id) {
    return NextResponse.json(
      { error: "Teamsを有効にするには承認チャンネルを設定してください" },
      { status: 400 }
    );
  }

  const { error: cfgErr } = await supabaseAdmin
    .from("teams_configs")
    .upsert(
      { workspace_id: ctx.workspaceId, ...update, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id" }
    );
  if (cfgErr) return NextResponse.json({ error: cfgErr.message }, { status: 500 });

  const { error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .update({ messaging_provider: provider })
    .eq("id", ctx.workspaceId);
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
