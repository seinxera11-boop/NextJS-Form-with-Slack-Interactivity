import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const checklistId = Number((await params).id);

  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*)), checklist_departments(department_id)")
    .eq("id", checklistId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const departmentIds: number[] = data.is_large_checklist
    ? (data.checklist_departments || []).map((cd: any) => cd.department_id)
    : data.department_id ? [data.department_id] : [];

  let departments: { id: number; name: string }[] = [];
  if (departmentIds.length > 0) {
    const { data: deptData } = await supabaseAdmin
      .from("departments")
      .select("id, name")
      .in("id", departmentIds);
    departments = deptData || [];
  }

  return NextResponse.json({ ...data, departments });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { title, sections, created_by, is_large_checklist, department_id, department_ids } =
    await req.json();
  const checklistId = Number((await params).id);

  if (!ctx.isMainAdmin) {
    if (!ctx.assignedChecklists.includes(checklistId) || is_large_checklist) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
  }

  if (!is_large_checklist) {
    if (!department_id) {
      return NextResponse.json(
        { error: "小規模チェックリストには部署の選択が必要です。" },
        { status: 400 }
      );
    }
  } else {
    if (!Array.isArray(department_ids) || department_ids.length === 0) {
      return NextResponse.json(
        { error: "大規模チェックリストには少なくとも1つの部署を選択してください。" },
        { status: 400 }
      );
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
    .eq("id", checklistId)
    .eq("workspace_id", ctx.workspaceId);
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  if (is_large_checklist) {
    const { error: delErr } = await supabaseAdmin
      .from("checklist_departments")
      .delete()
      .eq("checklist_id", checklistId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (Array.isArray(department_ids) && department_ids.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("checklist_departments")
        .insert(department_ids.map((dId: number) => ({ checklist_id: checklistId, department_id: dId })));
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  } else {
    await supabaseAdmin.from("checklist_departments").delete().eq("checklist_id", checklistId);
  }

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
          .update({ label: task.label, order_index: task.order_index, section_id: sectionId })
          .eq("id", task.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabaseAdmin
          .from("checklist_items")
          .insert({ checklist_id: checklistId, section_id: sectionId, label: task.label, order_index: task.order_index });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!ctx.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("checklists")
    .delete()
    .eq("id", (await params).id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
