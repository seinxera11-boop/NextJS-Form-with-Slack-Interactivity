import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const id = Number((await params).id);

  const { error } = await supabaseAdmin
    .from("workspace_holidays")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    console.error("[holidays] delete error:", error.message);
    return NextResponse.json({ error: "削除に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

