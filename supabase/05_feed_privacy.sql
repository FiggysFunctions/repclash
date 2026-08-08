-- ============================================================================
--  REPCLASH — public workout feed + per-workout privacy
--  Run AFTER 01–04. Safe to re-run.
--
--  Until now workouts were technically readable by your crew but there was no
--  way to browse them. This makes that explicit: a feed of everyone's sessions
--  with the full detail, plus a switch to keep any given session to yourself.
--
--  Important: a private workout still scores. Privacy hides *what* you did,
--  not *that* you did it — your points, streak and challenge standings are
--  unaffected. The scoring views run as the table owner and deliberately see
--  everything.
-- ============================================================================

alter table public.workouts
  add column if not exists is_private boolean not null default false;

-- Remembered preference so someone who wants everything private doesn't have
-- to flip the switch on every single session.
alter table public.profiles
  add column if not exists default_private boolean not null default false;

create index if not exists workouts_feed_idx
  on public.workouts(created_at desc) where not is_private;

-- ---------------------------------------------------------------------------
--  Visibility
--
--  Wrapped in a SECURITY DEFINER helper rather than inlined into the policy:
--  a policy that sub-queries another RLS-protected table gets awkward to
--  reason about, and this keeps the rule stated once.
-- ---------------------------------------------------------------------------
create or replace function app.can_see_workout(p_workout uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout
      and (w.user_id = auth.uid()
           or (not w.is_private and app.shares_crew(w.user_id)))
  );
$$;

drop policy if exists workouts_read on public.workouts;
create policy workouts_read on public.workouts
  for select to authenticated
  using (not is_private and app.shares_crew(user_id));
  -- your own workouts stay visible via the workouts_own policy

drop policy if exists entries_read on public.workout_entries;
create policy entries_read on public.workout_entries
  for select to authenticated
  using (app.can_see_workout(workout_id));

-- ---------------------------------------------------------------------------
--  The feed
--
--  One row per session, with its exercises rolled up into JSON so the app can
--  render a whole card without a second round trip.
--  p_before paginates: pass the created_at of the oldest row you already have.
--  p_user narrows it to one person, for their profile card.
-- ---------------------------------------------------------------------------
create or replace function public.crew_feed(
  p_crew   uuid,
  p_limit  int         default 25,
  p_before timestamptz default null,
  p_user   uuid        default null
) returns table (
  workout_id   uuid,
  user_id      uuid,
  display_name text,
  avatar_emoji text,
  performed_on date,
  note         text,
  created_at   timestamptz,
  effort       int,
  is_mine      boolean,
  is_private   boolean,
  entries      json
)
language plpgsql stable security definer set search_path = public, app as $$
-- Several OUT parameter names above (user_id, note, created_at, is_private)
-- are also column names below. Everything in the query is table-qualified, but
-- this makes the preference explicit so a future edit can't silently resolve a
-- bare reference to the parameter instead of the column.
#variable_conflict use_column
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;

  return query
  select
    w.id, w.user_id, p.display_name, p.avatar_emoji,
    w.performed_on, w.note, w.created_at,
    coalesce(sum(e.effort_points), 0)::int,
    (w.user_id = auth.uid()),
    w.is_private,
    coalesce(
      json_agg(
        json_build_object(
          'name',         ex.name,
          'emoji',        ex.emoji,
          'kind',         ex.kind,
          'category',     ex.category,
          'sets',         e.sets,
          'reps',         e.reps,
          'weight_kg',    e.weight_kg,
          'distance_km',  e.distance_km,
          'duration_min', e.duration_min,
          'points',       e.effort_points
        ) order by e.created_at
      ) filter (where e.id is not null),
      '[]'::json
    )
  from public.crew_members cm
  join public.workouts w  on w.user_id = cm.user_id
  join public.profiles p  on p.id = w.user_id
  left join public.workout_entries e on e.workout_id = w.id
  left join public.exercises ex      on ex.id = e.exercise_id
  where cm.crew_id = p_crew
    and (not w.is_private or w.user_id = auth.uid())
    and (p_user is null or w.user_id = p_user)
    and (p_before is null or w.created_at < p_before)
  group by w.id, w.user_id, p.display_name, p.avatar_emoji,
           w.performed_on, w.note, w.created_at, w.is_private
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end $$;

grant execute on function public.crew_feed(uuid, int, timestamptz, uuid) to authenticated;
