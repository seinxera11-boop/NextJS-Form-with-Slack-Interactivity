import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isValidEmail } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id: subAdminId } = await params;
  const { checklist_ids, email } = await req.json();

  if (email !== undefined) {
    if (!email.trim()) return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
    const lowerEmail = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", lowerEmail)
      .neq("id", subAdminId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "このメールアドレスはすでに登録されています" }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ email: lowerEmail })
      .eq("id", subAdminId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_main_admin", false);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "このメールアドレスはすでに登録されています" }, { status: 409 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (checklist_ids === undefined) return NextResponse.json({ ok: true });

  await supabaseAdmin.from("sub_admin_checklists").delete().eq("sub_admin_id", subAdminId);

  if (Array.isArray(checklist_ids) && checklist_ids.length > 0) {
    const rows = checklist_ids.map((c: number) => ({ sub_admin_id: subAdminId, checklist_id: c }));
    const { error } = await supabaseAdmin.from("sub_admin_checklists").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id: subAdminId } = await params;

  const { error } = await supabaseAdmin
    .from("admin_users")
    .delete()
    .eq("id", subAdminId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
