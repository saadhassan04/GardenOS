/**
 * Notes + lineage integration tests — v1.1 increment 2.
 * Runs in the shared disposable "gardenos-test" database.
 */

import { test, assert, assertEqual, assertThrows, pause } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import {
  createNote,
  updateNote,
  deleteNote,
  listNotes,
  togglePin,
} from '../services/notesService.js';
import { createPlant, getLineage } from '../services/plantService.js';
import { ValidationError } from '../utils/errors.js';

async function clearNotes() {
  await new Repository(STORES.notes).clearAll();
}

test('should validate and normalize notes when creating', async () => {
  await clearNotes();

  await assertThrows(() => createNote({}), ValidationError);
  await assertThrows(() => createNote({ title: '   ' }), ValidationError);

  const note = await createNote({
    title: '  Monsoon prep  ',
    body: ' Clear the drains ',
    tags: [' Monsoon', 'monsoon ', 'DRAINAGE', ''],
    plantIds: ['p1', '', 42],
  });
  assertEqual(note.title, 'Monsoon prep');
  assertEqual(note.body, 'Clear the drains');
  assertEqual(note.tags, ['monsoon', 'drainage'], 'tags must be lowercased, trimmed, deduped');
  assertEqual(note.plantIds, ['p1'], 'invalid plant ids must be dropped');
  assertEqual(note.pinned, 0);
});

test('should float pinned notes and order the rest by recency', async () => {
  await clearNotes();
  // Distinct-millisecond creations: recency ordering is what's under test.
  const oldest = await createNote({ title: 'Oldest' });
  await pause(3);
  await createNote({ title: 'Middle' });
  await pause(3);
  await createNote({ title: 'Newest' });
  await togglePin(oldest.id);

  const notes = await listNotes();
  assertEqual(
    notes.map((n) => n.title)[0],
    'Oldest',
    'pinned note must come first regardless of age',
  );
  // 'Oldest' was just re-touched by togglePin; the remaining two must be
  // recency-ordered.
  assertEqual(notes.slice(1).map((n) => n.title), ['Newest', 'Middle']);
});

test('should search notes across title, body, and tags and filter by plant', async () => {
  await clearNotes();
  const plant = await createPlant({ name: 'Search Subject Rose' });
  await createNote({ title: 'Fertilizer schedule', body: 'NPK every 30 days' });
  await createNote({ title: 'Bloom watch', tags: ['plumeria'], plantIds: [plant.id] });

  assertEqual((await listNotes({ search: 'npk' })).length, 1, 'body search failed');
  assertEqual((await listNotes({ search: 'plume' })).length, 1, 'tag search failed');
  assertEqual((await listNotes({ search: 'bloom' })).length, 1, 'title search failed');
  assertEqual((await listNotes({ search: 'nothing-matches' })).length, 0);
  assertEqual((await listNotes({ plantId: plant.id })).length, 1, 'plant filter failed');
});

test('should soft-delete notes and re-validate on update', async () => {
  await clearNotes();
  const note = await createNote({ title: 'Ephemeral' });

  await assertThrows(() => updateNote(note.id, { title: '' }), ValidationError);
  const updated = await updateNote(note.id, { body: 'now with body' });
  assertEqual(updated.body, 'now with body');

  await deleteNote(note.id);
  assertEqual((await listNotes()).length, 0, 'deleted note leaked into the list');
});

test('should walk propagation lineage in both directions', async () => {
  const mother = await createPlant({ name: 'Mother Plumeria' });
  const cutting = await createPlant({ name: 'Cutting 2026', parentPlantId: mother.id });
  const grandCutting = await createPlant({ name: 'Cutting of cutting', parentPlantId: cutting.id });

  const fromGrandchild = await getLineage(grandCutting.id);
  assertEqual(
    fromGrandchild.ancestors.map((p) => p.name),
    ['Cutting 2026', 'Mother Plumeria'],
    'ancestors must be nearest-first',
  );
  assertEqual(fromGrandchild.children.length, 0);

  const fromMother = await getLineage(mother.id);
  assertEqual(fromMother.ancestors.length, 0);
  assertEqual(fromMother.children.map((p) => p.name), ['Cutting 2026']);
  assert(
    (await getLineage(cutting.id)).children.map((p) => p.name).includes('Cutting of cutting'),
    'middle generation must list its cutting',
  );
});
