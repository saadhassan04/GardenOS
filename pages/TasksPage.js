/**
 * Tasks page (UI layer, L5) — FR-4, T-081/T-082/T-084.
 * Inbox (overdue / today / next 7 days / later) and a month calendar,
 * one-tap completion with auto-logged care
 * events and full Undo.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { formDialog } from '../components/FormDialog.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { formatDate, localDateString } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { getSetting } from '../storage/settings.js';
import { describeRecurrence, DAY_MS } from '../services/recurrence.js';
import {
  createTask,
  completeTask,
  undoComplete,
  skipOccurrence,
  undoSkip,
  deleteTask,
  listOrphanedTasks,
  deleteOrphanedTasks,
  getInbox,
  getCalendar,
  TASK_TYPE_OPTIONS,
} from '../services/taskSchedulerService.js';
import { listPlants } from '../services/plantService.js';
import { EVENT_TYPES } from '../config/registries.js';

/** @returns {HTMLElement} */
export function renderTasksPage() {
  const page = el('div', {});
  const state = {
    view: 'inbox',
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    selectMode: false,
    selected: new Set(),
    type: '',
  };
  const ctx = { state, rows: new Map(), updateBar: () => {} };

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

  const selectToggle = el(
    'button',
    {
      className: 'btn',
      'aria-pressed': 'false',
      onClick: () => {
        state.selectMode = !state.selectMode;
        state.selected.clear();
        selectToggle.setAttribute('aria-pressed', String(state.selectMode));
        selectToggle.textContent = state.selectMode ? 'Done' : 'Select';
        refresh();
      },
    },
    'Select',
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
        selectToggle,
        el('button', { className: 'btn btn--primary', onClick: () => newTaskFlow(refresh) }, svgIcon('plus', { size: 20 }), 'New task'),
      ),
    ),
  );

  const bodyRegion = el('div', {});
  const actionBar = el('div', { className: 'action-bar', hidden: '' });
  page.append(bodyRegion, actionBar);

  const exitSelect = () => {
    state.selectMode = false;
    state.selected.clear();
    selectToggle.setAttribute('aria-pressed', 'false');
    selectToggle.textContent = 'Select';
    refresh();
  };

  /** Run one action over every selected task; one toast, one Undo for the lot. */
  async function bulk(kind) {
    const ids = [...state.selected];
    if (kind === 'delete') {
      const ok = await confirmDialog({
        title: `Delete ${ids.length} tasks?`,
        body: 'Recurring tasks stop repeating too.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) {
        return;
      }
    }
    const done = [];
    let failed = 0;
    for (const id of ids) {
      try {
        if (kind === 'skip') {
          await skipOccurrence(id);
          done.push(id);
        } else if (kind === 'done') {
          done.push((await completeTask(id)).task.id);
        } else {
          await deleteTask(id);
        }
      } catch (error) {
        failed += 1;
        logger.warn('Bulk task action failed', { kind, error: error.message });
      }
    }
    const verb = { skip: 'Skipped', done: 'Completed', delete: 'Deleted' }[kind];
    const undo = kind === 'skip' ? undoSkip : kind === 'done' ? undoComplete : null;
    showToast(`${verb} ${ids.length - failed} tasks${failed ? ` (${failed} failed)` : ''}`, undo
      ? {
        actionLabel: 'Undo',
        onAction: async () => {
          for (const id of done) {
            await undo(id).catch(() => {});
          }
          showToast('Undone');
          refresh();
        },
      }
      : {});
    exitSelect();
  }

  ctx.updateBar = () => {
    clear(actionBar);
    if (!state.selectMode || state.selected.size === 0) {
      actionBar.setAttribute('hidden', '');
      return;
    }
    actionBar.removeAttribute('hidden');
    actionBar.append(
      el('span', { className: 'text-small' }, `${state.selected.size} selected`),
      el('button', { className: 'btn', onClick: () => bulk('skip') }, 'Skip'),
      el('button', { className: 'btn', onClick: () => bulk('done') }, svgIcon('check', { size: 18 }), 'Done'),
      el('button', { className: 'btn btn--danger', onClick: () => bulk('delete') }, 'Delete'),
    );
  };

  async function refresh() {
    try {
      clear(bodyRegion);
      if (state.view === 'inbox') {
        await fillInbox(bodyRegion, refresh, ctx);
        ctx.updateBar();
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

async function fillInbox(region, refresh, ctx) {
  const { state } = ctx;
  const [inbox, orphaned] = await Promise.all([getInbox(), listOrphanedTasks()]);
  const everything = [...inbox.overdue, ...inbox.dueToday, ...inbox.upcoming, ...inbox.later];
  const types = [...new Set(everything.map((task) => task.taskType))];
  if (state.type && !types.includes(state.type)) {
    state.type = '';
  }
  const shown = (tasks) => tasks.filter((task) => !state.type || task.taskType === state.type);
  const visible = new Set(shown(everything).map((task) => task.id));
  for (const id of [...state.selected]) {
    if (!visible.has(id)) {
      state.selected.delete(id);
    }
  }
  ctx.rows = new Map();

  // Tasks for plants that are archived/deceased/deleted are hidden above; offer to remove them for good.
  if (orphaned.length > 0) {
    region.append(
      el(
        'div',
        { className: 'card today-group stack' },
        el('p', { className: 'text-small' }, `${orphaned.length} tasks belong to plants that are no longer active, so they are hidden.`),
        el('button', {
          className: 'btn',
          onClick: async () => {
            const ok = await confirmDialog({
              title: `Remove ${orphaned.length} tasks?`,
              body: 'Deletes the hidden tasks (and their repeats) for archived, deceased or deleted plants. Plant history is kept.',
              confirmLabel: 'Remove',
              danger: true,
            });
            if (ok) {
              showToast(`Removed ${await deleteOrphanedTasks()} tasks`);
              refresh();
            }
          },
        }, 'Remove them'),
      ),
    );
  }

  if (types.length > 1) {
    region.append(
      el(
        'div',
        { className: 'chip-row page-section' },
        ...[['', 'All'], ...types.map((type) => [type, EVENT_TYPES[type]?.label ?? 'Custom'])].map(([type, label]) =>
          el('button', {
            type: 'button',
            className: 'btn chip-btn',
            'aria-pressed': String(state.type === type),
            onClick: () => { state.type = type; refresh(); },
          }, label)),
      ),
    );
  }

  const sections = [
    ['Overdue', shown(inbox.overdue)],
    ['Today', shown(inbox.dueToday)],
    ['Next 7 days', shown(inbox.upcoming)],
    ['Later', shown(inbox.later)],
  ];

  let any = false;
  for (const [title, tasks] of sections) {
    if (tasks.length === 0) {
      continue;
    }
    any = true;
    const card = el('div', { className: 'card' }, ...tasks.map((task) => taskRow(task, refresh, ctx)));
    const allSelected = () => tasks.every((task) => state.selected.has(task.id));
    const selectAll = el('button', {
      type: 'button',
      className: 'btn btn--ghost',
      onClick: () => {
        const on = !allSelected();
        for (const task of tasks) {
          on ? state.selected.add(task.id) : state.selected.delete(task.id);
          ctx.rows.get(task.id)?.(on);
        }
        selectAll.textContent = on ? 'Clear' : 'Select all';
        ctx.updateBar();
      },
    }, allSelected() ? 'Clear' : 'Select all');
    region.append(
      el(
        'section',
        { className: 'page-section' },
        el(
          'div',
          { className: 'task-section-head' },
          el('span', { className: 'text-caption' }, `${title} (${tasks.length})`),
          state.selectMode ? selectAll : null,
        ),
        card,
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

/** Select-mode row: tap anywhere to tick; no per-row buttons. */
function pickRow(task, ctx, body) {
  const icon = el('div', { className: 'plant-card__thumb task-row__icon' });
  const row = el('div', { className: 'status-row task-row task-row--pick', role: 'checkbox', tabindex: '0' }, icon, body);
  const paint = (on) => {
    row.classList.toggle('task-row--selected', on);
    row.setAttribute('aria-checked', String(on));
    icon.replaceChildren(svgIcon(on ? 'check' : (EVENT_TYPES[task.taskType]?.icon ?? 'note'), { size: 22 }));
  };
  const toggle = () => {
    const on = !ctx.state.selected.has(task.id);
    on ? ctx.state.selected.add(task.id) : ctx.state.selected.delete(task.id);
    paint(on);
    ctx.updateBar();
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggle();
    }
  });
  ctx.rows.set(task.id, paint);
  paint(ctx.state.selected.has(task.id));
  return row;
}

function taskRow(task, refresh, ctx) {
  const overdueDays = Math.ceil((new Date().setHours(0, 0, 0, 0) - Date.parse(task.dueAt)) / DAY_MS);
  const dueToday = formatDate(task.dueAt) === formatDate(new Date().toISOString());
  const dueText = overdueDays > 0
    ? `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`
    : dueToday ? 'Today' : formatDate(task.dueAt);
  const recurrenceText = describeRecurrence(task.recurrence);

  const body = el(
    'div',
    { className: 'today-row__body' },
    el('span', {}, task.title),
    el(
      'span',
      { className: `text-small ${overdueDays > 0 ? 'task-row__late' : 'text-muted'}` },
      `${dueText}${recurrenceText ? ` · ${recurrenceText}` : ''}`,
    ),
  );
  if (ctx.state.selectMode) {
    return pickRow(task, ctx, body);
  }

  return el(
    'div',
    { className: 'status-row task-row' },
    el('div', { className: 'plant-card__thumb task-row__icon' }, svgIcon(EVENT_TYPES[task.taskType]?.icon ?? 'note', { size: 22 })),
    body,
    el(
      'span',
      { className: 'task-row__actions' },
      el(
        'button',
        {
          className: 'btn today-act',
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
          className: 'btn btn--ghost task-row__more',
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
      { name: 'dueDate', label: 'Due on', kind: 'date', allowFuture: true, value: localDateString() },
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
