-- 카톡 과제 제출 공유 앱 데이터베이스
-- Supabase SQL Editor에서 이 파일 전체를 붙여넣고 Run을 눌러 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  date date not null,
  url text not null check (url ~* '^https?://'),
  note text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, date)
);

alter table public.members enable row level security;
alter table public.submissions enable row level security;

grant select on public.members, public.submissions to anon, authenticated;
grant insert on public.submissions to anon, authenticated;
grant insert, update, delete on public.members to authenticated;
grant update, delete on public.submissions to authenticated;

drop policy if exists "members are visible to everyone" on public.members;
create policy "members are visible to everyone"
  on public.members for select to anon, authenticated using (true);

drop policy if exists "submissions are visible to everyone" on public.submissions;
create policy "submissions are visible to everyone"
  on public.submissions for select to anon, authenticated using (true);

drop policy if exists "anyone can submit" on public.submissions;
create policy "anyone can submit"
  on public.submissions for insert to anon, authenticated with check (true);

drop policy if exists "admin can add members" on public.members;
create policy "admin can add members"
  on public.members for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'admin@ai-learning.local');

drop policy if exists "admin can edit members" on public.members;
create policy "admin can edit members"
  on public.members for update to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ai-learning.local')
  with check ((auth.jwt() ->> 'email') = 'admin@ai-learning.local');

drop policy if exists "admin can delete members" on public.members;
create policy "admin can delete members"
  on public.members for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ai-learning.local');

drop policy if exists "admin can edit submissions" on public.submissions;
create policy "admin can edit submissions"
  on public.submissions for update to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ai-learning.local')
  with check ((auth.jwt() ->> 'email') = 'admin@ai-learning.local');

drop policy if exists "admin can delete submissions" on public.submissions;
create policy "admin can delete submissions"
  on public.submissions for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ai-learning.local');

insert into public.members (name) values
  ('강보람'), ('김남희'), ('김보영'), ('김수경'), ('남수현'),
  ('민경'), ('박윤희'), ('백근혜'), ('서윤정'), ('신봉일'),
  ('안태욱'), ('양소희'), ('오동민'), ('오혜숙'), ('오희주'),
  ('이경훈'), ('이길례'), ('장소향'), ('정유진'), ('조영임'),
  ('주영순'), ('최진웅'), ('한재림'), ('홍민지'), ('황주애')
on conflict (name) do nothing;
