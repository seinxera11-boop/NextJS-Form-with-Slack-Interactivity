-- Microsoft Teams messaging configuration.
-- Step 2 of TEAMS_MIGRATION.md (§8).
--
-- Purely additive: the slack_* tables and columns are left untouched so both
-- integrations can run side by side and workspaces can be cut over one at a
-- time. Nothing here drops or rewrites existing data.
--
-- Mirrors the three-tier Slack config shape (checklist > department >
-- workspace) so lib/teams-helpers.ts can reuse the same fallback logic. The
-- stored value is a conversationId rather than a webhook URL, because Teams
-- has no per-channel webhook that supports interactive cards.
--
-- Note there is deliberately no bot_token column: one multi-tenant Entra app
-- registration authenticates to every tenant, so the per-tier token storage
-- (and the canWriteToken clobbering logic it required) goes away entirely.
-- See TEAMS_MIGRATION.md §4.

begin;

-- Tenant anchor, alongside the existing slack_team_id.
alter table workspaces
  add column if not exists teams_tenant_id text;

create index if not exists workspaces_teams_tenant_id_idx
  on workspaces (teams_tenant_id)
  where teams_tenant_id is not null;

-- Workspace-level default.
--
-- workspaces.id's type is not visible from the application code (ids are
-- DB-generated and never constructed in TypeScript), so rather than guessing
-- uuid vs bigint these tables are created with the type copied from the live
-- column. `like ... including all` would also copy the primary key and
-- defaults, so the column is declared explicitly via a lookup instead.
do $$
declare
  ws_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into strict ws_type
    from pg_attribute a
   where a.attrelid = 'workspaces'::regclass
     and a.attname  = 'id'
     and a.attnum   > 0
     and not a.attisdropped;

  execute format($f$
    create table if not exists teams_configs (
      workspace_id             %s primary key references workspaces(id) on delete cascade,
      approval_conversation_id text,
      security_conversation_id text,
      reminder_conversation_id text,
      created_at               timestamptz not null default now(),
      updated_at               timestamptz not null default now()
    )$f$, ws_type);

  -- Conversations discovered from install.add activities.
  --
  -- Teams has no "paste a webhook URL" step: a channel only becomes
  -- addressable once the app is installed there and we capture the
  -- conversationId. This is the pool the admin UI assigns to
  -- approval/security/reminder roles, and it is why the admin flow inverts
  -- relative to Slack (§9).
  execute format($f$
    create table if not exists teams_installations (
      id                 bigserial primary key,
      conversation_id    text not null unique,
      tenant_id          text not null,
      workspace_id       %s references workspaces(id) on delete set null,
      conversation_type  text,
      display_name       text,
      installed_at       timestamptz not null default now(),
      removed_at         timestamptz
    )$f$, ws_type);
end $$;

-- departments.id / checklists.id surface as `number` in TypeScript, which does
-- not distinguish int from bigint. Declaring these bigint is safe either way:
-- Postgres permits a bigint foreign key against an int primary key, both being
-- integer types. (uuid vs bigint would not be, hence the lookup above.)
create table if not exists department_teams_configs (
  department_id            bigint primary key references departments(id) on delete cascade,
  approval_conversation_id text,
  security_conversation_id text,
  reminder_conversation_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists checklist_teams_configs (
  checklist_id             bigint primary key references checklists(id) on delete cascade,
  approval_conversation_id text,
  security_conversation_id text,
  reminder_conversation_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists teams_installations_tenant_idx
  on teams_installations (tenant_id);

create index if not exists teams_installations_workspace_idx
  on teams_installations (workspace_id)
  where workspace_id is not null;

-- Lets a workspace be cut over independently; existing rows keep using Slack.
alter table workspaces
  add column if not exists messaging_provider text not null default 'slack';

alter table workspaces
  drop constraint if exists workspaces_messaging_provider_check;

alter table workspaces
  add constraint workspaces_messaging_provider_check
  check (messaging_provider in ('slack', 'teams'));

commit;
