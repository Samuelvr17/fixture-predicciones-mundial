-- Migration 005: Matches
-- Todos los partidos del torneo: fase de grupos y eliminatorias.
-- En eliminatorias, team1_id/team2_id pueden ser NULL hasta que se resuelvan los slots.

create type public.match_round as enum (
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final'
);

create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  match_number   int,                      -- Número oficial del partido (nullable)
  round          public.match_round not null,
  group_code     char(1),                  -- Solo para ronda de grupos (A-L)
  team1_id       uuid references public.teams(id) on delete set null,
  team2_id       uuid references public.teams(id) on delete set null,
  team1_slot     text not null,            -- "1A", "2B", "W74", "3A/B/C/D/F", etc.
  team2_slot     text not null,
  match_date     date not null,
  match_time     time not null,
  venue          text not null,
  sort_order     int not null default 0,   -- Orden visual en calendario y bracket
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint matches_match_number_key unique (match_number),
  constraint matches_group_code_valid check (
    group_code is null or group_code ~ '^[A-L]$'
  ),
  constraint matches_group_has_code check (
    round <> 'group' or group_code is not null
  ),
  constraint matches_team1_slot_length check (char_length(team1_slot) between 1 and 20),
  constraint matches_team2_slot_length check (char_length(team2_slot) between 1 and 20)
);

-- Índices para consultas frecuentes
create index idx_matches_round       on public.matches (round);
create index idx_matches_group_code  on public.matches (group_code);
create index idx_matches_match_date  on public.matches (match_date);
create index idx_matches_sort_order  on public.matches (sort_order);
create index idx_matches_team1_id    on public.matches (team1_id);
create index idx_matches_team2_id    on public.matches (team2_id);

create trigger matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();
