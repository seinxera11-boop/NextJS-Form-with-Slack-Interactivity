import { supabaseAdmin } from "./supabase-admin";

export async function getWebhookUrl(
  departmentId: number | null,
  type: "approval" | "security" | "reminder",
  workspaceId: string
): Promise<string | null> {

  // Step 1: check department config
  if (departmentId) {
    const { data: deptConfig } = await supabaseAdmin
      .from("department_slack_configs")
      .select("approval_url, security_url, reminder_url")
      .eq("department_id", departmentId)
      .maybeSingle();

    // Step 2: if dept has a URL for this type, return it
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