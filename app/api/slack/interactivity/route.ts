export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type");
    console.log("📦 Content-Type:", contentType);

    let payload: any;

    if (contentType?.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();

      const rawPayload = formData.get("payload");

      if (!rawPayload) {
        console.error("❌ No payload found in formData");
        return new Response("No payload", { status: 400 });
      }

      payload = JSON.parse(rawPayload as string);
    } else {
      // 👇 Only for manual testing (safe fallback)
      const text = await req.text();

      if (!text) {
        console.error("❌ Empty body received");
        return new Response("Empty body", { status: 400 });
      }

      payload = JSON.parse(text);
    }

    console.log("📩 Slack Payload:", payload);

    // =========================
    // BUTTON CLICK → OPEN MODAL
    // =========================
    if (payload.actions?.[0]?.action_id === "open_modal") {
      console.log("🔥 Button clicked");

      const res = await fetch("https://slack.com/api/views.open", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trigger_id: payload.trigger_id,
          view: {
            type: "modal",
            title: {
              type: "plain_text",
              text: "Reason",
            },
            submit: {
              type: "plain_text",
              text: "Submit",
            },
            blocks: [
              {
                type: "input",
                block_id: "reason_block",
                element: {
                  type: "plain_text_input",
                  action_id: "reason_input",
                  multiline: true,
                },
                label: {
                  type: "plain_text",
                  text: "Why not completed?",
                },
              },
            ],
          },
        }),
      });

      const data = await res.json();
      console.log("🟢 Slack response:", data);

      return new Response("OK");
    }

    // =========================
    // MODAL SUBMIT
    // =========================
    if (payload.type === "view_submission") {
      const reason =
        payload.view.state.values.reason_block.reason_input.value;

      console.log("🔥 Reason submitted:", reason);

      return Response.json({ response_action: "clear" });
    }

    return new Response("OK");
  } catch (err) {
    console.error("❌ ERROR:", err);
    return new Response("Error", { status: 500 });
  }
}