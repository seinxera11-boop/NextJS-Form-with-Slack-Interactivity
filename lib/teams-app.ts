import { App } from "@microsoft/teams.apps";
import { stripMentionsText } from "@microsoft/teams.api";
import { NextAdapter } from "./teams-adapter";
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

  // Approval button. Wired up in migration step 7 — logging only for now so
  // registration can be verified end to end before any DB writes happen.
  // Note: this handler must return a response (the type is not void) — the
  // card is waiting on an answer.
  app.on("card.action", async ({ activity }) => {
    console.log("[teams] card.action", {
      data: activity.value?.action?.data,
      from: activity.from?.name,
      tenantId: activity.conversation?.tenantId,
    });

    return {
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message" as const,
      value: "受け付けました（設定中）",
    };
  });
}
