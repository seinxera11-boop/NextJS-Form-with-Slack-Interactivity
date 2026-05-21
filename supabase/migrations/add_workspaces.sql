-- ─── 1. Create workspaces table ───────────────────────────────────────────────
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ─── 2. Add workspace_id to admin_users ───────────────────────────────────────
alter table admin_users
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- ─── 3. Add workspace_id to departments ───────────────────────────────────────
alter table departments
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- ─── 4. Add workspace_id to org_users ─────────────────────────────────────────
alter table org_users
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- ─── 5. Add workspace_id to checklists ────────────────────────────────────────
alter table checklists
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- ─── 6. Add workspace_id to responses ─────────────────────────────────────────
alter table responses
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- ─── 7. Update variables table ────────────────────────────────────────────────
-- Add workspace_id column
alter table variables
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- Drop old unique constraint on key alone (may be named differently — check your schema)
-- alter table variables drop constraint if exists variables_key_key;

-- Add composite unique constraint
alter table variables
  drop constraint if exists variables_workspace_key_unique;

alter table variables
  add constraint variables_workspace_key_unique unique (workspace_id, key);

-- ─── 8. Indexes for performance ───────────────────────────────────────────────
create index if not exists idx_admin_users_workspace    on admin_users(workspace_id);
create index if not exists idx_departments_workspace    on departments(workspace_id);
create index if not exists idx_org_users_workspace      on org_users(workspace_id);
create index if not exists idx_checklists_workspace     on checklists(workspace_id);
create index if not exists idx_responses_workspace      on responses(workspace_id);
create index if not exists idx_variables_workspace      on variables(workspace_id);
