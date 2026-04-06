// import { NextResponse } from "next/server";
// import { supabaseAdmin } from "@/lib/supabase-admin";

// // Full list of checklist items
// const fullChecklist = [
//   "Bathroom lights off",
//   "Room 1 lights off",
//   "Office main lights off",
//   "All switches turned off",
//   "AC/Fans turned off",
//   "Laptop shut down",
//   "Laptop stored in drawer",
//   "Chargers unplugged",
//   "Monitors turned off",
//   "Printer/Scanner turned off",
//   "All windows closed",
//   "Curtains/blinds adjusted",
//   "Balcony doors locked",
//   "Tap water turned off",
//   "No leakage present",
//   "Lights turned off",
//   "Exhaust fan off",
//   "Main door locked",
//   "Internal doors closed",
//   "Drawer/locker locked",
//   "Keys stored properly",
// ];

// type ChecklistRequest = {
//   data: Record<string, boolean>; // all tasks with true/false
//   completedItems: number;
//   totalItems: number;
// };

// export const runtime = "nodejs"; // ensure Node runtime for backend libs

// export async function POST(req: Request) {
//   try {
//     const body: ChecklistRequest = await req.json();
//     const { data, completedItems, totalItems } = body;

//     // ✅ Save all tasks to DB using supabaseAdmin (service role key)
//     const { error: dbError } = await supabaseAdmin.from("office_checklists").insert([
//       {
//         data, // includes both completed (true) and incomplete (false)
//         completed_count: completedItems,
//         total_count: totalItems,
//       },
//     ]);

//     if (dbError) {
//       console.error("❌ SUPABASE ERROR:", dbError);
//       return NextResponse.json({ error: dbError.message }, { status: 500 });
//     }

//     // ✅ Separate completed & incomplete tasks
//     const completedTasks = Object.entries(data)
//       .filter(([_, value]) => value)
//       .map(([key]) => key);

//     const incompleteTasks = Object.entries(data)
//       .filter(([_, value]) => !value)
//       .map(([key]) => key);

//     // ✅ Send Slack message with direct reason input
//     await fetch(process.env.SLACK_WEBHOOK_URL!, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         blocks: [
//           {
//             type: "section",
//             text: {
//               type: "mrkdwn",
//               text: `*Office Checklist Submitted*\n\n*Progress:* ${completedItems}/${totalItems}`,
//             },
//           },
//           {
//             type: "section",
//             text: {
//               type: "mrkdwn",
//               text: `*✅ Completed:*\n${completedTasks.join("\n") || "None"}`,
//             },
//           },
//           {
//             type: "section",
//             text: {
//               type: "mrkdwn",
//               text: `*❌ Not Completed:*\n${incompleteTasks.join("\n") || "None"}`,
//             },
//           },
//           {
//             type: "input",
//             block_id: "reason_block",
//             element: {
//               type: "plain_text_input",
//               action_id: "reason_input",
//               multiline: false,
//               placeholder: { type: "plain_text", text: "Enter reason for incomplete tasks" },
//             },
//             label: { type: "plain_text", text: "Reason for incomplete tasks" },
//           },
//           {
//             type: "actions",
//             elements: [
//               {
//                 type: "button",
//                 text: { type: "plain_text", text: "Submit" },
//                 style: "primary",
//                 action_id: "submit_reason",
//               },
//             ],
//           },
//         ],
//       }),
//     });

//     return NextResponse.json({ success: true });
//   } catch (err) {
//     console.error("❌ ERROR:", err);
//     return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
//   }
// }