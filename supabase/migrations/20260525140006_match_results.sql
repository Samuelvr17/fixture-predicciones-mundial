-- Migration 006: Match results
-- Resultados reales ingresados por el admin.
-- El marcador siempre refleja los 90 minutos (no cuenta tiempo extra ni penales).
-- En eliminatorias, winner_team_id puede diferir del ganador de 90 min.

create table public.match_results (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches(id) on delete cascade,
  team1_score    smallint not null,
  team2_score    smallint not null,
  -- Solo aplica en eliminatorias: el equipo que avanza (puede ganar en ET o penales)
  winner_team_id uuid references public.teams(id) on delete set null,
  entered_by     uuid not null references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint match_results_match_id_key unique (match_id),
  constraint match_results_team1_score_non_negative check (team1_score >= 0),
  constraint match_results_team2_score_non_negative check (team2_score >= 0)
);

-- Índice para lookup por partido
create index idx_match_results_match_id     on public.match_results (match_id);
create index idx_match_results_winner_team  on public.match_results (winner_team_id);

create trigger match_results_updated_at
  before update on public.match_results
  for each row execute function public.set_updated_at();
