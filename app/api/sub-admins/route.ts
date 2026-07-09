import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidEmail } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, sub_admin_checklists(checklist_id)")
    .eq("is_main_admin", false)
    .eq("workspace_id", ctx.workspaceId)
    .order("email");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { email, checklist_ids } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });

  const lowerEmail = email.trim().toLowerCase();

  const { data: existing } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("email", lowerEmail)
    .single();

  //let subAdminId: string;

  if (existing) {
  return NextResponse.json(
    { error: "このメールアドレスはすでに登録されています" },
    { status: 409 }
  );
}

const { data: inserted, error: insertError } = await supabaseAdmin
  .from("admin_users")
  .insert({ email: lowerEmail, is_main_admin: false, workspace_id: ctx.workspaceId })
  .select("id")
  .single();
if (insertError?.code === "23505") {
  return NextResponse.json({ error: "このメールアドレスはすでに登録されています" }, { status: 409 });
}
if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

const subAdminId = inserted.id;

  await supabaseAdmin.from("sub_admin_checklists").delete().eq("sub_admin_id", subAdminId);

  if (Array.isArray(checklist_ids) && checklist_ids.length > 0) {
    const rows = checklist_ids.map((c: number) => ({ sub_admin_id: subAdminId, checklist_id: c }));
    const { error: insError } = await supabaseAdmin.from("sub_admin_checklists").insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ id: subAdminId, email: lowerEmail }, { status: 201 });
}
