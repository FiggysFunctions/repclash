?/* ==========================================================================
   Service worker — makes RepClash installable and usable with a bad signal.

   Strategy:
     • Code (HTML/CSS/JS) → network first, with the cache as a fallback.
       You get updates the moment they're deployed, and the app still opens
       on the Underground.
     • Icons and the manifest → cache first. They never really change.
     • Supabase API calls → never touched. A stale leaderboard is worse than
       an honest error.

   CACHE is bumped automatically by scripts/deploy.ps1 on every deploy, which
   evicts the old copies on everyone's phone.
   ========================================================================== */

const CACHE = 'repclash-v4';

/* How long to wait for the network before falling back to cache. Long enough
   for a bad 4G signal, short enough that it never feels broken. */
const NET_TIMEOUT = 4000;

const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/api.js',
  './js/ui.js',
  './js/config.js',
  './js/demo.js',
  './js/changelog.js',
  './js/views/onboarding.js',
  './js/views/leaderboard.js',
  './js/views/log.js',
  './js/views/challenges.js',
  './js/views/profile.js',
  './js/views/feedback.js',
  './js/views/whatsnew.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll fails the whole install if one file 404s, so add individually.
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (path) => /\.(png|svg|ico|webmanifest)$/i.test(path);

async function keep(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const c = await caches.open(CACHE);
    await c.put(req, res.clone());
  }
  return res;
}

/** Network, but never hang: if it's slow, serve the cached copy instead. */
async function networkFirst(req) {
  const cached = await caches.match(req);

  try {
    const res = await Promise.race([
      fetch(req).then(r => keep(req, r)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('slow')), NET_TIMEOUT))
    ]);
    return res;
  } catch {
    if (cached) return cached;
    // Nothing cached and no network: for a page request, at least show the app
    // shell so the user sees RepClash rather than a browser error page.
    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw new Error('offline');
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  return keep(req, res);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Anything that isn't our own origin (i.e. Supabase) goes straight to network.
  if (url.origin !== self.location.origin) return;

  e.respondWith(isStatic(url.pathname) ? cacheFirst(req) : networkFirst(req));
});
