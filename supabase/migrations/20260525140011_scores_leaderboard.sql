-- Migration 011: Score breakdowns and leaderboard cache
-- score_breakdowns almacena el desglose calculado por categoría por (group, user).
-- leaderboard_cache almacena el ranking final ordenado por total_points.
-- Ambas tablas se recalculan desde cero cada vez que el motor de scoring se ejecuta.

create table public.score_breakdowns (
  id                            uuid primary key default gen_random_uuid(),
  group_id                      uuid not null references public.groups(id)   on delete cascade,
  user_id                       uuid not null references public.profiles(id)  on delete cascade,

  -- Marcadores fase de grupos
  exact_scores_group_stage      int not null default 0,   -- puntos por marcadores exactos (5 pts c/u)
  correct_results_group_stage   int not null default 0,   -- puntos por resultado correcto sin exacto (2 pts c/u)

  -- Marcadores eliminatorias
  exact_scores_knockout         int not null default 0,   -- puntos por marcadores exactos (10 pts c/u)

  -- Avances de ronda
  advances_points               int not null default 0,   -- puntos acumulados de avances

  -- Predicciones especiales
  third_place_points            int not null default 0,   -- 80 si acierta tercer puesto
  champion_points               int not null default 0,   -- 150 si acierta campeón
  top_scorer_points             int not null default 0,   -- 60 si acierta goleador

  -- Total calculado
  total_points                  int not null default 0,

  last_calculated_at            timestamptz not null default now(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),

  constraint score_breakdowns_unique unique (group_id, user_id),
  -- Guardar integridad: ningún campo puede ser negativo
  constraint score_breakdowns_exact_group_non_neg    check (exact_scores_group_stage    >= 0),
  constraint score_breakdowns_correct_group_non_neg  check (correct_results_group_stage >= 0),
  constraint score_breakdowns_exact_knockout_non_neg check (exact_scores_knockout        >= 0),
  constraint score_breakdowns_advances_non_neg       check (advances_points              >= 0),
  constraint score_breakdowns_third_non_neg          check (third_place_points           >= 0),
  constraint score_breakdowns_champion_non_neg       check (champion_points              >= 0),
  constraint score_breakdowns_top_scorer_non_neg     check (top_scorer_points            >= 0),
  constraint score_breakdowns_total_non_neg          check (total_points                 >= 0)
);

-- Índices para leaderboard queries
create index idx_score_breakdowns_group_id    on public.score_breakdowns (group_id);
create index idx_score_breakdowns_group_total on public.score_breakdowns (group_id, total_points desc);

create trigger score_breakdowns_updated_at
  before update on public.score_breakdowns
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────

create table public.leaderboard_cache (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id)   on delete cascade,
  user_id      uuid not null references public.profiles(id)  on delete cascade,
  rank         int not null,
  total_points int not null default 0,
  updated_at   timestamptz not null default now(),

  constraint leaderboard_cache_unique unique (group_id, user_id),
  constraint leaderboard_cache_rank_positive check (rank > 0),
  constraint leaderboard_cache_points_non_neg check (total_points >= 0)
);

-- Índice para mostrar tabla de posiciones ordenada
create index idx_leaderboard_group_rank on public.leaderboard_cache (group_id, rank asc);

create trigger leaderboard_cache_updated_at
  before update on public.leaderboard_cache
  for each row execute function public.set_updated_at();
