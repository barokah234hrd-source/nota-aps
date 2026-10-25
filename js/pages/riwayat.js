import * as db from '../db.js';
import { esc, rupiah, fmtDate, icon, emptyState, confirmDialog, toast, pageHeader, downloadCSV } from '../util.js';
import { toCSV } from '../calc.js';
import { sisa } from '../nota.js';
import { showNota } from '../nota-ui.js';

const st = { q: '' };
export default async function (el) {
  let notas = [], profile;
  const load = async () => { [notas, profile] = await Promise.all([db.getAll('notas'), db.getProfile()]); };
  const list = () => {
    const q = st.q.toLowerCase();
    return notas.filter((n) => !q || [n.no, n.customerName, n.phone, n.address].some((v) => (v || '').toLowerCase().includes(q))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };
  const listHTML = () => {
    const l = list();
    if (!l.length) return notas.length ? emptyState('Nota tidak ditemukan', 'Ubah kata kunci pencarian.') : emptyState('Belum ada nota', 'Buat nota pertama di menu Buat Nota.');
    return l.map((n) => `<div class="card tap" data-id="${n.id}"><div class="row between"><b style="font-size:16px">${esc(n.customerName)}</b><b>${rupiah(n.total)}</b></div>
      <div class="muted small">${esc(n.no)} · ${fmtDate(n.date)}${n.locTime ? ' · ' + esc(n.locTime) : ''}</div>
      <div class="row between small" style="margin-top:4px"><span>${n.items.length} menu</span><span class="badge ${n.paid ? 'ok' : 'warn'}">${n.paid ? 'Lunas' : n.dp > 0 ? 'DP, sisa ' + rupiah(sisa(n)) : 'Belum lunas'}</span></div></div>`).join('');
  };
  const draw = () => {
    el.innerHTML = `${pageHeader('Riwayat Nota', { actions: '<button class="btn small" data-action="csv">Ekspor CSV</button>' })}
      <div class="search">${icon('search', 20)}<input type="search" id="q" placeholder="Cari no. nota, nama, telepon, alamat" value="${esc(st.q)}" autocomplete="off"></div><div id="list">${listHTML()}</div>`;
  };
  el.onclick = async (e) => {
    if (e.target.closest('[data-action=csv]')) {
      return downloadCSV(`nota-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([['No Nota', 'Tanggal', 'Pelanggan', 'Telepon', 'Jam di Lokasi', 'Alamat', 'Menu', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'DP', 'Sisa', 'Status', 'Catatan'],
        ...list().map((n) => [n.no, n.date, n.customerName, n.phone, n.locTime, n.address, n.items.map((i) => `${i.qty}x ${i.name} @${i.price}`).join('; '), n.subtotal, n.discount, n.tax, n.total, n.dp, sisa(n), n.paid ? 'Lunas' : 'Belum lunas', n.note])]));
    }
    const c = e.target.closest('.card[data-id]');
    if (!c) return;
    const n = notas.find((x) => x.id === c.dataset.id);
    showNota(n, profile, {
      extra: '<button class="btn" data-a="dup" type="button">Duplikat</button><button class="btn" data-a="paid" type="button">' + (n.paid ? 'Batalkan Lunas' : 'Tandai Lunas') + '</button><button class="btn edit" data-a="edit" type="button">Edit</button><button class="btn danger" data-a="del" type="button">Hapus</button>',
      onAction: async (a, close) => {
        if (a === 'edit') { close(); location.hash = '#/buat?id=' + n.id; }
        if (a === 'dup') { close(); location.hash = '#/buat?dup=' + n.id; }
        if (a === 'paid') { await db.put('notas', { ...n, paid: !n.paid, updatedAt: Date.now() }); close(); toast('Status pembayaran diubah'); await load(); draw(); }
        if (a === 'del' && (await confirmDialog(`Hapus nota ${n.no} untuk ${n.customerName}? Nomor nota tidak akan dipakai lagi.`))) { await db.del('notas', n.id); close(); toast('Nota dihapus'); await load(); draw(); }
      },
    });
  };
  el.oninput = (e) => { if (e.target.id === 'q') { st.q = e.target.value; el.querySelector('#list').innerHTML = listHTML(); } };
  await load(); draw();
}
