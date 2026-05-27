-- Migration: Fix profiles INSERT policy for user registration
--
-- PROBLEMA:
-- El trigger handle_new_user() intenta insertar en public.profiles cuando se registra
-- un nuevo usuario, pero RLS está habilitado y no hay política INSERT.
-- Esto causa el error "Database error saving new user" durante el signup.
--
-- SOLUCIÓN:
-- Agregar política INSERT que permite al trigger crear el perfil del usuario.
-- La política permite INSERT cuando el id del perfil coincide con auth.uid()
-- (el usuario que se está registrando).

-- Permitir INSERT en profiles para el propio usuario (usado por trigger de signup)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());
