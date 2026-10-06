import { App } from "@microsoft/teams.apps";
import { NextAdapter } from "./teams-adapter";

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
  // address the channel later. Persisting it is step 4 of the migration.
  app.on("install.add", async ({ activity }) => {
    console.log("[teams] install.add", {
      conversationId: activity.conversation?.id,
      conversationType: activity.conversation?.conversationType,
      tenantId: activity.conversation?.tenantId,
      name: activity.conversation?.name,
    });
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
