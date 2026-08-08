/* ==========================================================================
   The ✨ What's New sheet — patch notes for people who don't read patch notes.
   ========================================================================== */

import { CHANGELOG, markRead, unreadEntries } from '../changelog.js';
import { $, esc, sheet, fmtDate } from '../ui.js';

const TAGS = {
  new:    { label: 'New',      cls: 'tag-new' },
  better: { label: 'Improved', cls: 'tag-better' },
  fix:    { label: 'Fixed',    cls: 'tag-fix' },
  note:   { label: 'Note',     cls: 'tag-note' }
};

/**
 * @param {boolean} onlyUnread  Show just what's changed since they last looked.
 *                              The full history is one tap away either way.
 */
export function openWhatsNew({ onlyUnread = false } = {}) {
  const fresh = unreadEntries();
  const showing = onlyUnread && fresh.length ? fresh : CHANGELOG;
  const isPartial = showing.length < CHANGELOG.length;

  const s = sheet(`
    <div class="center" style="padding-bottom:10px">
      <div style="font-size:2.4rem">✨</div>
      <h2 style="margin:6px 0 2px">What's new</h2>
      <p class="sub" style="margin:0">
        ${isPartial ? 'Since you last looked' : 'Everything that\'s changed so far'}
      </p>
    </div>
    <div id="entries">${showing.map(entry).join('')}</div>
    ${isPartial ? '<button class="btn btn-ghost mt" data-all>Show older updates</button>' : ''}
    <button class="btn btn-primary mt" data-ok>Got it</button>
  `, {
    // However the sheet was opened — tapped, or popped up automatically after
    // an update — closing it counts as having read the notes.
    onClose: () => {
      markRead();
      $('#news')?.classList.remove('has-dot');
    }
  });

  $('[data-ok]', s.el).addEventListener('click', () => s.close());

  $('[data-all]', s.el)?.addEventListener('click', () => {
    $('#entries', s.el).innerHTML = CHANGELOG.map(entry).join('');
    $('[data-all]', s.el).remove();
  });
}

function entry(c) {
  return `
    <div class="release">
      <div class="release-head">
        <span class="release-v">v${esc(c.version)}</span>
        <span class="release-d">${fmtDate(c.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <h3 class="release-t">${esc(c.title)}</h3>
      ${c.blurb ? `<p class="release-b">${esc(c.blurb)}</p>` : ''}
      <ul class="release-list">
        ${c.items.map(([tag, text]) => {
          const t = TAGS[tag] || TAGS.note;
          return `<li>
            <span class="tag ${t.cls}">${t.label}</span>
            <span>${esc(text)}</span>
          </li>`;
        }).join('')}
      </ul>
    </div>`;
}
