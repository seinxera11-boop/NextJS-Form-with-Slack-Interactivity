import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("checklists")
      .select("*, checklist_items(*)")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, items, created_by } = await req.json();

    if (!title || !items || items.length === 0) {
      return NextResponse.json({ error: "Title and items are required" }, { status: 400 });
    }

    // Insert checklist
    const { data: checklist, error: clError } = await supabaseAdmin
      .from("checklists")
      .insert([{ title, created_by: created_by || "admin" }])
      .select()
      .single();

    if (clError) return NextResponse.json({ error: clError.message }, { status: 500 });

    // Insert items
    const itemsToInsert = items.map((item: any, index: number) => ({
      checklist_id: checklist.id,
      label: item.label,
      type: item.type || "checkbox",
      required: item.required !== false,
      order_index: item.order_index ?? index,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("checklist_items")
      .insert(itemsToInsert);

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

    return NextResponse.json({ success: true, id: checklist.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}