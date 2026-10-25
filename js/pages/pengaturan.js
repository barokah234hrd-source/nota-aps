import * as db from '../db.js';
import { accountLine } from '../nota.js';
import { esc, rupiah, toast, formData, pageHeader, confirmDialog, downloadText, promptInstall } from '../util.js';

export default async function (el) {
  let profile = await db.getProfile();
  const draw = () => {
    el.innerHTML = `${pageHeader('Pengaturan')}
      <form id="fp" novalidate><div class="card"><h3 style="margin-bottom:8px">Identitas usaha (tampil di nota)</h3>
        <label class="field"><span>Nama usaha</span><input type="text" name="businessName" maxlength="80" value="${esc(profile.businessName)}"></label>
        <label class="field"><span>Alamat</span><textarea name="address" maxlength="250" placeholder="Isi alamat resto agar tampil di nota">${esc(profile.address)}</textarea></label>
        <label class="field"><span>Telepon</span><input type="tel" name="phone" maxlength="20" placeholder="Isi nomor telepon resto" value="${esc(profile.phone)}"></label>
        <button class="btn primary block" type="submit">Simpan</button></div></form>
      <div class="card"><h3 style="margin-bottom:4px">Rekening pembayaran</h3><div class="muted small" style="margin-bottom:8px">Tampil di nota yang belum lunas dan di pesan WhatsApp ke pelanggan.</div>
        ${(profile.accounts || []).map((a, i) => `<div class="row between" style="padding:6px 0;border-bottom:1px dashed var(--line)"><span>${esc(accountLine(a))}</span><button class="btn small danger" data-rmacc="${i}" type="button">Hapus</button></div>`).join('') || '<div class="muted small">Belum ada rekening.</div>'}
        <form id="fa" novalidate style="margin-top:10px"><label class="field"><span>Bank / e-wallet</span><input type="text" name="bank" maxlength="30" placeholder="mis. BCA, BRI, DANA"></label>
        <div class="two"><label class="field"><span>Nomor rekening</span><input type="text" name="number" inputmode="numeric" maxlength="30"></label><label class="field"><span>Atas nama</span><input type="text" name="holder" maxlength="60"></label></div>
        <button class="btn block" type="submit">+ Tambah rekening</button></form></div>
      <div class="card"><h3 style="margin-bottom:4px">Menu cepat</h3><div class="muted small" style="margin-bottom:8px">Daftar nama dan harga agar terisi otomatis saat membuat nota. Harga di nota lama tidak ikut berubah.</div>
        ${(profile.menu || []).map((m, i) => `<div class="row between" style="padding:6px 0;border-bottom:1px dashed var(--line)"><span>${esc(m.name)} · ${rupiah(m.price)}</span><button class="btn small danger" data-rm="${i}" type="button">Hapus</button></div>`).join('') || '<div class="muted small">Belum ada menu cepat.</div>'}
        <form id="fm" novalidate style="margin-top:10px"><div class="two"><label class="field"><span>Nama menu</span><input type="text" name="name" maxlength="80"></label><label class="field"><span>Harga (Rp)</span><input type="number" name="price" inputmode="numeric" min="0"></label></div><button class="btn block" type="submit">+ Tambah menu cepat</button></form></div>
      <div class="card"><h3 style="margin-bottom:4px">Cadangan data</h3><div class="muted small" style="margin-bottom:8px">Data nota hanya tersimpan di HP ini. Unduh cadangan secara rutin.</div>
        <div class="actions"><button class="btn primary" data-a="backup" type="button">Unduh Cadangan</button><label class="btn" style="cursor:pointer">Pulihkan<input type="file" accept=".json,application/json" id="restore" hidden></label></div></div>
      <div class="actions"><button class="btn" data-a="install" type="button">Pasang di Layar Utama</button></div>`;
  };
  const save = async (p) => { profile = { ...p, key: 'profile' }; await db.put('settings', profile); };
  el.onsubmit = async (e) => {
    e.preventDefault(); const d = formData(e.target);
    if (e.target.id === 'fp') { if (!d.businessName) return toast('Nama usaha wajib diisi', 'err'); await save({ ...profile, businessName: d.businessName, address: d.address, phone: d.phone }); toast('Tersimpan'); }
    if (e.target.id === 'fa') {
      if (!d.bank) return toast('Isi nama bank atau e-wallet', 'err');
      if (!/^[0-9 .\-]{4,30}$/.test(d.number || '')) return toast('Nomor rekening hanya angka (4-30 karakter)', 'err');
      await save({ ...profile, accounts: [...(profile.accounts || []), { bank: d.bank, number: d.number, holder: d.holder }] }); toast('Rekening ditambahkan'); return draw();
    }
    if (e.target.id === 'fm') {
      const price = Math.round(Number(d.price));
      if (!d.name) return toast('Nama menu wajib diisi', 'err');
      if (!(price >= 0) || d.price === '') return toast('Harga belum diisi', 'err');
      if ((profile.menu || []).some((m) => m.name.toLowerCase() === d.name.toLowerCase())) return toast('Menu sudah ada', 'err');
      await save({ ...profile, menu: [...(profile.menu || []), { name: d.name, price }] }); toast('Menu cepat ditambahkan'); draw();
    }
  };
  el.onclick = async (e) => {
    const ra = e.target.closest('[data-rmacc]');
    if (ra) { const a = profile.accounts[+ra.dataset.rmacc]; if (await confirmDialog(`Hapus rekening ${a.bank} ${a.number}?`)) { await save({ ...profile, accounts: profile.accounts.filter((_, i) => i !== +ra.dataset.rmacc) }); draw(); } return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { const m = profile.menu[+rm.dataset.rm]; if (await confirmDialog(`Hapus "${m.name}" dari menu cepat?`)) { await save({ ...profile, menu: profile.menu.filter((_, i) => i !== +rm.dataset.rm) }); draw(); } return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'backup') { const data = await db.exportAll(); downloadText(`cadangan-nota-surabaya-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), 'application/json'); toast('Cadangan diunduh'); }
    if (a === 'install') { if (!(await promptInstall())) toast('Gunakan menu ⋮ Chrome → Instal aplikasi', 'ok'); }
  };
  el.onchange = async (e) => {
    if (e.target.id !== 'restore' || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!(await confirmDialog('Pulihkan cadangan? Semua data nota saat ini akan diganti.', { okText: 'Pulihkan' }))) return;
      await db.importAll(data); toast('Cadangan dipulihkan'); profile = await db.getProfile(); draw();
    } catch (err) { toast(err.message || 'Berkas tidak valid', 'err'); }
  };
  draw();
}
