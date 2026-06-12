import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { names } = await req.json();
  if (!Array.isArray(names)) return NextResponse.json({ error: "Not an Array" }, { status: 400 });
  if (names.length == 0) return NextResponse.json({ error: "Array is Empty"}, {status: 400})
  
  const { data: existingDepts, error: fetchError } = await supabaseAdmin
    .from("departments")
    .select("name")
    .eq("workspace_id", ctx.workspaceId);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  const existingNames = existingDepts.map(u => u.name);
  const newNames = names.filter(name => !existingNames.includes(name));
  const skipped = names.filter(name => existingNames.includes(name));
  if (newNames.length == 0) return NextResponse.json({ error: "Department names should be unique" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert(newNames.map(name => ({ name: name, workspace_id: ctx.workspaceId })))
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({data,skipped}, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("departments")
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
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
