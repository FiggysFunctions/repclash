/* ==========================================================================
   Patch notes.

   Newest release goes at the TOP of the array. Bumping the `version` of the
   first entry is what makes the ✨ icon light up for everyone — the app
   remembers the last version each person read.

   Tags: 'new' (feature), 'better' (improvement), 'fix' (bug), 'note' (heads-up).
   Keep the wording plain — your mates are reading this, not other developers.
   ========================================================================== */

export const CHANGELOG = [
  {
    version: '1.8.0',
    date: '2026-08-12',
    title: 'Heavy counts for more',
    blurb: 'Strength work was losing to volume work. Fixed at the root this time.',
    items: [
      ['note', 'SCORING HAS CHANGED AGAIN, and this one favours the big lifts. Squats, deadlifts, bench and presses are worth 20–25% more than they were. Machines and isolation stay roughly where v1.7 put them.'],
      ['better','The reason: the old load multiplier maxed out at 120 kg and only ever spanned 1× to 3×, so going 60 kg → 100 kg bought 33% more per rep while doing 10 reps instead of 5 bought 100%. Volume beat intensity no matter what. It now runs to 4× and doesn\'t cap until 135 kg.'],
      ['better','Reps past 15 in a single set now count half. A set of 25 isn\'t two and a half times a set of 10 — past fifteen you\'re training endurance, and it shouldn\'t stack up forever.'],
      ['better','Incline dumbbell press and leg curls specifically came down. Both were outscoring the heavier lift they sit next to in a session.'],
      ['note', 'Nothing already logged has changed. Your points, streak, standings and pass are exactly where they were.'],
      ['new',  'Forgot your password? There\'s a link on the sign-in screen now. It emails you a reset — no need to ask Liam.'],
      ['new',  'You can also change your password any time under Me → ⚙️.'],
      ['new',  'New kit: seated and standing side delt machines, leg press calf raise, shin (tibialis) raises, and the plate-loaded rack — chest press, incline, shoulder press, row, pulldown and leg press.']
    ]
  },
  {
    version: '1.7.0',
    date: '2026-08-11',
    title: 'Big lifts, big points',
    blurb: 'Curls no longer outscore bench. Someone flagged it, they were right.',
    items: [
      ['note', 'SCORING HAS CHANGED. Isolation work is worth a lot less than it was, and compound lifts are untouched. Squats, deadlifts, bench, presses, rows and Olympic lifts score exactly what they always did.'],
      ['better','Curls, extensions, flies, pushdowns, lateral raises and the like are down roughly 45–55%. A set of machine curls used to be worth more than a set of bench, which was daft.'],
      ['better','Machine compounds — leg press, hack squat, pulldown, chest press — are down around 35%. They take far heavier loads than a barbell and the old rates didn\'t account for that.'],
      ['better','Small stuff — calves, hip abduction and adduction, shrugs — down more still. They\'re accessories, they should feel like accessories.'],
      ['note', 'Nothing already logged has changed. Your points, streak, standings and the season pass are all exactly where they were — points are locked in when you save a session. This only affects sessions from now on.'],
      ['note', 'Expect a typical lifting session to score maybe 20–25% lower than before. An arms-only day drops more like 45%. Everything still clears the 60 points needed for the day to count.'],
      ['better','Sets are now entered as kg then reps, not reps then kg, matching how programs are written. Everything reads that way too: "60 kg × 8 · 8 · 10", "40 kg × 12 · 50 kg × 10 · 60 kg × 8".'],
      ['new',  'Meadows Row added, set up as single-sided.']
    ]
  },
  {
    version: '1.6.0',
    date: '2026-08-11',
    title: 'Log it how you actually did it',
    blurb: 'Every set gets its own line, and single-arm work finally counts properly.',
    items: [
      ['new',  'Sets are now individual. Three sets of 8 where the last one went to 10 is one entry: 8, 8, 10. No more logging the same exercise twice or writing down a number you didn\'t do.'],
      ['new',  'Each set has its own weight too, so drop sets and pyramids log honestly. Every set is scored on the weight you actually used for it.'],
      ['new',  '＋ Add set copies the set above, so the usual "same again" is one tap.'],
      ['new',  'Single-arm and single-leg work. Exercises that are always one-sided — dumbbell row, Bulgarian split squat, concentration curl — switch it on themselves. Ones that could go either way, like curls, calf raises and lunges, have a toggle.'],
      ['note', 'Doing both sides is worth double, because it is: the reps you enter count for each side.'],
      ['better','Everything reads the way you\'d say it out loud — "8 · 8 · 10 @ 60 kg", "3 × 10 @ 20 kg each side", "4×9@27.5 · 13@22.5 kg" for a drop set.'],
      ['better','"Most reps in a set" and "heaviest" now mean your best single set, which is what they always should have meant.'],
      ['note', 'Everything you\'ve already logged is untouched and still shows exactly as before. Old entries just become "3 × 8" style sets.']
    ]
  },
  {
    version: '1.5.0',
    date: '2026-08-11',
    title: 'The whole gym',
    blurb: '124 new exercises — the machines, cables and Smith machine rack you actually use.',
    items: [
      ['new',  'The catalog went from 83 exercises to 207. Every resistance machine you\'d expect: hack squat, hip abduction and adduction, lying and seated leg curl, pec deck, chest press, rear delt fly, glute kickback, ab crunch, assisted pull-up and dip.'],
      ['new',  'The full cable station — fly crossover, tricep pushdown, overhead extension, face pull, cable curl, lateral raise, pull-through, cable crunch, woodchop, Pallof press.'],
      ['new',  'Ten Smith machine movements: squat, split squat, RDL, bench, incline, shoulder press, row, shrug, hip thrust, calf raise.'],
      ['new',  'More barbell and dumbbell work: sumo deadlift, rack pull, good morning, close-grip bench, push press, preacher curl, skullcrusher, Arnold press, hammer curl, Bulgarian split squat, goblet squat and plenty more.'],
      ['new',  'Weighted core — weighted Russian twist, weighted sit-up, cable crunch — plus ab wheel, toes to bar, hanging knee raise, hollow hold, L-sit and dead hang.'],
      ['new',  'Sled push and drag, battle ropes, farmer\'s carry, tyre flip, wall ball, Turkish get-up, assault bike and rucking.'],
      ['better','The picker now has muscle-group filters under the categories, so you can jump straight to Chest or Glutes instead of scrolling past 200 things.'],
      ['better','Search matches equipment and muscle, not just the name. Type "smith", "cable" or "glutes" and you\'ll find it.'],
      ['better','Exercises you haven\'t done before now show what kit they need — "Machine · Glutes" — so the similar-sounding ones are easy to tell apart.'],
      ['note', 'Nothing you\'ve already logged has changed value. Points are worked out and saved when you log a session, so your history and the leaderboard are exactly where you left them.'],
      ['note', 'Machines score less per rep than free weights on purpose. You load a leg press with far more than you\'d ever squat, so if they paid the same per kilo the machines would win every time.']
    ]
  },
  {
    version: '1.4.0',
    date: '2026-08-09',
    title: 'Beat last week',
    blurb: 'The app now remembers what you lifted and tells you what to try next.',
    items: [
      ['new',  'Last time recall. Pick an exercise and it shows what you did last time — 3 × 5 @ 50 kg, two weeks ago — and fills the numbers in for you.'],
      ['new',  'Suggestions. Tap a chip to go up: +2.5 kg, +1 rep, +5% distance. Small jumps on purpose, so you\'re still adding a year from now.'],
      ['new',  'Personal bests, tracked automatically. Heaviest weight, best set, biggest volume, furthest, longest, best pace — and estimated 1 rep max for lifts, so a heavy triple can be compared with a light ten.'],
      ['new',  'The app shouts 🏆 the moment your numbers would beat a PB, before you\'ve even saved.'],
      ['new',  'Goals. Give yourself a target on any exercise — 100 kg bench, 20 pull-ups, a 10 km run — and watch the bar fill. It records the day you hit it.'],
      ['new',  'Me → Your lifts has all of it: every exercise you\'ve done, your bests, full history and your goals.'],
      ['better', 'The exercise picker opens on Recent, so the things you actually do are at the top.'],
      ['note', 'All of this is private. Your bests, history and goals are yours alone — no one else in the crew can see them, and none of it affects points or the leaderboard.']
    ]
  },
  {
    version: '1.3.0',
    date: '2026-08-08',
    title: 'The Season Pass',
    blurb: '30 tiers of stuff to unlock, just for turning up.',
    items: [
      ['new',  'Season Pass. 30 tiers, earned with XP, running alongside the season. Your progress is the card at the top of the Me tab — tap it for the full ladder.'],
      ['new',  'XP: +100 for any day you train, +150 for hitting your weekly target, +250 for winning a weekly challenge.'],
      ['new',  'Unlocks: 20 new avatars, 3 name colours that show on the leaderboard and feed, 2 full app themes (Blood at tier 13, Terminal at tier 25), and 4 titles.'],
      ['new',  'Your tier shows as a small gold number next to your name on the leaderboard.'],
      ['note', 'The pass is NOT the leaderboard. XP is capped at one lot per day, so a four-hour Sunday earns the same as a solid Tuesday. Whoever\'s topping the table does not automatically win the pass — turning up regularly does.'],
      ['note', 'Everything you unlock is permanent. Season 2 will reset your tier, not your rewards.'],
      ['note', 'Joined recently? You\'re credited 400 XP for every week of the season that had already gone before you joined, so nobody starts already beaten.'],
      ['better', 'Avatars now live under Me → ⚙️ → Avatar, colours and themes. You start with 8; the other 20 are pass rewards.'],
      ['note', 'Nothing in the pass affects scoring. It\'s all cosmetic, on purpose — otherwise whoever started first would win forever.']
    ]
  },
  {
    version: '1.2.0',
    date: '2026-08-08',
    title: 'The Feed',
    blurb: 'See exactly what everyone else is doing. Or don\'t let them see yours.',
    items: [
      ['new',  'New 👀 Feed tab. Every session the crew logs, with the actual numbers — sets, reps, weight, distance, time. No more wondering what Jax is squatting.'],
      ['new',  'Tap any session in the feed to see the whole thing broken down exercise by exercise.'],
      ['new',  'Tap someone else\'s session and choose "Only show <name>" to scroll through just their training.'],
      ['new',  'Private sessions. Flip the switch when you save, or on any session afterwards, and the detail is hidden from everyone else.'],
      ['new',  'Me → ⚙️ has a master switch if you\'d rather everything you log be private by default.'],
      ['note', 'Private workouts still score. They count for your points, your streak, the leaderboard and the weekly challenge exactly as before — the switch only hides what you did, not that you did it.'],
      ['better', 'The Weekly tab moved along one to make room. Log is still the big button in the middle.']
    ]
  },
  {
    version: '1.1.0',
    date: '2026-08-08',
    title: 'Say what you think',
    blurb: 'You can now tell me what to build next, and see what changed when I build it.',
    items: [
      ['new',  'Suggestion box — Me → 💡 Suggest something. Ideas, bugs, missing exercises, complaints about the scoring. It comes straight to me.'],
      ['new',  'You can see what happened to everything you\'ve suggested: planned, done, or turned down, usually with a reply.'],
      ['new',  'This screen. The ✨ on the leaderboard lights up whenever there\'s a new update to read.'],
      ['note', 'Nothing about scoring changed in this update — your points and standings are exactly where you left them.']
    ]
  },
  {
    version: '1.0.0',
    date: '2026-08-08',
    title: 'RepClash is live',
    blurb: 'Log workouts, earn points, fight over the leaderboard.',
    items: [
      ['new', 'Leaderboard with weekly, season and all-time views.'],
      ['new', 'Log workouts from a catalog of 80+ exercises — lifting, cardio, classes and sport.'],
      ['new', 'Weekly challenges that rotate every Monday. Win one and you keep the title forever.'],
      ['new', '90-day seasons with a champion crowned at the end.'],
      ['new', '17 badges to collect, plus streak tracking.'],
      ['note', 'Scoring rewards turning up over going enormous once a month. Full breakdown under Me → How scoring works.']
    ]
  }
];

export const LATEST = CHANGELOG[0].version;

const SEEN_KEY = 'repclash.seenVersion';

/** Has this person read the newest entry? */
export function hasUnread() {
  return localStorage.getItem(SEEN_KEY) !== LATEST;
}

export function markRead() {
  localStorage.setItem(SEEN_KEY, LATEST);
}

/** Entries newer than the last one this person read, newest first. */
export function unreadEntries() {
  const seen = localStorage.getItem(SEEN_KEY);
  if (!seen) return CHANGELOG.slice(0, 1);      // first run: just show the latest
  const idx = CHANGELOG.findIndex(c => c.version === seen);
  return idx === -1 ? CHANGELOG : CHANGELOG.slice(0, idx);
}

/* A brand-new install shouldn't nag about updates it was never around for.
   Called once on first boot. */
export function primeIfFirstRun() {
  if (localStorage.getItem(SEEN_KEY) === null &&
      localStorage.getItem('repclash.primed') === null) {
    localStorage.setItem('repclash.primed', '1');
    return true;   // caller decides whether to show the welcome
  }
  return false;
}
