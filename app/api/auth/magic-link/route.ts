import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_ADMINS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (ALLOWED_ADMINS.length > 0 && !ALLOWED_ADMINS.includes(email)) {
      return NextResponse.json({ error: "Unauthorized email" }, { status: 403 });
    }

    // emailRedirectTo MUST point to /admin/auth/callback so our page.tsx
    // can read the #access_token hash and call setSession() correctly.
    // Do NOT redirect to /admin directly — Next.js SSR cannot read hash fragments.
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_PUBLIC_SITE_URL}/admin/login/callback`,
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