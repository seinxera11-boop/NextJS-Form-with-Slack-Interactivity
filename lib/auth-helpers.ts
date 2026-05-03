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
  /** Empty array means no restriction (main admin). Non-empty = allowed checklist IDs. */
  assignedChecklists: number[];
};

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.toLowerCase();

  if (ADMIN_EMAILS.includes(email)) {
    await supabaseAdmin
      .from("admin_users")
      .upsert({ email, is_main_admin: true }, { onConflict: "email" });
    return { email, isMainAdmin: true, assignedChecklists: [] };
  }

  const { data: adminUser } = await supabaseAdmin
    .from("admin_users")
    .select("id, is_main_admin")
    .eq("email", email)
    .single();

  if (!adminUser) return null;

  if (adminUser.is_main_admin) {
    return { email, isMainAdmin: true, assignedChecklists: [] };
  }

  const { data: rows } = await supabaseAdmin
    .from("sub_admin_checklists")
    .select("checklist_id")
    .eq("sub_admin_id", adminUser.id);

  return {
    email,
    isMainAdmin: false,
    assignedChecklists: (rows || []).map((r) => r.checklist_id),
  };
}
