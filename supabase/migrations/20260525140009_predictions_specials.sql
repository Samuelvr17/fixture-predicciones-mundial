-- Migration 009: Predictions - Special predictions
-- Campeón, tercer puesto y goleador oficial del torneo.
-- Una sola fila por (group_id, user_id) para evitar duplicados.
-- Puntos (RULES.md):
--   Campeón acertado     = 150 pts (además de los acumulados de avances)
--   Tercer puesto exacto = 80 pts
--   Goleador exacto      = 60 pts

create table public.predictions_specials (
  id                    uuid primary key default gen_random_uuid(),
  group_id              uuid not null references public.groups(id)   on delete cascade,
  user_id               uuid not null references public.profiles(id)  on delete cascade,
  champion_team_id      uuid references public.teams(id) on delete set null,
  third_place_team_id   uuid references public.teams(id) on delete set null,
  -- Nombre del jugador goleador (no es entidad propia, lo ingresa el usuario libremente)
  top_scorer_name       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint predictions_specials_unique unique (group_id, user_id),
  constraint predictions_specials_top_scorer_length check (
    top_scorer_name is null or char_length(top_scorer_name) between 2 and 100
  )
);

-- Índice
create index idx_pred_specials_group_user on public.predictions_specials (group_id, user_id);

create trigger predictions_specials_updated_at
  before update on public.predictions_specials
  for each row execute function public.set_updated_at();
