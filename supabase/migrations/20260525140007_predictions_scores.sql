-- Migration 007: Predictions - Score predictions per match
-- Cada usuario predice el marcador de 90 min para cada partido, dentro de su grupo.
-- Reglas de puntos (RULES.md):
--   Fase de grupos: exacto = 5pts, resultado correcto = 2pts, sin acierto = 0pts
--   Eliminatorias: exacto = 10pts

create table public.predictions_scores (
  id                   uuid primary key default gen_random_uuid(),
  group_id             uuid not null references public.groups(id)   on delete cascade,
  user_id              uuid not null references public.profiles(id)  on delete cascade,
  match_id             uuid not null references public.matches(id)   on delete cascade,
  predicted_team1_score smallint not null,
  predicted_team2_score smallint not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint predictions_scores_unique unique (group_id, user_id, match_id),
  constraint predictions_scores_team1_non_negative check (predicted_team1_score >= 0),
  constraint predictions_scores_team2_non_negative check (predicted_team2_score >= 0)
);

-- Índices para lookup por grupo/usuario/partido
create index idx_pred_scores_group_user   on public.predictions_scores (group_id, user_id);
create index idx_pred_scores_match_id     on public.predictions_scores (match_id);

create trigger predictions_scores_updated_at
  before update on public.predictions_scores
  for each row execute function public.set_updated_at();
