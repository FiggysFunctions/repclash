# RepClash — context for Claude

A workout-gamification PWA for Liam and a group of friends. Log workouts, earn
points, compete on a leaderboard, win weekly titles.

## Hard constraints

- **No build step, ever.** There is no Node or npm on this machine (`python` is
  2.7). Everything is plain ES modules a browser loads directly. Don't introduce
  bundlers, TypeScript, frameworks, or npm dependencies.
- **Free tier only.** Supabase free tier + GitHub Pages. Don't propose anything
  that costs money or needs a always-on server.
- **No CDN dependencies.** `api.js` is hand-rolled against Supabase's REST and
  auth endpoints rather than using `supabase-js`, so the app stays fully
  self-contained and installable offline. Keep it that way.

## Architecture

```
supabase/*.sql   Postgres schema. Idempotent — always safe to re-run.
web/             The whole app. Deployed as-is to GitHub Pages.
scripts/         serve.py (dev server), deploy.ps1 (ship), make-icons.ps1
```

Front end is four tabs over one crew. `app.js` works out which onboarding stage
the user is at, loads shared context once into a `ctx` object
(`{ crew, profile, rules, reload, goCrewSetup, bumpBoard, go }`), then hands off
to a view. Views render by building an HTML string and wiring handlers — no
virtual DOM, no reactivity.

## Where scoring lives

**`app.rules()` at the top of `supabase/01_schema.sql` is the single source of
truth.** Seven constants; everything downstream reads from them. The client
never hardcodes scoring — it calls `scoring_rules()` and displays what it gets.

Two deliberate exceptions, both documented in place:
- `previewEffort()` in `api.js` mirrors the SQL `entry_effort()` function so the
  points preview updates without a round trip.
- `web/js/demo.js` reimplements the pipeline for demo mode.

If you change the SQL formula, update both. The SQL is authoritative.

The scoring is **consistency-weighted** by design — a daily cap plus session,
streak, and weekly-target bonuses, so showing up four times a week beats one
enormous session. That's a product decision Liam made, not an accident. Don't
"optimise" it toward raw volume without asking.

## Security model

Row-level security on every table. Two `SECURITY DEFINER` helpers,
`app.is_member()` and `app.shares_crew()`, avoid the infinite recursion you'd
otherwise get from a `crew_members` policy that queries `crew_members`.

Views live in the `app` schema, which is **not** exposed to PostgREST — Postgres
views bypass RLS by default, so exposing them would leak data. The browser only
ever reaches `public` functions that check membership first.

The anon key is public by design and safe to commit. The service_role key must
never appear in this repo.

## Weekly challenges

No cron job. `public.sync_crew(crew_id)` is called on every app load and is
idempotent: it settles finished weeks, awards titles, creates the current week's
challenge, and rolls the season if it ended. Adding a row to
`challenge_templates` lengthens the rotation automatically.

## Every update ships with patch notes

Liam asked for this explicitly: **every change that users would notice gets an
entry at the top of `web/js/changelog.js`** before deploying. Bumping the top
entry's `version` is what lights up the ✨ icon and pops the notes once for
everyone next time they open the app.

Write them for a group of friends, not for developers — say what's different
for them, not what was refactored. Tags are `new`, `better`, `fix`, `note`. If
scoring changed in a way that moves anyone's standings, say so plainly in a
`note`; people notice and will assume it's a bug otherwise.

Internal-only changes (refactors, doc edits) don't need an entry.

## Async rendering

Views fetch and then write into a container they looked up before awaiting. A
second render can start in the meantime — a tab tapped twice, or a sheet's
`onChange` asking for a refresh — which detaches the first render's container.
Always capture the node before an await and guard with `live(node)` from
`ui.js` afterwards. Skipping this produces a view that silently stops
responding to taps.

`sheet()` replaces whatever sheet is open rather than stacking. Don't open a
sheet from inside a sheet and then touch the outer one afterwards — close and
reopen instead (see `replyTo` in `views/feedback.js`).

Element ids must be unique across the whole document, not just within a view:
view containers and open sheets coexist in the DOM. Sheet-local ids are
prefixed (`fb-body`, not `body`).

## Conventions

- Dates are plain local `YYYY-MM-DD` strings everywhere. Never involve UTC — a
  Tuesday workout must read as Tuesday regardless of timezone.
- All user-typed text goes through `esc()` before touching `innerHTML`.
  Display names come from other people.
- Weeks start Monday, matching Postgres `date_trunc('week')`.
- Error messages get translated into something actionable in `humanise()` in
  `api.js` rather than surfacing raw Postgres text.
- Comments explain *why*, not *what*. Match the existing density.

## Testing

```bash
python scripts/serve.py     # http://localhost:8099
```

Demo mode (the button on the setup screen) exercises every view without a
Supabase project. When testing changes in the browser, the service worker will
serve cached code — unregister it or hard reload if changes don't appear.

## Deploying

```bash
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 "message"
```

Bumps the sw.js cache version, commits, pushes. GitHub Actions publishes `web/`
to Pages. Live in ~1 minute.
