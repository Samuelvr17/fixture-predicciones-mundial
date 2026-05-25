-- Migration 001: Extensions and helpers
-- Habilita extensiones necesarias y crea función de updated_at reutilizable.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- Función para actualizar updated_at automáticamente
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
