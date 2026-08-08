/* ==========================================================================
   Everything before you reach the leaderboard: connect the database, sign in,
   pick a name, join a crew.
   ========================================================================== */

import * as api from '../api.js';
import { saveConfig, activeCrew } from '../config.js';
import { $, esc, toastOk, toastBad, randomAvatar, STARTER_AVATARS } from '../ui.js';

/* -------------------------------------------------------------------------
   1. Connect to Supabase (only shown if config.js hasn't been filled in)
   ------------------------------------------------------------------------- */
export function renderSetup(root, next) {
  root.innerHTML = `
    <div class="view">
      <div class="center" style="padding:26px 0 20px">
        <div style="font-size:3rem">🔥</div>
        <h1 style="margin:8px 0 4px;font-size:1.7rem;font-weight:850">RepClash</h1>
        <p class="muted" style="margin:0;font-size:.9rem">One-time setup</p>
      </div>

      <div class="card">
        <h3>Connect your database</h3>
        <p class="hint" style="margin:0 0 14px">
          In Supabase, open your project and go to
          <b>Settings → API Keys</b>. Copy the two values below.
          They're safe to share with your friends — the database is locked down
          separately.
        </p>
        <div id="err"></div>
        <div class="field">
          <label for="url">Project URL</label>
          <input class="input" id="url" type="url" inputmode="url"
                 autocapitalize="off" autocorrect="off" spellcheck="false"
                 placeholder="https://yourproject.supabase.co">
        </div>
        <div class="field">
          <label for="key">Anon public key</label>
          <textarea class="input" id="key" rows="3"
                    autocapitalize="off" autocorrect="off" spellcheck="false"
                    placeholder="eyJhbGciOi..."></textarea>
          <p class="hint">This is the key labelled <b>anon</b> / <b>publishable</b>.
             Never paste the <b>service_role</b> / secret key here.</p>
        </div>
        <button class="btn btn-primary" id="go">Connect</button>
      </div>

      <p class="center muted" style="font-size:.8rem;margin:18px 0 10px">or</p>

      <div class="card">
        <h3>Just have a look first</h3>
        <p class="hint" style="margin:0 0 12px">
          Opens the full app with a fake crew and two months of sample history.
          Runs entirely on this device — no account, nothing saved anywhere else.
        </p>
        <button class="btn" id="demo">🎮 Try the demo</button>
      </div>
    </div>`;

  $('#demo', root).addEventListener('click', () => { api.startDemo(); next(); });

  $('#go', root).addEventListener('click', () => {
    const err = $('#err', root);
    err.innerHTML = '';
    try {
      saveConfig($('#url', root).value, $('#key', root).value);
      next();
    } catch (e) {
      err.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  });
}

/* -------------------------------------------------------------------------
   2. Sign in / sign up
   ------------------------------------------------------------------------- */
export function renderAuth(root, next) {
  let mode = 'in';

  const draw = () => {
    const signup = mode === 'up';
    root.innerHTML = `
      <div class="view">
        <div class="center" style="padding:34px 0 24px">
          <div style="font-size:3.4rem">🔥</div>
          <h1 style="margin:10px 0 4px;font-size:2rem;font-weight:880;letter-spacing:-.03em">RepClash</h1>
          <p class="muted" style="margin:0">Your mates. Your gym. One league.</p>
        </div>

        <div class="seg">
          <button data-mode="in" class="${signup ? '' : 'on'}">Sign in</button>
          <button data-mode="up" class="${signup ? 'on' : ''}">Create account</button>
        </div>

        <div class="card">
          <div id="err"></div>
          <div class="field">
            <label for="email">Email</label>
            <input class="input" id="email" type="email" inputmode="email"
                   autocomplete="email" autocapitalize="off" autocorrect="off"
                   spellcheck="false" placeholder="you@example.com">
          </div>
          <div class="field">
            <label for="pw">Password</label>
            <input class="input" id="pw" type="password"
                   autocomplete="${signup ? 'new-password' : 'current-password'}"
                   placeholder="${signup ? 'At least 6 characters' : '••••••••'}">
          </div>
          <button class="btn btn-primary" id="go">
            ${signup ? 'Create my account' : 'Sign in'}
          </button>
        </div>

        <p class="hint center" style="padding:0 12px">
          Your email is only ever used to sign you in. No newsletters, no
          notifications, nobody sells anything.
        </p>
      </div>`;

    root.querySelectorAll('[data-mode]').forEach(b =>
      b.addEventListener('click', () => { mode = b.dataset.mode; draw(); }));

    const submit = async () => {
      const btn = $('#go', root);
      const err = $('#err', root);
      const email = $('#email', root).value.trim();
      const pw = $('#pw', root).value;
      err.innerHTML = '';

      if (!email || !pw) {
        err.innerHTML = '<div class="err">Fill in both fields.</div>';
        return;
      }
      btn.disabled = true;
      btn.textContent = signup ? 'Creating…' : 'Signing in…';
      try {
        if (signup) {
          const straightIn = await api.signUp(email, pw);
          if (!straightIn) {
            err.innerHTML = `<div class="err">Account created — but this project
              requires email confirmation. Check your inbox, or turn confirmation
              off in Supabase → Authentication → Sign In / Providers → Email.</div>`;
            btn.disabled = false;
            btn.textContent = 'Create my account';
            return;
          }
        } else {
          await api.signIn(email, pw);
        }
        next();
      } catch (e) {
        err.innerHTML = `<div class="err">${esc(e.message)}</div>`;
        btn.disabled = false;
        btn.textContent = signup ? 'Create my account' : 'Sign in';
      }
    };

    $('#go', root).addEventListener('click', submit);
    $('#pw', root).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  };

  draw();
}

/* -------------------------------------------------------------------------
   3. Pick a display name and an avatar
   ------------------------------------------------------------------------- */
export function renderProfileSetup(root, next) {
  let picked = randomAvatar();

  const draw = () => {
    root.innerHTML = `
      <div class="view">
        <div class="center" style="padding:30px 0 18px">
          <div style="font-size:3.2rem">${picked}</div>
          <h1 style="margin:10px 0 4px;font-size:1.6rem;font-weight:850">Who are you?</h1>
          <p class="muted" style="margin:0;font-size:.9rem">This is the name on the leaderboard.</p>
        </div>

        <div class="card">
          <div id="err"></div>
          <div class="field">
            <label for="name">Display name</label>
            <input class="input" id="name" maxlength="24" autocomplete="nickname"
                   placeholder="Liam">
          </div>
          <label style="display:block;margin-bottom:6px;font-size:.74rem;font-weight:800;
                        letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint)">
            Avatar
          </label>
          <div class="ach-grid" id="avs" style="grid-template-columns:repeat(auto-fill,minmax(52px,1fr))">
            ${STARTER_AVATARS.map(a => `
              <button class="ach ${a === picked ? 'got' : ''}" data-av="${a}"
                      style="padding:9px 2px" aria-label="Choose ${a}">
                <div class="ach-em">${a}</div>
              </button>`).join('')}
          </div>
          <button class="btn btn-primary mt" id="go">Let's go</button>
        </div>
      </div>`;

    root.querySelectorAll('[data-av]').forEach(b =>
      b.addEventListener('click', () => {
        picked = b.dataset.av;
        const name = $('#name', root).value;
        draw();
        $('#name', root).value = name;
      }));

    $('#go', root).addEventListener('click', async () => {
      const btn = $('#go', root);
      const err = $('#err', root);
      const name = $('#name', root).value.trim();
      err.innerHTML = '';

      if (name.length < 2) {
        err.innerHTML = '<div class="err">Give yourself a name of at least 2 characters.</div>';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await api.createProfile(name, picked);
        next();
      } catch (e) {
        err.innerHTML = `<div class="err">${esc(e.message)}</div>`;
        btn.disabled = false;
        btn.textContent = "Let's go";
      }
    });
  };

  draw();
}

/* -------------------------------------------------------------------------
   4. Create or join a crew
   ------------------------------------------------------------------------- */
export function renderCrewSetup(root, next, { canCancel = false } = {}) {
  root.innerHTML = `
    <div class="view">
      <div class="center" style="padding:26px 0 18px">
        <div style="font-size:3rem">🤝</div>
        <h1 style="margin:10px 0 4px;font-size:1.6rem;font-weight:850">Find your crew</h1>
        <p class="muted" style="margin:0;font-size:.9rem">
          A crew is your private league. Only people with the code can see it.
        </p>
      </div>

      <div id="err"></div>

      <div class="card">
        <h3>Join with a code</h3>
        <div class="field">
          <input class="input input-code" id="code" maxlength="6" placeholder="ABC123"
                 autocapitalize="characters" autocorrect="off" spellcheck="false">
        </div>
        <button class="btn btn-primary" id="join">Join crew</button>
      </div>

      <p class="center muted" style="font-size:.8rem;margin:16px 0">or</p>

      <div class="card">
        <h3>Start a new one</h3>
        <div class="field">
          <input class="input" id="name" maxlength="40" placeholder="Crew name — e.g. Sunday Sufferers">
        </div>
        <button class="btn" id="create">Create crew</button>
        <p class="hint">You'll get a 6-character code to send your mates.</p>
      </div>

      ${canCancel ? '<button class="btn btn-ghost mt" id="cancel">Back</button>' : ''}
    </div>`;

  const err = $('#err', root);
  const fail = (m) => { err.innerHTML = `<div class="err">${esc(m)}</div>`; };

  $('#code', root).addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  $('#join', root).addEventListener('click', async () => {
    const btn = $('#join', root);
    const code = $('#code', root).value.trim();
    err.innerHTML = '';
    if (code.length !== 6) return fail('Join codes are 6 characters.');

    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const crew = await api.joinCrew(code);
      activeCrew.set(crew.id);
      toastOk(`You're in — ${crew.name}`);
      next();
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'Join crew';
    }
  });

  $('#create', root).addEventListener('click', async () => {
    const btn = $('#create', root);
    const name = $('#name', root).value.trim();
    err.innerHTML = '';
    if (name.length < 2) return fail('Give the crew a name.');

    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const crew = await api.createCrew(name);
      activeCrew.set(crew.id);
      showCodeThen(root, crew, next);
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'Create crew';
    }
  });

  if (canCancel) $('#cancel', root).addEventListener('click', () => next());
}

/** Celebration screen with the shiny new join code. */
function showCodeThen(root, crew, next) {
  root.innerHTML = `
    <div class="view center" style="padding-top:40px">
      <div style="font-size:3.4rem">🎉</div>
      <h1 style="margin:12px 0 4px;font-size:1.6rem;font-weight:850">${esc(crew.name)} is live</h1>
      <p class="muted" style="margin:0 0 22px">Send this code to your mates.</p>
      <div class="code-box">${esc(crew.join_code)}</div>
      <div class="btn-row">
        <button class="btn" id="copy">Copy code</button>
        <button class="btn" id="share">Share</button>
      </div>
      <button class="btn btn-primary mt" id="done">Start logging</button>
    </div>`;

  const msg = `Join my RepClash crew "${crew.name}" — code ${crew.join_code}\n${location.origin}${location.pathname}`;

  $('#copy', root).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(crew.join_code); toastOk('Code copied'); }
    catch { toastBad('Copy failed — the code is ' + crew.join_code); }
  });

  $('#share', root).addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'RepClash', text: msg }); } catch { /* dismissed */ }
    } else {
      try { await navigator.clipboard.writeText(msg); toastOk('Invite copied'); }
      catch { toastBad('Copy failed'); }
    }
  });

  $('#done', root).addEventListener('click', () => next());
}
