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

Order matters — run them 01, 02, 03.

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
| Change what an exercise is worth | `supabase/02_exercises.sql`, re-run it |
| Add an exercise | Add a row in `supabase/02_exercises.sql`, re-run it |
| Change or add weekly challenges | `challenge_templates` in `supabase/03_challenges.sql`, re-run it |
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
web/
  index.html          the shell
  css/app.css         all the styling
  js/
    app.js            boot + tab router
    api.js            every call to Supabase
    config.js         your Supabase keys
    ui.js             DOM helpers, sheets, toasts, date maths
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
