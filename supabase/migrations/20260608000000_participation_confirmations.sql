create table public.participation_confirmations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  status text not null default 'confirmed',
  is_visible boolean not null default true,
  notes text null,
  confirmed_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participation_confirmations_display_name_length check (char_length(btrim(display_name)) between 1 and 80),
  constraint participation_confirmations_status_check check (status in ('confirmed', 'pending', 'cancelled')),
  constraint participation_confirmations_notes_length check (notes is null or char_length(notes) <= 500)
);

create index idx_participation_confirmations_visible_status_confirmed_at
  on public.participation_confirmations (is_visible, status, confirmed_at desc);

create trigger participation_confirmations_updated_at
  before update on public.participation_confirmations
  for each row execute function public.set_updated_at();

alter table public.participation_confirmations enable row level security;

create policy "participation_confirmations_select_visible_confirmed"
  on public.participation_confirmations for select
  to authenticated
  using (is_visible = true and status = 'confirmed');

create policy "participation_confirmations_select_global_admin"
  on public.participation_confirmations for select
  to authenticated
  using (public.is_global_admin());

create policy "participation_confirmations_insert_global_admin"
  on public.participation_confirmations for insert
  to authenticated
  with check (public.is_global_admin() and created_by = auth.uid());

create policy "participation_confirmations_update_global_admin"
  on public.participation_confirmations for update
  to authenticated
  using (public.is_global_admin())
  with check (public.is_global_admin());

create policy "participation_confirmations_delete_global_admin"
  on public.participation_confirmations for delete
  to authenticated
  using (public.is_global_admin());
