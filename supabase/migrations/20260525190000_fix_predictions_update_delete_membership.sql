-- Migration: Fix UPDATE/DELETE policies to require current group membership
-- 
-- PROBLEMA:
-- Las políticas UPDATE y DELETE en predictions_scores, predictions_advances y predictions_specials
-- solo verificaban user_id = auth.uid() y is_before_deadline(), pero NO verificaban
-- is_group_member(group_id).
--
-- RIESGO:
-- Un usuario que fue removido de un grupo o que abandonó el grupo podría seguir editando
-- o eliminando sus predicciones antes del deadline, violando la intención de seguridad.
--
-- SOLUCIÓN:
-- Agregar is_group_member(group_id) a todas las políticas UPDATE y DELETE de predicciones,
-- igual como ya está en las políticas INSERT. Esto asegura que solo miembros ACTUALES
-- puedan modificar sus predicciones.
--
-- NOTA: También se eliminan condiciones inútiles como "group_id = group_id" en WITH CHECK.

-- ════════════════════════════════════════════════════════════
-- TABLA: predictions_scores
-- ════════════════════════════════════════════════════════════

-- Eliminar política UPDATE existente
drop policy if exists "pred_scores_update_owner_before_deadline" on public.predictions_scores;

-- Recrear política UPDATE con verificación de membresía
create policy "pred_scores_update_owner_before_deadline"
  on public.predictions_scores for update
  using  (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

-- Eliminar política DELETE existente
drop policy if exists "pred_scores_delete_owner_before_deadline" on public.predictions_scores;

-- Recrear política DELETE con verificación de membresía
create policy "pred_scores_delete_owner_before_deadline"
  on public.predictions_scores for delete
  using (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );


-- ════════════════════════════════════════════════════════════
-- TABLA: predictions_advances
-- ════════════════════════════════════════════════════════════

-- Eliminar política UPDATE existente
drop policy if exists "pred_advances_update_owner_before_deadline" on public.predictions_advances;

-- Recrear política UPDATE con verificación de membresía
create policy "pred_advances_update_owner_before_deadline"
  on public.predictions_advances for update
  using  (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

-- Eliminar política DELETE existente
drop policy if exists "pred_advances_delete_owner_before_deadline" on public.predictions_advances;

-- Recrear política DELETE con verificación de membresía
create policy "pred_advances_delete_owner_before_deadline"
  on public.predictions_advances for delete
  using (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );


-- ════════════════════════════════════════════════════════════
-- TABLA: predictions_specials
-- ════════════════════════════════════════════════════════════

-- Eliminar política UPDATE existente
drop policy if exists "pred_specials_update_owner_before_deadline" on public.predictions_specials;

-- Recrear política UPDATE con verificación de membresía
create policy "pred_specials_update_owner_before_deadline"
  on public.predictions_specials for update
  using  (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );

-- Eliminar política DELETE existente
drop policy if exists "pred_specials_delete_owner_before_deadline" on public.predictions_specials;

-- Recrear política DELETE con verificación de membresía
create policy "pred_specials_delete_owner_before_deadline"
  on public.predictions_specials for delete
  using (
    user_id = auth.uid()
    and public.is_group_member(group_id)
    and public.is_before_deadline(group_id)
  );
