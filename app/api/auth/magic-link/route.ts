import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_ADMINS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (ALLOWED_ADMINS.length > 0 && ALLOWED_ADMINS[0] !== "" && !ALLOWED_ADMINS.includes(email)) {
      return NextResponse.json({ error: "Unauthorized email" }, { status: 403 });
    }

    // Use signInWithOtp — this is what actually sends the magic link email
    // and correctly uses the redirectTo URL.
    // generateLink only generates the link object, it doesn't send the email.
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_PUBLIC_SITE_URL}/admin`,
      },
    });

    if (error) {
      console.error("Magic link error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}