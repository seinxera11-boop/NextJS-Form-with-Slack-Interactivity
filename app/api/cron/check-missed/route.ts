import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const now = new Date();

    if (now.getDay() === 6) {
      return NextResponse.json({ message: "Today is Saturday — holiday" });
    }

    const today = now.toISOString().split("T")[0];

    const { data: responses } = await supabaseAdmin
      .from("responses")
      .select("id")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    if (responses && responses.length > 0) {
      return NextResponse.json({ message: "Already submitted" });
    }

    // Fetch reminder URL from DB
    const { data: varData } = await supabaseAdmin
      .from("variables")
      .select("value")
      .eq("key", "reminder_url")
      .single();

    const reminderUrl = varData?.value || "";

    if (reminderUrl) {
      await fetch(reminderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "🚨 Today is a working day. Why haven't you filled the checklist?",
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}