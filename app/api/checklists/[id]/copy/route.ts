import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string}>}) {
    const ctx = await getUserContext(req);
    if (!ctx) return NextResponse.json({ error: "認証が必要です"}, { status: 401 });

    const checklistId = Number((await params).id);

    if (!ctx.isMainAdmin) return NextResponse.json({ error: "権限がありません"}, { status: 403 });  

    const { data: orgChecklist, error }= await supabaseAdmin
        .from("checklists")
        .select("*, checklist_sections(*, checklist_items(*)), checklist_departments(department_id)")
        .eq("id", checklistId)
        .single();
    if (error) return NextResponse.json({ error: error.message}, { status: 404 });
    
    const { data: newChecklist, error: clErr } = await supabaseAdmin
        .from("checklists")
        .insert({
            title: "コピー: " + orgChecklist.title,
            created_by: orgChecklist.created_by,
            is_large_checklist: orgChecklist.is_large_checklist,
            department_id: orgChecklist.department_id,
            workspace_id: ctx.workspaceId,
        })
        .select()
        .single();
    if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 });

    if (orgChecklist.is_large_checklist) {
        const { error: deptErr } = await supabaseAdmin
            .from("checklist_departments")
            .insert(orgChecklist.checklist_departments.map((d: { department_id: number}) => ({ checklist_id: newChecklist.id, department_id: d.department_id })));
        if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 });
    }

    for ( const sec of orgChecklist.checklist_sections) {
        const { data: newSec, error: secErr } = await supabaseAdmin
            .from("checklist_sections")
            .insert({
                checklist_id: newChecklist.id,
                title: sec.title,
                order_index:  sec.order_index
            })
            .select()
            .single();
        if (secErr) return NextResponse.json({ error: secErr.message }, { status: 500 });

        const { error: itemErr } = await supabaseAdmin
            .from("checklist_items")
            .insert( sec.checklist_items.map((item: { label: string, order_index: number }) => ({ checklist_id: newChecklist.id, section_id: newSec.id, label: item.label, order_index: item.order_index })))
        if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

    }
    return NextResponse.json({id: newChecklist.id }, { status: 201 });
}