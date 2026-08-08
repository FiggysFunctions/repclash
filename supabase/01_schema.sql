-- ============================================================================
--  REPCLASH — database schema
--  Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--  Safe to re-run: everything is idempotent.
-- ============================================================================

create extension if not exists pgcrypto;

-- Views/helpers live in `app` so PostgREST never exposes them directly.
-- Only `public` is reachable from the browser, and there we expose
-- carefully-guarded functions instead of raw views.
create schema if not exists app;
revoke all on schema app from anon, authenticated;

-- ============================================================================
--  SCORING CONSTANTS
--  Change these numbers and re-run this file to retune the whole game.
--  Everything downstream (views, leaderboard, previews) reads from here, so
--  scoring is defined in exactly one place.
-- ============================================================================
create or replace function app.rules()
returns table (
  daily_effort_cap   int,   -- max effort points that count in a single day
  qualify_threshold  int,   -- effort points needed for a day to "count"
  session_bonus      int,   -- flat bonus for each qualifying day
  streak_step        int,   -- bonus per consecutive day
  streak_cap         int,   -- max streak bonus per day
  weekly_target      int,   -- qualifying days per week to hit the target
  weekly_bonus       int    -- bonus for hitting the weekly target
)
language sql immutable parallel safe as $$
  select 400, 60, 60, 10, 100, 4, 250;
$$;

-- Public read-only mirror so the app can show the rules on the How Scoring
-- Works screen without ever hardcoding them in JavaScript.
create or replace function public.scoring_rules()
returns json language sql stable security definer set search_path = public, app as $$
  select to_json(r) from app.rules() r;
$$;

-- ============================================================================
--  PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 24),
  avatar_emoji text not null default '💪',
  created_at   timestamptz not null default now()
);

-- ============================================================================
--  CREWS  (a private league of friends, joined with a 6-character code)
-- ============================================================================
create table if not exists public.crews (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(trim(name)) between 2 and 40),
  join_code     text not null unique,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  season_name   text not null default 'Season 1',
  season_starts date not null default current_date,
  season_ends   date not null default (current_date + 90),
  created_at    timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id   uuid not null references public.crews(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_members_user_idx on public.crew_members(user_id);

-- ============================================================================
--  EXERCISE CATALOG
--    kind = how the exercise is measured, which decides the points formula:
--      strength   → sets x reps, scaled by load
--      bodyweight → sets x reps, no load scaling
--      distance   → kilometres
--      timed      → minutes
-- ============================================================================
create table if not exists public.exercises (
  id             text primary key,
  name           text not null,
  category       text not null,
  kind           text not null check (kind in ('strength','bodyweight','distance','timed')),
  points_per_unit numeric(6,2) not null check (points_per_unit > 0),
  emoji          text not null default '🏋️',
  sort_order     int not null default 100,
  active         boolean not null default true
);

-- ============================================================================
--  WORKOUTS
-- ============================================================================
create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  performed_on  date not null default current_date,
  note          text check (char_length(note) <= 280),
  created_at    timestamptz not null default now()
);
create index if not exists workouts_user_day_idx on public.workouts(user_id, performed_on);

create table if not exists public.workout_entries (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references public.workouts(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  exercise_id   text not null references public.exercises(id),
  sets          int     check (sets     between 1 and 50),
  reps          int     check (reps     between 1 and 1000),
  weight_kg     numeric(6,1) check (weight_kg between 0 and 700),
  distance_km   numeric(6,2) check (distance_km between 0 and 300),
  duration_min  int     check (duration_min between 0 and 1440),
  effort_points int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists entries_workout_idx on public.workout_entries(workout_id);
create index if not exists entries_user_idx on public.workout_entries(user_id);

-- ---------------------------------------------------------------------------
--  Effort formula — the single source of truth for what one entry is worth.
-- ---------------------------------------------------------------------------
create or replace function public.entry_effort(
  p_kind text, p_ppu numeric,
  p_sets int, p_reps int, p_weight numeric, p_distance numeric, p_duration int
) returns int
language sql immutable parallel safe as $$
  select greatest(0, round(
    case p_kind
      when 'strength'   then p_ppu * (coalesce(p_sets,1) * coalesce(p_reps,0))
                             * least(1 + coalesce(p_weight,0) / 60.0, 3.0)
      when 'bodyweight' then p_ppu * (coalesce(p_sets,1) * coalesce(p_reps,0))
      when 'distance'   then p_ppu * coalesce(p_distance,0)
      when 'timed'      then p_ppu * coalesce(p_duration,0)
      else 0
    end
  ))::int;
$$;

create or replace function app.fill_entry() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare ex public.exercises%rowtype;
begin
  select * into ex from public.exercises where id = new.exercise_id;
  if not found then raise exception 'Unknown exercise %', new.exercise_id; end if;

  -- user_id is always taken from the parent workout, never from the client
  select w.user_id into new.user_id from public.workouts w where w.id = new.workout_id;

  new.effort_points := public.entry_effort(
    ex.kind, ex.points_per_unit,
    new.sets, new.reps, new.weight_kg, new.distance_km, new.duration_min
  );
  return new;
end $$;

drop trigger if exists trg_fill_entry on public.workout_entries;
create trigger trg_fill_entry
  before insert or update on public.workout_entries
  for each row execute function app.fill_entry();

-- ============================================================================
--  WEEKLY CHALLENGES + PERMANENT TITLES
-- ============================================================================
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references public.crews(id) on delete cascade,
  week_start   date not null,
  title        text not null,
  description  text,
  emoji        text not null default '🎯',
  metric       text not null check (metric in ('points','active_days','distance_km','reps','minutes')),
  category     text,                      -- optional: restrict to one category
  reward_title text not null,             -- the permanent title the winner earns
  settled_at   timestamptz,
  unique (crew_id, week_start)
);

create table if not exists public.titles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  crew_id      uuid not null references public.crews(id) on delete cascade,
  title        text not null,
  emoji        text not null default '🏆',
  awarded_for  text,
  awarded_at   timestamptz not null default now()
);
create index if not exists titles_user_idx on public.titles(user_id);

create table if not exists public.season_champions (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  season_name text not null,
  user_id     uuid references public.profiles(id) on delete set null,
  points      int not null default 0,
  crowned_at  timestamptz not null default now()
);

-- ============================================================================
--  SCORING PIPELINE  (internal views — never exposed to the browser)
-- ============================================================================

-- Raw effort per user per day
create or replace view app.v_day_raw as
  select e.user_id,
         w.performed_on as day,
         sum(e.effort_points)::int as raw_effort,
         count(distinct w.id)::int as sessions,
         sum(coalesce(e.reps,0) * coalesce(e.sets,1))::int as reps,
         sum(coalesce(e.distance_km,0))::numeric as distance_km,
         sum(coalesce(e.duration_min,0))::int as minutes
  from public.workout_entries e
  join public.workouts w on w.id = e.workout_id
  group by 1, 2;

-- Apply the daily cap and the qualifying-day session bonus
create or replace view app.v_day_scored as
  select d.*,
         least(d.raw_effort, r.daily_effort_cap) as effort_points,
         case when d.raw_effort >= r.qualify_threshold then r.session_bonus else 0 end as session_bonus,
         (d.raw_effort >= r.qualify_threshold) as qualified
  from app.v_day_raw d cross join app.rules() r;

-- Consecutive-qualifying-day streak length, per day
create or replace view app.v_day_streak as
  select s.*,
         case when s.qualified
              then row_number() over (partition by s.user_id, s.grp order by s.day)
              else 0 end::int as streak_day
  from (
    select v.*,
           v.day - (row_number() over (partition by v.user_id order by v.day))::int as grp
    from app.v_day_scored v
    where v.qualified
  ) s;

-- Final per-day total
create or replace view app.v_day_total as
  select t.user_id, t.day, t.raw_effort, t.sessions, t.reps, t.distance_km, t.minutes,
         t.effort_points, t.session_bonus, t.qualified, t.streak_day,
         least(t.streak_day * r.streak_step, r.streak_cap) as streak_bonus,
         (t.effort_points + t.session_bonus
          + least(t.streak_day * r.streak_step, r.streak_cap))::int as day_points
  from app.v_day_streak t cross join app.rules() r;

-- Weekly target bonus (weeks start Monday)
create or replace view app.v_week_bonus as
  select v.user_id,
         date_trunc('week', v.day)::date as week_start,
         count(*)::int as active_days,
         case when count(*) >= r.weekly_target then r.weekly_bonus else 0 end as week_bonus
  from app.v_day_scored v cross join app.rules() r
  where v.qualified
  group by 1, 2, r.weekly_target, r.weekly_bonus;

-- ============================================================================
--  SECURITY HELPERS
-- ============================================================================
create or replace function app.is_member(p_crew uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = p_crew and user_id = auth.uid()
  );
$$;

create or replace function app.shares_crew(p_user uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select p_user = auth.uid() or exists (
    select 1
    from public.crew_members me
    join public.crew_members them on them.crew_id = me.crew_id
    where me.user_id = auth.uid() and them.user_id = p_user
  );
$$;

-- ============================================================================
--  ROW LEVEL SECURITY
--  Default stance: you can only ever read data belonging to people who share
--  a crew with you, and you can only ever write your own rows.
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.crews           enable row level security;
alter table public.crew_members    enable row level security;
alter table public.exercises       enable row level security;
alter table public.workouts        enable row level security;
alter table public.workout_entries enable row level security;
alter table public.challenges      enable row level security;
alter table public.titles          enable row level security;
alter table public.season_champions enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (app.shares_crew(id));

drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists crews_read on public.crews;
create policy crews_read on public.crews
  for select to authenticated using (app.is_member(id));

drop policy if exists crews_insert on public.crews;
create policy crews_insert on public.crews
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists crews_update_owner on public.crews;
create policy crews_update_owner on public.crews
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists members_read on public.crew_members;
create policy members_read on public.crew_members
  for select to authenticated using (app.is_member(crew_id));

drop policy if exists members_leave on public.crew_members;
create policy members_leave on public.crew_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises
  for select to authenticated using (true);

drop policy if exists workouts_read on public.workouts;
create policy workouts_read on public.workouts
  for select to authenticated using (app.shares_crew(user_id));

drop policy if exists workouts_own on public.workouts;
create policy workouts_own on public.workouts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists entries_read on public.workout_entries;
create policy entries_read on public.workout_entries
  for select to authenticated using (app.shares_crew(user_id));

drop policy if exists entries_own on public.workout_entries;
create policy entries_own on public.workout_entries
  for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges
  for select to authenticated using (app.is_member(crew_id));

drop policy if exists titles_read on public.titles;
create policy titles_read on public.titles
  for select to authenticated using (app.is_member(crew_id));

drop policy if exists champions_read on public.season_champions;
create policy champions_read on public.season_champions
  for select to authenticated using (app.is_member(crew_id));

-- ============================================================================
--  PUBLIC RPCs  (the only write paths that need elevated privileges)
-- ============================================================================

create or replace function app.new_join_code() returns text
language plpgsql volatile security definer set search_path = public, app as $$
declare code text; i int := 0;
begin
  loop
    -- No I/O/0/1 — these are read aloud and typed by humans.
    code := string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                              1 + floor(random() * 32)::int, 1), '')
            from generate_series(1, 6);
    exit when not exists (select 1 from public.crews where join_code = code);
    i := i + 1;
    if i > 50 then raise exception 'Could not allocate a join code'; end if;
  end loop;
  return code;
end $$;

-- Create a crew and join it in one step.
create or replace function public.create_crew(p_name text)
returns public.crews
language plpgsql volatile security definer set search_path = public, app as $$
declare c public.crews;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.crews (name, join_code, owner_id)
  values (trim(p_name), app.new_join_code(), auth.uid())
  returning * into c;
  insert into public.crew_members (crew_id, user_id) values (c.id, auth.uid());
  return c;
end $$;

-- Join an existing crew by its code.
create or replace function public.join_crew(p_code text)
returns public.crews
language plpgsql volatile security definer set search_path = public, app as $$
declare c public.crews;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into c from public.crews where join_code = upper(trim(p_code));
  if not found then raise exception 'No crew with that code'; end if;
  insert into public.crew_members (crew_id, user_id)
  values (c.id, auth.uid())
  on conflict do nothing;
  return c;
end $$;

-- The leaderboard. Points = daily totals + weekly target bonuses in range.
-- Internal version (no permission check) so the challenge/season engine can
-- reuse it; the public wrapper below enforces crew membership.
create or replace function app.leaderboard(
  p_crew uuid, p_from date, p_to date
) returns table (
  user_id uuid, display_name text, avatar_emoji text,
  points int, effort int, bonus int,
  sessions int, active_days int, current_streak int, title_count int
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  return query
  with members as (
    select cm.user_id as uid, p.display_name as dn, p.avatar_emoji as ae
    from public.crew_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.crew_id = p_crew
  ),
  d as (
    select * from app.v_day_total where day between p_from and p_to
  ),
  w as (
    select * from app.v_week_bonus
    where week_start between date_trunc('week', p_from)::date and p_to
  ),
  agg as (
    select m.uid, m.dn, m.ae,
      coalesce((select sum(x.day_points)   from d x where x.user_id = m.uid), 0)::int as day_pts,
      coalesce((select sum(x.effort_points) from d x where x.user_id = m.uid), 0)::int as eff,
      coalesce((select sum(x.session_bonus + x.streak_bonus) from d x where x.user_id = m.uid), 0)::int as day_bonus,
      coalesce((select sum(y.week_bonus)   from w y where y.user_id = m.uid), 0)::int as wk_bonus,
      coalesce((select sum(x.sessions)     from d x where x.user_id = m.uid), 0)::int as sess,
      coalesce((select count(*)            from d x where x.user_id = m.uid and x.qualified), 0)::int as adays,
      coalesce((
        select x.streak_day from app.v_day_total x
        where x.user_id = m.uid and x.day >= current_date - 1
        order by x.day desc limit 1
      ), 0)::int as streak,
      coalesce((select count(*) from public.titles t
                where t.user_id = m.uid and t.crew_id = p_crew), 0)::int as tcount
    from members m
  )
  select agg.uid, agg.dn, agg.ae,
         agg.day_pts + agg.wk_bonus, agg.eff, agg.day_bonus + agg.wk_bonus,
         agg.sess, agg.adays, agg.streak, agg.tcount
  from agg
  order by 4 desc, agg.adays desc, agg.dn asc;
end $$;

create or replace function public.crew_leaderboard(
  p_crew uuid, p_from date, p_to date
) returns table (
  user_id uuid, display_name text, avatar_emoji text,
  points int, effort int, bonus int,
  sessions int, active_days int, current_streak int, title_count int
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;
  return query select * from app.leaderboard(p_crew, p_from, p_to);
end $$;

-- Live standings for one week's challenge (internal; wrapper below checks access).
create or replace function app.standings(p_challenge uuid)
returns table (user_id uuid, display_name text, avatar_emoji text, score numeric)
language plpgsql stable security definer set search_path = public, app as $$
declare ch public.challenges;
begin
  select * into ch from public.challenges where id = p_challenge;
  if not found then raise exception 'No such challenge'; end if;

  return query
  select p.id, p.display_name, p.avatar_emoji,
    coalesce(sum(
      case ch.metric
        when 'points'      then e.effort_points::numeric
        when 'reps'        then (coalesce(e.reps,0) * coalesce(e.sets,1))::numeric
        when 'distance_km' then coalesce(e.distance_km, 0)
        when 'minutes'     then coalesce(e.duration_min, 0)::numeric
        else 0
      end
    ), 0) +
    case when ch.metric = 'active_days' then coalesce((
      select count(*) from app.v_day_total v
      where v.user_id = p.id and v.qualified
        and v.day between ch.week_start and ch.week_start + 6
    ), 0)::numeric else 0 end as score
  from public.crew_members cm
  join public.profiles p on p.id = cm.user_id
  left join public.workouts wo
    on wo.user_id = p.id and wo.performed_on between ch.week_start and ch.week_start + 6
  left join public.workout_entries e on e.workout_id = wo.id
  left join public.exercises ex on ex.id = e.exercise_id
    and (ch.category is null or ex.category = ch.category)
  where cm.crew_id = ch.crew_id
    and (ch.category is null or ex.id is not null or e.id is null)
  group by p.id, p.display_name, p.avatar_emoji
  order by score desc, p.display_name asc;
end $$;

create or replace function public.challenge_standings(p_challenge uuid)
returns table (user_id uuid, display_name text, avatar_emoji text, score numeric)
language plpgsql stable security definer set search_path = public, app as $$
declare c_crew uuid;
begin
  select crew_id into c_crew from public.challenges where id = p_challenge;
  if c_crew is null then raise exception 'No such challenge'; end if;
  if not app.is_member(c_crew) then raise exception 'Not a member of this crew'; end if;
  return query select * from app.standings(p_challenge);
end $$;

-- A single member's stats card (streaks, totals, personal bests).
create or replace function public.member_stats(p_user uuid)
returns json language plpgsql stable security definer set search_path = public, app as $$
declare result json;
begin
  if not app.shares_crew(p_user) then raise exception 'Not visible to you'; end if;

  select json_build_object(
    'total_points',   coalesce((select sum(day_points) from app.v_day_total where user_id = p_user), 0)
                    + coalesce((select sum(week_bonus) from app.v_week_bonus where user_id = p_user), 0),
    'total_sessions', coalesce((select sum(sessions) from app.v_day_total where user_id = p_user), 0),
    'active_days',    coalesce((select count(*) from app.v_day_total where user_id = p_user and qualified), 0),
    'best_streak',    coalesce((select max(streak_day) from app.v_day_total where user_id = p_user), 0),
    'current_streak', coalesce((select streak_day from app.v_day_total
                                where user_id = p_user and day >= current_date - 1
                                order by day desc limit 1), 0),
    'total_km',       coalesce((select sum(distance_km) from app.v_day_total where user_id = p_user), 0),
    'total_minutes',  coalesce((select sum(minutes) from app.v_day_total where user_id = p_user), 0),
    'first_day',      (select min(day) from app.v_day_total where user_id = p_user),
    'recent',         coalesce((select json_agg(row_to_json(r)) from (
                        select day, day_points, raw_effort, sessions, qualified
                        from app.v_day_total where user_id = p_user
                        order by day desc limit 30
                      ) r), '[]'::json)
  ) into result;
  return result;
end $$;

-- ============================================================================
--  GRANTS
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.workouts, public.workout_entries to authenticated;
grant select on public.crews, public.crew_members, public.exercises,
                public.challenges, public.titles, public.season_champions to authenticated;
grant delete on public.crew_members to authenticated;
grant execute on function public.create_crew(text),
                          public.join_crew(text),
                          public.crew_leaderboard(uuid, date, date),
                          public.challenge_standings(uuid),
                          public.member_stats(uuid),
                          public.scoring_rules(),
                          public.entry_effort(text, numeric, int, int, numeric, numeric, int)
  to authenticated;
