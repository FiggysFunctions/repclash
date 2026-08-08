-- ============================================================================
--  REPCLASH — the Season Pass
--  Run AFTER 01-05. Safe to re-run.
--
--  A 30-tier cosmetic progression track that runs alongside the season.
--
--  Design rules, so future edits don't quietly break it:
--
--   1. XP is NOT leaderboard points. It's capped at one "active day" a day, so
--      turning up four times beats one enormous session — same philosophy as
--      the scoring. Whoever's winning the league does not automatically win
--      the pass.
--   2. Rewards are cosmetic only. Nothing here may ever affect scoring, or
--      anyone joining late is playing a game they can't win.
--   3. Unlocks are PERMANENT. pass_unlocks is keyed on (user_id, tier) with no
--      season in the key, so a tier reached in Season 1 stays unlocked forever.
--   4. Late joiners get catch-up credit for the weeks that had already passed
--      when they joined, so nobody starts a season already beaten.
-- ============================================================================

-- Titles can now come from two places, and pass titles must not feed back into
-- XP as if they were challenge wins.
alter table public.titles
  add column if not exists source text not null default 'challenge';

alter table public.profiles
  add column if not exists equipped_colour text,
  add column if not exists equipped_theme  text;

-- ---------------------------------------------------------------------------
--  XP rates. Change these and re-run to retune the whole pass.
-- ---------------------------------------------------------------------------
create or replace function app.pass_rules()
returns table (
  xp_active_day     int,   -- per qualifying day (max one a day, by definition)
  xp_weekly_target  int,   -- per week you hit the weekly target
  xp_challenge_win  int,   -- per weekly challenge won
  xp_catchup_week   int,   -- credited per full week of season missed before joining
  max_tier          int
)
language sql immutable parallel safe as $$
  select 100, 150, 250, 400, 30;
$$;

create or replace function public.pass_rules()
returns json language sql stable security definer set search_path = public, app as $$
  select to_json(r) from app.pass_rules() r;
$$;

-- Avatars everyone starts with. The rest are earned.
create or replace function app.starter_avatars() returns text[]
language sql immutable parallel safe as $$
  select array['💪','🔥','🏋️','🏃','🚴','🧗','🥊','🐺'];
$$;

-- ---------------------------------------------------------------------------
--  The ladder. Edit freely and re-run — tiers are looked up, never hardcoded
--  in the app, and changes apply retroactively to everyone.
-- ---------------------------------------------------------------------------
create table if not exists public.pass_tiers (
  tier         int primary key check (tier between 1 and 200),
  xp_required  int  not null check (xp_required >= 0),
  reward_kind  text check (reward_kind in ('avatar','colour','theme','title')),
  reward_value text,
  reward_label text
);

insert into public.pass_tiers (tier, xp_required, reward_kind, reward_value, reward_label) values
  ( 1,     0, null,     null,          'Season started'),
  ( 2,   150, 'avatar', '🦍',          'Gorilla'),
  ( 3,   320, 'avatar', '🦁',          'Lion'),
  ( 4,   510, 'avatar', '🦅',          'Eagle'),
  ( 5,   720, 'title',  'Warming Up',  'Title: Warming Up'),
  ( 6,   950, 'avatar', '⚡',          'Bolt'),
  ( 7,  1200, 'avatar', '🐉',          'Dragon'),
  ( 8,  1470, 'avatar', '🦈',          'Shark'),
  ( 9,  1760, 'colour', 'ember',       'Ember name'),
  (10,  2070, 'avatar', '🐻',          'Bear'),
  (11,  2400, 'avatar', '🦖',          'T-Rex'),
  (12,  2750, 'avatar', '🐗',          'Boar'),
  (13,  3120, 'theme',  'blood',       'Blood theme'),
  (14,  3510, 'avatar', '🦏',          'Rhino'),
  (15,  3920, 'title',  'Halfway Beast','Title: Halfway Beast'),
  (16,  4350, 'avatar', '🐅',          'Tiger'),
  (17,  4800, 'avatar', '🌶️',          'Chilli'),
  (18,  5270, 'avatar', '🥷',          'Ninja'),
  (19,  5760, 'colour', 'volt',        'Volt name'),
  (20,  6270, 'avatar', '🤖',          'Robot'),
  (21,  6800, 'avatar', '🧟',          'Zombie'),
  (22,  7350, 'title',  'Relentless',  'Title: Relentless'),
  (23,  7920, 'avatar', '👹',          'Oni'),
  (24,  8510, 'avatar', '🚀',          'Rocket'),
  (25,  9120, 'theme',  'terminal',    'Terminal theme'),
  (26,  9750, 'avatar', '💀',          'Skull'),
  (27, 10400, 'avatar', '🍑',          'Peach'),
  (28, 11070, 'avatar', '👑',          'Crown'),
  (29, 11760, 'colour', 'shimmer',     'Shimmer name'),
  (30, 12470, 'title',  'Maxed Out',   'Title: Maxed Out')
on conflict (tier) do update set
  xp_required  = excluded.xp_required,
  reward_kind  = excluded.reward_kind,
  reward_value = excluded.reward_value,
  reward_label = excluded.reward_label;

alter table public.pass_tiers enable row level security;
drop policy if exists tiers_read on public.pass_tiers;
create policy tiers_read on public.pass_tiers
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
--  Permanent unlocks. No season in the key: once earned, yours forever.
-- ---------------------------------------------------------------------------
create table if not exists public.pass_unlocks (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tier        int  not null references public.pass_tiers(tier) on delete cascade,
  crew_id     uuid references public.crews(id) on delete set null,
  season_name text,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, tier)
);

alter table public.pass_unlocks enable row level security;
drop policy if exists unlocks_read on public.pass_unlocks;
create policy unlocks_read on public.pass_unlocks
  for select to authenticated using (app.shares_crew(user_id));

-- ---------------------------------------------------------------------------
--  XP and tier for every member of a crew, for the crew's current season
-- ---------------------------------------------------------------------------
-- Also returns the equipped name colour: the leaderboard and feed both need it
-- to render someone's name, and they're already calling this for the tier.
create or replace function app.crew_pass(p_crew uuid)
returns table (user_id uuid, xp int, tier int, colour text)
language plpgsql stable security definer set search_path = public, app as $$
#variable_conflict use_column
declare cr public.crews;
begin
  select * into cr from public.crews where id = p_crew;
  if not found then raise exception 'No such crew'; end if;

  return query
  with r as (select * from app.pass_rules()),
  calc as (
    select
      cm.user_id as uid,
      (
        -- one per qualifying day: this is the cap, and why a huge session
        -- is worth no more to the pass than a solid one
        coalesce((select count(*) from app.v_day_total d
                  where d.user_id = cm.user_id and d.qualified
                    and d.day between cr.season_starts and cr.season_ends), 0) * r.xp_active_day
      + coalesce((select count(*) from app.v_week_bonus w
                  where w.user_id = cm.user_id and w.week_bonus > 0
                    and w.week_start between date_trunc('week', cr.season_starts)::date
                                         and cr.season_ends), 0) * r.xp_weekly_target
        -- only real challenge wins; pass titles would otherwise feed back in
      + coalesce((select count(*) from public.titles t
                  where t.user_id = cm.user_id and t.crew_id = p_crew
                    and t.source = 'challenge'
                    and t.awarded_at >= cr.season_starts), 0) * r.xp_challenge_win
        -- credit for the weeks that had already gone when they joined
      + greatest(0, floor(
          extract(epoch from (cm.joined_at - cr.season_starts::timestamptz)) / 604800
        ))::int * r.xp_catchup_week
      )::int as xp
    from public.crew_members cm cross join r
    where cm.crew_id = p_crew
  )
  select c.uid, c.xp,
         coalesce((select max(t.tier) from public.pass_tiers t
                   where t.xp_required <= c.xp), 1),
         (select pf.equipped_colour from public.profiles pf where pf.id = c.uid)
  from calc c;
end $$;

drop function if exists public.crew_pass(uuid);
create or replace function public.crew_pass(p_crew uuid)
returns table (user_id uuid, xp int, tier int, colour text)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;
  return query select * from app.crew_pass(p_crew);
end $$;

-- ---------------------------------------------------------------------------
--  Hand out any newly-reached tiers. Idempotent — called by sync_crew().
-- ---------------------------------------------------------------------------
create or replace function app.grant_unlocks(p_crew uuid)
returns int
language plpgsql volatile security definer set search_path = public, app as $$
declare n int;
begin
  with fresh as (
    insert into public.pass_unlocks (user_id, tier, crew_id, season_name)
    select cp.user_id, t.tier, p_crew, cr.season_name
    from app.crew_pass(p_crew) cp
    join public.pass_tiers t on t.tier <= cp.tier
    cross join (select season_name from public.crews where id = p_crew) cr
    on conflict (user_id, tier) do nothing
    returning user_id, tier
  ),
  titled as (
    insert into public.titles (user_id, crew_id, title, emoji, awarded_for, source)
    select f.user_id, p_crew, t.reward_value, '🎖️',
           'Season pass tier ' || t.tier, 'pass'
    from fresh f
    join public.pass_tiers t on t.tier = f.tier
    where t.reward_kind = 'title'
    returning 1
  )
  select count(*) into n from fresh;
  return n;
end $$;

-- Fold into the existing once-per-load sync.
create or replace function public.sync_crew(p_crew uuid)
returns json
language plpgsql volatile security definer set search_path = public, app as $$
declare titles_awarded int; rolled boolean; unlocked int; ch public.challenges;
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;

  titles_awarded := app.settle_challenges(p_crew);
  rolled         := app.roll_season(p_crew);
  ch             := app.ensure_challenge(p_crew, app.week_start());
  unlocked       := app.grant_unlocks(p_crew);

  return json_build_object(
    'titles_awarded',    titles_awarded,
    'season_rolled',     rolled,
    'tiers_unlocked',    unlocked,
    'current_challenge', row_to_json(ch)
  );
end $$;

-- ---------------------------------------------------------------------------
--  Everything the pass screen needs, in one call
-- ---------------------------------------------------------------------------
create or replace function public.my_pass(p_crew uuid)
returns json
language plpgsql stable security definer set search_path = public, app as $$
declare me record; cr public.crews; result json;
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;

  select * into cr from public.crews where id = p_crew;
  select * into me from app.crew_pass(p_crew) where user_id = auth.uid();

  select json_build_object(
    'xp',            coalesce(me.xp, 0),
    'tier',          coalesce(me.tier, 1),
    'max_tier',      (select max_tier from app.pass_rules()),
    'season_name',   cr.season_name,
    'season_starts', cr.season_starts,
    'season_ends',   cr.season_ends,
    'days_left',     greatest(0, cr.season_ends - current_date),
    'tiers', (
      select coalesce(json_agg(row_to_json(x) order by x.tier), '[]'::json) from (
        select t.tier, t.xp_required, t.reward_kind, t.reward_value, t.reward_label,
               (u.user_id is not null) as unlocked
        from public.pass_tiers t
        left join public.pass_unlocks u
          on u.tier = t.tier and u.user_id = auth.uid()
        order by t.tier
      ) x
    ),
    'starter_avatars', to_json(app.starter_avatars())
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
--  Equipping cosmetics
--
--  This has to be server-side. Direct UPDATE on these columns is revoked
--  below, so the only way to change your avatar, name colour or theme is
--  through here, which checks you've actually earned it. Otherwise anyone who
--  opened the network tab could hand themselves the tier 29 shimmer.
-- ---------------------------------------------------------------------------
create or replace function app.has_unlocked(p_kind text, p_value text)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1
    from public.pass_unlocks u
    join public.pass_tiers t on t.tier = u.tier
    where u.user_id = auth.uid()
      and t.reward_kind = p_kind
      and t.reward_value = p_value
  );
$$;

create or replace function public.equip(
  p_avatar text default null,
  p_colour text default null,
  p_theme  text default null,
  p_clear_colour boolean default false,
  p_clear_theme  boolean default false
) returns public.profiles
language plpgsql volatile security definer set search_path = public, app as $$
declare pr public.profiles;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  if p_avatar is not null
     and not (p_avatar = any(app.starter_avatars()) or app.has_unlocked('avatar', p_avatar))
  then
    raise exception 'You have not unlocked that avatar yet';
  end if;

  if p_colour is not null and not app.has_unlocked('colour', p_colour) then
    raise exception 'You have not unlocked that name colour yet';
  end if;

  if p_theme is not null and not app.has_unlocked('theme', p_theme) then
    raise exception 'You have not unlocked that theme yet';
  end if;

  update public.profiles set
    avatar_emoji    = coalesce(p_avatar, avatar_emoji),
    equipped_colour = case when p_clear_colour then null
                           else coalesce(p_colour, equipped_colour) end,
    equipped_theme  = case when p_clear_theme  then null
                           else coalesce(p_theme,  equipped_theme)  end
  where id = auth.uid()
  returning * into pr;

  return pr;
end $$;

-- Lock down the columns the pass controls. display_name and default_private
-- stay directly editable; the cosmetic columns go through equip() only.
--
-- NOTE: 01_schema.sql grants UPDATE on the whole table. If you ever re-run it,
-- re-run this file afterwards or the cosmetic columns become directly writable
-- again and the unlock checks can be skipped.
revoke update on public.profiles from authenticated;
grant  update (display_name, default_private) on public.profiles to authenticated;

grant select on public.pass_tiers, public.pass_unlocks to authenticated;
grant execute on function public.crew_pass(uuid),
                          public.my_pass(uuid),
                          public.pass_rules(),
                          public.equip(text, text, text, boolean, boolean)
  to authenticated;
