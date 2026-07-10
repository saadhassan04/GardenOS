/**
 * Notification service (Business layer, L3) — API_DESIGN.md §6, FR-4.5,
 * T-083. Best-effort platform notifications for due tasks with an
 * always-available fallback: the navigation badge. Without a push server
 * (which GardenOS will never require), notifications fire when the app is
 * opened or used — honest capability, no pretense of background delivery.
 */

import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { getInbox } from './taskSchedulerService.js';

/** @returns {'granted'|'denied'|'not-asked'|'unsupported'} */
export function getCapability() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  return 'not-asked';
}

/** @returns {Promise<'granted'|'denied'|'not-asked'|'unsupported'>} */
export async function requestPermission() {
  if (getCapability() === 'unsupported') {
    return 'unsupported';
  }
  try {
    await Notification.requestPermission();
  } catch (error) {
    logger.warn('Notification permission request failed', { error: error.message });
  }
  return getCapability();
}

/**
 * Recompute due tasks, update the navigation badge (the universal
 * fallback), and — when permitted — show one summary notification.
 * Tagged so repeated calls replace rather than stack.
 */
export async function announceDueTasks() {
  try {
    const inbox = await getInbox();
    bus.emit('tasks:badge', { count: inbox.dueCount });

    if (inbox.dueCount === 0 || getCapability() !== 'granted') {
      return;
    }
    const titles = [...inbox.overdue, ...inbox.dueToday].slice(0, 3).map((t) => t.title);
    const body = titles.join(' · ');
    const title = `${inbox.dueCount} garden task${inbox.dueCount === 1 ? '' : 's'} due`;

    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title, { body, tag: 'gardenos-due', icon: 'assets/icons/icon-192.png' });
    } else {
      // eslint-disable-next-line no-new
      new Notification(title, { body, tag: 'gardenos-due' });
    }
  } catch (error) {
    logger.warn('Due-task announcement failed', { error: error.message });
  }
}

// The badge follows task activity live, whichever screen caused it.
for (const topic of ['task:created', 'task:completed', 'task:skipped', 'task:deleted', 'backup:restored']) {
  bus.on(topic, () => {
    announceDueTasks();
  });
}
