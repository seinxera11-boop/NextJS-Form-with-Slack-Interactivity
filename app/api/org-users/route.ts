import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const department_id = searchParams.get("department_id");
  const checklist_id = searchParams.get("checklist_id");

  let workspaceId: string;

  if (checklist_id) {
    // Public fill mode: derive workspace from the checklist, no auth needed
    const { data: cl, error: clErr } = await supabaseAdmin
      .from("checklists")
      .select("workspace_id")
      .eq("id", Number(checklist_id))
      .single();
    if (clErr || !cl) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    workspaceId = cl.workspace_id;
  } else {
    const ctx = await getUserContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    workspaceId = ctx.workspaceId;
  }

  let query = supabaseAdmin
    .from("org_users")
    .select("id, name, department_id")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (department_id) query = query.eq("department_id", department_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, department_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!department_id) return NextResponse.json({ error: "Department is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("org_users")
    .insert({ name: name.trim(), department_id, workspace_id: ctx.workspaceId })
    .select("*, departments(name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("org_users")
    .update({ name: name.trim() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  const { error } = await supabaseAdmin
    .from("org_users")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
