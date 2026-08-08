-- ============================================================================
--  REPCLASH — weekly challenge + permanent title engine
--  Run AFTER 01_schema.sql and 02_exercises.sql.
--
--  How it works: the app calls public.sync_crew(crew_id) whenever it loads.
--  That one call
--    1. settles any finished weeks and awards the winners their titles,
--    2. makes sure the current week has a challenge,
--    3. crowns a season champion and rolls the season over if it has ended.
--  No cron job, no server, nothing to pay for.
-- ============================================================================

alter table public.crews
  add column if not exists season_number int not null default 1;

-- ---------------------------------------------------------------------------
--  Challenge templates. Edit freely — the rotation picks by `rotation` order,
--  and adding a row automatically lengthens the cycle.
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_templates (
  slug         text primary key,
  rotation     int  not null unique,
  title        text not null,
  description  text not null,
  emoji        text not null default '🎯',
  metric       text not null check (metric in ('points','active_days','distance_km','reps','minutes')),
  category     text,
  reward_title text not null,
  active       boolean not null default true
);

insert into public.challenge_templates
  (slug, rotation, title, description, emoji, metric, category, reward_title) values
  ('iron',      0, 'Iron Week',       'Most effort points from Strength work this week.',        '🏋️', 'points',      'Strength',   'Ironclad'),
  ('metronome', 1, 'The Metronome',   'Most days trained this week. Turning up is the whole game.','📅', 'active_days', null,         'The Metronome'),
  ('roadwork',  2, 'Roadwork',        'Most kilometres covered this week — run, ride, row or swim.','🛣️','distance_km', 'Cardio',     'Road Warrior'),
  ('repmachine',3, 'Rep Machine',     'Most total reps this week across everything.',             '🔁', 'reps',        null,         'Rep Machine'),
  ('engine',    4, 'The Engine',      'Most minutes of Class or conditioning work this week.',     '🔥', 'minutes',     'Class',      'Human Engine'),
  ('calisth',   5, 'Bodyweight Boss', 'Most reps of pure bodyweight work this week.',             '🤸', 'reps',        'Bodyweight', 'Bodyweight Boss'),
  ('allround',  6, 'No Weak Links',   'Most total points this week. Everything counts.',          '👑', 'points',      null,         'Undisputed'),
  ('gametime',  7, 'Game Time',       'Most minutes of actual sport played this week.',           '⚽', 'minutes',     'Sport',      'Sunday League Legend')
on conflict (slug) do update set
  rotation     = excluded.rotation,
  title        = excluded.title,
  description  = excluded.description,
  emoji        = excluded.emoji,
  metric       = excluded.metric,
  category     = excluded.category,
  reward_title = excluded.reward_title;

alter table public.challenge_templates enable row level security;
drop policy if exists templates_read on public.challenge_templates;
create policy templates_read on public.challenge_templates
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
--  Helpers
-- ---------------------------------------------------------------------------
create or replace function app.week_start(p_day date default current_date)
returns date language sql immutable parallel safe as $$
  select date_trunc('week', p_day)::date;   -- ISO weeks: Monday
$$;

-- Deterministic rotation: every crew on the same week gets the same challenge,
-- and the cycle is offset per crew so two crews aren't always in lockstep.
create or replace function app.pick_template(p_crew uuid, p_week date)
returns public.challenge_templates
language plpgsql stable security definer set search_path = public, app as $$
declare n int; idx int; t public.challenge_templates;
begin
  select count(*) into n from public.challenge_templates where active;
  if n = 0 then raise exception 'No active challenge templates'; end if;
  idx := ((p_week - date '2024-01-01') / 7 + abs(hashtext(p_crew::text)) % n)::int % n;
  select * into t from public.challenge_templates
   where active order by rotation offset idx limit 1;
  return t;
end $$;

-- ---------------------------------------------------------------------------
--  1. Make sure the given week has a challenge
-- ---------------------------------------------------------------------------
create or replace function app.ensure_challenge(p_crew uuid, p_week date)
returns public.challenges
language plpgsql volatile security definer set search_path = public, app as $$
declare t public.challenge_templates; c public.challenges;
begin
  select * into c from public.challenges where crew_id = p_crew and week_start = p_week;
  if found then return c; end if;

  t := app.pick_template(p_crew, p_week);
  insert into public.challenges
    (crew_id, week_start, title, description, emoji, metric, category, reward_title)
  values
    (p_crew, p_week, t.title, t.description, t.emoji, t.metric, t.category, t.reward_title)
  on conflict (crew_id, week_start) do nothing
  returning * into c;

  if c is null then
    select * into c from public.challenges where crew_id = p_crew and week_start = p_week;
  end if;
  return c;
end $$;

-- ---------------------------------------------------------------------------
--  2. Settle every finished-but-unsettled week and hand out titles
-- ---------------------------------------------------------------------------
create or replace function app.settle_challenges(p_crew uuid)
returns int
language plpgsql volatile security definer set search_path = public, app as $$
declare ch public.challenges; winner record; n int := 0; this_week date := app.week_start();
begin
  for ch in
    select * from public.challenges
    where crew_id = p_crew and settled_at is null and week_start < this_week
    order by week_start
  loop
    select * into winner from app.standings(ch.id) limit 1;

    -- Only award if somebody actually did something that week.
    if winner is not null and winner.score > 0 then
      insert into public.titles (user_id, crew_id, title, emoji, awarded_for)
      values (winner.user_id, p_crew, ch.reward_title, ch.emoji,
              ch.title || ' · week of ' || to_char(ch.week_start, 'DD Mon YYYY'));
      n := n + 1;
    end if;

    update public.challenges set settled_at = now() where id = ch.id;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
--  3. Crown the season champion and roll into the next season
-- ---------------------------------------------------------------------------
create or replace function app.roll_season(p_crew uuid)
returns boolean
language plpgsql volatile security definer set search_path = public, app as $$
declare cr public.crews; champ record;
begin
  select * into cr from public.crews where id = p_crew;
  if not found or current_date <= cr.season_ends then return false; end if;

  select * into champ
    from app.leaderboard(p_crew, cr.season_starts, cr.season_ends) limit 1;

  insert into public.season_champions (crew_id, season_name, user_id, points)
  values (p_crew, cr.season_name,
          case when champ is not null and champ.points > 0 then champ.user_id end,
          coalesce(champ.points, 0));

  if champ is not null and champ.points > 0 then
    insert into public.titles (user_id, crew_id, title, emoji, awarded_for)
    values (champ.user_id, p_crew, cr.season_name || ' Champion', '👑',
            'Won ' || cr.season_name || ' with ' || champ.points || ' points');
  end if;

  update public.crews set
    season_number = cr.season_number + 1,
    season_name   = 'Season ' || (cr.season_number + 1),
    season_starts = cr.season_ends + 1,
    season_ends   = cr.season_ends + 91
  where id = p_crew;

  return true;
end $$;

-- ---------------------------------------------------------------------------
--  The one call the app makes on load.
-- ---------------------------------------------------------------------------
create or replace function public.sync_crew(p_crew uuid)
returns json
language plpgsql volatile security definer set search_path = public, app as $$
declare titles_awarded int; rolled boolean; ch public.challenges;
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;

  titles_awarded := app.settle_challenges(p_crew);
  rolled         := app.roll_season(p_crew);
  ch             := app.ensure_challenge(p_crew, app.week_start());

  return json_build_object(
    'titles_awarded',    titles_awarded,
    'season_rolled',     rolled,
    'current_challenge', row_to_json(ch)
  );
end $$;

-- Hall of fame: every title ever won in this crew, newest first.
create or replace function public.crew_trophy_case(p_crew uuid)
returns table (
  user_id uuid, display_name text, avatar_emoji text,
  title text, emoji text, awarded_for text, awarded_at timestamptz
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;
  return query
    select t.user_id, p.display_name, p.avatar_emoji,
           t.title, t.emoji, t.awarded_for, t.awarded_at
    from public.titles t
    join public.profiles p on p.id = t.user_id
    where t.crew_id = p_crew
    order by t.awarded_at desc;
end $$;

grant select on public.challenge_templates to authenticated;
grant execute on function public.sync_crew(uuid),
                          public.crew_trophy_case(uuid)
  to authenticated;
