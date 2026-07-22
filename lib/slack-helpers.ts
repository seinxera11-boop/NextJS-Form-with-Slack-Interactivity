import { supabaseAdmin } from "./supabase-admin";

type SlackChannelType = "approval" | "security" | "reminder";

export async function getWebhookUrl(
  checklistId: number | null,
  departmentId: number | null,
  type: SlackChannelType,
  workspaceId: string
): Promise<string | null> {

  // Step 1: checklist-level override (most specific)
  if (checklistId) {
    const { data: checklistConfig } = await supabaseAdmin
      .from("checklist_slack_configs")
      .select("approval_url, security_url, reminder_url")
      .eq("checklist_id", checklistId)
      .maybeSingle();

    const url = checklistConfig?.[`${type}_url`];
    if (url) return url;
  }

  // Step 2: department config
  if (departmentId) {
    const { data: deptConfig } = await supabaseAdmin
      .from("department_slack_configs")
      .select("approval_url, security_url, reminder_url")
      .eq("department_id", departmentId)
      .maybeSingle();

    const url = deptConfig?.[`${type}_url`];
    if (url) return url;
  }

  // Step 3: fall back to workspace default
  const { data: workspaceConfig } = await supabaseAdmin
    .from("slack_configs")
    .select("approval_url, security_url, reminder_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const workspaceUrl = workspaceConfig?.[`${type}_url`];
  return workspaceUrl ?? null;
}