-- Migration to add hidden_from_leaderboard columns to group_members
alter table public.group_members
add column if not exists hidden_from_leaderboard boolean not null default false,
add column if not exists hidden_from_leaderboard_at timestamptz null,
add column if not exists hidden_from_leaderboard_by uuid null references auth.users(id);

create index if not exists idx_group_members_hidden_leaderboard
on public.group_members(group_id, hidden_from_leaderboard);
