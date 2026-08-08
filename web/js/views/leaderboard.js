/* ==========================================================================
   The leaderboard — the reason the app exists.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, ordinal, plural, toastOk, toastBad, todayISO, weekStart,
  fmtDate, MEDALS, sheet, live
} from '../ui.js';
import { activeCrew } from '../config.js';
import { hasUnread } from '../changelog.js';
import { openWhatsNew } from './whatsnew.js';

const RANGES = {
  week:   { label: 'This week' },
  season: { label: 'Season' },
  all:    { label: 'All time' }
};

let range = localStorage.getItem('repclash.range') || 'week';

function rangeDates(crew) {
  const today = todayISO();
  if (range === 'week')   return [weekStart(today), today];
  if (range === 'season') return [crew.season_starts, crew.season_ends];
  return ['2000-01-01', today];
}

export async function render(root, ctx) {
  const { crew, profile, rules } = ctx;

  root.innerHTML = `
    <div class="view">
      ${header(crew)}
      <div class="seg" id="seg">
        ${Object.entries(RANGES).map(([k, v]) =>
          `<button data-r="${k}" class="${k === range ? 'on' : ''}">${v.label}</button>`).join('')}
      </div>
      <div id="body">
        <div class="skel" style="height:104px"></div>
        <div class="skel"></div><div class="skel"></div><div class="skel"></div>
      </div>
    </div>`;

  wireHeader(root, ctx);

  root.querySelectorAll('[data-r]').forEach(b =>
    b.addEventListener('click', () => {
      range = b.dataset.r;
      localStorage.setItem('repclash.range', range);
      render(root, ctx);
    }));

  const [from, to] = rangeDates(crew);
  const body = $('#body', root);
  let board;
  try {
    board = await api.leaderboard(crew.id, from, to);
    if (!live(body)) return;          // a newer render already took over
  } catch (e) {
    if (!live(body)) return;
    body.innerHTML = `<div class="err">${esc(e.message)}</div>
      <button class="btn mt" id="retry">Try again</button>`;
    $('#retry', root)?.addEventListener('click', () => render(root, ctx));
    return;
  }

  const me = board.find(r => r.user_id === profile.id);
  const myRank = board.findIndex(r => r.user_id === profile.id) + 1;
  const top3 = board.slice(0, 3);
  const rest = board.length > 3 ? board.slice(3) : [];

  const anyPoints = board.some(r => r.points > 0);

  body.innerHTML = `
    ${heroCard(me, myRank, board.length, rules, crew)}
    ${anyPoints && board.length >= 3 ? podium(top3) : ''}
    ${!anyPoints ? emptyBoard() : ''}
    ${anyPoints ? rowsHtml(board.length >= 3 ? rest : board,
                           board.length >= 3 ? 4 : 1, profile.id) : ''}
    ${board.length === 1 ? soloNudge(crew) : ''}
    <p class="hint center mt">
      ${range === 'season'
        ? `${esc(crew.season_name)} · ${fmtDate(crew.season_starts)} – ${fmtDate(crew.season_ends)}`
        : range === 'week'
          ? `Week of ${fmtDate(from)}`
          : 'Every point ever scored'}
    </p>`;

  root.querySelectorAll('[data-member]').forEach(el =>
    el.addEventListener('click', () => memberSheet(el.dataset.member, board, ctx)));

  $('#invite', root)?.addEventListener('click', () => inviteSheet(crew));
}

/* ------------------------------------------------------------------------- */

function header(crew) {
  return `
    <div class="hdr">
      <div class="hdr-txt">
        <h1>${esc(crew.name)}</h1>
        <p>${esc(crew.season_name)} · code <b>${esc(crew.join_code)}</b></p>
      </div>
      <button class="icon-btn ${hasUnread() ? 'has-dot' : ''}" id="news"
              title="What's new" aria-label="What's new">✨</button>
      <button class="icon-btn" id="invite" title="Invite" aria-label="Invite friends">👥</button>
      <button class="icon-btn" id="switch" title="Switch crew" aria-label="Switch crew">⇄</button>
    </div>`;
}

function wireHeader(root, ctx) {
  $('#switch', root)?.addEventListener('click', () => crewSwitcher(ctx));
  $('#news', root)?.addEventListener('click', () => openWhatsNew());
}

function heroCard(me, rank, total, rules, crew) {
  const pts = me?.points || 0;
  const streak = me?.current_streak || 0;
  const active = me?.active_days || 0;
  const target = rules.weekly_target;

  return `
    <div class="hero">
      <div class="hero-top">
        <div>
          <div class="hero-l">Your points</div>
          <div class="hero-n">${num(pts)}</div>
        </div>
        <div class="hero-rank">
          <b>${rank > 0 ? ordinal(rank) : '–'}</b>
          <span>of ${total}</span>
        </div>
      </div>

      ${streak > 0 ? `
        <div class="chal-prize" style="margin-top:13px">
          🔥 ${plural(streak, 'day')} streak
          ${streak >= 10 ? '· bonus maxed' : `· +${streak * rules.streak_step}/day`}
        </div>` : ''}

      <div class="prog">
        <div class="prog-head">
          <span>Weekly target</span>
          <span>${Math.min(active, target)} / ${target} days${active >= target ? ` · +${num(rules.weekly_bonus)} 🎉` : ''}</span>
        </div>
        <div class="prog-bar">
          <div class="prog-fill" style="width:${Math.min(100, (active / target) * 100)}%"></div>
        </div>
      </div>
    </div>`;
}

function podium(top3) {
  // Visual order is 2nd, 1st, 3rd.
  const order = [top3[1], top3[0], top3[2]];
  const cls   = ['pod-2', 'pod-1', 'pod-3'];
  const place = [2, 1, 3];

  return `<div class="podium">
    ${order.map((p, i) => !p ? '<div></div>' : `
      <div class="pod ${cls[i]}" data-member="${esc(p.user_id)}">
        ${place[i] === 1 ? '<div class="pod-crown">👑</div>' : ''}
        <div class="pod-av">${esc(p.avatar_emoji)}</div>
        <div class="pod-name">${esc(p.display_name)}</div>
        <div class="pod-pts">${num(p.points)}</div>
        <div class="pod-block">${MEDALS[place[i] - 1]}</div>
      </div>`).join('')}
  </div>`;
}

function rowsHtml(rows, startRank, myId) {
  if (!rows.length) return '';
  return rows.map((r, i) => {
    const rank = startRank + i;
    return `
      <div class="row ${r.user_id === myId ? 'row-me' : ''}" data-member="${esc(r.user_id)}">
        <div class="row-rank">${rank}</div>
        <div class="row-av">${esc(r.avatar_emoji)}</div>
        <div class="row-main">
          <div class="row-name">${esc(r.display_name)}
            ${r.title_count > 0 ? `<span class="badge-mini">🏆 ${r.title_count}</span>` : ''}
          </div>
          <div class="row-sub">
            ${plural(r.active_days, 'day')} active
            ${r.current_streak > 1 ? ` · 🔥${r.current_streak}` : ''}
          </div>
        </div>
        <div class="row-pts">${num(r.points)}<span>pts</span></div>
      </div>`;
  }).join('');
}

function emptyBoard() {
  return `
    <div class="empty">
      <div class="empty-em">🥱</div>
      <p><b>Nothing on the board yet.</b></p>
      <p>Be the first to log something and take the lead.</p>
    </div>`;
}

function soloNudge(crew) {
  return `
    <div class="card center mt">
      <p style="margin:0 0 4px"><b>It's a bit quiet in here.</b></p>
      <p class="hint" style="margin:0 0 12px">
        A leaderboard of one isn't much of a competition.
      </p>
      <div class="code-box" style="font-size:1.4rem">${esc(crew.join_code)}</div>
      <button class="btn btn-sm" id="invite">Send an invite</button>
    </div>`;
}

/* ------------------------------------------------------------------------- */

function inviteSheet(crew) {
  const link = `${location.origin}${location.pathname}`;
  const msg  = `Join my RepClash crew "${crew.name}" — code ${crew.join_code}\n${link}`;

  const s = sheet(`
    <h2>Invite to ${esc(crew.name)}</h2>
    <p class="sub">Anyone with this code can join and appear on the leaderboard.</p>
    <div class="code-box">${esc(crew.join_code)}</div>
    <button class="btn btn-primary" data-share>Share invite</button>
    <button class="btn mt" data-copy>Copy code</button>
    <p class="hint center mt">
      They open the link, create an account, and enter the code. That's it.
    </p>
  `);

  $('[data-copy]', s.el).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(crew.join_code); toastOk('Code copied'); }
    catch { toastBad('Copy failed'); }
  });
  $('[data-share]', s.el).addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'RepClash', text: msg }); } catch { /* dismissed */ }
    } else {
      try { await navigator.clipboard.writeText(msg); toastOk('Invite copied'); }
      catch { toastBad('Copy failed'); }
    }
  });
}

async function crewSwitcher(ctx) {
  const s = sheet(`
    <h2>Your crews</h2>
    <p class="sub">You can be in as many as you like.</p>
    <div id="crews"><div class="skel" style="height:56px"></div></div>
    <button class="btn btn-primary mt" data-new>Join or create another</button>
  `);

  $('[data-new]', s.el).addEventListener('click', () => { s.close(); ctx.goCrewSetup(); });

  const rows = await api.myCrews();
  $('#crews', s.el).innerHTML = rows.map(r => `
    <div class="row ${r.crew_id === ctx.crew.id ? 'row-me' : ''}" data-crew="${esc(r.crew_id)}">
      <div class="row-av">${r.crew_id === ctx.crew.id ? '✅' : '🏋️'}</div>
      <div class="row-main">
        <div class="row-name">${esc(r.crews.name)}</div>
        <div class="row-sub">Code ${esc(r.crews.join_code)}</div>
      </div>
    </div>`).join('');

  s.el.querySelectorAll('[data-crew]').forEach(el =>
    el.addEventListener('click', () => {
      activeCrew.set(el.dataset.crew);
      s.close();
      ctx.reload();
    }));
}

/* A tap on any leaderboard row opens this. */
async function memberSheet(userId, board, ctx) {
  const row = board.find(r => r.user_id === userId);
  if (!row) return;
  const isMe = userId === ctx.profile.id;

  const s = sheet(`
    <div class="center" style="padding:4px 0 10px">
      <div style="font-size:3rem">${esc(row.avatar_emoji)}</div>
      <h2 style="margin:8px 0 2px">${esc(row.display_name)}</h2>
      <p class="sub" style="margin:0">${num(row.points)} points ${RANGES[range].label.toLowerCase()}</p>
    </div>
    <div id="detail"><div class="skel" style="height:72px"></div></div>
  `);

  try {
    const [stats, trophies] = await Promise.all([
      api.memberStats(userId),
      api.trophyCase(ctx.crew.id)
    ]);
    const mine = trophies.filter(t => t.user_id === userId);

    $('#detail', s.el).innerHTML = `
      <div class="stats" style="margin-bottom:14px">
        <div class="stat"><div class="stat-n">${num(stats.total_points)}</div><div class="stat-l">All-time</div></div>
        <div class="stat"><div class="stat-n">${num(stats.current_streak)}</div><div class="stat-l">Streak</div></div>
        <div class="stat"><div class="stat-n">${num(stats.best_streak)}</div><div class="stat-l">Best</div></div>
      </div>
      <div class="card">
        <div class="kv"><span>Sessions logged</span><b>${num(stats.total_sessions)}</b></div>
        <div class="kv"><span>Days active</span><b>${num(stats.active_days)}</b></div>
        <div class="kv"><span>Distance covered</span><b>${Number(stats.total_km).toFixed(1)} km</b></div>
        <div class="kv"><span>Time logged</span><b>${num(stats.total_minutes)} min</b></div>
        ${stats.first_day ? `<div class="kv"><span>Member since</span><b>${fmtDate(stats.first_day, { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>` : ''}
      </div>
      ${mine.length ? `
        <div class="section-title">Titles won</div>
        <div>${mine.map(t => `<span class="title-pill">${esc(t.emoji)} ${esc(t.title)}</span>`).join('')}</div>
      ` : `<p class="hint center mt">No titles yet. Weekly challenges are how you get them.</p>`}
      ${isMe ? '' : ''}
    `;
  } catch (e) {
    $('#detail', s.el).innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}
