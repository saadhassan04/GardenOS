/**
 * Canvas chart primitives (UI layer, L5) — UI_GUIDELINES.md §7 Charts,
 * T-072. No chart libraries (ADR-0001): a bar chart and a calendar
 * heatmap, DPR-crisp, colored from design tokens, with a visually-hidden
 * text alternative for screen readers (WCAG).
 */

import { el } from '../utils/dom.js';

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function prepareCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

/**
 * Vertical bar chart for short daily series.
 * @param {{date: string, count: number}[]} series oldest → newest
 * @param {{height?: number, ariaLabel: string}} options
 * @returns {HTMLElement} a container with canvas + hidden text alternative
 */
export function barChart(series, { height = 120, ariaLabel } = {}) {
  const container = el('div', { className: 'chart' });
  const canvas = el('canvas', { role: 'img', 'aria-label': ariaLabel });
  container.append(canvas, textAlternative(series));

  const draw = () => {
    const width = container.clientWidth || 280;
    const ctx = prepareCanvas(canvas, width, height);
    const primary = token('--color-primary');
    const muted = token('--color-text-muted');
    const surface = token('--color-surface-2');

    const max = Math.max(1, ...series.map((d) => d.count));
    const padBottom = 18;
    const plotHeight = height - padBottom - 4;
    const step = width / series.length;
    const barWidth = Math.max(3, Math.min(24, step - 4));

    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';

    series.forEach((day, i) => {
      const x = i * step + step / 2;
      const barHeight = Math.round((day.count / max) * plotHeight);
      ctx.fillStyle = day.count === 0 ? surface : primary;
      ctx.fillRect(
        x - barWidth / 2,
        4 + plotHeight - Math.max(barHeight, 2),
        barWidth,
        Math.max(barHeight, 2),
      );
      // Day-of-month labels, thinned to avoid crowding.
      if (i % Math.ceil(series.length / 7) === 0) {
        ctx.fillStyle = muted;
        ctx.fillText(day.date.slice(8, 10), x, height - 4);
      }
    });
  };

  // Draw after insertion (needs clientWidth); microtask is enough.
  queueMicrotask(draw);
  return container;
}

/**
 * Calendar heatmap (weeks × 7) of daily activity, oldest week first.
 * @param {{date: string, count: number}[]} series oldest → newest, length % 7 free
 * @param {{ariaLabel: string}} options
 * @returns {HTMLElement}
 */
export function calendarHeatmap(series, { ariaLabel } = {}) {
  const container = el('div', { className: 'chart' });
  const canvas = el('canvas', { role: 'img', 'aria-label': ariaLabel });
  container.append(canvas, textAlternative(series));

  const draw = () => {
    const weeks = Math.ceil(series.length / 7);
    const cell = 12;
    const gap = 3;
    const width = weeks * (cell + gap);
    const height = 7 * (cell + gap);
    const ctx = prepareCanvas(canvas, width, height);

    const primary = token('--color-primary');
    const surface = token('--color-surface-2');
    const max = Math.max(1, ...series.map((d) => d.count));

    series.forEach((day, i) => {
      const week = Math.floor(i / 7);
      const dow = i % 7;
      if (day.count === 0) {
        ctx.fillStyle = surface;
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.25 + 0.75 * (day.count / max);
      }
      ctx.beginPath();
      ctx.roundRect(week * (cell + gap), dow * (cell + gap), cell, cell, 3);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  queueMicrotask(draw);
  return container;
}

/** Data table alternative for assistive tech (UI_GUIDELINES.md §10). */
function textAlternative(series) {
  const active = series.filter((d) => d.count > 0);
  const summary = active.length === 0
    ? 'No activity in this period.'
    : active.map((d) => `${d.date}: ${d.count}`).join(', ');
  return el('span', { className: 'visually-hidden' }, summary);
}
