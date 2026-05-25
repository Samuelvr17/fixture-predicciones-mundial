-- Migration 003: Groups and group_members
-- Cada grupo es una quiniela privada con código de invitación único.

create table public.groups (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  invite_code         text not null,
  creator_id          uuid not null references public.profiles(id) on delete restrict,
  prediction_deadline timestamptz not null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint groups_name_length check (char_length(name) between 2 and 80),
  constraint groups_invite_code_key unique (invite_code),
  constraint groups_invite_code_length check (char_length(invite_code) between 6 and 12)
);

-- Índice para lookup por invite_code
create index idx_groups_invite_code on public.groups (invite_code);
create index idx_groups_creator_id  on public.groups (creator_id);

create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────

create type public.group_role as enum ('admin', 'member');

create table public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id)   on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.group_role not null default 'member',
  joined_at  timestamptz not null default now(),

  constraint group_members_unique unique (group_id, user_id)
);

-- Índices para queries frecuentes
create index idx_group_members_group_id on public.group_members (group_id);
create index idx_group_members_user_id  on public.group_members (user_id);
