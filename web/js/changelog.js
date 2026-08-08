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
