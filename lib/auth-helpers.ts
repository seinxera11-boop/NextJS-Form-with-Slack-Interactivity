import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export type UserContext = {
  email: string;
  isMainAdmin: boolean;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  assignedChecklists: number[];
};

function getSupabaseClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function getUserContext(req: NextRequest): Promise<UserContext | null> {
  const supabase = getSupabaseClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.toLowerCase();

  const { data: adminUser } = await supabaseAdmin
    .from("admin_users")
    .select("id, is_main_admin, workspace_id")
    .eq("email", email)
    .not("workspace_id", "is", null)
    .single();

  if (!adminUser?.workspace_id) return null;

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("slug, name")
    .eq("id", adminUser.workspace_id)
    .single();

  if (!workspace) return null;

  if (adminUser.is_main_admin) {
    return {
      email,
      isMainAdmin: true,
      workspaceId: adminUser.workspace_id,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      assignedChecklists: [],
    };
  }

  const { data: rows } = await supabaseAdmin
    .from("sub_admin_checklists")
    .select("checklist_id")
    .eq("sub_admin_id", adminUser.id);

  return {
    email,
    isMainAdmin: false,
    workspaceId: adminUser.workspace_id,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    assignedChecklists: (rows || []).map((r) => r.checklist_id),
  };
}

export async function isSuperAdmin(req: NextRequest): Promise<boolean> {
  if (SUPER_ADMIN_EMAILS.length === 0) return false;
  const supabase = getSupabaseClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export function getSuperAdminEmails(): string[] {
  return SUPER_ADMIN_EMAILS;
}
