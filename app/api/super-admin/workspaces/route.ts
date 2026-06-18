import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/auth-helpers";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(req: NextRequest) {
  if (!(await isSuperAdmin(req)))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("*, admin_users(email, is_main_admin)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin(req)))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { name, adminEmail } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "ワークスペース名は必須です" }, { status: 400 });
  if (!adminEmail?.trim()) return NextResponse.json({ error: "管理者メールアドレスは必須です" }, { status: 400 });

  const slug = slugify(name.trim());
  const email = adminEmail.trim().toLowerCase();

  // Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `スラッグ「${slug}」は既に使用されています。別の名前をお試しください。` },
      { status: 409 }
    );
  }

  // Create workspace
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .insert({ name: name.trim(), slug })
    .select()
    .single();

  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });

  // Create main admin user
  const { error: adminErr } = await supabaseAdmin
    .from("admin_users")
    .insert({ email, is_main_admin: true, workspace_id: workspace.id });

  if (adminErr) {
    // Rollback workspace
    await supabaseAdmin.from("workspaces").delete().eq("id", workspace.id);
    return NextResponse.json({ error: adminErr.message }, { status: 500 });
  }

  // Send magic link invite
  const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_PUBLIC_SITE_URL}/admin/login/callback`,
    },
  });

  if (linkErr) {
    // Workspace + admin created successfully, but email failed — not fatal
    console.error("Magic link send error:", linkErr.message);
    return NextResponse.json(
      { ok: true, workspace, warning: "ワークスペースは作成されましたが、招待メールの送信に失敗しました: " + linkErr.message },
      { status: 201 }
    );
  }

  return NextResponse.json({ ok: true, workspace }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await isSuperAdmin(req)))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id, slack_team_id } = await req.json();
  if (!id) return NextResponse.json({ error: "ワークスペースIDは必須です" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("workspaces")
    .update({ slack_team_id: slack_team_id?.trim() || null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isSuperAdmin(req)))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ワークスペースIDは必須です" }, { status: 400 });

  const { error } = await supabaseAdmin.from("workspaces").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
