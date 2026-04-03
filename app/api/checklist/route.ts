import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Replace with your FE checklist items (full list)
const fullChecklist = [
  "Bathroom lights off",
  "Room 1 lights off",
  "Office main lights off",
  "All switches turned off",
  "AC/Fans turned off",
  "Laptop shut down",
  "Laptop stored in drawer",
  "Chargers unplugged",
  "Monitors turned off",
  "Printer/Scanner turned off",
  "All windows closed",
  "Curtains/blinds adjusted",
  "Balcony doors locked",
  "Tap water turned off",
  "No leakage present",
  "Lights turned off",
  "Exhaust fan off",
  "Main door locked",
  "Internal doors closed",
  "Drawer/locker locked",
  "Keys stored properly",
];

type ChecklistRequest = {
  data: Record<string, boolean>;
  completedItems: number;
  totalItems: number;
};

export async function POST(req: Request) {
  try {
    const body: ChecklistRequest = await req.json();
    const { data, completedItems, totalItems } = body;

    // ✅ Save only checked items in DB
    const checkedItems = Object.entries(data)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    const { error } = await supabase.from("office_checklists").insert([
      {
        data: checkedItems,
        completed_count: completedItems,
        total_count: totalItems,
      },
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ✅ Determine incomplete tasks by comparing full checklist
    const incompleteTasks = fullChecklist.filter((item) => !checkedItems.includes(item));

    // ✅ Send Slack message
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Office Checklist Submitted*\n\n*Progress:* ${completedItems}/${totalItems}` },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*✅ Completed:*\n${checkedItems.join("\n") || "None"}` },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*❌ Not Completed:*\n${incompleteTasks.join("\n") || "None"}` },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Add Reason" },
                style: "primary",
                action_id: "open_modal", // Slack interactivity
              },
            ],
          },
        ],
      }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}