-- Core schema for LoveCoin
--
-- Creates the foundational tables: profiles, lovecoins, lovenotes, reactions.
-- Mirrors drizzle/migrations/0000_lovecoin_core_schema.sql so that Supabase's
-- migration runner has all base tables before 0001, 0002, and 0003 run.
--
-- Idempotent: safe to run against a database that already has these objects.
-- Tables use CREATE TABLE IF NOT EXISTS. Policies are guarded with DO blocks
-- that check pg_policies before creating, since CREATE POLICY IF NOT EXISTS
-- requires Postgres 17+ and Supabase runs Postgres 15.

-- =============================================================================
-- Profiles
-- =============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text        not null default 'Someone',
  created_at   timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all                     on public.profiles to service_role;

alter table public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'own profile read'
  ) then
    create policy "own profile read"
      on public.profiles for select to authenticated
      using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'own profile insert'
  ) then
    create policy "own profile insert"
      on public.profiles for insert to authenticated
      with check (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'own profile update'
  ) then
    create policy "own profile update"
      on public.profiles for update to authenticated
      using  (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $func$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1),
      'Someone'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$func$;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- =============================================================================
-- LoveCoins
-- =============================================================================

create table if not exists public.lovecoins (
  id             uuid        primary key default gen_random_uuid(),
  coin_number    integer     not null unique,
  owner_id       uuid        references auth.users(id) on delete set null,
  creator_name   text        not null,
  recipient_name text        not null,
  relation       text        not null default 'Someone I love',
  message        text        not null default '',
  image_url      text,
  style          text        not null default 'classic',
  visibility     text        not null default 'public',
  status         text        not null default 'claimed',
  is_showcase    boolean     not null default false,
  created_at     timestamptz not null default now()
);

grant select                  on public.lovecoins to anon;
grant select, insert, update  on public.lovecoins to authenticated;
grant all                     on public.lovecoins to service_role;

alter table public.lovecoins enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovecoins' and policyname = 'public coins readable'
  ) then
    create policy "public coins readable"
      on public.lovecoins for select
      to anon, authenticated
      using (visibility = 'public' or owner_id = auth.uid());
  end if;
end $$;

-- NOTE: The "claim own coin" insert policy is intentionally present in the
-- initial schema. Migration 0002 drops it to enforce the two-phase claim flow —
-- after that, only the service-role Edge Function may insert coins.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovecoins' and policyname = 'claim own coin'
  ) then
    create policy "claim own coin"
      on public.lovecoins for insert to authenticated
      with check (auth.uid() = owner_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovecoins' and policyname = 'update own coin'
  ) then
    create policy "update own coin"
      on public.lovecoins for update to authenticated
      using  (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;
end $$;

-- =============================================================================
-- LoveNotes
-- =============================================================================

create table if not exists public.lovenotes (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete set null,
  author_name    text        not null,
  content        text        not null,
  love_type      text        not null,
  category       text        not null default 'Other',
  image_url      text,
  love_coin_id   uuid        references public.lovecoins(id) on delete set null,
  is_showcase    boolean     not null default false,
  seed_reactions jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

grant select                          on public.lovenotes to anon;
grant select, insert, update, delete  on public.lovenotes to authenticated;
grant all                             on public.lovenotes to service_role;

alter table public.lovenotes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovenotes' and policyname = 'notes readable'
  ) then
    create policy "notes readable"
      on public.lovenotes for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovenotes' and policyname = 'write own note'
  ) then
    create policy "write own note"
      on public.lovenotes for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovenotes' and policyname = 'update own note'
  ) then
    create policy "update own note"
      on public.lovenotes for update to authenticated
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lovenotes' and policyname = 'delete own note'
  ) then
    create policy "delete own note"
      on public.lovenotes for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- =============================================================================
-- Reactions
-- =============================================================================

create table if not exists public.reactions (
  id           uuid        primary key default gen_random_uuid(),
  love_note_id uuid        not null references public.lovenotes(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  reaction_type text       not null,
  created_at   timestamptz not null default now(),
  unique (love_note_id, user_id, reaction_type)
);

grant select           on public.reactions to anon;
grant select, insert, delete on public.reactions to authenticated;
grant all              on public.reactions to service_role;

alter table public.reactions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'reactions readable'
  ) then
    create policy "reactions readable"
      on public.reactions for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'react as self'
  ) then
    create policy "react as self"
      on public.reactions for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reactions' and policyname = 'unreact own'
  ) then
    create policy "unreact own"
      on public.reactions for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists lovenotes_created_at_idx on public.lovenotes (created_at desc);
create index if not exists reactions_note_idx        on public.reactions  (love_note_id);

-- =============================================================================
-- Seed data — showcase LoveCoins (curated)
-- =============================================================================

insert into public.lovecoins (coin_number, creator_name, recipient_name, relation, message, style, created_at, is_showcase) values
  (18472, 'Simi',  'Abbie',       'Someone I love', 'I created this LoveCoin for my wife because ordinary days with her never feel ordinary.',           'romantic', now() - interval '1 day',   true),
  (18211, 'Tolu',  'Dad',         'Family',          'I called my dad today just because I hadn''t heard his voice in a while. He talked for an hour.',   'classic',  now() - interval '4 days',  true),
  (18033, 'Nadia', 'Ife',         'Friend',          'My best friend remembered my interview was today and texted me right before I walked in.',           'minimal',  now() - interval '7 days',  true),
  (18590, 'Kemi',  'Zuri',        'Family',          'My daughter left me a note in my bag this morning. I kept it. Now I''m keeping this.',               'golden',   now() - interval '12 days', true),
  (18310, 'David', 'Grandma Rose','Someone special', 'For the woman who taught me that love is mostly just showing up. Every single time.',                'personal', now() - interval '20 days', true)
on conflict (coin_number) do nothing;

-- Showcase LoveCoins (wider community, deterministic)
insert into public.lovecoins (coin_number, creator_name, recipient_name, relation, message, style, created_at, is_showcase)
select
  d.num,
  (array['Ada','Bayo','Chidi','Dami','Emeka','Farida','Gbemi','Hauwa','Ibrahim','Joy','Kola','Lara','Muna','Ngozi','Obi','Peju','Rita','Segun','Tara','Uche','Yemi','Zara'])[1 + (d.num * 7) % 22],
  (array['Mum','Dad','my wife','my husband','Ada','my brother','Grandma','my daughter','my son','Tunde','Bisi','my best friend','Nneka','Sade','Kunle'])[1 + (d.num * 11) % 15],
  'Someone I love',
  (array[
    'For the woman who calls just to hear me breathe.',
    'You made an ordinary year feel like a good one.',
    'Thank you for the quiet ways you show up.',
    'Kept here so I never forget how today felt.',
    'Twelve years, and you still make me laugh first thing in the morning.',
    'For the friend who answers at 2am without asking why.',
    'Because you believed it before I did.',
    'A small place for a big thank you.'])[1 + (d.num * 13) % 8],
  (array['classic','romantic','minimal','golden','personal'])[1 + (d.num * 17) % 5],
  now() - ((d.num % 90) || ' days')::interval,
  true
from (select distinct 18000 + ((i * 61 + 7) % 900) as num from generate_series(1, 200) i) d
on conflict (coin_number) do nothing;

-- =============================================================================
-- Seed data — showcase LoveNotes
-- =============================================================================

insert into public.lovenotes (author_name, content, love_type, category, love_coin_id, created_at, is_showcase, seed_reactions) values
  ('Amaka',  'My mum called me this morning just to make sure I had eaten. Sometimes the smallest things mean the most.',                                         'received', 'Family',      null,                                                              now() - interval '3 hours',      true, '{"loved":128,"felt":42,"smile":19,"beautiful":31}'::jsonb),
  ('Tobi',   'Someone paid for my coffee today. I don''t know their name, but they made my morning lighter than it had any right to be.',                        'received', 'Kindness',    null,                                                              now() - interval '6 hours',      true, '{"loved":74,"grateful":26,"beautiful":12}'::jsonb),
  ('Simi',   'I made a LoveCoin for my wife tonight. Ordinary Tuesday. Ordinary jollof. Nothing ordinary about her.',                                            'gave',     'Romantic',    (select id from public.lovecoins where coin_number = 18472),       now() - interval '9 hours',      true, '{"loved":96,"inspired":33,"smile":28}'::jsonb),
  ('Nadia',  'My best friend remembered my interview was today and texted me before I walked in. I read it twice in the elevator.',                               'received', 'Friendship',  (select id from public.lovecoins where coin_number = 18033),       now() - interval '1 day',        true, '{"loved":61,"felt":40,"smile":22}'::jsonb),
  ('Kemi',   'My daughter left me a note in my bag this morning. Six words. I cried at my desk.',                                                                'received', 'Family',      (select id from public.lovecoins where coin_number = 18590),       now() - interval '1 day 5 hours', true, '{"loved":143,"smile":58,"felt":24}'::jsonb),
  ('Tolu',   'I called my dad today just because I hadn''t heard his voice in a while. We talked about nothing for an hour.',                                    'gave',     'Family',      (select id from public.lovecoins where coin_number = 18211),       now() - interval '2 days',       true, '{"loved":88,"felt":31,"grateful":17}'::jsonb),
  ('Ifeoma', 'My old boss still checks in on me two jobs later. She has no reason to. That''s the whole point.',                                                  'received', 'Mentorship',  null,                                                              now() - interval '3 days',       true, '{"loved":52,"inspired":29,"grateful":14}'::jsonb),
  ('David',  'Cooked too much rice on purpose so I could take a plate to the security man downstairs. He called me ''my son''.',                                  'gave',     'Community',   null,                                                              now() - interval '4 days',       true, '{"loved":67,"beautiful":21,"grateful":35}'::jsonb),
  ('Zainab', 'It''s been three years since my grandmother passed. I made her stew today, exactly the way she did. The kitchen smelled like her.',                 'gave',     'Remembrance', null,                                                              now() - interval '5 days',       true, '{"loved":112,"felt":63,"beautiful":44}'::jsonb)
on conflict do nothing;
