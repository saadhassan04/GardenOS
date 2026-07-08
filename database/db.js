/**
 * IndexedDB connection manager (Data layer, L2) — TODO T-017.
 * Owns: opening the database, running pending migrations in order,
 * recording install/migration metadata in appMeta, and diagnostics reads.
 * Everything above this file talks to repositories, never to IndexedDB.
 */

import { DB_NAME, DB_SCHEMA_VERSION, APP_VERSION } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { uuid } from '../utils/uuid.js';
import { StorageError, MigrationError } from '../utils/errors.js';
import { migrations } from './migrations/index.js';
import { STORES, ALL_STORE_NAMES } from './stores.js';
import { promisify, transactionDone } from './idb.js';

let databaseName = DB_NAME;

/** @type {Promise<IDBDatabase>|null} */
let databasePromise = null;

/**
 * Override the database name. Test-only: lets the test harness run against
 * a disposable database. Must be called before the first openDatabase().
 * @param {{name: string}} options
 */
export function configureDatabase({ name }) {
  if (databasePromise) {
    throw new StorageError('configureDatabase() must be called before openDatabase()');
  }
  databaseName = name;
}

/**
 * Open (once) and return the database. Safe to call from anywhere;
 * concurrent callers share one connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (!databasePromise) {
    databasePromise = open();
  }
  return databasePromise;
}

/** Close the connection (tests and pre-restore flows). */
export async function closeDatabase() {
  if (!databasePromise) {
    return;
  }
  const db = await databasePromise;
  db.close();
  databasePromise = null;
}

async function open() {
  const request = indexedDB.open(databaseName, DB_SCHEMA_VERSION);
  let migratedFrom = null;

  request.onupgradeneeded = (event) => {
    migratedFrom = event.oldVersion;
    const db = request.result;
    for (const migration of migrations) {
      if (migration.version > event.oldVersion) {
        logger.info(`Running migration ${migration.version} (${migration.name})`);
        try {
          migration.upgrade(db, request.transaction);
        } catch (error) {
          logger.error(`Migration ${migration.version} failed`, { error: error.message });
          // Rethrowing aborts the upgrade transaction: the database stays at
          // its previous version, untouched (NFR-4.2). Forward-only policy —
          // recovery is via backup restore, never partial schemas.
          throw new MigrationError(`Migration ${migration.version} (${migration.name}) failed`, {
            cause: error,
          });
        }
      }
    }
  };

  request.onblocked = () => {
    logger.warn('Database upgrade blocked by another open tab — close other GardenOS tabs');
  };

  let db;
  try {
    db = await promisify(request);
  } catch (error) {
    databasePromise = null;
    throw error;
  }

  // Another tab is upgrading to a newer schema: release our connection so it
  // can proceed; next openDatabase() call reconnects at the new version.
  db.onversionchange = () => {
    db.close();
    databasePromise = null;
    logger.warn('Database connection closed: schema upgraded in another tab');
  };

  await recordInstallMeta(db, migratedFrom);
  logger.info(`Database "${databaseName}" open at schema version ${DB_SCHEMA_VERSION}`);
  return db;
}

/**
 * Maintain appMeta rows: installId/installedAt (first run), schemaVersion
 * (every open), migrationLog (appended when an upgrade ran) — DATABASE.md §3.13.
 * @param {IDBDatabase} db
 * @param {number|null} migratedFrom oldVersion when an upgrade ran this open
 */
async function recordInstallMeta(db, migratedFrom) {
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  const store = tx.objectStore(STORES.appMeta);
  const now = new Date().toISOString();

  const existingInstallId = await promisify(store.get('installId'));
  if (!existingInstallId) {
    store.put({ key: 'installId', value: uuid() });
    store.put({ key: 'installedAt', value: now });
  }

  store.put({ key: 'schemaVersion', value: DB_SCHEMA_VERSION });

  if (migratedFrom !== null) {
    const logRow = (await promisify(store.get('migrationLog'))) ?? { key: 'migrationLog', value: [] };
    logRow.value.push({ from: migratedFrom, to: DB_SCHEMA_VERSION, at: now, appVersion: APP_VERSION });
    store.put(logRow);
  }

  await transactionDone(tx);
}

/**
 * Read all appMeta rows as one object (Diagnostics view).
 * @returns {Promise<Record<string, *>>}
 */
export async function getAppMeta() {
  const db = await openDatabase();
  const store = db.transaction(STORES.appMeta, 'readonly').objectStore(STORES.appMeta);
  const rows = await promisify(store.getAll());
  const meta = {};
  for (const row of rows) {
    meta[row.key] = row.value;
  }
  return meta;
}

/**
 * Record count per store, including soft-deleted records (Diagnostics view).
 * @returns {Promise<Record<string, number>>}
 */
export async function getStoreCounts() {
  const db = await openDatabase();
  const tx = db.transaction(ALL_STORE_NAMES, 'readonly');
  const counts = {};
  await Promise.all(
    ALL_STORE_NAMES.map(async (name) => {
      counts[name] = await promisify(tx.objectStore(name).count());
    }),
  );
  return counts;
}
