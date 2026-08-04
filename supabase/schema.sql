create table if not exists jeong_state (
  user_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table jeong_state enable row level security;

-- 실제 배포 시 인증 방식에 맞는 RLS 정책을 추가하세요.
