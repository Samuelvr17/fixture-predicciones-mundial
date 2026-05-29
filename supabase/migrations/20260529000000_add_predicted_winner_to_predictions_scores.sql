-- Add knockout advancing-team prediction.
--
-- Score predictions store the 90-minute result. For knockout matches, a draw at
-- 90 minutes still needs a predicted team that advances, so the user's predicted
-- bracket can be derived from match predictions.

alter table public.predictions_scores
  add column if not exists predicted_winner_team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_pred_scores_predicted_winner
  on public.predictions_scores (predicted_winner_team_id);
