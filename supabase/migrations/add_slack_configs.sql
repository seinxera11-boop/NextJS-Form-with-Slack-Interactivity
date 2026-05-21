create table if not exists slack_configs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid unique not null references workspaces(id) on delete cascade,
  bot_token    text,
  approval_url text,
  security_url text,
  reminder_url text,
  updated_at   timestamptz default now()
);

create index if not exists idx_slack_configs_workspace on slack_configs(workspace_id);
