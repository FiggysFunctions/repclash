/* ==========================================================================
   The Season Pass — a 30-tier cosmetic track that runs with the season.

   Rewards are deliberately cosmetic. Nothing here touches scoring, so someone
   joining in week six isn't playing a game they've already lost.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, plural, sheet, toastOk, toastBad, applyTheme
} from '../ui.js';

export const THEMES = {
  blood:    { name: 'Blood',    em: '🩸', desc: 'Crimson and bone' },
  terminal: { name: 'Terminal', em: '🖥️', desc: 'Phosphor green on black' }
};

export const COLOURS = {
  ember:   { name: 'Ember',   desc: 'Molten orange' },
  volt:    { name: 'Volt',    desc: 'Electric lime' },
  shimmer: { name: 'Shimmer', desc: 'Moving gradient. Tier 29.' }
};

/** Name with its unlocked colour treatment applied. Safe for innerHTML. */
export function name(displayName, colour) {
  const cls = COLOURS[colour] ? ` class="nm nm-${colour}"` : '';
  return `<span${cls}>${esc(displayName)}</span>`;
}

export const tierChip = (tier) =>
  tier > 1 ? `<span class="tier-chip">${tier}</span>` : '';

/* -------------------------------------------------------------------------
   The card that sits at the top of the Me tab
   ------------------------------------------------------------------------- */
export function progressCard(pass) {
  const cur  = pass.tiers.find(t => t.tier === pass.tier);
  const next = pass.tiers.find(t => t.tier === pass.tier + 1);

  const floorXp = cur?.xp_required ?? 0;
  const span    = next ? next.xp_required - floorXp : 1;
  const into    = Math.max(0, pass.xp - floorXp);
  const pct     = next ? Math.min(100, (into / span) * 100) : 100;

  return `
    <button class="passcard" id="passcard">
      <div class="passcard-top">
        <div>
          <div class="hero-l">${esc(pass.season_name)} Pass</div>
          <div class="passcard-tier">Tier ${pass.tier}<span>/${pass.max_tier}</span></div>
        </div>
        <div class="passcard-xp">
          <b>${num(pass.xp)}</b>
          <span>XP</span>
        </div>
      </div>

      <div class="prog" style="margin-top:12px">
        <div class="prog-head">
          <span>${next ? `Next: ${esc(next.reward_label)}` : 'Everything unlocked 🎉'}</span>
          <span>${next ? `${num(next.xp_required - pass.xp)} XP to go` : ''}</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      </div>

      <div class="passcard-foot">
        ${pass.days_left > 0
          ? `${plural(pass.days_left, 'day')} left in the season`
          : 'Season over — a new one starts on next load'}
        · tap to see the ladder
      </div>
    </button>`;
}

/* -------------------------------------------------------------------------
   The full ladder
   ------------------------------------------------------------------------- */
export function openPass(ctx, pass, onChange) {
  const s = sheet(`
    <div class="center" style="padding-bottom:12px">
      <div style="font-size:2.4rem">🎖️</div>
      <h2 style="margin:6px 0 2px">${esc(pass.season_name)} Pass</h2>
      <p class="sub" style="margin:0">
        Tier ${pass.tier} of ${pass.max_tier} · ${num(pass.xp)} XP
      </p>
    </div>

    <button class="btn btn-primary" data-customise>🎨 Customise your look</button>

    <div class="card mt">
      <h3>How you earn XP</h3>
      <div class="kv"><span>Any day you train</span><b>+100</b></div>
      <div class="kv"><span>Hitting your weekly target</span><b>+150</b></div>
      <div class="kv"><span>Winning a weekly challenge</span><b>+250</b></div>
      <p class="hint" style="margin:10px 0 0">
        One lot of day XP per day, no matter how big the session — same idea as
        the scoring. Turning up four times beats one heroic Sunday. Joining
        late? You're credited for the weeks that had already gone.
      </p>
    </div>

    <div class="section-title">The ladder</div>
    <div id="ladder">${pass.tiers.map(t => tierRow(t, pass.tier)).join('')}</div>
  `);

  $('[data-customise]', s.el).addEventListener('click', () => {
    s.close();
    openCosmetics(ctx, pass, onChange);
  });

  // Drop the reader at their current position rather than the very top.
  const here = $(`[data-tier="${pass.tier}"]`, s.el);
  if (here) setTimeout(() => here.scrollIntoView({ block: 'center' }), 80);
}

function tierRow(t, myTier) {
  const done    = t.tier <= myTier;
  const current = t.tier === myTier;
  const icon = t.reward_kind === 'avatar' ? t.reward_value
             : t.reward_kind === 'theme'  ? (THEMES[t.reward_value]?.em || '🎨')
             : t.reward_kind === 'title'  ? '🎖️'
             : t.reward_kind === 'colour' ? '🖍️'
             : '🚩';

  return `
    <div class="tier ${done ? 'tier-done' : ''} ${current ? 'tier-now' : ''}"
         data-tier="${t.tier}">
      <div class="tier-n">${t.tier}</div>
      <div class="tier-icon ${done ? '' : 'tier-locked'}">${done ? icon : '🔒'}</div>
      <div class="row-main">
        <div class="tier-label">${esc(t.reward_label || '—')}</div>
        <div class="tier-xp">${num(t.xp_required)} XP</div>
      </div>
      ${current ? '<div class="tier-here">YOU</div>' : ''}
    </div>`;
}

/* -------------------------------------------------------------------------
   Equipping what you've unlocked
   ------------------------------------------------------------------------- */
export function openCosmetics(ctx, pass, onChange) {
  const unlocked = (kind) => pass.tiers.filter(t => t.reward_kind === kind && t.unlocked);
  const locked   = (kind) => pass.tiers.filter(t => t.reward_kind === kind && !t.unlocked);

  const avatars = [
    ...pass.starter_avatars.map(a => ({ value: a, unlocked: true, tier: null })),
    ...pass.tiers.filter(t => t.reward_kind === 'avatar')
                 .map(t => ({ value: t.reward_value, unlocked: t.unlocked, tier: t.tier }))
  ];

  const s = sheet(`
    <h2>Customise</h2>
    <p class="sub">Everything here is earned through the pass. Locked things
      show the tier they come from.</p>

    <div class="section-title" style="margin-top:8px">Avatar</div>
    <div class="ach-grid" style="grid-template-columns:repeat(auto-fill,minmax(52px,1fr))">
      ${avatars.map(a => `
        <button class="ach ${a.value === ctx.profile.avatar_emoji ? 'got' : ''}
                     ${a.unlocked ? '' : 'ach-locked'}"
                data-av="${esc(a.value)}" ${a.unlocked ? '' : 'disabled'}
                style="padding:9px 2px" aria-label="Avatar ${esc(a.value)}">
          <div class="ach-em">${a.unlocked ? esc(a.value) : '🔒'}</div>
          ${a.tier && !a.unlocked ? `<div class="ach-d">T${a.tier}</div>` : ''}
        </button>`).join('')}
    </div>

    <div class="section-title">Name colour</div>
    <div id="colours">
      ${swatch({ value: null, label: 'Default', unlocked: true },
               !ctx.profile.equipped_colour)}
      ${unlocked('colour').map(t => swatch({
          value: t.reward_value,
          label: COLOURS[t.reward_value]?.name || t.reward_value,
          desc: COLOURS[t.reward_value]?.desc,
          unlocked: true
        }, ctx.profile.equipped_colour === t.reward_value)).join('')}
      ${locked('colour').map(t => swatch({
          value: t.reward_value,
          label: COLOURS[t.reward_value]?.name || t.reward_value,
          desc: `Unlocks at tier ${t.tier}`,
          unlocked: false
        }, false)).join('')}
    </div>

    <div class="section-title">App theme</div>
    <div id="themes">
      ${themeRow({ value: null, name: 'Flame', em: '🔥', desc: 'The original' },
                 !ctx.profile.equipped_theme, true)}
      ${pass.tiers.filter(t => t.reward_kind === 'theme').map(t => themeRow({
          value: t.reward_value,
          name: THEMES[t.reward_value]?.name || t.reward_value,
          em:   THEMES[t.reward_value]?.em   || '🎨',
          desc: t.unlocked ? (THEMES[t.reward_value]?.desc || '') : `Unlocks at tier ${t.tier}`
        }, ctx.profile.equipped_theme === t.reward_value, t.unlocked)).join('')}
    </div>
  `);

  const save = async (patch, okMsg) => {
    try {
      const updated = await api.equip(patch);
      Object.assign(ctx.profile, updated);
      applyTheme(ctx.profile.equipped_theme);
      toastOk(okMsg);
      s.close();
      onChange?.();
    } catch (e) { toastBad(e.message); }
  };

  s.el.querySelectorAll('[data-av]').forEach(b =>
    b.addEventListener('click', () => save({ avatar: b.dataset.av }, 'Avatar changed')));

  s.el.querySelectorAll('[data-colour]').forEach(b =>
    b.addEventListener('click', () => {
      const v = b.dataset.colour;
      save(v ? { colour: v } : { clearColour: true }, 'Name colour changed');
    }));

  s.el.querySelectorAll('[data-theme]').forEach(b =>
    b.addEventListener('click', () => {
      const v = b.dataset.theme;
      save(v ? { theme: v } : { clearTheme: true }, 'Theme changed');
    }));
}

function swatch(c, active) {
  return `
    <button class="row ${active ? 'row-me' : ''} ${c.unlocked ? '' : 'row-locked'}"
            style="width:100%;text-align:left"
            ${c.unlocked ? `data-colour="${c.value ?? ''}"` : 'disabled'}>
      <div class="row-av">${c.unlocked ? '🖍️' : '🔒'}</div>
      <div class="row-main">
        <div class="row-name">
          ${c.value ? `<span class="nm nm-${esc(c.value)}">${esc(c.label)}</span>`
                    : esc(c.label)}
        </div>
        ${c.desc ? `<div class="row-sub">${esc(c.desc)}</div>` : ''}
      </div>
      ${active ? '<div style="color:var(--volt)">✓</div>' : ''}
    </button>`;
}

function themeRow(t, active, unlocked) {
  return `
    <button class="row ${active ? 'row-me' : ''} ${unlocked ? '' : 'row-locked'}"
            style="width:100%;text-align:left"
            ${unlocked ? `data-theme="${t.value ?? ''}"` : 'disabled'}>
      <div class="row-av">${unlocked ? t.em : '🔒'}</div>
      <div class="row-main">
        <div class="row-name">${esc(t.name)}</div>
        <div class="row-sub">${esc(t.desc || '')}</div>
      </div>
      ${active ? '<div style="color:var(--volt)">✓</div>' : ''}
    </button>`;
}
