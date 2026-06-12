import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSuperAdminEmails } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });

    const normalized = email.trim().toLowerCase();

    // Allow super admins
    const superAdminEmails = getSuperAdminEmails();
    if (superAdminEmails.includes(normalized)) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${process.env.NEXT_PUBLIC_PUBLIC_SITE_URL}/admin/login/callback`,
        },
      });
      if (error) {
        const isRateLimit = error.message.toLowerCase().includes("rate limit") || error.status === 429;
        return NextResponse.json(
          { error: isRateLimit ? "送信上限に達しました。しばらく待ってから再試行してください。" : error.message },
          { status: isRateLimit ? 429 : 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // Allow any email registered in admin_users (any workspace)
    const { data: adminUser } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", normalized)
      .not("workspace_id", "is", null)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: "登録されていないメールアドレスです" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_PUBLIC_SITE_URL}/admin/login/callback`,
      },
    });

    if (error) {
      const isRateLimit = error.message.toLowerCase().includes("rate limit") || error.status === 429;
      return NextResponse.json(
        { error: isRateLimit ? "送信上限に達しました。しばらく待ってから再試行してください。" : error.message },
        { status: isRateLimit ? 429 : 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
