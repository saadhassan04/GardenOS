/**
 * Tasks page (UI layer, L5) — FR-4, T-081/T-082/T-084.
 * Inbox (overdue / today / next 7 days / later) and a month calendar,
 * care-profile suggestions, one-tap completion with auto-logged care
 * events and full Undo.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { formDialog } from '../components/FormDialog.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { formatDate } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { getSetting } from '../storage/settings.js';
import { describeRecurrence, DAY_MS } from '../services/recurrence.js';
import {
  createTask,
  completeTask,
  undoComplete,
  skipOccurrence,
  deleteTask,
  getInbox,
  getCalendar,
  suggestFromCareProfiles,
  createSuggestedTask,
  TASK_TYPE_OPTIONS,
} from '../services/taskSchedulerService.js';
import { listPlants } from '../services/plantService.js';

/** @returns {HTMLElement} */
export function renderTasksPage() {
  const page = el('div', {});
  const state = { view: 'inbox', calYear: new Date().getFullYear(), calMonth: new Date().getMonth() + 1 };

  const viewToggle = el(
    'button',
    {
      className: 'btn',
      onClick: () => {
        state.view = state.view === 'inbox' ? 'calendar' : 'inbox';
        viewToggle.textContent = state.view === 'inbox' ? 'Calendar' : 'Inbox';
        refresh();
      },
    },
    'Calendar',
  );

  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el('h1', {}, 'Tasks'),
      el(
        'div',
        { className: 'dialog__actions' },
        viewToggle,
        el('button', { className: 'btn btn--primary', onClick: () => newTaskFlow(refresh) }, svgIcon('plus', { size: 20 }), 'New task'),
      ),
    ),
  );

  const suggestionsRegion = el('div', {});
  const bodyRegion = el('div', {});
  page.append(suggestionsRegion, bodyRegion);

  async function refresh() {
    fillSuggestions(suggestionsRegion, refresh);
    try {
      clear(bodyRegion);
      if (state.view === 'inbox') {
        await fillInbox(bodyRegion, refresh);
      } else {
        await fillCalendar(bodyRegion, state, refresh);
      }
    } catch (error) {
      logger.error('Tasks failed to load', { error: error.message });
      bodyRegion.append(el('div', { className: 'card' }, `Could not load tasks: ${error.message}`));
    }
  }

  refresh();
  return page;
}

/* ---- Inbox ---- */

async function fillInbox(region, refresh) {
  const inbox = await getInbox();
  const sections = [
    ['Overdue', inbox.overdue, 'status-row__value--warn'],
    ['Today', inbox.dueToday, ''],
    ['Next 7 days', inbox.upcoming, ''],
    ['Later', inbox.later, ''],
  ];

  let any = false;
  for (const [title, tasks] of sections) {
    if (tasks.length === 0) {
      continue;
    }
    any = true;
    region.append(
      el(
        'section',
        { className: 'page-section' },
        el('span', { className: 'text-caption' }, `${title} (${tasks.length})`),
        el('div', { className: 'card' }, ...tasks.map((task) => taskRow(task, refresh))),
      ),
    );
  }
  if (!any) {
    region.append(
      el(
        'div',
        { className: 'card empty-state' },
        el('p', {}, 'No pending tasks. The garden — and you — are on schedule.'),
      ),
    );
  }
}

function taskRow(task, refresh) {
  const overdueDays = Math.floor((Date.now() - Date.parse(task.dueAt)) / DAY_MS);
  const dueText = overdueDays > 0
    ? `${overdueDays} day(s) overdue`
    : formatDate(task.dueAt);
  const recurrenceText = describeRecurrence(task.recurrence);

  return el(
    'div',
    { className: 'status-row' },
    el(
      'span',
      {},
      task.title,
      el(
        'span',
        { className: 'text-small text-muted' },
        ` — ${dueText}${recurrenceText ? ` · ${recurrenceText}` : ''}`,
      ),
    ),
    el(
      'span',
      { className: 'dialog__actions' },
      el(
        'button',
        {
          className: 'btn',
          'aria-label': `Complete ${task.title}`,
          onClick: async () => {
            try {
              const { task: done, batchId } = await completeTask(task.id);
              showToast(
                batchId ? `${task.title} done — care events logged` : `${task.title} done`,
                {
                  actionLabel: 'Undo',
                  onAction: async () => {
                    await undoComplete(done.id);
                    showToast('Completion undone');
                    refresh();
                  },
                },
              );
              refresh();
            } catch (error) {
              showToast(error.message);
            }
          },
        },
        svgIcon('check', { size: 18 }),
      ),
      el(
        'button',
        {
          className: 'btn btn--ghost note-card__pin',
          'aria-label': `More actions for ${task.title}`,
          onClick: async () => {
            const choice = await formDialog({
              title: task.title,
              submitLabel: 'Apply',
              fields: [{
                name: 'action',
                label: 'Action',
                kind: 'select',
                options: [
                  ...(task.recurrence ? [['skip', 'Skip this occurrence']] : []),
                  ['delete', 'Delete task'],
                ],
              }],
            });
            if (!choice) {
              return;
            }
            try {
              if (choice.action === 'skip') {
                await skipOccurrence(task.id);
                showToast('Skipped — the series continues');
              } else if (choice.action === 'delete') {
                const ok = await confirmDialog({
                  title: `Delete “${task.title}”?`,
                  body: task.recurrence ? 'This ends the recurring series too.' : 'The task is removed.',
                  confirmLabel: 'Delete task',
                  danger: true,
                });
                if (!ok) {
                  return;
                }
                await deleteTask(task.id);
                showToast('Task deleted');
              }
              refresh();
            } catch (error) {
              showToast(error.message);
            }
          },
        },
        '⋯',
      ),
    ),
  );
}

/* ---- Calendar (FR-4.3) ---- */

const WEEKDAY_ORDERS = {
  monday: [1, 2, 3, 4, 5, 6, 0],
  sunday: [0, 1, 2, 3, 4, 5, 6],
  saturday: [6, 0, 1, 2, 3, 4, 5],
};
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

async function fillCalendar(region, state, refresh) {
  const byDate = await getCalendar(state.calYear, state.calMonth);
  const order = WEEKDAY_ORDERS[getSetting('weekStart')] ?? WEEKDAY_ORDERS.monday;

  const nav = el(
    'div',
    { className: 'page-header page-header--split' },
    el('button', {
      className: 'btn', 'aria-label': 'Previous month',
      onClick: () => { shiftMonth(state, -1); refresh(); },
    }, '‹'),
    el('h2', {}, `${MONTH_NAMES[state.calMonth - 1]} ${state.calYear}`),
    el('button', {
      className: 'btn', 'aria-label': 'Next month',
      onClick: () => { shiftMonth(state, 1); refresh(); },
    }, '›'),
  );

  const grid = el('div', { className: 'cal-grid' });
  for (const dow of order) {
    grid.append(el('span', { className: 'text-caption cal-grid__head' }, WEEKDAY_SHORT[dow]));
  }

  const first = new Date(state.calYear, state.calMonth - 1, 1);
  const daysInMonth = new Date(state.calYear, state.calMonth, 0).getDate();
  const leadBlanks = order.indexOf(first.getDay());
  for (let i = 0; i < leadBlanks; i += 1) {
    grid.append(el('span', {}));
  }

  const dayList = el('div', { className: 'card stack cal-day-list' });
  dayList.append(el('p', { className: 'text-small text-muted' }, 'Pick a day to see its tasks.'));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${state.calYear}-${String(state.calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tasks = byDate[key] ?? [];
    grid.append(
      el(
        'button',
        {
          className: `cal-grid__day${tasks.length ? ' cal-grid__day--busy' : ''}`,
          'aria-label': `${key}: ${tasks.length} task(s)`,
          onClick: () => {
            clear(dayList);
            dayList.append(el('span', { className: 'text-caption' }, `${formatDate(key)} (${tasks.length})`));
            if (tasks.length === 0) {
              dayList.append(el('p', { className: 'text-small text-muted' }, 'Nothing scheduled.'));
            }
            for (const task of tasks) {
              dayList.append(
                task.status === 'pending'
                  ? taskRow(task, refresh)
                  : el('p', { className: 'text-small text-muted' }, `✓ ${task.title} (${task.status})`),
              );
            }
          },
        },
        String(day),
      ),
    );
  }

  region.append(nav, el('div', { className: 'card' }, grid), dayList);
}

function shiftMonth(state, delta) {
  const d = new Date(state.calYear, state.calMonth - 1 + delta, 1);
  state.calYear = d.getFullYear();
  state.calMonth = d.getMonth() + 1;
}

/* ---- Suggestions (T-084) ---- */

async function fillSuggestions(region, refresh) {
  try {
    const suggestions = await suggestFromCareProfiles();
    clear(region);
    if (suggestions.length === 0) {
      return;
    }
    const card = el('div', { className: 'card' });
    for (const suggestion of suggestions.slice(0, 5)) {
      card.append(
        el(
          'div',
          { className: 'status-row' },
          el(
            'span',
            {},
            `Fertilize ${suggestion.plant.name}`,
            el('span', { className: 'text-small text-muted' }, ` — profile says every ${suggestion.everyDays} days`),
          ),
          el(
            'button',
            {
              className: 'btn',
              onClick: async () => {
                await createSuggestedTask(suggestion);
                showToast(`Recurring task created for ${suggestion.plant.name}`);
                refresh();
              },
            },
            'Create',
          ),
        ),
      );
    }
    region.append(
      el(
        'section',
        { className: 'page-section' },
        el('span', { className: 'text-caption' }, 'Suggested from care profiles'),
        card,
      ),
    );
  } catch (error) {
    logger.warn('Suggestions failed', { error: error.message });
  }
}

/* ---- Creation ---- */

async function newTaskFlow(refresh) {
  const plants = await listPlants({ status: 'active' });
  const values = await formDialog({
    title: 'New task',
    submitLabel: 'Create task',
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'Fertilize roses' },
      { name: 'taskType', label: 'Type', kind: 'select', value: 'custom', options: [...TASK_TYPE_OPTIONS] },
      {
        name: 'plantId', label: 'Plant', kind: 'select', value: '',
        options: [['', 'No specific plant'], ...plants.map((p) => [p.id, p.name])],
        hint: 'Care-type tasks auto-log an event for this plant on completion',
      },
      { name: 'dueDate', label: 'Due on', kind: 'date', allowFuture: true, value: new Date().toISOString().slice(0, 10) },
      {
        name: 'repeat', label: 'Repeat', kind: 'select', value: 'none',
        options: [
          ['none', 'Does not repeat'], ['daily', 'Daily'], ['everyNDays', 'Every N days'],
          ['weekly', 'Weekly (same weekday)'], ['monthly', 'Monthly (same date)'],
          ['seasonal-summer', 'Every summer'], ['seasonal-monsoon', 'Every monsoon'], ['seasonal-winter', 'Every winter'],
        ],
      },
      { name: 'interval', label: 'N (for "every N days")', kind: 'number', value: '7' },
      { name: 'notes', label: 'Notes', kind: 'textarea' },
    ],
  });
  if (!values) {
    return;
  }

  const due = new Date(`${values.dueDate}T09:00:00`);
  let recurrence = null;
  if (values.repeat === 'daily') {
    recurrence = { pattern: 'daily' };
  } else if (values.repeat === 'everyNDays') {
    recurrence = { pattern: 'everyNDays', interval: Number.parseInt(values.interval, 10) };
  } else if (values.repeat === 'weekly') {
    recurrence = { pattern: 'weekly', daysOfWeek: [due.getDay()] };
  } else if (values.repeat === 'monthly') {
    recurrence = { pattern: 'monthly' };
  } else if (values.repeat.startsWith('seasonal-')) {
    recurrence = { pattern: 'seasonal', season: values.repeat.slice('seasonal-'.length) };
  }

  try {
    await createTask({
      title: values.title,
      taskType: values.taskType,
      plantIds: values.plantId ? [values.plantId] : [],
      dueAt: due.toISOString(),
      recurrence,
      notes: values.notes,
    });
    showToast('Task created');
    refresh();
  } catch (error) {
    showToast(error.message);
  }
}
