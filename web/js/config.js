/* ==========================================================================
   Where RepClash finds its database.

   Two ways to set this, and you only need one:

   A) Paste your Supabase details into BAKED below and redeploy. Everyone who
      installs the app is then connected automatically. This is what you want
      once you're happy with it.

   B) Leave it blank and the app shows a one-off setup screen where you paste
      the two values in. They're saved in the browser only. Handy for testing.

   Is it safe to commit these to a public repo? Yes. The "anon key" is designed
   to be public — it identifies your project, it doesn't grant access. Every
   table is locked down by Row Level Security, so the key alone lets someone do
   precisely nothing. Never put the *service_role* key here; that one is a
   master key and must stay secret.
   ========================================================================== */

const BAKED = {
  url:     'https://hidinflomxilctxehxtn.supabase.co',   // e.g. 'https://abcdefghijkl.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZGluZmxvbXhpbGN0eGVoeHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNzc0MzgsImV4cCI6MjEwMTc1MzQzOH0.8MCa7qUvOtbqgb5Phi5KeWnnxPccnpeM694DOQE1Etw'    // the long "anon public" key from Supabase → Settings → API
};

const LS_KEY = 'repclash.config';

export function getConfig() {
  if (BAKED.url && BAKED.anonKey) return { ...BAKED, source: 'baked' };
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved?.url && saved?.anonKey) return { ...saved, source: 'local' };
  } catch { /* corrupt entry — fall through to unconfigured */ }
  return null;
}

export function saveConfig(url, anonKey) {
  const clean = {
    url: String(url).trim().replace(/\/+$/, ''),
    anonKey: String(anonKey).trim()
  };
  if (!/^https:\/\/.+\.supabase\.(co|in)$/.test(clean.url)) {
    throw new Error('That doesn\'t look like a Supabase project URL. It should look like https://yourproject.supabase.co');
  }
  if (clean.anonKey.length < 40) {
    throw new Error('That anon key looks too short — copy the whole thing.');
  }
  localStorage.setItem(LS_KEY, JSON.stringify(clean));
  return clean;
}

export function clearConfig() {
  localStorage.removeItem(LS_KEY);
}

/* The crew you're currently looking at, remembered between visits. */
export const activeCrew = {
  get()      { return localStorage.getItem('repclash.crew') || null; },
  set(id)    { id ? localStorage.setItem('repclash.crew', id)
                  : localStorage.removeItem('repclash.crew'); }
};
