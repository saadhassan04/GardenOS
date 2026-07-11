/**
 * Care profiles page (UI layer, L5) — FR-1.3.
 * Lists every care profile (seeded + user-made) with how many plants use
 * each, and links to create/edit. Reached from More.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { logger } from '../utils/logger.js';
import { listCareProfiles, countPlantsUsingProfile } from '../services/careProfileService.js';
import { currentSeason } from '../config/climate.karachi.js';

/** @returns {HTMLElement} */
export function renderCareProfilesPage() {
  const page = el('div', {});

  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el('h1', {}, 'Care profiles'),
      el('a', { className: 'btn btn--primary', href: '#/care-profiles/new' }, svgIcon('plus', { size: 20 }), 'New profile'),
    ),
    el(
      'p',
      { className: 'text-small text-muted page-section' },
      `A care profile is a reusable watering/feeding template. Assign one on a plant’s edit form; `
        + `the dashboard uses it to flag what needs attention. This season is ${currentSeason()}.`,
    ),
  );

  const listRegion = el('div', { className: 'stack' });
  page.append(listRegion);

  async function refresh() {
    try {
      const profiles = await listCareProfiles();
      clear(listRegion);
      if (profiles.length === 0) {
        listRegion.append(
          el('div', { className: 'card empty-state' }, el('p', {}, 'No care profiles yet — add your first.')),
        );
        return;
      }
      for (const profile of profiles) {
        listRegion.append(await profileCard(profile));
      }
    } catch (error) {
      logger.error('Care profiles failed to load', { error: error.message });
      clear(listRegion);
      listRegion.append(el('div', { className: 'card' }, `Could not load profiles: ${error.message}`));
    }
  }

  async function profileCard(profile) {
    const inUse = await countPlantsUsingProfile(profile.id);
    const seasonal = profile.wateringSeasonal;
    const wateringText = seasonal
      ? `water: summer ${dash(seasonal.summer)} · monsoon ${dash(seasonal.monsoon)} · winter ${dash(seasonal.winter)} (days)`
      : profile.wateringEveryDays
        ? `water every ${profile.wateringEveryDays} days`
        : 'watering not set';

    return el(
      'a',
      { className: 'card note-card__head more-entry', href: `#/care-profiles/${profile.id}/edit` },
      el(
        'div',
        {},
        el('h3', { className: 'plant-card__name' }, profile.name),
        el(
          'div',
          { className: 'plant-card__meta' },
          profile.source === 'seed' ? el('span', { className: 'chip' }, 'Karachi preset') : el('span', { className: 'chip' }, 'Custom'),
          el('span', { className: 'text-small text-muted' }, `${inUse} plant(s)`),
        ),
        el('p', { className: 'text-small text-muted' }, wateringText),
      ),
      el('span', { className: 'text-muted' }, '›'),
    );
  }

  refresh();
  return page;
}

function dash(value) {
  return value === null || value === undefined ? '—' : String(value);
}
