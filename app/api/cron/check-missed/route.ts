import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const now = new Date();

    // Check if today is Saturday
    const isSaturday = now.getDay() === 6;

    if (isSaturday) {
      return NextResponse.json({ message: "Today is Saturday — holiday" });
    }

    // 🗓️ Today date (ISO)
    const today = now.toISOString().split("T")[0];

    // Check if response already exists today
    const { data: responses } = await supabaseAdmin
      .from("responses")
      .select("id")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    if (responses && responses.length > 0) {
      return NextResponse.json({ message: "Already submitted" });
    }

    // Send Slack reminder if webhook exists
    const webhook3 = process.env.SLACK_WEBHOOK_URL_3;
    if (webhook3) {
      await fetch(webhook3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "🚨 Today is a working day. Why haven’t you filled the checklist?",
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}