import { supabaseAdmin } from "./supabase-admin";

type TeamsChannelType = "approval" | "security" | "reminder";

/**
 * Resolve which Teams conversation a message should go to, most specific
 * first: checklist override, then department, then the workspace default.
 *
 * Deliberately mirrors getWebhookUrl() in ./slack-helpers.ts so the two can be
 * compared side by side during the migration. The only difference is what is
 * stored: a conversationId instead of a webhook URL, because Teams has no
 * per-channel webhook that can carry an interactive card.
 *
 * Returns null when no tier is configured, which callers treat the same way
 * they treat a missing webhook today: skip that channel.
 */
export async function getConversationId(
  checklistId: number | null,
  departmentId: number | null,
  type: TeamsChannelType,
  workspaceId: string
): Promise<string | null> {
  const column = `${type}_conversation_id`;

  // Step 1: checklist-level override (most specific)
  if (checklistId) {
    const { data: checklistConfig } = await supabaseAdmin
      .from("checklist_teams_configs")
      .select(column)
      .eq("checklist_id", checklistId)
      .maybeSingle();

    const id = checklistConfig?.[column as keyof typeof checklistConfig];
    if (id) return id as string;
  }

  // Step 2: department config
  if (departmentId) {
    const { data: deptConfig } = await supabaseAdmin
      .from("department_teams_configs")
      .select(column)
      .eq("department_id", departmentId)
      .maybeSingle();

    const id = deptConfig?.[column as keyof typeof deptConfig];
    if (id) return id as string;
  }

  // Step 3: fall back to workspace default
  const { data: workspaceConfig } = await supabaseAdmin
    .from("teams_configs")
    .select(column)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const workspaceConversationId =
    workspaceConfig?.[column as keyof typeof workspaceConfig];
  return (workspaceConversationId as string | undefined) ?? null;
}

/**
 * Which messaging provider a workspace is cut over to.
 *
 * Lets Slack and Teams run side by side so workspaces migrate one at a time
 * rather than in a single flip. Defaults to "slack" so a workspace that has
 * not been touched keeps its current behaviour.
 */
export async function getMessagingProvider(
  workspaceId: string
): Promise<"slack" | "teams"> {
  const { data } = await supabaseAdmin
    .from("workspaces")
    .select("messaging_provider")
    .eq("id", workspaceId)
    .maybeSingle();

  return data?.messaging_provider === "teams" ? "teams" : "slack";
}
