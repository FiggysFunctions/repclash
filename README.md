# 🔥 RepClash

Turn your workouts into a league with your mates. Log what you did, earn points,
climb the leaderboard, win weekly titles that stick to your name forever.

Installs on any phone from a link. Costs nothing to run, ever.

---

## Look at it first

You don't need to set anything up to see the app working:

```bash
python scripts/serve.py
```

Open <http://localhost:8099> and hit **🎮 Try the demo**. That loads a fake crew
with two months of history so you can click through every screen. Everything
runs in your browser — no account, no network.

---

## Getting it live (about 20 minutes, one time)

You need two free accounts. Neither ever asks for a card.

| What | Why | Cost |
|---|---|---|
| [Supabase](https://supabase.com) | The shared database, so everyone sees the same leaderboard | Free tier, permanently |
| [GitHub](https://github.com) | Hosts the code and the live website | Free for public repos |

### Step 1 — Create the Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**. Name it `repclash`. Pick the region closest to you.
3. Set a database password and save it somewhere. You won't need it often,
   but you can't recover it.
4. Wait ~2 minutes for it to finish setting up.

### Step 2 — Create the tables

1. In your project, click **SQL Editor** in the left sidebar → **New query**.
2. Open `supabase/01_schema.sql` from this folder, copy the whole thing, paste
   it in, and click **Run**. It should say *Success*.
3. Do the same with `supabase/02_exercises.sql`.
4. Do the same with `supabase/03_challenges.sql`.
5. Do the same with `supabase/04_feedback.sql`.
6. Do the same with `supabase/05_feed_privacy.sql`.
7. Do the same with `supabase/06_season_pass.sql`.
8. Do the same with `supabase/07_progression.sql`.

Order matters — run them in number order.

> One caveat if you ever re-run an earlier file: `01_schema.sql` grants UPDATE
> on the whole `profiles` table, while `06_season_pass.sql` narrows that so
> cosmetics can only be changed through the `equip()` function that checks your
> unlocks. If you re-run 01, re-run 06 afterwards.

### Step 3 — Turn off email confirmation

Otherwise your friends have to click a link in an email before they can sign in,
and Supabase's free tier only sends a handful of emails per hour.

1. **Authentication** → **Sign In / Providers** → **Email**.
2. Turn **Confirm email** *off*. Save.

### Step 4 — Get your two keys

1. **Settings** (bottom left) → **API Keys**.
2. Copy the **Project URL** — looks like `https://abcdefgh.supabase.co`.
3. Copy the **anon public** key — a very long string starting `eyJ...`.

> ⚠️ There's also a **service_role** / secret key on that page. Never put that
> one in the app or in this repo. It bypasses all the security rules.
> The anon key is *designed* to be public and is safe to commit.

### Step 5 — Put the keys in the app

Open `web/js/config.js` and fill in the two blanks at the top:

```js
const BAKED = {
  url:     'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

Now anyone who opens the app is connected automatically — your friends never
see a setup screen.

### Step 6 — Put it on GitHub

1. Go to <https://github.com/new>. Name it `repclash`. **Public**. Don't tick
   any of the "initialize with" boxes. **Create repository**.
2. Copy the URL GitHub shows you, then in this folder run:

```bash
git remote add origin https://github.com/YOUR-USERNAME/repclash.git
git push -u origin main
```

3. In the repo on GitHub: **Settings** → **Pages** → under **Source** choose
   **GitHub Actions**. That's it, nothing else to configure.
4. Go to the **Actions** tab and watch the deploy finish (~1 minute).

Your app is now live at:

```
https://YOUR-USERNAME.github.io/repclash/
```

### Step 7 — Get everyone on it

1. Open the link on your phone, create an account, pick a name.
2. **Create crew**. You'll get a 6-character code.
3. Send your friends the link and the code. They open it, create an account,
   enter the code, done.
4. Everyone should **add it to their home screen** — the app tells them how
   under Me → ⚙️ → *How to install this app*. It then opens fullscreen like a
   real app.

---

## How the scoring works

Built so that **turning up consistently beats one heroic session a month**.

| | |
|---|---|
| **Effort points** | Every exercise is worth points per rep, km, or minute. Lifting scales with the weight on the bar, up to 3× at 120 kg. |
| **Daily cap** | Only the first **400** effort points each day count. You can't bank a week's score on Sunday. |
| **Showing up** | Any day with **60+** effort points is an "active day" and earns a flat **+60**. |
| **Streaks** | Each consecutive active day adds **+10**, up to **+100** a day. Miss a day, back to zero. |
| **Weekly target** | **4** active days in a week (Mon–Sun) earns **+250**. This is the big one. |

All of it is defined in one place: the `app.rules()` function at the top of
`supabase/01_schema.sql`. Change those seven numbers, re-run the file, and the
entire league is rescored retroactively — no app update needed.

## Weekly challenges and titles

Every Monday a challenge appears automatically, rotating through eight of them
(Iron Week, Roadwork, The Metronome, Rep Machine…). Whoever wins the week earns
a **permanent title** — "Ironclad", "Road Warrior" — that shows next to their
name in the trophy case forever.

There's no server or cron job doing this. The app calls `sync_crew()` when it
opens, which settles any finished weeks, hands out the titles, and creates the
current week's challenge. If nobody opens the app for a fortnight, the first
person to open it settles both weeks at once.

Seasons run 90 days. When one ends, the leader is crowned champion, gets a
`Season N Champion` title, and a fresh season starts automatically.

To change the challenges, edit the `challenge_templates` rows in
`supabase/03_challenges.sql` and re-run it. Adding a row lengthens the rotation.

## Personal progression

The half of the app that isn't about your mates. **All of it is private** —
your history, bests and goals are visible to you and nobody else, and none of
it affects points or the leaderboard.

**Last time recall.** Pick an exercise and it shows what you did last time and
fills the numbers in. The picker opens on *Recent*, ordered by what you've done
most recently.

**Suggestions.** Tap a chip to progress: `+2.5 kg` (or `+1 kg` under 20 kg),
`+1 rep`, `+5%` distance, `+5 min`. Deliberately small — the point is to still
be adding next year.

**Personal bests**, tracked automatically per exercise:

| Kind | What's tracked |
|---|---|
| Strength | Heaviest weight, most reps in a set, biggest session volume, **estimated 1RM** |
| Bodyweight | Most reps in a set |
| Cardio (distance) | Furthest, longest, **best pace** |
| Timed | Longest |

Estimated 1RM uses the Epley formula (`weight × (1 + reps/30)`), which is how
you compare a heavy triple against a light set of ten. The app flags 🏆 as soon
as your numbers would beat a best, before you've saved.

**Goals.** Set a target on any exercise and metric — 100 kg bench, 20 pull-ups,
a 10 km run. Progress is worked out from your history rather than stored, so it
stays correct if you delete a session, and the app records the day you hit it.

Find it all under **Me → Your lifts**.

## The Season Pass

A 30-tier cosmetic track running alongside each 90-day season. Progress is the
gold card at the top of the **Me** tab; tap it for the ladder.

XP comes from consistency, not volume:

| | |
|---|---|
| Any day you train | **+100** |
| Hitting your weekly target | **+150** |
| Winning a weekly challenge | **+250** |

**The pass is not a second leaderboard.** Day XP is capped at one lot per day,
so a four-hour Sunday earns exactly what a solid Tuesday earns. Whoever's
topping the table doesn't automatically win the pass — the person who never
misses does. That's the point of having both.

Rewards are **20 avatars, 3 name colours, 2 app themes and 4 titles**, and
they're **permanent** — a new season resets your tier, never your unlocks.

Anyone joining part-way through a season is credited 400 XP for each full week
that had already passed, so nobody arrives already beaten.

**Nothing in the pass affects scoring**, deliberately. The moment a tier granted
a points multiplier, the league would be decided by who signed up first.

To retune it: the XP rates are in `app.pass_rules()` and the ladder is the
`pass_tiers` rows, both in `supabase/06_season_pass.sql`. Re-run the file and
changes apply retroactively.

## The feed and privacy

The **👀 Feed** tab shows every session the crew logs, with the real numbers —
sets, reps, weight, distance, time. Tap one for the full breakdown, or tap
someone else's and choose *Only show them* to scroll through just their
training.

Any session can be made **private**: flip the switch when you save it, or on
any past session from the feed or your recent list. A private session is
invisible to everyone else — you'll see it with a 🔒 so you know. There's a
master switch under **Me → ⚙️** if you'd rather everything be private by
default.

**Private sessions still score.** They count towards your points, streak,
leaderboard position and the weekly challenge exactly as before. The switch
hides *what* you did, not *that* you did it. If you wanted a session not to
count at all, you'd delete it.

## The suggestion box

Everyone in the crew gets **Me → 💡 Suggest something**. Whatever they send
lands in an inbox that only **the crew owner** can read — that's you, for the
crew you created. You'll see an unread count on your Me tab.

For each suggestion you can mark it **Planned**, **Done** or **Not doing**, and
leave a reply. The person who sent it sees the status and your reply under
**Me → 📄 What I've suggested**, so nothing disappears into a void.

There's no email notification, deliberately: Supabase's free tier only sends a
handful of emails an hour and those are reserved for sign-in. Anything else
would mean paying for a mail service.

## Patch notes

`web/js/changelog.js` is the list of updates. The newest entry goes at the top,
and bumping its `version` is what makes the ✨ icon light up for everyone. Next
time each person opens the app they get the notes for anything they haven't
read yet, once.

Tags are `new`, `better`, `fix` and `note`. Write them for your mates, not for
developers.

---

## Making changes

```bash
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 "made squats worth more"
```

That bumps the service worker cache (so phones actually pick up the new
version), commits, and pushes. GitHub Actions puts it live in about a minute.

Common tweaks:

| You want to… | Edit |
|---|---|
| Retune the whole scoring system | `app.rules()` in `supabase/01_schema.sql`, re-run in SQL Editor |
| Change what an exercise is worth | `supabase/02_exercises.sql`, re-run it (affects future logs only) |
| Add an exercise | Add a row in `supabase/02_exercises.sql`, re-run it |
| Change or add weekly challenges | `challenge_templates` in `supabase/03_challenges.sql`, re-run it |
| Write patch notes for an update | Add an entry at the top of `web/js/changelog.js` |
| Retune season pass XP or rewards | `app.pass_rules()` / `pass_tiers` in `supabase/06_season_pass.sql`, re-run it |
| Add an app theme | A `:root[data-rc-theme="..."]` block in `web/css/app.css`, plus a `pass_tiers` row and an entry in `THEMES` in `web/js/views/pass.js` |
| Add a badge | The `BADGES` array in `web/js/views/profile.js` — they're computed from stats, so new ones apply retroactively |
| Change colours | The `:root` variables at the top of `web/css/app.css` |
| Change season length | `season_ends` in the `crews` table |

SQL files are all safe to re-run as many times as you like.

---

## What's where

```
supabase/
  01_schema.sql       tables, security rules, scoring pipeline, leaderboard
  02_exercises.sql    the exercise catalog and what each is worth
  03_challenges.sql   weekly challenge rotation, titles, season rollover
  04_feedback.sql     the suggestion box
  05_feed_privacy.sql the workout feed and per-session privacy
  06_season_pass.sql  the season pass: XP, tiers, unlocks, cosmetics
  07_progression.sql  personal bests, exercise history and goals
web/
  index.html          the shell
  css/app.css         all the styling
  js/
    app.js            boot + tab router
    api.js            every call to Supabase
    config.js         your Supabase keys
    ui.js             DOM helpers, sheets, toasts, date maths
    changelog.js      patch notes — edit this every update
    demo.js           the fake backend behind demo mode
    views/            one file per screen
  sw.js               offline support
  manifest.webmanifest, icons/
scripts/
  serve.py            local dev server
  deploy.ps1          bump cache, commit, push, go live
  make-icons.ps1      regenerate the app icons
```

No build step, no dependencies, no `npm install`. It's plain files a browser
can read, which is why it costs nothing to host and won't rot in two years.

---

## Is my data private?

Yes. Every table has row-level security, which means the database itself
refuses to return data you're not entitled to — it isn't enforced by the app,
so it can't be bypassed by poking at the API.

Specifically: you can only read profiles and workouts belonging to people who
share a crew with you, and you can only ever write your own rows. Crews are
invisible to anyone without the join code.

## Costs

Nothing, at your scale. Supabase's free tier gives 500 MB of database and
50,000 monthly active users. A group of friends logging workouts will use a
rounding error of that. GitHub Pages is free for public repos with a 100 GB/month
bandwidth allowance.

The one thing to know: **Supabase pauses free projects after 7 days with no
activity.** If you all stop using it for a week you'll need to click "Restore"
in the dashboard. Nothing is lost. Using the app at all resets the clock.
