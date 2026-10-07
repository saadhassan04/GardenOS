/**
 * Fertilizer logging — payload validation (old bare events stay valid) and
 * the derived "products used" list (PHASE2_HANDOFF §5.2).
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { validateCareEvent } from '../models/CareEvent.js';
import { createPlant } from '../services/plantService.js';
import { logEvent } from '../services/careEventService.js';
import { listUsedProducts, defaultsForPlant, summarizeProducts } from '../services/fertilizerService.js';
import { ValidationError } from '../utils/errors.js';

const feed = (plantId, data, occurredAt) => logEvent(plantId, 'fertilizing', { data, occurredAt });
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

test('should accept bare fertilizing events and reject a bad NPK or method', async () => {
  validateCareEvent({ plantId: 'p', type: 'fertilizing' });
  validateCareEvent({ plantId: 'p', type: 'fertilizing', data: { product: ' DAP ', npk: '20-20-20.5', method: 'foliar' } });
  await assertThrows(() => validateCareEvent({ plantId: 'p', type: 'fertilizing', data: { npk: '20/20' } }), ValidationError);
  await assertThrows(() => validateCareEvent({ plantId: 'p', type: 'fertilizing', data: { method: 'magic' } }), ValidationError);
});

test('should dedupe used products by case, latest wins, and merge profile suggestions', async () => {
  const plant = await createPlant({ name: 'Feeder Fern' });
  await feed(plant.id, { product: 'Seaweed Extract', dose: '2 ml/L' }, daysAgo(9));
  await feed(plant.id, {}, daysAgo(8)); // old bare event: ignored
  await feed(plant.id, { product: 'seaweed extract', dose: '5 ml/L', method: 'foliar' }, daysAgo(2));

  const products = await listUsedProducts();
  const seaweed = products.filter((p) => p.product.toLowerCase() === 'seaweed extract');
  assertEqual(seaweed.length, 1);
  assertEqual(seaweed[0].dose, '5 ml/L');
  assertEqual(seaweed[0].uses, 2);

  assertEqual((await defaultsForPlant(plant.id)).method, 'foliar');

  const merged = summarizeProducts([], ['Bone meal', 'bone MEAL']);
  assertEqual(merged.length, 1);
  assertEqual(merged[0].uses, 0);
  assert(products.length >= 1);
});
