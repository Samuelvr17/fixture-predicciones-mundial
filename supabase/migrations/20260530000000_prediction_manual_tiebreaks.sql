-- Manual tiebreaks chosen by each user for their own predictions.
-- These are independent from global-admin official manual_tiebreaks.

create table public.prediction_manual_tiebreaks (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  type             public.tiebreak_type not null,
  -- For group_tiebreak: 'group_A', 'group_B', etc.
  -- Future use can support best_thirds with reference = 'best_thirds'.
  reference        text not null,
  ordered_team_ids uuid[] not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint prediction_manual_tiebreaks_reference_length check (char_length(reference) between 1 and 40),
  constraint prediction_manual_tiebreaks_unique unique (group_id, user_id, type, reference)
);

create index idx_prediction_manual_tiebreaks_group_user
  on public.prediction_manual_tiebreaks (group_id, user_id);

create index idx_prediction_manual_tiebreaks_type_ref
  on public.prediction_manual_tiebreaks (type, reference);

create trigger prediction_manual_tiebreaks_updated_at
  before update on public.prediction_manual_tiebreaks
  for each row execute function public.set_updated_at();

alter table public.prediction_manual_tiebreaks enable row level security;

-- Members can read each other's prediction tiebreaks in the same group,
-- just like saved score predictions.
create policy "prediction_manual_tiebreaks_select_member"
  on public.prediction_manual_tiebreaks for select
  using (public.is_group_member(group_id));

-- Users can create only their own tiebreaks while they are group members
-- and before the prediction deadline.
create policy "prediction_manual_tiebreaks_insert_owner_before_deadline"
  on public.prediction_manual_tiebreaks for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

-- Users can edit only their own tiebreaks while they are group members
-- and before the prediction deadline.
create policy "prediction_manual_tiebreaks_update_owner_before_deadline"
  on public.prediction_manual_tiebreaks for update
  using (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

-- Users can delete only their own tiebreaks while they are group members
-- and before the prediction deadline.
create policy "prediction_manual_tiebreaks_delete_owner_before_deadline"
  on public.prediction_manual_tiebreaks for delete
  using (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );
