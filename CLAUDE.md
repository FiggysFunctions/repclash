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

## The exercise catalog

`02_exercises.sql` holds all 207 exercises and is re-run whenever it changes.
Two rules:

- **Never change or remove an `id` that has shipped.** `workout_entries` points
  at it, so a rename would orphan people's history, personal bests and goals.
  The `name` is free to change.
- **Machines get a much lower `points_per_unit` than free weights.** The load
  multiplier caps at 3× (120 kg), and people load a leg press with far more
  than they'd ever squat. Equal rates would make machines strictly better.

**`09_scoring_rates.sql` owns `points_per_unit`, not `02`.** 02 is the catalog
(what exists, how it's measured); 09 is the pricing. 02's `ON CONFLICT` clause
deliberately excludes the rate so adding an exercise can't undo a rebalance.

Rates sit in explicit bands, and this ordering is the product requirement — a
crew member reported machine curls outscoring bench, and barbell curls did too:

| Band | Rate | |
|---|---|---|
| Heavy compound | 1.00–1.50 | barbell, multi-joint, systemic |
| Compound | 0.70–1.00 | dumbbell, unilateral, supported |
| Machine compound | 0.40–0.70 | fixed path, much heavier loads |
| Isolation | 0.25–0.40 | single joint, any equipment |
| Small isolation | 0.12–0.25 | calves, delts, abductors |

The underlying cause is structural: effort is linear in reps while the load
multiplier only spans 1×–3×, so high-rep light work out-accumulates heavy work
unless the rates are far apart. Keep new exercises inside these bands.

Changing `points_per_unit` does **not** rescore history: `app.fill_entry()`
computes and stores `effort_points` at insert time, so a retune only affects
future sessions. `app.rules()` is different — those are applied by views at
read time, so changing *those* does move historical standings.

`muscle` and `equipment` exist purely so the picker can filter and search 200+
items. Nothing scores off them. All weights work stays in `category = 'Strength'`
regardless of equipment, because that's what the weekly challenges filter on.

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

## Season pass

Four rules, all deliberate — Liam signed off on each:

1. **Pass XP is not leaderboard points.** Day XP is capped at one lot per day so
   the pass rewards consistency while the leaderboard rewards output. If you
   make them correlate, the pass stops being a separate reward axis and becomes
   noise.
2. **Rewards are cosmetic, forever.** No tier may ever grant a scoring bonus —
   that would make the league unwinnable for anyone who joined late.
3. **Unlocks are permanent.** `pass_unlocks` is keyed `(user_id, tier)` with no
   season, on purpose. Seasons reset tier, never rewards.
4. **Late joiners get catch-up credit** (`xp_catchup_week`), derived from
   `crew_members.joined_at`.

Cosmetics **must** be equipped through `public.equip()`. Direct UPDATE on
`profiles.avatar_emoji`, `equipped_colour` and `equipped_theme` is revoked at
the column level in `06_season_pass.sql`, because a client-side check is no
check at all — anyone could PATCH themselves the tier 29 shimmer.

Pass-awarded titles carry `titles.source = 'pass'` and are excluded from the
challenge-win XP term. Without that filter, a pass title would grant XP that
could unlock the next title: a feedback loop.

Themes are pure CSS variable overrides under `:root[data-rc-theme="..."]`.
`restoreTheme()` runs before `boot()` so there's no flash of the default while
the profile loads.

## Personal progression

`07_progression.sql` is the private half of the app: history, personal bests
and goals, all scoped to `auth.uid()` and shared with nobody. It must never
feed scoring or the leaderboard — that separation is the whole point.

`app.metric_of()` is the single definition of what a metric is worth; both
personal bests and goal progress read from it, so they can't disagree.
`web/js/progression.js` mirrors it for the live PB flag while logging, the same
deliberate exception as the points preview.

## Sets and sides

An entry holds `set_detail`: an array of `{reps, kg}`, one per set, so varied
sets, drop sets and pyramids are one entry rather than several. Each set is
priced on its own load and summed — never averaged.

`per_side` means the reps entered were done on each side, and doubles the
entry. Only meaningful for `strength` and `bodyweight`; the trigger forces it
false otherwise. `exercises.sided` drives the toggle: `'always'` defaults on,
`'option'` defaults off, null hides it.

The flat `sets` / `reps` / `weight_kg` columns are **derived by the trigger**
from `set_detail` — count, best single set's reps, heaviest single set. That's
deliberate: it's exactly what "most reps in a set" and "heaviest" should mean
for a personal best. Never write them from the client when set_detail is
present. `total_reps`, `total_volume` and `top_e1rm` are denormalised at write
time so PBs and goals stay simple queries.

Old entries have `set_detail = null` and keep working through the same code
paths; `fromEntry()` in `progression.js` expands them into the set shape.

Goal progress and the achieved date are **derived**, never stored. Delete a
session and the goal correctly un-achieves; raise a target you'd already beaten
and it goes back to in-progress.

## Privacy

`workouts.is_private` hides a session's *detail* from the feed. It deliberately
does **not** affect scoring: the scoring views and every RPC run SECURITY
DEFINER as the table owner, so private sessions still feed the leaderboard,
streaks and challenge standings. Liam confirmed this is what he wants — a
session that stopped counting when hidden would read as a bug. Don't "fix" it.

`profiles.default_private` is only the default applied to new drafts; each
workout carries its own flag.

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
sheet from inside a sheet and then touch the outer one afterwards — close the
outer one first and pass a `back` callback that reopens it (see `replyTo` in
`views/feedback.js` and `goalSheet` in `views/progress.js`). This has been
introduced as a bug twice now; check for it whenever a sheet opens a sheet.

`confirmSheet()` takes the same `back`, which it runs on cancel or dismiss —
without it, backing out of a confirm leaves the user staring at the page behind
instead of the sheet they came from.

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
