/**
 * Today page (UI layer, L5) — PHASE2_HANDOFF §5.1. The first screen: what to
 * water, feed, treat and do right now, loggable one-handed. Repaints its
 * sections in place on bus events (no page rebuild, no scroll jump).
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { currentSeason } from '../config/climate.karachi.js';
import { logWithUndo } from '../components/logWithUndo.js';
import { getToday } from '../services/todayService.js';
import { getBackupStatus } from '../services/backupService.js';
import { logEvent, logBulk } from '../services/careEventService.js';
import { completeTask, undoComplete } from '../services/taskSchedulerService.js';

const REFRESH_TOPICS = [
  'events:logged', 'plant:created', 'plant:updated', 'plant:deleted',
  'pest:observed', 'pest:resolved',
  'task:created', 'task:completed', 'task:deleted', 'task:skipped',
];

let activeUnsubs = [];
let noHistoryOpen = false;

function teardown() {
  for (const unsub of activeUnsubs) {
    unsub();
  }
  activeUnsubs = [];
}

/** @returns {HTMLElement} */
export function renderTodayPage() {
  teardown();

  const summary = el('p', { className: 'text-small text-muted' });
  const banner = el('div', {});
  const sections = {
    water: el('section', { className: 'page-section' }),
    feed: el('section', { className: 'page-section' }),
    problems: el('section', { className: 'page-section' }),
    tasks: el('section', { className: 'page-section' }),
    tomorrow: el('p', { className: 'text-small text-muted' }),
  };
  const now = new Date();
  const season = currentSeason(now);
  const page = el(
    'div',
    {},
    el(
      'header',
      { className: 'page-header' },
      el(
        'div',
        {},
        el('h1', {}, 'Today'),
        el('p', { className: 'text-small text-muted' }, `${now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${season[0].toUpperCase()}${season.slice(1)} season`),
      ),
    ),
    summary,
    banner,
    ...Object.values(sections),
  );

  let paintId = 0;
  const paint = async () => {
    const id = ++paintId;
    try {
      const today = await getToday();
      if (id !== paintId) {
        return; // a newer paint is already on its way
      }
      paintToday(today, { summary, sections });
    } catch (error) {
      logger.error('Today failed to render', { error: error.message });
      clear(sections.water);
      sections.water.append(el('p', { className: 'text-small text-muted' }, `Unavailable: ${error.message}`));
    }
  };
  paint();
  paintBackupBanner(banner);

  for (const topic of REFRESH_TOPICS) {
    activeUnsubs.push(bus.on(topic, paint));
  }
  activeUnsubs.push(bus.on('route:changed', ({ path }) => {
    if (path !== '/') {
      teardown();
    }
  }));
  return page;
}

async function paintBackupBanner(banner) {
  try {
    const status = await getBackupStatus();
    if (status.reminderDue) {
      const ago = status.daysSince === null ? 'never been backed up' : `not been backed up for ${status.daysSince} days`;
      banner.append(
        el('a', { className: 'card today-banner', href: '#/settings' }, `Your garden data has ${ago} — Back up →`),
      );
    }
  } catch (error) {
    logger.warn('Backup banner check failed', { error: error.message });
  }
}

function plural(n, word) {
  return `${n} ${word}`;
}

function paintToday(today, { summary, sections }) {
  const { counts, tomorrow } = today;
  const parts = [
    counts.water ? plural(counts.water, 'to water') : null,
    counts.feed ? plural(counts.feed, 'to feed') : null,
    counts.problems ? plural(counts.problems, counts.problems === 1 ? 'problem' : 'problems') : null,
  ].filter(Boolean);
  summary.textContent = parts.length ? parts.join(' · ') : 'Nothing needs you today.';

  paintWater(sections.water, today.water);
  paintFeed(sections.feed, today.feed);
  paintProblems(sections.problems, today.problems);
  paintTasks(sections.tasks, today.tasks);

  const next = [
    tomorrow.water ? `${tomorrow.water} to water` : null,
    tomorrow.feed ? `${tomorrow.feed} to feed` : null,
  ].filter(Boolean);
  sections.tomorrow.textContent = next.length ? `Tomorrow: ${next.join(' · ')}` : '';
}

/** Heading + children into a section, or hide it when empty. */
function fill(section, title, ...children) {
  clear(section);
  section.hidden = children.flat().filter(Boolean).length === 0;
  if (!section.hidden) {
    section.append(el('span', { className: 'text-caption' }, title), ...children);
  }
}

function row(main, sub, action, { href, done } = {}) {
  const body = el(
    href ? 'a' : 'div',
    { className: `today-row__body${done ? ' today-row__body--done' : ''}`, href },
    el('span', {}, main),
    sub ? el('span', { className: 'text-small text-muted' }, sub) : null,
  );
  return el('div', { className: 'status-row' }, body, action);
}

function iconButton(icon, label, onClick) {
  return el('button', { className: 'btn today-act', 'aria-label': label, onClick }, svgIcon(icon, { size: 20 }));
}

const waterIds = (items) => items.filter((item) => !item.done).map((item) => item.plant.id);
const waterAll = (ids, message) => logWithUndo(() => logBulk(ids, 'watering'), message);

function paintWater(section, { groups, noHistory }) {
  const cards = groups.map((group) => {
    const ids = waterIds(group.items);
    return el(
      'div',
      { className: 'card today-group' },
      el(
        'div',
        { className: 'status-row today-group__head' },
        el('strong', {}, `${group.location} · ${group.items.length}`),
        ids.length
          ? el('button', { className: 'btn', onClick: () => waterAll(ids, `Watered ${ids.length} plants`) }, `Water all ${ids.length}`)
          : null,
      ),
      ...group.items.map(({ plant, done, wateredAt, overdueDays }) =>
        row(
          plant.name,
          done
            ? `watered ${new Date(wateredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
            : overdueDays > 0 ? `${overdueDays}d overdue` : 'due today',
          done ? svgIcon('check', { size: 20, className: 'today-done' })
            : iconButton('drop', `Water ${plant.name}`, () => logWithUndo(() => logEvent(plant.id, 'watering'), `Watered ${plant.name}`)),
          { href: `#/plants/${plant.id}`, done },
        ),
      ),
    );
  });

  let history = null;
  if (noHistory.length) {
    const ids = noHistory.map((plant) => plant.id);
    history = el(
      'details',
      { className: 'card today-group', open: noHistoryOpen ? '' : null },
      el('summary', { className: 'status-row today-group__head' }, `No watering history (${noHistory.length})`),
      el('button', { className: 'btn', onClick: () => waterAll(ids, `Marked ${ids.length} plants watered`) }, 'Mark all watered today'),
      ...noHistory.map((plant) => row(plant.name, null, null, { href: `#/plants/${plant.id}` })),
    );
    history.addEventListener('toggle', () => { noHistoryOpen = history.open; });
  }
  fill(section, 'WATER', ...cards, history);
}

function paintFeed(section, feed) {
  fill(
    section,
    'FEED',
    feed.length
      ? el(
        'div',
        { className: 'card today-group' },
        ...feed.map(({ plant, everyDays, lastAt }) =>
          row(
            plant.name,
            `every ${everyDays}d · last ${Math.floor((Date.now() - Date.parse(lastAt)) / 86_400_000)}d ago`,
            iconButton('leaf', `Log feeding for ${plant.name}`, () => logWithUndo(() => logEvent(plant.id, 'fertilizing'), `Fed ${plant.name}`)),
          ),
        ),
      )
      : null,
  );
}

function paintProblems(section, problems) {
  fill(
    section,
    'PROBLEMS',
    problems.length
      ? el(
        'div',
        { className: 'card today-group' },
        ...problems.map(({ pest, names, treatedAt, outcomePending }) =>
          row(
            `${names.join(', ')} — ${pest.pestType} (${pest.severity})`,
            treatedAt
              ? `treated ${Math.floor((Date.now() - Date.parse(treatedAt)) / 86_400_000)}d ago${outcomePending ? ' · outcome?' : ''}`
              : 'not treated yet',
            el('span', { className: 'text-muted' }, '›'),
            { href: `#/plants/${pest.plantIds[0]}` },
          ),
        ),
      )
      : null,
  );
}

function paintTasks(section, tasks) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  fill(
    section,
    'TASKS',
    tasks.length
      ? el(
        'div',
        { className: 'card today-group' },
        ...tasks.map((task) => {
          const late = Math.ceil((startOfToday - Date.parse(task.dueAt)) / 86_400_000);
          return row(
            task.title,
            late > 0 ? `${late}d overdue` : 'due today',
            iconButton('check', `Complete ${task.title}`, () =>
              logWithUndo(() => completeTask(task.id), `${task.title} done`, ({ task: done }) => undoComplete(done.id))),
          );
        }),
      )
      : null,
  );
}
