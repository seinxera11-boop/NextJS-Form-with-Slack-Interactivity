import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*))")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { title, sections, created_by, is_large_checklist, department_id } = await req.json();

  // Only attach department_id for small checklists
  const resolvedDeptId = is_large_checklist ? null : (department_id ?? null);

  const { data: cl, error: clErr } = await supabase
    .from("checklists")
    .insert({ title, created_by, is_large_checklist: is_large_checklist ?? false, department_id: resolvedDeptId })
    .select()
    .single();
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  for (const sec of sections) {
    const { data: secRow, error: secErr } = await supabase
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
      const { error: itemErr } = await supabase.from("checklist_items").insert(items);
      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: cl.id }, { status: 201 });
}