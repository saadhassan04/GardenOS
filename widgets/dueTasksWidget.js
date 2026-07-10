/**
 * Due tasks widget (UI layer, L5) — FR-8.1, the widget that waited for
 * v1.5. Overdue + today's tasks with one-tap completion.
 */

import { el, svgIcon } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { getInbox, completeTask, undoComplete } from '../services/taskSchedulerService.js';
import { DAY_MS } from '../services/recurrence.js';
import { registerWidget } from './registry.js';

registerWidget({
  id: 'dueTasks',
  title: 'Tasks due',
  defaultOrder: 0,
  refreshOn: ['task:created', 'task:completed', 'task:skipped', 'task:deleted', 'backup:restored'],
  async render(container) {
    const inbox = await getInbox();
    const due = [...inbox.overdue, ...inbox.dueToday];
    if (due.length === 0) {
      container.append(
        el(
          'p',
          { className: 'text-small text-muted' },
          'Nothing due today. ',
          el('a', { href: '#/tasks' }, `${inbox.upcoming.length} coming up this week`),
        ),
      );
      return;
    }
    for (const task of due.slice(0, 6)) {
      const overdueDays = Math.floor((Date.now() - Date.parse(task.dueAt)) / DAY_MS);
      container.append(
        el(
          'div',
          { className: 'status-row' },
          el(
            'span',
            {},
            task.title,
            overdueDays > 0
              ? el('span', { className: 'text-small status-row__value--warn' }, ` ${overdueDays}d overdue`)
              : null,
          ),
          el(
            'button',
            {
              className: 'btn',
              'aria-label': `Complete ${task.title}`,
              onClick: async () => {
                const { task: done } = await completeTask(task.id);
                showToast(`${task.title} done`, {
                  actionLabel: 'Undo',
                  onAction: async () => {
                    await undoComplete(done.id);
                    showToast('Completion undone');
                  },
                });
              },
            },
            svgIcon('check', { size: 18 }),
          ),
        ),
      );
    }
    container.append(el('p', {}, el('a', { className: 'text-small', href: '#/tasks' }, 'All tasks →')));
  },
});
