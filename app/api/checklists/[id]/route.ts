import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*))")
    .eq("id", (await params).id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  if (!ctx.isMainAdmin && !ctx.assignedDepartments.includes(data.department_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, sections, created_by, is_large_checklist, department_id } = await req.json();
  const checklistId = Number((await params).id);

  if (!ctx.isMainAdmin) {
    const { data: existing } = await supabaseAdmin
      .from("checklists")
      .select("department_id")
      .eq("id", checklistId)
      .single();
    if (!existing || !ctx.assignedDepartments.includes(existing.department_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (is_large_checklist) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const resolvedDeptId = is_large_checklist ? null : (department_id ?? null);

  const { error: clErr } = await supabaseAdmin
    .from("checklists")
    .update({
      title,
      created_by,
      is_large_checklist: is_large_checklist ?? false,
      department_id: resolvedDeptId,
    })
    .eq("id", checklistId);
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  const { data: existingSections } = await supabaseAdmin
    .from("checklist_sections")
    .select("id")
    .eq("checklist_id", checklistId);

  const existingSectionIds = (existingSections || []).map((s) => s.id);
  const incomingSectionIds = sections.filter((s: any) => s.id).map((s: any) => s.id);
  const sectionsToDelete   = existingSectionIds.filter((id) => !incomingSectionIds.includes(id));

  if (sectionsToDelete.length) {
    const { error } = await supabaseAdmin
      .from("checklist_sections")
      .delete()
      .in("id", sectionsToDelete);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const sec of sections) {
    let sectionId: number;

    if (sec.id) {
      const { error } = await supabaseAdmin
        .from("checklist_sections")
        .update({ title: sec.title, order_index: sec.order_index })
        .eq("id", sec.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      sectionId = sec.id;
    } else {
      const { data: newSec, error } = await supabaseAdmin
        .from("checklist_sections")
        .insert({ checklist_id: checklistId, title: sec.title, order_index: sec.order_index })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      sectionId = newSec.id;
    }

    const { data: existingItems } = await supabaseAdmin
      .from("checklist_items")
      .select("id")
      .eq("section_id", sectionId);

    const existingItemIds = (existingItems || []).map((i) => i.id);
    const incomingItemIds = (sec.tasks || []).filter((t: any) => t.id).map((t: any) => t.id);
    const itemsToDelete   = existingItemIds.filter((id) => !incomingItemIds.includes(id));

    if (itemsToDelete.length) {
      const { error } = await supabaseAdmin
        .from("checklist_items")
        .delete()
        .in("id", itemsToDelete);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const task of sec.tasks || []) {
      if (task.id) {
        const { error } = await supabaseAdmin
          .from("checklist_items")
          .update({
            label:       task.label,
            order_index: task.order_index,
            section_id:  sectionId,
          })
          .eq("id", task.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabaseAdmin
          .from("checklist_items")
          .insert({
            checklist_id: checklistId,
            section_id:   sectionId,
            label:        task.label,
            order_index:  task.order_index,
          });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("checklists")
    .delete()
    .eq("id", (await params).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
