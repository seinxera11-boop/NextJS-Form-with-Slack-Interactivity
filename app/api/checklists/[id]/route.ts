import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
     const id = Number((await params).id); // Convert string → number
     console.log((await params).id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid checklist id" }, { status: 400 });
  }
    const { data, error } = await supabaseAdmin
      .from("checklists")
      .select("*, checklist_items(*)")
      .eq("id", ( await params).id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { title, items } = await req.json();
    const id = Number((await params).id);

    // Update checklist title
    const { error: clError } = await supabaseAdmin
      .from("checklists")
      .update({ title })
      .eq("id", id);

    if (clError) return NextResponse.json({ error: clError.message }, { status: 500 });

    // Delete old items and re-insert (simplest approach for full replace)
    const { error: delError } = await supabaseAdmin
      .from("checklist_items")
      .delete()
      .eq("checklist_id", id);

    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    const itemsToInsert = items.map((item: any, index: number) => ({
      checklist_id: id,
      label: item.label,
      type: item.type || "checkbox",
      required: item.required !== false,
      order_index: item.order_index ?? index,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("checklist_items")
      .insert(itemsToInsert);

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // checklist_items are cascade deleted via FK
    const { error } = await supabaseAdmin
      .from("checklists")
      .delete()
      .eq("id", (await params).id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}