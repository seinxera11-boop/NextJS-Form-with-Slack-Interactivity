import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserContext } from "@/lib/auth-helpers";

const KEYS = ["bot_token", "approval_url", "security_url", "reminder_url"] as const;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("variables")
    .select("key, value")
    .in("key", [...KEYS]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const ctx = await getUserContext(req);
  if (!ctx?.isMainAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const rows = KEYS
    .filter(k => k in body)
    .map(k => ({ key: k, value: body[k] ?? "" }));

  if (rows.length === 0)
    return NextResponse.json({ error: "No valid keys provided" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("variables")
    .upsert(rows, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}