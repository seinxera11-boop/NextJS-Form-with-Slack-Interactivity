import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { isValidEmail } from "@/lib/utils";

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
  if (!isValidEmail(adminEmail)) return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });

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

  // Check admin email uniqueness (email is unique across all workspaces)
  const { data: existingAdmin } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingAdmin) {
    return NextResponse.json(
      { error: "このメールアドレスは既に他の管理者として登録されています。" },
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
    if (adminErr.code === "23505") {
      return NextResponse.json({ error: "このメールアドレスは既に他の管理者として登録されています。" }, { status: 409 });
    }
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

  const { id, slack_team_id, name, adminEmail } = await req.json();
  if (!id) return NextResponse.json({ error: "ワークスペースIDは必須です" }, { status: 400 });

  // Update workspace name if provided
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "ワークスペース名は必須です" }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({ name: name.trim() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update main admin's email if provided
  if (adminEmail !== undefined) {
    if (!adminEmail.trim()) return NextResponse.json({ error: "管理者メールアドレスは必須です" }, { status: 400 });
    if (!isValidEmail(adminEmail)) return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
    const email = adminEmail.trim().toLowerCase();

    const { data: existingAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", email)
      .neq("workspace_id", id)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: "このメールアドレスは既に他の管理者として登録されています。" },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ email })
      .eq("workspace_id", id)
      .eq("is_main_admin", true);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "このメールアドレスは既に他の管理者として登録されています。" }, { status: 409 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update slack_team_id if provided (existing behavior)
  if (slack_team_id !== undefined) {
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({ slack_team_id: slack_team_id?.trim() || null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


async function deleteWhere(table: string, column: string, value: string | number | (string | number)[]) {
  const query = supabaseAdmin.from(table).delete();
  const { error } = Array.isArray(value) ? await query.in(column, value) : await query.eq(column, value);
  if (error) throw new Error(`${table}の削除に失敗しました: ${error.message}`);
}

export async function DELETE(req: NextRequest) {
  if (!(await isSuperAdmin(req)))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ワークスペースIDは必須です" }, { status: 400 });

  try {
    const [{ data: checklists }, { data: responses }, { data: departments }, { data: adminUsers }] = await Promise.all([
      supabaseAdmin.from("checklists").select("id").eq("workspace_id", id),
      supabaseAdmin.from("responses").select("id").eq("workspace_id", id),
      supabaseAdmin.from("departments").select("id").eq("workspace_id", id),
      supabaseAdmin.from("admin_users").select("id").eq("workspace_id", id),
    ]);

    const checklistIds  = (checklists ?? []).map(c => c.id);
    const responseIds   = (responses ?? []).map(r => r.id);
    const departmentIds = (departments ?? []).map(d => d.id);
    const adminUserIds  = (adminUsers ?? []).map(a => a.id);

    const { data: sections } = checklistIds.length
      ? await supabaseAdmin.from("checklist_sections").select("id").in("checklist_id", checklistIds)
      : { data: [] as { id: number }[] };
    const sectionIds = (sections ?? []).map(s => s.id);

    // Deepest children first, so nothing is left referencing a row we're
    // about to delete further up the chain (this is what "workspaces" itself
    // was blocked on — reminder_runs.workspace_id has no ON DELETE CASCADE,
    // and other tables below aren't guaranteed to either).
    if (responseIds.length) {
      await deleteWhere("response_approvals", "response_id", responseIds);
      await deleteWhere("response_items", "response_id", responseIds);
    }
    await deleteWhere("responses", "workspace_id", id);

    if (checklistIds.length) {
      await deleteWhere("sub_admin_checklists", "checklist_id", checklistIds);
      await deleteWhere("checklist_departments", "checklist_id", checklistIds);
    }
    if (sectionIds.length) await deleteWhere("checklist_items", "section_id", sectionIds);
    if (checklistIds.length) await deleteWhere("checklist_sections", "checklist_id", checklistIds);
    // checklist_slack_configs cascades automatically via ON DELETE CASCADE on checklist_id.
    await deleteWhere("checklists", "workspace_id", id);

    if (departmentIds.length) await deleteWhere("department_slack_configs", "department_id", departmentIds);
    await deleteWhere("org_users", "workspace_id", id);
    await deleteWhere("departments", "workspace_id", id);

    await deleteWhere("slack_configs", "workspace_id", id);
    await deleteWhere("reminder_runs", "workspace_id", id);
    await deleteWhere("workspace_holidays", "workspace_id", id);

    if (adminUserIds.length) await deleteWhere("sub_admin_checklists", "sub_admin_id", adminUserIds);
    await deleteWhere("admin_users", "workspace_id", id);

    const { error } = await supabaseAdmin.from("workspaces").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "削除に失敗しました" }, { status: 500 });
  }
}
