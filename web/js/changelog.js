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
