import { App } from "@microsoft/teams.apps";
import { stripMentionsText } from "@microsoft/teams.api";
import { NextAdapter } from "./teams-adapter";
import { supabaseAdmin } from "./supabase-admin";
import {
  claimInstallation,
  markInstallationRemoved,
  recordInstallation,
} from "./teams-installations";

// Matches createClaimCode()'s output: 8 chars from an unambiguous alphabet.
const CLAIM_CODE_PATTERN = /^[A-HJ-NP-Za-hj-np-z2-9]{8}$/;

/**
 * Single Teams App instance, shared across route handlers.
 *
 * Multi-tenant by design: one Entra app registration (CLIENT_ID /
 * CLIENT_SECRET) authenticates to every customer tenant, so unlike the Slack
 * integration there is no per-workspace bot token to store or clobber.
 * See TEAMS_MIGRATION.md §4.
 *
 * The App is constructed lazily and memoised. On a warm serverless invocation
 * this is reused; on a cold start it is rebuilt. Activity handlers must be
 * registered before initialize(), so they live here.
 */

const adapter = new NextAdapter();

let appPromise: Promise<App> | null = null;

function buildApp(): Promise<App> {
  // clientId/clientSecret/tenantId are read from CLIENT_ID / CLIENT_SECRET /
  // TENANT_ID when not passed explicitly.
  const app = new App({ httpServerAdapter: adapter });

  registerHandlers(app);

  return app.initialize().then(() => app);
}

export function getTeamsApp(): Promise<App> {
  appPromise ??= buildApp();
  return appPromise;
}

/**
 * The messaging route handler registered by the SDK through our adapter.
 * Entering through this (rather than app.process) is what gets inbound
 * Bot Framework JWT validation. See TEAMS_MIGRATION.md §7.
 */
export async function getTeamsHandler() {
  await getTeamsApp();

  const handler = adapter.getHandler();
  if (!handler) {
    throw new Error(
      `Teams SDK registered no messaging route. Registered: ${
        adapter.registeredRoutes.join(", ") || "(none)"
      }`
    );
  }
  return handler;
}

function registerHandlers(app: App) {
  // Installation is how a channel becomes reachable: there is no webhook URL
  // to paste, so the conversationId from this activity is the only way to
  // address the channel later. It is stored unclaimed; the admin links it to
  // a workspace by posting a claim code (see the message handler below).
  app.on("install.add", async ({ activity, send }) => {
    const conversationId = activity.conversation?.id;
    const tenantId = activity.conversation?.tenantId;
    if (!conversationId || !tenantId) return;

    try {
      await recordInstallation({
        conversationId,
        tenantId,
        conversationType: activity.conversation?.conversationType,
        displayName: activity.conversation?.name,
      });
      await send(
        "インストールありがとうございます。管理画面で発行した連携コードを、このチャンネルで @メンション付きで送信してください。"
      );
    } catch (err) {
      console.error("[teams] install.add failed:", err);
    }
  });

  app.on("install.remove", async ({ activity }) => {
    const conversationId = activity.conversation?.id;
    if (!conversationId) return;
    try {
      await markInstallationRemoved(conversationId);
    } catch (err) {
      console.error("[teams] install.remove failed:", err);
    }
  });

  // Claim flow: the admin posts the code from the dashboard in the channel.
  app.on("message", async ({ activity, send }) => {
    const conversationId = activity.conversation?.id;
    const tenantId = activity.conversation?.tenantId;
    if (!conversationId || !tenantId) return;

    const text = (stripMentionsText(activity) ?? "").trim();
    if (!CLAIM_CODE_PATTERN.test(text)) return;

    try {
      const result = await claimInstallation(text, conversationId, tenantId);
      if (result.ok) {
        await send(
          `「${result.workspaceName}」に連携しました。管理画面でこのチャンネルの用途（承認／セキュリティ／リマインダー）を設定してください。`
        );
        return;
      }
      const reasons = {
        invalid: "コードが無効、または期限切れです。管理画面で新しいコードを発行してください。",
        tenant_mismatch: "このワークスペースは別の Microsoft 365 テナントに連携済みです。",
        already_claimed: "このチャンネルはすでに連携済みです。",
      } as const;
      await send(reasons[result.reason]);
    } catch (err) {
      console.error("[teams] claim failed:", err);
    }
  });

  // Approval button. This handler must return a response (the type is not
  // void) — the card is waiting on an answer.
  app.on("card.action", async ({ activity }) => {
    const reply = (value: string) => ({
      statusCode: 200 as const,
      type: "application/vnd.microsoft.activity.message" as const,
      value,
    });

    const data = activity.value?.action?.data as
      | { verb?: string; response_id?: number | string; reason?: string }
      | undefined;
    if (data?.verb !== "approve") return reply("未対応の操作です");

    const responseId = Number(data.response_id);
    const tenantId = activity.conversation?.tenantId;
    if (!Number.isInteger(responseId) || !tenantId) return reply("不正なリクエストです");

    try {
      // Tenant isolation: one credential reaches every tenant, so the response
      // must belong to a workspace tied to the tenant the click came from.
      // See TEAMS_MIGRATION.md §4.
      const { data: response } = await supabaseAdmin
        .from("responses")
        .select("workspace_id")
        .eq("id", responseId)
        .maybeSingle();
      if (!response) return reply("提出が見つかりません");

      const { data: workspace } = await supabaseAdmin
        .from("workspaces")
        .select("teams_tenant_id")
        .eq("id", response.workspace_id)
        .maybeSingle();
      if (!workspace?.teams_tenant_id || workspace.teams_tenant_id !== tenantId) {
        console.warn("[teams] card.action tenant mismatch", { responseId, tenantId });
        return reply("この提出を承認する権限がありません");
      }

      // The button stays clickable after approval, so this guard is
      // load-bearing, not just a retry safeguard.
      const { data: existing } = await supabaseAdmin
        .from("response_approvals")
        .select("id")
        .eq("response_id", responseId)
        .maybeSingle();
      if (existing) return reply("既に承認済みです");

      const reason = data.reason?.trim() || "コメントありませんでした。";
      const approvedBy = activity.from?.name || "不明";

      const { error } = await supabaseAdmin
        .from("response_approvals")
        .insert({ response_id: responseId, reason, approved_by: approvedBy });
      if (error) throw error;

      return reply(`${approvedBy}が承認しました\nコメント: ${reason}`);
    } catch (err) {
      console.error("[teams] card.action failed:", err);
      return reply("承認の保存に失敗しました。もう一度お試しください。");
    }
  });
}
