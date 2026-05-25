-- Migration 013: Unique constraint para partidos de grupos
-- Permite upsert idempotente en el script seed por (team1_slot, team2_slot, match_date).
-- Solo aplica a partidos de grupos (en eliminatoria ya existe unique en match_number).

alter table public.matches
  add constraint matches_group_unique
    unique (team1_slot, team2_slot, match_date);
