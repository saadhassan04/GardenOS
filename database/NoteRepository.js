/**
 * Note repository (Data layer, L2) — DATABASE.md §3.4.
 * Recency listing via the updatedAt index; text search happens in the
 * service over this bounded scan (client-side index is fine at hundreds of
 * notes — FR-7.2; revisit via ADR if the collection ever proves otherwise).
 */

import { Repository } from './Repository.js';
import { STORES } from './stores.js';

export class NoteRepository extends Repository {
  constructor() {
    super(STORES.notes);
  }

  /**
   * Most recently updated notes first.
   * @param {{limit?: number}} [options]
   * @returns {Promise<object[]>}
   */
  async listRecent({ limit = 500 } = {}) {
    const { items } = await this.query({ index: 'updatedAt', direction: 'prev', limit });
    return items;
  }
}

export const noteRepository = new NoteRepository();
