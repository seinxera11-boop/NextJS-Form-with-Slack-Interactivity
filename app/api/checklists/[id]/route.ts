import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { data, error } = await supabase
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*))")
    .eq("id", (await params).id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { title, sections, created_by } = await req.json();
  const checklistId = Number((await params).id);

  // 1. Update checklist title
  const { error: clErr } = await supabase
    .from("checklists")
    .update({ title, created_by })
    .eq("id", checklistId);
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  // 2. Delete old sections (cascade deletes their items too)
  const { error: delErr } = await supabase
    .from("checklist_sections")
    .delete()
    .eq("checklist_id", checklistId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // 3. Re-insert sections + items
  for (const sec of sections) {
    const { data: secRow, error: secErr } = await supabase
      .from("checklist_sections")
      .insert({ checklist_id: checklistId, title: sec.title, order_index: sec.order_index })
      .select()
      .single();
    if (secErr) return NextResponse.json({ error: secErr.message }, { status: 500 });

    if (sec.tasks?.length) {
      const items = sec.tasks.map((t: any) => ({
        checklist_id: checklistId,
        section_id:   secRow.id,
        label:        t.label,
        type:         t.type,
        required:     t.required,
        order_index:  t.order_index,
      }));
      const { error: itemErr } = await supabase.from("checklist_items").insert(items);
      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await supabase
    .from("checklists")
    .delete()
    .eq("id", (await params).id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}