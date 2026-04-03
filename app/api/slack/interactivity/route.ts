export async function POST(req: Request) {
  try {
    
    const formData = await req.formData();
    const rawPayload = formData.get("payload");
    if (!rawPayload) return new Response("No payload", { status: 400 });

    const payload = JSON.parse(rawPayload as string);
    console.log("📩 Slack Payload:", payload);
    console.log("hi");

    if (payload.actions?.[0]?.action_id === "submit_reason") {
      // ✅ Get reason text
      const reason =
        payload.state?.values?.reason_block?.reason_input?.value || "No reason provided";

      console.log("🔥 Reason submitted:", reason);

      // ✅ Save to Supabase here
      // await supabase.from("office_checklists").update({ reason }).eq("id", payload.message.ts);

      return new Response(
        JSON.stringify({ response_action: "update", text: "✅ Reason submitted!" }),
        { status: 200 }
      );
    }

    return new Response("OK");
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
}