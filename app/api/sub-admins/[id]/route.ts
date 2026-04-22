import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: subAdminId } = await params;
  const { department_ids } = await req.json();

  // Replace all department assignments.
  await supabaseAdmin.from("sub_admin_departments").delete().eq("sub_admin_id", subAdminId);

  if (Array.isArray(department_ids) && department_ids.length > 0) {
    const rows = department_ids.map((d: number) => ({ sub_admin_id: subAdminId, department_id: d }));
    const { error } = await supabaseAdmin.from("sub_admin_departments").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: subAdminId } = await params;

  // sub_admin_departments rows cascade-delete via FK.
  const { error } = await supabaseAdmin
    .from("admin_users")
    .delete()
    .eq("id", subAdminId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
