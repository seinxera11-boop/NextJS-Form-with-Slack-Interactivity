"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isValidEmail } from "@/lib/utils";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  admin_users: { email: string; is_main_admin: boolean }[];
};

export default function SuperAdminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading]       = useState(true);
  const [forbidden, setForbidden]   = useState(false);
  const [booting, setBooting]       = useState(true);

  // Form state
  const [name, setName]           = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState("");

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/admin/login"; return; }
      setBooting(false);
      fetchWorkspaces();
    });
  }, []);

  const fetchWorkspaces = async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/workspaces");
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const data = await res.json();
    setWorkspaces(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !adminEmail.trim()) return;
    if (!isValidEmail(adminEmail)) { setCreateError("メールアドレスの形式が正しくありません"); return; }
    setCreating(true); setCreateError("");
    try {
      const res = await fetch("/api/super-admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), adminEmail: adminEmail.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "ワークスペースの作成に失敗しました");
      setName(""); setAdminEmail("");
      await fetchWorkspaces();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    if (!confirm(`ワークスペース「${ws.name}」を削除しますか？\n部署・チェックリスト・回答など、すべてのデータが削除されます。この操作は元に戻せません。`)) return;
    setDeleting(ws.id);
    try {
      const res = await fetch("/api/super-admin/workspaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ws.id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await fetchWorkspaces();
    } catch (err: any) {
      alert("削除に失敗しました: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (ws: Workspace) => {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditEmail(ws.admin_users?.find(u => u.is_main_admin)?.email ?? "");
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editEmail.trim()) return;
    if (!isValidEmail(editEmail)) { alert("メールアドレスの形式が正しくありません"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), adminEmail: editEmail.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setEditingId(null);
      await fetchWorkspaces();
    } catch (err: any) {
      alert("更新に失敗しました: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  if (booting) return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,#f5f0fe_0%,#ebe4fc_100%)] text-[#8c70e8]">
      読み込み中…
    </div>
  );

  if (forbidden) return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,#f5f0fe_0%,#ebe4fc_100%)]">
      <div className="text-center">
        <div className="text-4xl mb-4">⛔</div>
        <div className="text-xl font-bold text-[#1a1035] mb-2">アクセス拒否</div>
        <div className="text-sm text-[#7a6aaa]">スーパー管理者ではありません。</div>
        <button onClick={() => window.location.href = "/admin"} className="mt-6 text-sm text-[#4f35be] underline">
          管理者ポータルへ
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f0fe_0%,#ede8fc_100%)] font-['Inter',system-ui,sans-serif] text-[#1a1035]">
      {/* Nav */}
      <nav className="h-17.5 border-b-[1.5px] border-[#dfd5fb] flex items-center justify-between px-10 sticky top-0 bg-[rgba(250,247,255,0.96)] backdrop-blur-md z-50 shadow-[0_1px_20px_rgba(79,53,190,0.11)]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[linear-gradient(135deg,#6d28d9_0%,#a78bfa_100%)]" />
          <span className="font-extrabold text-xl text-[#4f35be] tracking-[-0.03em]">スーパー管理者</span>
          <span className="text-xs font-semibold bg-[linear-gradient(135deg,#fde68a_0%,#fbbf24_100%)] text-[#78350f] px-2.5 py-1 rounded-full border border-[#fbbf24]">プラットフォーム</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-[#6a5d8e] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1.5 px-4 cursor-pointer font-[inherit]"
        >
          ログアウト
        </button>
      </nav>

      <div className="max-w-3xl mx-auto py-14 px-6">
        <div className="text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#1a1035] mb-1">ワークスペース</div>
        <div className="text-sm text-[#6a5d8e] mb-10">クライアントのワークスペースを作成・管理します。各ワークスペースは完全に独立しています。</div>

        {/* Create workspace card */}
        <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl p-8 mb-8 bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)]">
          <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em] mb-6">新規ワークスペース</div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#6a5d8e] uppercase tracking-wider mb-2">ワークスペース名</label>
            <input
              className="w-full border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-3.5 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit] focus:border-[#6d28d9] focus:shadow-[0_0_0_3px_rgba(109,40,217,0.12)] transition-all"
              placeholder="例）株式会社サンプル"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-[#6a5d8e] uppercase tracking-wider mb-2">管理者メールアドレス</label>
            <input
              className="w-full border-[1.5px] border-[#ccc0fa] rounded-[10px] py-2.5 px-3.5 text-sm text-[#1a1035] outline-none bg-[#faf9ff] font-[inherit] focus:border-[#6d28d9] focus:shadow-[0_0_0_3px_rgba(109,40,217,0.12)] transition-all"
              type="email"
              placeholder="admin@example.com"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <div className="text-xs text-[#9688c0] mt-1.5">このメールアドレスにマジックリンクが送信され、ワークスペースのメイン管理者になります。</div>
          </div>

          {name.trim() && (
            <div className="text-xs text-[#7a6aaa] mb-4">
              スラッグ: <span className="font-mono text-[#4f35be]">/{name.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-")}</span>
            </div>
          )}

          {createError && <div className="text-xs text-[#dc2626] mb-4 font-medium">⚠ {createError}</div>}

          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !adminEmail.trim()}
            className="text-sm font-semibold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#4f35be_100%)] border-none rounded-[10px] py-2.5 px-6 cursor-pointer font-[inherit] shadow-[0_2px_10px_rgba(109,40,217,0.28)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "作成中…" : "ワークスペースを作成"}
          </button>
        </div>

        {/* Workspace list */}
        <div className="border-[1.5px] border-[#dfd5fb] rounded-2xl bg-white shadow-[0_2px_18px_rgba(79,53,190,0.10)] overflow-hidden">
          <div className="px-8 py-5 border-b border-[#ede9fe]">
            <div className="text-xs font-bold text-[#3e249e] uppercase tracking-[0.12em]">
              すべてのワークスペース（{workspaces.length}件）
            </div>
          </div>

          {loading ? (
            <div className="py-14 text-center text-sm text-[#c4b5fd]">読み込み中…</div>
          ) : workspaces.length === 0 ? (
            <div className="py-14 text-center text-sm text-[#a696f2]">ワークスペースがまだありません。上から作成してください。</div>
          ) : (
            workspaces.map((ws, i) => {
              const mainAdmin = ws.admin_users?.find(u => u.is_main_admin);
              const isEditing = editingId === ws.id;
              return (
                <div key={ws.id} className={`px-8 py-5 gap-4 ${i > 0 ? "border-t border-[#ede9fe]" : ""}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 mb-2 max-w-sm">
                          <input
                            className="w-full border-[1.5px] border-[#ccc0fa] rounded-lg py-1.5 px-3 text-sm outline-none bg-[#faf9ff] font-[inherit] text-[#1a1035] focus:border-[#6d28d9]"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="ワークスペース名"
                          />
                          <input
                            className="w-full border-[1.5px] border-[#ccc0fa] rounded-lg py-1.5 px-3 text-sm outline-none bg-[#faf9ff] font-[inherit] text-[#1a1035] focus:border-[#6d28d9]"
                            type="email"
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            placeholder="管理者メールアドレス"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="font-semibold text-[#1a1035] text-sm">{ws.name}</span>
                            <span className="text-xs font-mono text-[#7a6aaa] bg-[#f5f0ff] px-2 py-0.5 rounded-md border border-[#ede9fe]">
                              /{ws.slug}
                            </span>
                          </div>
                          <div className="text-xs text-[#9688c0]">
                            管理者: {mainAdmin?.email ?? "—"}
                          </div>
                          <div className="text-xs text-[#c4b5fd] mt-0.5">
                            作成日: {new Date(ws.created_at).toLocaleDateString("ja-JP")}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(ws.id)}
                            disabled={saving || !editName.trim() || !editEmail.trim()}
                            className="text-xs font-semibold text-white bg-[#6d28d9] border-none rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? "保存中…" : "保存"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="text-xs text-[#6a5d8e] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit] disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(ws)}
                            className="text-xs text-[#4f35be] bg-[#ede9fe] border border-[#ccc0fa] rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit]"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(ws)}
                            disabled={deleting === ws.id}
                            className="text-xs text-[#dc2626] bg-[#fff5f5] border-[1.5px] border-[#fecaca] rounded-lg py-1.5 px-3.5 cursor-pointer font-[inherit] disabled:opacity-50"
                          >
                            {deleting === ws.id ? "削除中…" : "削除"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
