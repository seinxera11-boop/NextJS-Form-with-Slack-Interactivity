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

  const { error: clErr } = await supabase
    .from("checklists")
    .update({ title, created_by })
    .eq("id", checklistId);
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  const { data: existingSections } = await supabase
    .from("checklist_sections")
    .select("id")
    .eq("checklist_id", checklistId);

  const existingSectionIds = (existingSections || []).map((s) => s.id);
  const incomingSectionIds = sections.filter((s: any) => s.id).map((s: any) => s.id);
  const sectionsToDelete = existingSectionIds.filter((id) => !incomingSectionIds.includes(id));

  if (sectionsToDelete.length) {
    const { error } = await supabase
      .from("checklist_sections")
      .delete()
      .in("id", sectionsToDelete);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const sec of sections) {
    let sectionId: number;

    if (sec.id) {
      const { error } = await supabase
        .from("checklist_sections")
        .update({ title: sec.title, order_index: sec.order_index })
        .eq("id", sec.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      sectionId = sec.id;
    } else {
      const { data: newSec, error } = await supabase
        .from("checklist_sections")
        .insert({ checklist_id: checklistId, title: sec.title, order_index: sec.order_index })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      sectionId = newSec.id;
    }

    const { data: existingItems } = await supabase
      .from("checklist_items")
      .select("id")
      .eq("section_id", sectionId);

    const existingItemIds = (existingItems || []).map((i) => i.id);
    const incomingItemIds = (sec.tasks || []).filter((t: any) => t.id).map((t: any) => t.id);
    const itemsToDelete = existingItemIds.filter((id) => !incomingItemIds.includes(id));

    if (itemsToDelete.length) {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .in("id", itemsToDelete);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const task of sec.tasks || []) {
      if (task.id) {
        const { error } = await supabase
          .from("checklist_items")
          .update({
            label:       task.label,
            type:        task.type,
            required:    task.required,
            order_index: task.order_index,
            section_id:  sectionId,
          })
          .eq("id", task.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabase
          .from("checklist_items")
          .insert({
            checklist_id: checklistId,
            section_id:   sectionId,
            label:        task.label,
            type:         task.type,
            required:     task.required,
            order_index:  task.order_index,
          });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
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