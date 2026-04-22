import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export type UserContext = {
  email: string;
  isMainAdmin: boolean;
  /** Empty array means no restriction (main admin). Non-empty = allowed dept IDs. */
  assignedDepartments: number[];
};

/**
 * Reads the Supabase session from request cookies and returns the caller's
 * admin context (main admin vs sub-admin + their department list).
 * Returns null if the request has no valid session or the email is not an admin.
 */
export async function getUserContext(req: NextRequest): Promise<UserContext | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  // getUser() contacts the Supabase Auth server to verify the token.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.toLowerCase();

  // Main admin check via env var (fastest path, no DB round-trip needed for identity).
  if (ADMIN_EMAILS.includes(email)) {
    // Keep admin_users in sync so the table always reflects current admins.
    await supabaseAdmin
      .from("admin_users")
      .upsert({ email, is_main_admin: true }, { onConflict: "email" });
    return { email, isMainAdmin: true, assignedDepartments: [] };
  }

  // Sub-admin check via admin_users table.
  const { data: adminUser } = await supabaseAdmin
    .from("admin_users")
    .select("id, is_main_admin")
    .eq("email", email)
    .single();

  if (!adminUser) return null;

  if (adminUser.is_main_admin) {
    return { email, isMainAdmin: true, assignedDepartments: [] };
  }

  // Fetch assigned departments for sub-admin.
  const { data: deptRows } = await supabaseAdmin
    .from("sub_admin_departments")
    .select("department_id")
    .eq("sub_admin_id", adminUser.id);

  return {
    email,
    isMainAdmin: false,
    assignedDepartments: (deptRows || []).map((r) => r.department_id),
  };
}
