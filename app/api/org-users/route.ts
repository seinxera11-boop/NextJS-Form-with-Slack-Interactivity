import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const department_id = searchParams.get("department_id");

  let query = supabaseAdmin
    .from("org_users")
    .select("*, departments(name)")
    .order("name");

  if (department_id) query = query.eq("department_id", department_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { name, department_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!department_id) return NextResponse.json({ error: "Department is required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("org_users")
    .insert({ name: name.trim(), department_id })
    .select("*, departments(name)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("org_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}