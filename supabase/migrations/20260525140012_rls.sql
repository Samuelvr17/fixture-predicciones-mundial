-- Migration 012: Row Level Security
-- Activa RLS en todas las tablas y define políticas de acceso.
-- Principio: el cliente nunca es fuente de verdad para puntos ni resultados.

-- ════════════════════════════════════════════════════════════
-- FUNCIONES HELPER (security definer para evitar recursión RLS)
-- ════════════════════════════════════════════════════════════

-- ¿El usuario autenticado es miembro de este grupo?
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id  = auth.uid()
  );
$$;

-- ¿El usuario autenticado es admin de este grupo?
create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id  = auth.uid()
      and role     = 'admin'
  );
$$;

-- ¿Estamos antes del deadline de predicciones de este grupo?
create or replace function public.is_before_deadline(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups
    where id                  = p_group_id
      and prediction_deadline > now()
  );
$$;

-- ¿El usuario es admin de AL MENOS UN grupo? (para resultados globales)
create or replace function public.is_any_group_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where user_id = auth.uid()
      and role    = 'admin'
  );
$$;


-- ════════════════════════════════════════════════════════════
-- TABLA: profiles
-- ════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;

-- Todo usuario autenticado ve su propio perfil
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

-- Miembros del mismo grupo pueden verse entre sí (para mostrar leaderboard)
create policy "profiles_select_group_peers"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.group_members gm1
      join public.group_members gm2
        on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid()
        and gm2.user_id = profiles.id
    )
  );

-- Solo el propio usuario puede actualizar su perfil
create policy "profiles_update_own"
  on public.profiles for update
  using  (id = auth.uid())
  with check (id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- TABLA: groups
-- ════════════════════════════════════════════════════════════
alter table public.groups enable row level security;

-- Solo ven grupos donde son miembros
create policy "groups_select_member"
  on public.groups for select
  using (public.is_group_member(id));

-- Cualquier usuario autenticado puede crear un grupo
create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.uid() is not null AND creator_id = auth.uid());

-- Solo el admin del grupo puede actualizar configuración del grupo
create policy "groups_update_admin"
  on public.groups for update
  using  (public.is_group_admin(id))
  with check (public.is_group_admin(id));


-- ════════════════════════════════════════════════════════════
-- TABLA: group_members
-- ════════════════════════════════════════════════════════════
alter table public.group_members enable row level security;

-- Ven miembros solo de grupos a los que pertenecen
create policy "group_members_select_peer"
  on public.group_members for select
  using (public.is_group_member(group_id));

-- Cualquier usuario autenticado puede unirse a un grupo (insertar su propia fila)
create policy "group_members_insert_self"
  on public.group_members for insert
  with check (
    user_id  = auth.uid()
    and role = 'member'    -- al unirse siempre entra como member, no como admin
  );

-- El admin del grupo puede cambiar roles de otros miembros
create policy "group_members_update_admin"
  on public.group_members for update
  using  (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- El admin del grupo puede eliminar miembros, o el usuario se elimina a sí mismo
create policy "group_members_delete"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or public.is_group_admin(group_id)
  );


-- ════════════════════════════════════════════════════════════
-- TABLA: teams  (datos públicos de lectura)
-- ════════════════════════════════════════════════════════════
alter table public.teams enable row level security;

create policy "teams_select_all"
  on public.teams for select
  using (auth.uid() is not null);
-- Writes solo vía service role (seed script), sin policy de INSERT/UPDATE para cliente.


-- ════════════════════════════════════════════════════════════
-- TABLA: matches  (datos públicos de lectura)
-- ════════════════════════════════════════════════════════════
alter table public.matches enable row level security;

create policy "matches_select_all"
  on public.matches for select
  using (auth.uid() is not null);
-- Writes solo vía service role (seed script).


-- ════════════════════════════════════════════════════════════
-- TABLA: match_results
-- Los resultados son globales (no por grupo). Cualquier admin de cualquier grupo
-- puede ingresar resultados. Todos los usuarios autenticados pueden leerlos.
-- ════════════════════════════════════════════════════════════
alter table public.match_results enable row level security;

create policy "match_results_select_authenticated"
  on public.match_results for select
  using (auth.uid() is not null);

create policy "match_results_insert_admin"
  on public.match_results for insert
  with check (
    public.is_any_group_admin()
    and entered_by = auth.uid()
  );

create policy "match_results_update_admin"
  on public.match_results for update
  using  (public.is_any_group_admin())
  with check (public.is_any_group_admin());


-- ════════════════════════════════════════════════════════════
-- TABLA: predictions_scores
-- ════════════════════════════════════════════════════════════
alter table public.predictions_scores enable row level security;

-- Todos los miembros del grupo pueden ver predicciones de sus compañeros
create policy "pred_scores_select_member"
  on public.predictions_scores for select
  using (public.is_group_member(group_id));

-- Solo el dueño puede insertar su propia predicción, antes del deadline
create policy "pred_scores_insert_owner_before_deadline"
  on public.predictions_scores for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

-- Solo el dueño puede actualizar su propia predicción, antes del deadline
create policy "pred_scores_update_owner_before_deadline"
  on public.predictions_scores for update
  using  (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id  = auth.uid()                       -- no puede cambiar el user_id
    and group_id = group_id                     -- no puede cambiar el grupo
    and public.is_before_deadline(group_id)
  );

-- Solo el dueño puede eliminar su propia predicción, antes del deadline
create policy "pred_scores_delete_owner_before_deadline"
  on public.predictions_scores for delete
  using (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  );


-- ════════════════════════════════════════════════════════════
-- TABLA: predictions_advances
-- ════════════════════════════════════════════════════════════
alter table public.predictions_advances enable row level security;

create policy "pred_advances_select_member"
  on public.predictions_advances for select
  using (public.is_group_member(group_id));

create policy "pred_advances_insert_owner_before_deadline"
  on public.predictions_advances for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

create policy "pred_advances_update_owner_before_deadline"
  on public.predictions_advances for update
  using  (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  );

create policy "pred_advances_delete_owner_before_deadline"
  on public.predictions_advances for delete
  using (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  );


-- ════════════════════════════════════════════════════════════
-- TABLA: predictions_specials
-- ════════════════════════════════════════════════════════════
alter table public.predictions_specials enable row level security;

create policy "pred_specials_select_member"
  on public.predictions_specials for select
  using (public.is_group_member(group_id));

create policy "pred_specials_insert_owner_before_deadline"
  on public.predictions_specials for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

create policy "pred_specials_update_owner_before_deadline"
  on public.predictions_specials for update
  using  (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  );

create policy "pred_specials_delete_owner_before_deadline"
  on public.predictions_specials for delete
  using (
    user_id = auth.uid()
    and public.is_before_deadline(group_id)
  );


-- ════════════════════════════════════════════════════════════
-- TABLA: manual_tiebreaks
-- Solo admins del grupo afectado pueden insertar/actualizar.
-- Miembros del grupo pueden leer el resultado del desempate.
-- Para best_thirds: cualquier admin de cualquier grupo.
-- ════════════════════════════════════════════════════════════
alter table public.manual_tiebreaks enable row level security;

-- Los miembros de al menos un grupo pueden ver desempates (son datos globales del torneo)
create policy "manual_tiebreaks_select_authenticated"
  on public.manual_tiebreaks for select
  using (auth.uid() is not null);

-- Solo un admin puede insertar un desempate
create policy "manual_tiebreaks_insert_admin"
  on public.manual_tiebreaks for insert
  with check (
    public.is_any_group_admin()
    and resolved_by = auth.uid()
  );

-- Solo un admin puede actualizar un desempate (para corregirlo)
create policy "manual_tiebreaks_update_admin"
  on public.manual_tiebreaks for update
  using  (public.is_any_group_admin())
  with check (public.is_any_group_admin());


-- ════════════════════════════════════════════════════════════
-- TABLA: tournament_results
-- Admin confirma campeón, tercer puesto y goleador oficial.
-- ════════════════════════════════════════════════════════════
alter table public.tournament_results enable row level security;

create policy "tournament_results_select_authenticated"
  on public.tournament_results for select
  using (auth.uid() is not null);

create policy "tournament_results_insert_admin"
  on public.tournament_results for insert
  with check (public.is_any_group_admin());

create policy "tournament_results_update_admin"
  on public.tournament_results for update
  using  (public.is_any_group_admin())
  with check (public.is_any_group_admin());


-- ════════════════════════════════════════════════════════════
-- TABLA: score_breakdowns
-- Solo lectura para miembros del grupo. Ningún cliente puede escribir.
-- Las escrituras se hacen exclusivamente desde el servidor con service_role.
-- ════════════════════════════════════════════════════════════
alter table public.score_breakdowns enable row level security;

create policy "score_breakdowns_select_member"
  on public.score_breakdowns for select
  using (public.is_group_member(group_id));

-- No hay políticas de INSERT / UPDATE / DELETE para el cliente.
-- El motor de scoring escribe con service_role (bypass RLS).


-- ════════════════════════════════════════════════════════════
-- TABLA: leaderboard_cache
-- Solo lectura para miembros del grupo. Las escrituras son solo servidor.
-- ════════════════════════════════════════════════════════════
alter table public.leaderboard_cache enable row level security;

create policy "leaderboard_select_member"
  on public.leaderboard_cache for select
  using (public.is_group_member(group_id));

-- No hay políticas de INSERT / UPDATE / DELETE para el cliente.
