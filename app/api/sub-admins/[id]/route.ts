import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id: subAdminId } = await params;
  const { checklist_ids } = await req.json();

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
