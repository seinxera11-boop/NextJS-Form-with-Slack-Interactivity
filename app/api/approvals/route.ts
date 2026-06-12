import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  let query = supabaseAdmin
    .from("responses")
    .select(
      `*, checklists(title), departments(name), org_users(name),
       response_items(*, checklist_items(label, type)), response_approvals(*)`
    )
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  if (!ctx.isMainAdmin) {
    if (ctx.assignedChecklists.length === 0) return NextResponse.json([]);
    query = query.in("checklist_id", ctx.assignedChecklists);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
