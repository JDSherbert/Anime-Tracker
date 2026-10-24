'use strict';

const STORAGE_KEY = 'anime-tracker:v1';
const TAB_KEY = 'anime-tracker:tab';
const ANILIST_URL = 'https://graphql.anilist.co';

// Order here is the order of the tabs. Add more (e.g. on hold, dropped) here.
const STATUSES = [
  { id: 'watching', label: 'Watching', empty: 'Nothing on the go. Tap + to add a show, or start one from To Watch.' },
  { id: 'planned', label: 'To Watch', empty: 'Your watchlist is empty. Tap + to add something.' },
  { id: 'completed', label: 'Completed', empty: 'Nothing finished yet. Shows land here when you reach the last episode.' },
];

const FORMATS = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' };

const SEARCH_QUERY = `query ($search: String) {
  Page(perPage: 15) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
      id episodes format seasonYear
      title { romaji english }
      coverImage { large }
    }
  }
}`;

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  items: load(),
  tab: loadTab(),
};

let searchResults = [];
let searchTimer;
let searchCtl;
let detailId = null;
let toastTimer;

// ---------- storage ----------

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return dedupe((data?.items ?? []).map(normalise).filter(Boolean));
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items: state.items }));
  } catch {
    toast('Couldn’t save. Storage may be full or blocked.');
  }
}

function loadTab() {
  try {
    const tab = localStorage.getItem(TAB_KEY);
    if (STATUSES.some(s => s.id === tab)) return tab;
  } catch {}
  return STATUSES[0].id;
}

function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}

// Coerces anything (old saves, imported files) into a valid entry, or null.
function normalise(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string') return null;
  const total = Number.isInteger(raw.total) && raw.total > 0 ? raw.total : null;
  const status = STATUSES.some(s => s.id === raw.status) ? raw.status : 'planned';
  let progress = Number.isInteger(raw.progress) && raw.progress > 0 ? raw.progress : 0;
  if (total) progress = Math.min(progress, total);
  if (status === 'completed' && total) progress = total;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    anilistId: Number.isInteger(raw.anilistId) ? raw.anilistId : null,
    title: raw.title.trim() || 'Untitled',
    cover: typeof raw.cover === 'string' && raw.cover.startsWith('https://') ? raw.cover : null,
    total,
    progress,
    status,
    score: Number.isInteger(raw.score) && raw.score >= 1 && raw.score <= 10 ? raw.score : null,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    addedAt: Number(raw.addedAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

function dedupe(items) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) item.id = uid();
    seen.add(item.id);
  }
  return items;
}

function commit() {
  save();
  render();
}

// ---------- helpers ----------

function uid() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function find(id) {
  return state.items.find(item => item.id === id);
}

function statusLabel(id) {
  return STATUSES.find(s => s.id === id)?.label ?? id;
}

function hue(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function coverHTML(item, cls) {
  if (item.cover) {
    return `<img class="${cls}" src="${esc(item.cover)}" alt="" loading="lazy" crossorigin="anonymous">`;
  }
  const initial = [...item.title.trim()][0]?.toUpperCase() ?? '?';
  return `<div class="${cls} cover-ph" style="--hue:${hue(item.title)}" aria-hidden="true">${esc(initial)}</div>`;
}

function progressLabel(item) {
  if (item.status === 'completed') return item.total ? `${item.total} episode${item.total === 1 ? '' : 's'}` : 'Completed';
  if (item.total) return `Ep ${item.progress} / ${item.total}`;
  return item.progress ? `Ep ${item.progress}` : 'Not started';
}

// ---------- rendering ----------

function render() {
  renderTabs();
  renderList();
}

function renderTabs() {
  $('#tabs').innerHTML = STATUSES.map(s => {
    const count = state.items.filter(item => item.status === s.id).length;
    return `<button class="tab" type="button" role="tab" data-tab="${s.id}" aria-selected="${s.id === state.tab}">
      ${esc(s.label)}<span class="count">${count}</span>
    </button>`;
  }).join('');
}

function renderList() {
  const items = state.items
    .filter(item => item.status === state.tab)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const list = $('#list');
  if (!items.length) {
    list.innerHTML = `<p class="empty">${esc(STATUSES.find(s => s.id === state.tab).empty)}</p>`;
    return;
  }
  list.innerHTML = items.map(cardHTML).join('');
}

function cardHTML(item) {
  const pct = item.total ? Math.round((item.progress / item.total) * 100) : 0;
  const stepper = item.status === 'completed' ? '' : `
    <div class="stepper">
      <button class="step" type="button" data-act="dec" aria-label="Back one episode"${item.progress === 0 ? ' disabled' : ''}>−</button>
      <button class="step step-inc" type="button" data-act="inc" aria-label="Watched next episode">+1</button>
    </div>`;
  return `
    <article class="card" data-id="${esc(item.id)}">
      ${coverHTML(item, 'cover')}
      <div class="card-body">
        <h2 class="card-title">${esc(item.title)}</h2>
        <p class="card-meta">${esc(progressLabel(item))}${item.score ? ` · ★ ${item.score}` : ''}</p>
        ${item.total && item.status !== 'completed' ? `<div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>` : ''}
      </div>
      ${stepper}
    </article>`;
}

// ---------- actions ----------

function setTab(tab) {
  state.tab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch {}
  render();
  window.scrollTo({ top: 0 });
}

function step(id, delta) {
  const item = find(id);
  if (!item) return;
  const next = item.progress + delta;
  if (next < 0 || (item.total && next > item.total)) return;

  const before = { ...item };
  item.progress = next;
  let message = null;
  if (delta > 0 && item.status === 'planned') {
    item.status = 'watching';
    message = `Started ${item.title}`;
  }
  if (item.total && next === item.total) {
    item.status = 'completed';
    message = `Finished ${item.title}! 🎉`;
  }
  item.updatedAt = Date.now();
  commit();
  if (message) toast(message, { label: 'Undo', run: () => { Object.assign(item, before); commit(); } });
}

function addItem(data) {
  const now = Date.now();
  const item = normalise({ ...data, id: uid(), status: state.tab, progress: 0, addedAt: now, updatedAt: now });
  state.items.push(item);
  commit();
  requestPersistence();
  return item;
}

function removeItem(id) {
  const index = state.items.findIndex(item => item.id === id);
  if (index < 0) return;
  const [removed] = state.items.splice(index, 1);
  commit();
  toast(`Removed ${removed.title}`, { label: 'Undo', run: () => { state.items.push(removed); commit(); } });
}

// ---------- search ----------

function openSearch() {
  const input = $('#search-input');
  input.value = '';
  renderResults(null, '');
  $('#search-dialog').showModal();
  input.focus();
}

function onSearchInput() {
  const query = $('#search-input').value.trim();
  clearTimeout(searchTimer);
  searchCtl?.abort();
  if (query.length < 2) {
    renderResults(null, query);
    return;
  }
  searchTimer = setTimeout(() => runSearch(query), 350);
}

async function runSearch(query) {
  searchCtl = new AbortController();
  $('#results').innerHTML = '<p class="hint">Searching…</p>';
  try {
    const res = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query } }),
      signal: searchCtl.signal,
    });
    if (!res.ok) throw new Error(`AniList responded ${res.status}`);
    const json = await res.json();
    renderResults(json.data.Page.media.map(fromAniList), query);
  } catch (err) {
    if (err.name === 'AbortError') return;
    $('#results').innerHTML =
      `<p class="hint">Couldn’t reach AniList${navigator.onLine ? '' : ' (you’re offline)'}. You can still add it by name.</p>` +
      manualHTML(query);
  }
}

function fromAniList(media) {
  const total = media.episodes ?? null;
  return {
    anilistId: media.id,
    title: media.title.english || media.title.romaji,
    cover: media.coverImage?.large ?? null,
    total,
    meta: [FORMATS[media.format], media.seasonYear, total && `${total} ep${total === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
  };
}

function renderResults(results, query) {
  searchResults = results ?? [];
  const el = $('#results');
  if (!results) {
    el.innerHTML = query ? '' : '<p class="hint">Search by English or Japanese title.</p>';
    return;
  }
  const rows = results.map((r, i) => {
    const existing = r.anilistId && state.items.find(item => item.anilistId === r.anilistId);
    const action = existing
      ? `<span class="in-list">In ${esc(statusLabel(existing.status))}</span>`
      : `<button class="btn btn-small" type="button" data-add="${i}">Add</button>`;
    return `
      <div class="result">
        ${coverHTML(r, 'result-cover')}
        <div class="result-body">
          <div class="result-title">${esc(r.title)}</div>
          <div class="result-meta">${esc(r.meta)}</div>
        </div>
        ${action}
      </div>`;
  }).join('');
  el.innerHTML = (results.length ? rows : '<p class="hint">No matches on AniList.</p>') + manualHTML(query);
}

function manualHTML(query) {
  return `<button class="btn btn-ghost manual" type="button" data-manual>Add “${esc(query)}” without AniList info</button>`;
}

function onResultsClick(e) {
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) {
    const result = searchResults[Number(addBtn.dataset.add)];
    if (!result) return;
    addItem(result);
    renderResults(searchResults, $('#search-input').value.trim());
    return;
  }
  if (e.target.closest('[data-manual]')) {
    const title = $('#search-input').value.trim();
    if (!title) return;
    const item = addItem({ title });
    $('#search-dialog').close();
    toast(`Added to ${statusLabel(item.status)}`);
  }
}

// ---------- detail ----------

function openDetail(id) {
  const item = find(id);
  if (!item) return;
  detailId = id;
  renderDetail(item);
  $('#detail-dialog').showModal();
}

function renderDetail(item) {
  const scores = Array.from({ length: 10 }, (_, i) => 10 - i)
    .map(n => `<option value="${n}"${item.score === n ? ' selected' : ''}>${n}</option>`)
    .join('');
  $('#detail-body').innerHTML = `
    <div class="detail-head">
      ${coverHTML(item, 'detail-cover')}
      <label class="field">
        <span>Title</span>
        <textarea name="title" rows="2" autocomplete="off">${esc(item.title)}</textarea>
      </label>
    </div>
    <div class="field">
      <span>Status</span>
      <div class="segmented">
        ${STATUSES.map(s => `<button type="button" data-status="${s.id}" aria-pressed="${s.id === item.status}">${esc(s.label)}</button>`).join('')}
      </div>
    </div>
    <div class="row">
      <label class="field"><span>Episode</span><input name="progress" type="number" inputmode="numeric" min="0" value="${item.progress}"></label>
      <label class="field"><span>Total eps</span><input name="total" type="number" inputmode="numeric" min="1" value="${item.total ?? ''}" placeholder="?"></label>
      <label class="field"><span>Score</span><select name="score"><option value="">–</option>${scores}</select></label>
    </div>
    <label class="field">
      <span>Notes</span>
      <textarea name="notes" rows="3" placeholder="Favourite character, where you left off…">${esc(item.notes)}</textarea>
    </label>
    <div class="detail-actions">
      <button class="btn btn-danger" type="button" data-delete>Remove</button>
      <button class="btn" type="button" data-close autofocus>Done</button>
    </div>`;
}

// Reads every field at once, so it's safe to call on any change and on close.
function applyDetailForm() {
  const item = find(detailId);
  const body = $('#detail-body');
  if (!item || !body.querySelector('[name="title"]')) return;
  const field = name => body.querySelector(`[name="${name}"]`);
  const next = normalise({
    ...item,
    title: field('title').value.replace(/\s+/g, ' '),
    notes: field('notes').value,
    progress: parseInt(field('progress').value, 10) || 0,
    total: parseInt(field('total').value, 10) || null,
    score: parseInt(field('score').value, 10) || null,
  });
  const keys = ['title', 'notes', 'progress', 'total', 'score', 'status'];
  if (keys.every(k => next[k] === item[k])) return;
  Object.assign(item, next, { updatedAt: Date.now() });
  field('progress').value = item.progress;
  commit();
}

function onDetailClick(e) {
  const statusBtn = e.target.closest('[data-status]');
  if (statusBtn) {
    applyDetailForm();
    const item = find(detailId);
    if (!item || item.status === statusBtn.dataset.status) return;
    Object.assign(item, normalise({ ...item, status: statusBtn.dataset.status }), { updatedAt: Date.now() });
    commit();
    renderDetail(item);
    return;
  }
  if (e.target.closest('[data-delete]')) {
    const item = find(detailId);
    if (item && confirm(`Remove “${item.title}” from your list?`)) {
      detailId = null;
      $('#detail-dialog').close();
      removeItem(item.id);
    }
  }
}

// ---------- backup ----------

function exportData() {
  const payload = { app: 'anime-tracker', version: 1, exportedAt: new Date().toISOString(), items: state.items };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `anime-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importData(file) {
  let items;
  try {
    const data = JSON.parse(await file.text());
    items = (Array.isArray(data) ? data : data.items).map(normalise).filter(Boolean);
  } catch {
    toast('That file doesn’t look like a backup.');
    return;
  }
  if (!confirm(`Replace your current list (${state.items.length} entries) with the ${items.length} in this backup?`)) return;
  state.items = dedupe(items);
  commit();
  $('#settings-dialog').close();
  toast(`Imported ${items.length} entries`);
}

async function openSettings() {
  const status = $('#storage-status');
  status.textContent = `${state.items.length} entries saved.`;
  $('#settings-dialog').showModal();
  const persisted = await navigator.storage?.persisted?.().catch(() => null);
  if (persisted != null) {
    status.textContent += persisted
      ? ' Protected storage is on, so the browser won’t clear it to free up space.'
      : ' Protected storage is off. Installing the app to your home screen usually turns it on.';
  }
}

// ---------- toast ----------

function toast(message, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').addEventListener('click', () => {
      action.run();
      hideToast();
    });
  }
  // Re-show so the toast sits above any dialog that opened since.
  if (el.matches?.(':popover-open')) el.hidePopover();
  el.showPopover?.();
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4500);
}

function hideToast() {
  const el = $('#toast');
  el.classList.remove('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.matches?.(':popover-open') && el.hidePopover(), 200);
}

// ---------- wiring ----------

$('#tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) setTab(tab.dataset.tab);
});

$('#list').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const act = e.target.closest('[data-act]');
  if (act) step(card.dataset.id, act.dataset.act === 'inc' ? 1 : -1);
  else openDetail(card.dataset.id);
});

$('#add-btn').addEventListener('click', openSearch);
$('#settings-btn').addEventListener('click', openSettings);
$('#search-input').addEventListener('input', onSearchInput);
$('#results').addEventListener('click', onResultsClick);
$('#detail-body').addEventListener('click', onDetailClick);
$('#detail-body').addEventListener('change', applyDetailForm);
$('#detail-dialog').addEventListener('close', () => {
  applyDetailForm();
  detailId = null;
});
$('#export-btn').addEventListener('click', exportData);
$('#import-input').addEventListener('change', e => {
  const [file] = e.target.files;
  if (file) importData(file);
  e.target.value = '';
});

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', e => {
    // Tapping the dimmed backdrop, or any [data-close] button, closes the sheet.
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
}

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
