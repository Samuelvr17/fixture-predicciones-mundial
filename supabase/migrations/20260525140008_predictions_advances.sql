-- Migration 008: Predictions - Advance predictions per team
-- El usuario predice hasta qué ronda llega cada selección.
-- Los puntos son ACUMULABLES según RULES.md:
--   round_of_32  = +20 pts
--   round_of_16  = +35 pts
--   quarter_final = +55 pts
--   semi_final    = +80 pts
--   final         = +110 pts
--   champion      = +150 pts

create type public.tournament_round as enum (
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
  'champion'
);

create table public.predictions_advances (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id)   on delete cascade,
  user_id          uuid not null references public.profiles(id)  on delete cascade,
  team_id          uuid not null references public.teams(id)     on delete cascade,
  predicted_round  public.tournament_round not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Un usuario tiene una única predicción de avance por selección en cada grupo
  constraint predictions_advances_unique unique (group_id, user_id, team_id)
);

-- Índices
create index idx_pred_advances_group_user on public.predictions_advances (group_id, user_id);
create index idx_pred_advances_team_id    on public.predictions_advances (team_id);

create trigger predictions_advances_updated_at
  before update on public.predictions_advances
  for each row execute function public.set_updated_at();
