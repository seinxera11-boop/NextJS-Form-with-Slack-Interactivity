-- Base schema, reconstructed from how the application code uses each table.
-- The original DDL was not in the repo, so types, defaults and constraints
-- here are inferred, not copied. Verify against the old project if possible.
--
-- Must run before 20261007_teams_configs.sql, which alters workspaces and
-- references departments/checklists.
--
-- RLS is enabled on every table with no policies: the app only touches these
-- through the service-role client (lib/supabase-admin.ts), which bypasses RLS,
-- while the anon key is used for auth only. This keeps the tables closed to
-- anyone holding just the public anon key.

begin;

create table workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  slack_team_id text,
  created_at    timestamptz not null default now()
);

create table admin_users (
  id            bigint generated always as identity primary key,
  email         text not null unique,
  is_main_admin boolean not null default false,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table departments (
  id           bigint generated always as identity primary key,
  name         text not null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table org_users (
  id            bigint generated always as identity primary key,
  name          text not null,
  department_id bigint not null references departments(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table checklists (
  id                 bigint generated always as identity primary key,
  title              text not null,
  created_by         text,
  is_large_checklist boolean not null default false,
  department_id      bigint references departments(id) on delete set null,
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  created_at         timestamptz not null default now()
);

create table checklist_departments (
  checklist_id  bigint not null references checklists(id) on delete cascade,
  department_id bigint not null references departments(id) on delete cascade,
  primary key (checklist_id, department_id)
);

create table checklist_sections (
  id          bigint generated always as identity primary key,
  checklist_id bigint not null references checklists(id) on delete cascade,
  title       text not null,
  order_index integer not null default 0
);

create table checklist_items (
  id           bigint generated always as identity primary key,
  checklist_id bigint not null references checklists(id) on delete cascade,
  section_id   bigint not null references checklist_sections(id) on delete cascade,
  label        text not null,
  order_index  integer not null default 0,
  type         text not null default 'checkbox'
);

create table sub_admin_checklists (
  sub_admin_id bigint not null references admin_users(id) on delete cascade,
  checklist_id bigint not null references checklists(id) on delete cascade,
  primary key (sub_admin_id, checklist_id)
);

create table responses (
  id               bigint generated always as identity primary key,
  checklist_id     bigint not null references checklists(id) on delete cascade,
  submitted_by     text not null,
  reason           text,
  department_id    bigint references departments(id) on delete set null,
  department_name  text,
  user_id          bigint references org_users(id) on delete set null,
  other_user_name  text,
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index responses_workspace_created_idx on responses (workspace_id, created_at);

create table response_items (
  id                bigint generated always as identity primary key,
  response_id       bigint not null references responses(id) on delete cascade,
  checklist_item_id bigint not null references checklist_items(id) on delete cascade,
  value             text not null
);

-- unique(response_id) makes PostgREST embed this as a single object
-- (app/admin/types.ts: response_approvals: ResponseApproval | null) and backs
-- the "already processed" guard in the Slack interactivity route.
create table response_approvals (
  id          bigint generated always as identity primary key,
  response_id bigint not null unique references responses(id) on delete cascade,
  reason      text,
  approved_by text,
  approved_at timestamptz not null default now()
);

create table slack_configs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  bot_token    text,
  approval_url text,
  security_url text,
  reminder_url text,
  updated_at   timestamptz not null default now()
);

create table department_slack_configs (
  department_id bigint primary key references departments(id) on delete cascade,
  bot_token     text,
  slack_team_id text,
  approval_url  text,
  security_url  text,
  reminder_url  text
);

create table checklist_slack_configs (
  checklist_id  bigint primary key references checklists(id) on delete cascade,
  bot_token     text,
  slack_team_id text,
  approval_url  text,
  security_url  text,
  reminder_url  text
);

create table workspace_holidays (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  holiday_date date not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, holiday_date)
);

-- The daily cron claims a run by inserting here and treats a unique violation
-- as "already processed today", so this constraint is load-bearing.
create table reminder_runs (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  run_date     date not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, run_date)
);

alter table workspaces               enable row level security;
alter table admin_users              enable row level security;
alter table departments              enable row level security;
alter table org_users                enable row level security;
alter table checklists               enable row level security;
alter table checklist_departments    enable row level security;
alter table checklist_sections       enable row level security;
alter table checklist_items          enable row level security;
alter table sub_admin_checklists     enable row level security;
alter table responses                enable row level security;
alter table response_items           enable row level security;
alter table response_approvals       enable row level security;
alter table slack_configs            enable row level security;
alter table department_slack_configs enable row level security;
alter table checklist_slack_configs  enable row level security;
alter table workspace_holidays       enable row level security;
alter table reminder_runs            enable row level security;

commit;
