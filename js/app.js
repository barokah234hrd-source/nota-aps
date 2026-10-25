import * as db from './db.js';
import { icon, toast, esc } from './util.js';

const routes = {
  buat: () => import('./pages/buat.js'),
  riwayat: () => import('./pages/riwayat.js'),
  pengaturan: () => import('./pages/pengaturan.js'),
};
const NAV = [['buat', 'Buat Nota', 'plus'], ['riwayat', 'Riwayat', 'orders'], ['pengaturan', 'Pengaturan', 'settings']];
const nav = document.getElementById('nav');
nav.innerHTML = NAV.map(([k, l, i]) => `<a class="nav-item" href="#/${k}" data-k="${k}">${icon(i, 24)}<span>${l}</span></a>`).join('');

let token = 0;
async function render() {
  const my = ++token;
  const name = (location.hash.replace(/^#\/?/, '') || 'buat').split('?')[0];
  const key = routes[name] ? name : 'buat';
  nav.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.dataset.k === key;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const view = document.getElementById('view');
  try {
    const mod = await routes[key]();
    if (my !== token) return;
    view.innerHTML = '';
    view.onclick = view.oninput = view.onchange = view.onsubmit = null;
    window.scrollTo(0, 0);
    await mod.default(view);
  } catch (err) {
    console.error(err);
    if (my === token) view.innerHTML = `<div class="empty"><div class="empty-title">Terjadi kesalahan</div><p>${esc(err.message || err)}</p></div>`;
  }
}

const syncOnline = () => { document.getElementById('offline').hidden = navigator.onLine; };
window.addEventListener('online', syncOnline); window.addEventListener('offline', syncOnline); syncOnline();
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installEvt = e; document.dispatchEvent(new Event('installready')); });
window.addEventListener('appinstalled', () => { window.__installEvt = null; toast('Aplikasi terpasang di layar utama'); });

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then((reg) => {
    const showUpdate = (w) => { document.getElementById('update-bar').hidden = false; document.getElementById('update-btn').onclick = () => w.postMessage('SKIP_WAITING'); };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); }); });
    setInterval(() => reg.update().catch(() => {}), 3600000);
  }).catch((e) => console.warn('SW gagal didaftarkan', e));
  let reloading = false;
  // Muat ulang hanya saat pembaruan yang diminta pengguna (ada controller sebelumnya).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !hadController) return; reloading = true; location.reload(); });
}

async function boot() {
  try {
    await db.open();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty"><div class="empty-title">Penyimpanan tidak tersedia</div><p>${esc(e.message)}. Coba buka di Chrome (bukan mode penyamaran).</p></div>`;
    return;
  }
  window.addEventListener('hashchange', render);
  registerSW();
  render();
}
boot();
