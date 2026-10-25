// Penyimpanan IndexedDB aplikasi nota (database terpisah dari aplikasi nota lain di domain yang sama).
const DB_NAME = 'nota-surabaya';
const DB_VERSION = 1;
export const STORES = ['notas', 'settings'];
let dbPromise;
export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB tidak didukung browser ini'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'settings' ? 'key' : 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database terblokir oleh tab lain'));
  });
  return dbPromise;
}
function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode); let out;
    const rq = fn(t.objectStore(store));
    if (rq) rq.onsuccess = () => { out = rq.result; };
    t.oncomplete = () => resolve(out); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('Transaksi dibatalkan'));
  }));
}
export const getAll = (s) => run(s, 'readonly', (st) => st.getAll());
export const get = (s, id) => run(s, 'readonly', (st) => st.get(id));
export const put = (s, v) => run(s, 'readwrite', (st) => st.put(v));
export const del = (s, id) => run(s, 'readwrite', (st) => st.delete(id));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export async function nextCounter() {
  const rec = (await get('settings', 'counters')) || { key: 'counters' };
  rec.nota = (rec.nota || 0) + 1;
  await put('settings', rec);
  return rec.nota;
}
export const DEFAULT_PROFILE = { key: 'profile', businessName: 'Ayam Penyet Surabaya', address: '', phone: '', menu: [], accounts: [] };
export async function getProfile() { return { ...DEFAULT_PROFILE, ...((await get('settings', 'profile')) || {}) }; }

export async function exportAll() {
  const data = { app: 'nota-surabaya', version: DB_VERSION, exportedAt: new Date().toISOString(), stores: {} };
  for (const s of STORES) data.stores[s] = await getAll(s);
  return data;
}
export async function importAll(data) {
  if (!data || data.app !== 'nota-surabaya' || typeof data.stores !== 'object') throw new Error('Berkas bukan cadangan Nota Surabaya');
  for (const s of STORES) if (data.stores[s] != null && !Array.isArray(data.stores[s])) throw new Error('Struktur cadangan tidak valid');
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readwrite');
    for (const s of STORES) { const st = t.objectStore(s); st.clear(); for (const r of data.stores[s] || []) st.put(r); }
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('Impor dibatalkan'));
  });
}
