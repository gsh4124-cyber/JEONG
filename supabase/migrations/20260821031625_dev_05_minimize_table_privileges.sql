-- DEV 05 QA hardening: keep table privileges aligned with RLS and schema.sql.
-- This migration changes privileges only. It does not modify JEONG data rows.

revoke all privileges on table public.jeong_state from authenticated, anon;
revoke all privileges on table public.jeong_state_backups from authenticated, anon;

grant select, insert, update, delete on table public.jeong_state to authenticated;
grant select, insert on table public.jeong_state_backups to authenticated;
