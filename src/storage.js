// IndexedDB persistence for the whole db object. IndexedDB survives storage
// pressure far better than localStorage and has no ~5 MB ceiling, which matters
// for a photo journal meant to last years.

const DB_NAME = 'coquest';
const STORE = 'state';
const KEY = 'db';

// The pre-IndexedDB localStorage key. Read once for migration; never written again.
export const LEGACY_STORAGE_KEY = 'coquest.v1';

// No connection caching: tests swap in a fresh IDBFactory per test, and one
// open per save (debounced to ~1/300ms) is negligible.
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveState(value) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearState() {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function readLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Ask the browser not to evict our data under storage pressure.
// Best-effort: some browsers grant silently, some prompt, some refuse.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* unsupported */ }
  return false;
}
