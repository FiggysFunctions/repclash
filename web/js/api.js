/* ==========================================================================
   Everything that talks to Supabase lives here.

   Deliberately hand-rolled against the REST + auth endpoints instead of
   pulling in the supabase-js library: no npm, no build step, no CDN that
   could go down, and the whole app stays installable offline.
   ========================================================================== */

import { getConfig, clearConfig } from './config.js';
import * as demo from './demo.js';

const SESSION_KEY = 'repclash.session';

let cfg = null;
let session = null;      // { access_token, refresh_token, expires_at, user }
let refreshing = null;   // in-flight refresh, so parallel calls share one

export function init() {
  cfg = getConfig();
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { session = null; }
  return !!cfg;
}

/* In demo mode every call is answered locally by demo.js — no network, no
   account, no Supabase. See the "Try the demo" button on the setup screen. */
export const inDemo = demo.on;
export function startDemo() { demo.enable(); }
export function endDemo()   { demo.disable(); }

export function isConfigured() { return demo.on() || !!cfg; }
export function currentUser()  { return demo.on() ? demo.currentUser() : (session?.user || null); }
export function isSignedIn()   { return demo.on() || !!session?.access_token; }

function persist(s) {
  session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else   localStorage.removeItem(SESSION_KEY);
}

/* -------------------------------------------------------------------------
   Low-level request plumbing
   ------------------------------------------------------------------------- */

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Turn Postgres/GoTrue error blobs into something a human can act on. */
function humanise(body, status) {
  const raw = body?.message || body?.error_description || body?.error ||
              body?.msg || body?.hint || '';
  const m = String(raw);

  if (/duplicate key.*profiles_pkey/i.test(m))      return 'You already have a profile.';
  if (/duplicate key.*crews_join_code/i.test(m))    return 'Code clash — try again.';
  if (/No crew with that code/i.test(m))            return 'No crew has that code. Check the letters and try again.';
  if (/Not a member of this crew/i.test(m))         return 'You\'re not in that crew.';
  if (/already registered|already been registered/i.test(m))
    return 'That email already has an account. Try signing in instead.';
  if (/Invalid login credentials/i.test(m))         return 'Wrong email or password.';
  if (/Email not confirmed/i.test(m))
    return 'This project still has email confirmation switched on. Turn it off in Supabase → Authentication → Sign In / Providers.';
  if (/Password should be at least/i.test(m))       return 'Password needs to be at least 6 characters.';
  if (/violates row-level security/i.test(m))       return 'You don\'t have permission to do that.';
  if (/Only the crew owner/i.test(m))               return 'Only the person who created the crew can read the suggestion box.';
  // The app has shipped a feature whose SQL hasn't been run yet.
  if (/does not exist|Could not find the (table|function)|schema cache/i.test(m))
    return 'This bit needs a database update. Liam: run the newest file in supabase/ in the Supabase SQL editor.';
  if (/JWT|token is expired/i.test(m))              return 'Your session expired — sign in again.';
  if (status === 0)                                 return 'No connection. Check your internet and try again.';
  return m || `Something went wrong (${status}).`;
}

async function request(path, { method = 'GET', body, headers = {}, auth = true, raw } = {}) {
  if (!cfg) throw new ApiError('Not configured', 0, null);

  const h = {
    apikey: cfg.anonKey,
    'Content-Type': 'application/json',
    ...headers
  };
  if (auth) {
    const token = await validToken();
    h.Authorization = `Bearer ${token || cfg.anonKey}`;
  } else {
    h.Authorization = `Bearer ${cfg.anonKey}`;
  }

  let res;
  try {
    res = await fetch(cfg.url + path, {
      method, headers: h,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0, null);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }

  if (!res.ok) {
    // A dead session should log you out rather than leave the app wedged.
    if (res.status === 401 && auth && session) {
      persist(null);
    }
    throw new ApiError(humanise(data, res.status), res.status, data);
  }
  return raw ? { data, res } : data;
}

/* Refresh the access token slightly before it actually expires. */
async function validToken() {
  if (!session) return null;
  const soon = Date.now() / 1000 + 60;
  if (session.expires_at && session.expires_at < soon && session.refresh_token) {
    refreshing ??= doRefresh().finally(() => { refreshing = null; });
    await refreshing;
  }
  return session?.access_token || null;
}

async function doRefresh() {
  try {
    const out = await request(
      '/auth/v1/token?grant_type=refresh_token',
      { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false }
    );
    persist(shapeSession(out));
  } catch {
    persist(null);   // refresh token is dead; the UI will bounce to sign-in
  }
}

function shapeSession(out) {
  return {
    access_token:  out.access_token,
    refresh_token: out.refresh_token,
    expires_at:    out.expires_at || Math.floor(Date.now() / 1000) + (out.expires_in || 3600),
    user:          out.user
  };
}

const rest = (p, o) => request('/rest/v1' + p, o);
const rpc  = (fn, args) => request('/rest/v1/rpc/' + fn, { method: 'POST', body: args || {} });

/* -------------------------------------------------------------------------
   Auth
   ------------------------------------------------------------------------- */

export async function signUp(email, password) {
  const out = await request('/auth/v1/signup', {
    method: 'POST', auth: false,
    body: { email: email.trim(), password }
  });
  // With email confirmation off, signup returns a full session.
  if (out.access_token) { persist(shapeSession(out)); return true; }
  // Otherwise the account exists but needs a click in an email.
  return false;
}

export async function signIn(email, password) {
  const out = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', auth: false,
    body: { email: email.trim(), password }
  });
  persist(shapeSession(out));
}

export async function signOut() {
  if (demo.on()) { demo.disable(); localStorage.removeItem('repclash.crew'); return; }
  try { await request('/auth/v1/logout', { method: 'POST' }); } catch { /* best effort */ }
  persist(null);
  localStorage.removeItem('repclash.crew');
}

export function hardReset() {
  persist(null);
  clearConfig();
  localStorage.removeItem('repclash.crew');
}

/* -------------------------------------------------------------------------
   Profile
   ------------------------------------------------------------------------- */

export async function getMyProfile() {
  if (demo.on()) return demo.getMyProfile();
  const uid = currentUser()?.id;
  if (!uid) return null;
  const rows = await rest(`/profiles?id=eq.${uid}&select=*`);
  return rows[0] || null;
}

/** Someone else's profile. RLS only allows this for people you share a crew with. */
export async function getProfile(id) {
  if (demo.on()) return demo.getProfile(id);
  const rows = await rest(`/profiles?id=eq.${id}&select=id,display_name,avatar_emoji`);
  return rows[0] || null;
}

export async function createProfile(displayName, emoji) {
  if (demo.on()) return demo.createProfile(displayName, emoji);
  const uid = currentUser()?.id;
  const rows = await rest('/profiles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: { id: uid, display_name: displayName.trim(), avatar_emoji: emoji }
  });
  return rows[0];
}

export async function updateProfile(patch) {
  if (demo.on()) return demo.updateProfile(patch);
  const uid = currentUser()?.id;
  const rows = await rest(`/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: patch
  });
  return rows[0];
}

/* -------------------------------------------------------------------------
   Crews
   ------------------------------------------------------------------------- */

export async function myCrews() {
  if (demo.on()) return demo.myCrews();
  return rest('/crew_members?select=crew_id,joined_at,crews(*)&order=joined_at.asc');
}

export const createCrew = (name) =>
  demo.on() ? demo.createCrew(name) : rpc('create_crew', { p_name: name });

export const joinCrew = (code) =>
  demo.on() ? demo.joinCrew(code) : rpc('join_crew', { p_code: code });

export const syncCrew = (id) =>
  demo.on() ? demo.syncCrew(id) : rpc('sync_crew', { p_crew: id });

export async function leaveCrew(crewId) {
  if (demo.on()) return demo.leaveCrew();
  const uid = currentUser()?.id;
  await rest(`/crew_members?crew_id=eq.${crewId}&user_id=eq.${uid}`, { method: 'DELETE' });
}

export const leaderboard = (crewId, from, to) =>
  demo.on() ? demo.leaderboard(crewId, from, to)
            : rpc('crew_leaderboard', { p_crew: crewId, p_from: from, p_to: to });

export const trophyCase = (crewId) =>
  demo.on() ? demo.trophyCase(crewId) : rpc('crew_trophy_case', { p_crew: crewId });

export const seasonChampions = (crewId) =>
  demo.on() ? demo.seasonChampions()
            : rest(`/season_champions?crew_id=eq.${crewId}&select=*,profiles(display_name,avatar_emoji)&order=crowned_at.desc`);

/* -------------------------------------------------------------------------
   Exercises  (cached — the catalog barely ever changes)
   ------------------------------------------------------------------------- */

let exerciseCache = null;

export async function exercises() {
  if (demo.on()) return demo.exercises();
  if (exerciseCache) return exerciseCache;
  try {
    exerciseCache = await rest('/exercises?active=eq.true&select=*&order=sort_order.asc');
    localStorage.setItem('repclash.exercises', JSON.stringify(exerciseCache));
  } catch (e) {
    // Offline? Fall back to whatever we saw last time so logging still works.
    const cached = localStorage.getItem('repclash.exercises');
    if (cached) { exerciseCache = JSON.parse(cached); return exerciseCache; }
    throw e;
  }
  return exerciseCache;
}

/* -------------------------------------------------------------------------
   Workouts
   ------------------------------------------------------------------------- */

/** Save a whole session: one workout row plus its entries. */
export async function saveWorkout({ performedOn, note, entries, isPrivate }) {
  if (demo.on()) return demo.saveWorkout({ performedOn, note, entries, isPrivate });
  const uid = currentUser()?.id;
  const rows = await rest('/workouts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      user_id: uid,
      performed_on: performedOn,
      note: note || null,
      is_private: !!isPrivate
    }
  });
  const workout = rows[0];

  try {
    await rest('/workout_entries', {
      method: 'POST',
      body: entries.map(e => ({
        workout_id:   workout.id,
        user_id:      uid,
        exercise_id:  e.exerciseId,
        sets:         e.sets ?? null,
        reps:         e.reps ?? null,
        weight_kg:    e.weightKg ?? null,
        distance_km:  e.distanceKm ?? null,
        duration_min: e.durationMin ?? null
      }))
    });
  } catch (err) {
    // Don't leave a ghost workout with no exercises in it.
    await rest(`/workouts?id=eq.${workout.id}`, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
  return workout;
}

export const myWorkouts = (limit = 40) =>
  demo.on() ? demo.myWorkouts(limit)
            : rest(`/workouts?user_id=eq.${currentUser()?.id}` +
                   `&select=*,workout_entries(*,exercises(name,emoji,kind))` +
                   `&order=performed_on.desc,created_at.desc&limit=${limit}`);

export const deleteWorkout = (id) =>
  demo.on() ? demo.deleteWorkout(id) : rest(`/workouts?id=eq.${id}`, { method: 'DELETE' });

export const setWorkoutPrivacy = (id, isPrivate) =>
  demo.on() ? demo.setWorkoutPrivacy(id, isPrivate)
            : rest(`/workouts?id=eq.${id}`, { method: 'PATCH', body: { is_private: isPrivate } });

/** The crew's workout feed. `before` is the created_at of the oldest row you
    already have — that's how you page backwards. */
export const crewFeed = (crewId, { limit = 25, before = null, userId = null } = {}) =>
  demo.on() ? demo.crewFeed({ limit, before, userId })
            : rpc('crew_feed', {
                p_crew: crewId, p_limit: limit, p_before: before, p_user: userId
              });

export const memberStats = (userId) =>
  demo.on() ? demo.memberStats(userId) : rpc('member_stats', { p_user: userId });

export const scoringRules = () =>
  demo.on() ? demo.scoringRules() : rpc('scoring_rules');

/* -------------------------------------------------------------------------
   Challenges
   ------------------------------------------------------------------------- */

export const currentChallenge = (crewId, weekStart) =>
  demo.on() ? demo.currentChallenge()
            : rest(`/challenges?crew_id=eq.${crewId}&week_start=eq.${weekStart}&select=*`)
                .then(r => r[0] || null);

export const pastChallenges = (crewId, limit = 8) =>
  demo.on() ? demo.pastChallenges()
            : rest(`/challenges?crew_id=eq.${crewId}&settled_at=not.is.null` +
                   `&select=*&order=week_start.desc&limit=${limit}`);

export const challengeStandings = (challengeId) =>
  demo.on() ? demo.challengeStandings(challengeId)
            : rpc('challenge_standings', { p_challenge: challengeId });

/* -------------------------------------------------------------------------
   Season pass
   ------------------------------------------------------------------------- */

export const myPass = (crewId) =>
  demo.on() ? demo.myPass() : rpc('my_pass', { p_crew: crewId });

export const crewPass = (crewId) =>
  demo.on() ? demo.crewPass() : rpc('crew_pass', { p_crew: crewId });

/** Cosmetics go through the server so unlocks can't be faked. */
export async function equip({ avatar, colour, theme, clearColour, clearTheme } = {}) {
  if (demo.on()) return demo.equip({ avatar, colour, theme, clearColour, clearTheme });
  return rpc('equip', {
    p_avatar: avatar ?? null,
    p_colour: colour ?? null,
    p_theme:  theme  ?? null,
    p_clear_colour: !!clearColour,
    p_clear_theme:  !!clearTheme
  });
}

/* -------------------------------------------------------------------------
   Feedback
   ------------------------------------------------------------------------- */

export async function sendFeedback(crewId, kind, body) {
  if (demo.on()) return demo.sendFeedback(crewId, kind, body);
  await rest('/feedback', {
    method: 'POST',
    body: { user_id: currentUser()?.id, crew_id: crewId, kind, body: body.trim() }
  });
}

export const myFeedback = (crewId) =>
  demo.on() ? demo.myFeedback() : rpc('my_feedback', { p_crew: crewId });

export const crewFeedback = (crewId) =>
  demo.on() ? demo.crewFeedback() : rpc('crew_feedback', { p_crew: crewId });

export const feedbackUnread = (crewId) =>
  demo.on() ? demo.feedbackUnread() : rpc('feedback_unread', { p_crew: crewId });

export async function updateFeedback(id, patch) {
  if (demo.on()) return demo.updateFeedback(id, patch);
  await rest(`/feedback?id=eq.${id}`, { method: 'PATCH', body: patch });
}

/* Points preview for one entry, without a round trip. Mirrors the
   entry_effort() function in the database — kept in sync by
   supabase/01_schema.sql, which is the authority. */
export function previewEffort(ex, v) {
  if (!ex) return 0;
  const ppu = Number(ex.points_per_unit);
  switch (ex.kind) {
    case 'strength': {
      const units = (v.sets || 1) * (v.reps || 0);
      const load  = Math.min(1 + (v.weightKg || 0) / 60, 3);
      return Math.max(0, Math.round(ppu * units * load));
    }
    case 'bodyweight':
      return Math.max(0, Math.round(ppu * (v.sets || 1) * (v.reps || 0)));
    case 'distance':
      return Math.max(0, Math.round(ppu * (v.distanceKm || 0)));
    case 'timed':
      return Math.max(0, Math.round(ppu * (v.durationMin || 0)));
    default:
      return 0;
  }
}

export { ApiError };
