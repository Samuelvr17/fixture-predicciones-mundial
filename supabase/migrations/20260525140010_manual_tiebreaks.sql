-- Migration 010: Manual tiebreaks
-- Cuando el motor automático no puede resolver un empate, el admin lo hace manualmente.
-- Aplica para:
--   - Empates dentro de un grupo (tipo 'group_tiebreak', reference = 'A'..'L')
--   - Empates entre mejores terceros (tipo 'best_thirds', reference = 'best_thirds')
-- ordered_team_ids almacena el orden final decidido por el admin.

create type public.tiebreak_type as enum ('group_tiebreak', 'best_thirds');

create table public.manual_tiebreaks (
  id               uuid primary key default gen_random_uuid(),
  type             public.tiebreak_type not null,
  -- Para group_tiebreak: letra del grupo ('A'..'L')
  -- Para best_thirds:    'best_thirds'
  reference        text not null,
  -- Array de UUIDs de equipos en el orden definitivo elegido por el admin
  ordered_team_ids uuid[] not null,
  resolved_by      uuid not null references public.profiles(id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint manual_tiebreaks_reference_length check (char_length(reference) between 1 and 20),
  -- Solo puede haber un desempate activo por tipo + referencia
  constraint manual_tiebreaks_type_reference_key unique (type, reference)
);

create index idx_manual_tiebreaks_type_ref on public.manual_tiebreaks (type, reference);

create trigger manual_tiebreaks_updated_at
  before update on public.manual_tiebreaks
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Tabla auxiliar para el resultado oficial del torneo
-- El admin confirma campeón, tercer puesto y goleador oficial aquí.
-- Hay exactamente una fila (singleton). Se usa upsert con id = '00000000-...'
-- ────────────────────────────────────────────────────────────
create table public.tournament_results (
  id                   uuid primary key default gen_random_uuid(),
  champion_team_id     uuid references public.teams(id) on delete set null,
  third_place_team_id  uuid references public.teams(id) on delete set null,
  top_scorer_name      text,
  confirmed_by         uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint tournament_results_top_scorer_length check (
    top_scorer_name is null or char_length(top_scorer_name) between 2 and 100
  )
);

create trigger tournament_results_updated_at
  before update on public.tournament_results
  for each row execute function public.set_updated_at();
