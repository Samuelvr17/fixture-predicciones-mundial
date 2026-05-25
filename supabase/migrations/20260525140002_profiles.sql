-- Migration 002: Profiles
-- Extiende auth.users de Supabase con datos públicos de perfil.

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_username_length check (char_length(username) between 2 and 32),
  constraint profiles_username_key unique (username)
);

-- Índice para búsqueda por username
create index idx_profiles_username on public.profiles (username);

-- Trigger updated_at
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-crear perfil cuando se registra un usuario nuevo en auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
