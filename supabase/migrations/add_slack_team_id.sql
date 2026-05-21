alter table workspaces
  add column if not exists slack_team_id text;
