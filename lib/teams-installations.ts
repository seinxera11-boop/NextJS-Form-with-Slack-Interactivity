import { randomInt } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin";

// No 0/O/1/I so a code read out loud or typed from a screenshot is unambiguous.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_TTL_MS = 30 * 60 * 1000;

export type InstallationInfo = {
  conversationId: string;
  tenantId: string;
  conversationType?: string | null;
  displayName?: string | null;
};

/** Record (or refresh) a conversation the app was installed into. */
export async function recordInstallation(info: InstallationInfo) {
  // workspace_id is deliberately omitted so a reinstall never unlinks a
  // channel that was already claimed.
  const { error } = await supabaseAdmin.from("teams_installations").upsert(
    {
      conversation_id: info.conversationId,
      tenant_id: info.tenantId,
      conversation_type: info.conversationType ?? null,
      display_name: info.displayName ?? null,
      installed_at: new Date().toISOString(),
      removed_at: null,
    },
    { onConflict: "conversation_id" }
  );
  if (error) throw error;
}

export async function markInstallationRemoved(conversationId: string) {
  const { error } = await supabaseAdmin
    .from("teams_installations")
    .update({ removed_at: new Date().toISOString() })
    .eq("conversation_id", conversationId);
  if (error) throw error;
}

/** Create a one-time code for the workspace; the admin posts it in a channel. */
export async function createClaimCode(workspaceId: string, createdBy: string) {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // A collision on a 32^8 space is vanishingly unlikely; retry covers it anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    const { error } = await supabaseAdmin.from("teams_claim_codes").insert({
      code,
      workspace_id: workspaceId,
      created_by: createdBy,
      expires_at: expiresAt,
    });
    if (!error) return { code, expiresAt };
    if (error.code !== "23505") throw error;
  }
  throw new Error("could not generate a unique claim code");
}

export type ClaimResult =
  | { ok: true; workspaceName: string }
  | { ok: false; reason: "invalid" | "tenant_mismatch" | "already_claimed" };

/**
 * Bind an installed conversation to the workspace that issued `code`.
 *
 * The tenant check matters: once a workspace is tied to one Entra tenant, a
 * code posted from a different tenant must not attach foreign channels to it,
 * because approvals are later authorised by comparing tenant ids.
 */
export async function claimInstallation(
  code: string,
  conversationId: string,
  tenantId: string
): Promise<ClaimResult> {
  const normalized = code.trim().toUpperCase();

  const { data: inst } = await supabaseAdmin
    .from("teams_installations")
    .select("workspace_id, tenant_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (inst?.workspace_id) return { ok: false, reason: "already_claimed" };

  // Atomic single-use: only one caller can flip used_at from null.
  const { data: claimed } = await supabaseAdmin
    .from("teams_claim_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", normalized)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("workspace_id")
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "invalid" };

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("name, teams_tenant_id")
    .eq("id", claimed.workspace_id)
    .single();
  if (!workspace) return { ok: false, reason: "invalid" };

  if (workspace.teams_tenant_id && workspace.teams_tenant_id !== tenantId) {
    return { ok: false, reason: "tenant_mismatch" };
  }

  if (!workspace.teams_tenant_id) {
    await supabaseAdmin
      .from("workspaces")
      .update({ teams_tenant_id: tenantId })
      .eq("id", claimed.workspace_id);
  }

  const { error } = await supabaseAdmin
    .from("teams_installations")
    .update({ workspace_id: claimed.workspace_id, tenant_id: tenantId })
    .eq("conversation_id", conversationId);
  if (error) throw error;

  return { ok: true, workspaceName: workspace.name };
}
