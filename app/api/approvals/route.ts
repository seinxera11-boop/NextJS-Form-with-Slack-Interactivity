import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabaseAdmin
    .from("responses")
    .select(
      `*, checklists(title), departments(name), org_users(name),
       response_items(*, checklist_items(label, type)), response_approvals(*)`
    )
    .order("created_at", { ascending: false });

  if (!ctx.isMainAdmin) {
    if (ctx.assignedDepartments.length === 0) return NextResponse.json([]);
    query = query.in("department_id", ctx.assignedDepartments);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { response_id, reason } = await req.json();
  if (!response_id) return NextResponse.json({ error: "response_id required" }, { status: 400 });

  if (!ctx.isMainAdmin) {
    const { data: resp } = await supabaseAdmin
      .from("responses")
      .select("department_id")
      .eq("id", response_id)
      .single();

    if (!resp || !ctx.assignedDepartments.includes(resp.department_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin.from("response_approvals").insert({
    response_id,
    reason: reason || "",
    approved_by: ctx.email,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
