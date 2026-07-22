import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("workspace_holidays")
    .select("id, holiday_date")
    .eq("workspace_id", ctx.workspaceId)
    .order("holiday_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawDates: unknown[] = Array.isArray(body?.dates) ? body.dates : [];

  const validDates = rawDates.filter(
    (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
  );

  if (validDates.length === 0) {
    return NextResponse.json(
      { error: "有効な日付がありません（YYYY-MM-DD形式で指定してください）" },
      { status: 400 }
    );
  }

  // Dedupe within this batch — Postgres rejects an upsert that would apply
  // ON CONFLICT DO UPDATE to the same row twice in one statement, which
  // happens if the same date appears more than once in the pasted list.
  const uniqueDates = [...new Set(validDates)];
  const rows = uniqueDates.map(holiday_date => ({ workspace_id: ctx.workspaceId, holiday_date }));

  const { error } = await supabaseAdmin
    .from("workspace_holidays")
    .upsert(rows, { onConflict: "workspace_id,holiday_date" });

  if (error) {
    console.error("[holidays] upsert error:", error.message);
    return NextResponse.json({ error: "休日の保存に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ success: true, added: uniqueDates.length }, { status: 201 });
}

