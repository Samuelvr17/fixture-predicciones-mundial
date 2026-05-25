-- Migration 004: Teams
-- Selecciones nacionales del Mundial 2026 (48 equipos, 12 grupos A-L).

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        char(3) not null,          -- ISO / FIFA code: COL, BRA, ARG...
  group_code  char(1),                   -- Grupo A-L en fase de grupos
  flag_url    text,
  created_at  timestamptz not null default now(),

  constraint teams_code_key unique (code),
  constraint teams_name_key unique (name),
  constraint teams_group_code_valid check (group_code is null or group_code ~ '^[A-L]$')
);

-- Índices para resolución de slots del bracket
create index idx_teams_code       on public.teams (code);
create index idx_teams_group_code on public.teams (group_code);
