import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  let query = supabaseAdmin
    .from("checklists")
    .select("*, checklist_sections(*, checklist_items(*)), checklist_departments(department_id)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  if (!ctx.isMainAdmin) {
    if (ctx.assignedChecklists.length === 0) return NextResponse.json([]);
    query = query.in("id", ctx.assignedChecklists);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!ctx.isMainAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { title, sections, created_by, is_large_checklist, department_id, department_ids } =
    await req.json();

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

  const { data: cl, error: clErr } = await supabaseAdmin
    .from("checklists")
    .insert({
      title,
      created_by,
      is_large_checklist: is_large_checklist ?? false,
      department_id: resolvedDeptId,
      workspace_id: ctx.workspaceId,
    })
    .select()
    .single();
  if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

  if (is_large_checklist && Array.isArray(department_ids) && department_ids.length > 0) {
    const { error: deptErr } = await supabaseAdmin
      .from("checklist_departments")
      .insert(department_ids.map((dId: number) => ({ checklist_id: cl.id, department_id: dId })));
    if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 });
  }

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
