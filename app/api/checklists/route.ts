import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabaseAdmin
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*))")
    .order("created_at", { ascending: false });

  if (!ctx.isMainAdmin) {
    query = (query as any).in("department_id", ctx.assignedDepartments);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, sections, created_by, is_large_checklist, department_id } = await req.json();
  const resolvedDeptId = is_large_checklist ? null : (department_id ?? null);

  const { data: cl, error: clErr } = await supabaseAdmin
    .from("checklists")
    .insert({ title, created_by, is_large_checklist: is_large_checklist ?? false, department_id: resolvedDeptId })
    .select()
    .single();
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  for (const sec of sections) {
    const { data: secRow, error: secErr } = await supabaseAdmin
      .from("checklist_sections")
      .insert({ checklist_id: cl.id, title: sec.title, order_index: sec.order_index })
      .select()
      .single();
    if (secErr) return NextResponse.json({ error: secErr.message }, { status: 500 });

    if (sec.tasks?.length) {
      const items = sec.tasks.map((t: any) => ({
        checklist_id: cl.id,
        section_id:   secRow.id,
        label:        t.label,
        order_index:  t.order_index,
      }));
      const { error: itemErr } = await supabaseAdmin.from("checklist_items").insert(items);
      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: cl.id }, { status: 201 });
}
