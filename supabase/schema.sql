-- JEONG v2 · Phase 1 schema
-- Supabase will become the source of truth only after import + round-trip verification.
-- Google Calendar remains the schedule source of truth.

create extension if not exists pgcrypto;

create table if not exists public.jeong_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null,
  revision bigint not null default 1,
  state jsonb not null,
  state_hash text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.jeong_state_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null,
  revision bigint not null,
  reason text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists jeong_state_backups_user_created_idx
  on public.jeong_state_backups(user_id, created_at desc);

alter table public.jeong_state enable row level security;
alter table public.jeong_state_backups enable row level security;

drop policy if exists "jeong_state_select_own" on public.jeong_state;
create policy "jeong_state_select_own" on public.jeong_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jeong_state_insert_own" on public.jeong_state;
create policy "jeong_state_insert_own" on public.jeong_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "jeong_state_update_own" on public.jeong_state;
create policy "jeong_state_update_own" on public.jeong_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "jeong_state_delete_own" on public.jeong_state;
create policy "jeong_state_delete_own" on public.jeong_state for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jeong_state_backup_select_own" on public.jeong_state_backups;
create policy "jeong_state_backup_select_own" on public.jeong_state_backups for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jeong_state_backup_insert_own" on public.jeong_state_backups;
create policy "jeong_state_backup_insert_own" on public.jeong_state_backups for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Backup rows intentionally have no update/delete policy so rollback history cannot be mutated from the client.

-- JEONG state tables are not exposed to anonymous sessions, and signed-in
-- users receive only the object privileges the client actually needs. RLS then
-- narrows those privileges to rows owned by auth.uid().
revoke all on table public.jeong_state from anon;
revoke all on table public.jeong_state_backups from anon;
revoke all on table public.jeong_state from authenticated;
revoke all on table public.jeong_state_backups from authenticated;
grant select, insert, update, delete on table public.jeong_state to authenticated;
grant select, insert on table public.jeong_state_backups to authenticated;


-- Atomic compare-and-swap write. A second device cannot silently overwrite
-- a newer revision; the caller must reload/merge/retry.
create or replace function public.save_jeong_state(
  expected_revision bigint,
  new_schema_version integer,
  new_state jsonb,
  new_state_hash text default null
) returns public.jeong_state
language plpgsql security invoker
set search_path = public
as $$
declare current_row public.jeong_state;
begin
  select * into current_row from public.jeong_state where user_id = auth.uid() for update;

  if not found then
    if expected_revision <> 0 then raise exception 'JEONG_REVISION_CONFLICT'; end if;
    insert into public.jeong_state(user_id,schema_version,revision,state,state_hash)
    values(auth.uid(),new_schema_version,1,new_state,new_state_hash)
    returning * into current_row;
    return current_row;
  end if;

  if current_row.revision <> expected_revision then
    raise exception 'JEONG_REVISION_CONFLICT';
  end if;

  insert into public.jeong_state_backups(user_id,schema_version,revision,reason,state)
  values(current_row.user_id,current_row.schema_version,current_row.revision,'before_write',current_row.state);

  update public.jeong_state
  set schema_version=new_schema_version,
      revision=current_row.revision+1,
      state=new_state,
      state_hash=new_state_hash,
      updated_at=now()
  where user_id=auth.uid()
  returning * into current_row;

  return current_row;
end;
$$;

-- Only authenticated JEONG sessions may call the CAS write endpoint.
revoke execute on function public.save_jeong_state(bigint, integer, jsonb, text) from public, anon;
grant execute on function public.save_jeong_state(bigint, integer, jsonb, text) to authenticated;
