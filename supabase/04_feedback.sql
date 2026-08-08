-- ============================================================================
--  REPCLASH — feedback inbox
--  Run AFTER 01, 02 and 03. Safe to re-run.
--
--  Anyone in a crew can post a suggestion. The person who owns the crew reads
--  them, sets a status, and can leave a reply. Submitters see their own
--  suggestions and whatever status they've been given, so the loop closes and
--  people can tell they've been heard.
-- ============================================================================

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  crew_id    uuid not null references public.crews(id) on delete cascade,
  kind       text not null default 'idea'
             check (kind in ('idea','bug','exercise','scoring','other')),
  body       text not null check (char_length(trim(body)) between 4 and 1000),
  status     text not null default 'new'
             check (status in ('new','planned','done','declined')),
  reply      text check (char_length(reply) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_crew_idx on public.feedback(crew_id, created_at desc);
create index if not exists feedback_user_idx on public.feedback(user_id);

-- ---------------------------------------------------------------------------
--  Who's in charge of a crew's inbox
-- ---------------------------------------------------------------------------
create or replace function app.owns_crew(p_crew uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.crews where id = p_crew and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
--  Row level security
-- ---------------------------------------------------------------------------
alter table public.feedback enable row level security;

-- You can read your own suggestions; the crew owner reads all of them.
drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or app.owns_crew(crew_id));

-- You can only post as yourself, and only into a crew you're actually in.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid() and app.is_member(crew_id));

-- Only the owner triages. Submitters deliberately can't edit after sending —
-- otherwise the status the owner set could be quietly overwritten.
drop policy if exists feedback_triage on public.feedback;
create policy feedback_triage on public.feedback
  for update to authenticated
  using (app.owns_crew(crew_id))
  with check (app.owns_crew(crew_id));

-- Submitters can withdraw something they regret posting.
drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback
  for delete to authenticated
  using (user_id = auth.uid() or app.owns_crew(crew_id));

create or replace function app.touch_feedback() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_feedback on public.feedback;
create trigger trg_touch_feedback
  before update on public.feedback
  for each row execute function app.touch_feedback();

-- ---------------------------------------------------------------------------
--  Reading the inbox
--
--  A plain PostgREST select can't embed profiles here: the crew owner is
--  allowed to see the feedback row, but the profiles policy is what decides
--  whether they see the author, and those are evaluated independently. Doing
--  it in one guarded function keeps the join predictable.
-- ---------------------------------------------------------------------------
create or replace function public.crew_feedback(p_crew uuid)
returns table (
  id uuid, user_id uuid, display_name text, avatar_emoji text,
  kind text, body text, status text, reply text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.owns_crew(p_crew) then
    raise exception 'Only the crew owner can read the suggestion box';
  end if;

  return query
    select f.id, f.user_id, p.display_name, p.avatar_emoji,
           f.kind, f.body, f.status, f.reply, f.created_at, f.updated_at
    from public.feedback f
    join public.profiles p on p.id = f.user_id
    where f.crew_id = p_crew
    order by (f.status = 'new') desc, f.created_at desc;
end $$;

-- Everything you've ever suggested, plus what happened to it.
create or replace function public.my_feedback(p_crew uuid)
returns table (
  id uuid, kind text, body text, status text, reply text, created_at timestamptz
)
language sql stable security definer set search_path = public, app as $$
  select f.id, f.kind, f.body, f.status, f.reply, f.created_at
  from public.feedback f
  where f.user_id = auth.uid() and f.crew_id = p_crew
  order by f.created_at desc;
$$;

-- Small enough to poll on every app load: just the unread count for the badge.
create or replace function public.feedback_unread(p_crew uuid)
returns int language sql stable security definer set search_path = public, app as $$
  select case
    when app.owns_crew(p_crew)
      then (select count(*) from public.feedback
            where crew_id = p_crew and status = 'new')::int
    else 0
  end;
$$;

grant select, insert, update, delete on public.feedback to authenticated;
grant execute on function public.crew_feedback(uuid),
                          public.my_feedback(uuid),
                          public.feedback_unread(uuid)
  to authenticated;
