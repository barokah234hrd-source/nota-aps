import * as db from '../db.js';
import { esc, rupiah, todayStr, toast, formData } from '../util.js';
import { orderTotal, orderBreakdown } from '../calc.js';
import { notaNo } from '../nota.js';
import { showNota, sendNotaImage, reserveWhatsAppChat } from '../nota-ui.js';

export default async function draw(el) {
  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const editId = q.get('id');
  const dupId = q.get('dup');
  const [profile, notas] = await Promise.all([db.getProfile(), db.getAll('notas')]);
  const edit = editId ? notas.find((x) => x.id === editId) : null;
  const src = edit || (dupId ? notas.find((x) => x.id === dupId) : null);
  const p = src ? { ...src, date: edit ? src.date : todayStr(), paid: edit ? src.paid : false, dp: edit ? src.dp : '' } : { customerName: '', phone: '', date: todayStr(), locTime: '', address: '', items: [{ name: '', qty: 1, price: '' }], discountType: 'rp', discountValue: '', taxRate: '', dp: '', paid: false, note: '' };
  const menu = profile.menu || [];
  const custMap = new Map();
  for (const n of [...notas].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) custMap.set(n.customerName.toLowerCase(), n);

  const rowHTML = (it) => `<div class="item-row"><div class="row"><input type="text" class="i-name" list="dl-menu" placeholder="Nama menu" value="${esc(it.name)}" autocomplete="off" aria-label="Nama menu"><button type="button" class="rm" data-rm>Hapus</button></div>
    <div class="grid"><input type="number" class="i-qty" inputmode="decimal" min="0" step="any" value="${it.qty}" aria-label="Jumlah"><input type="number" class="i-price" inputmode="numeric" min="0" placeholder="Harga satuan" value="${it.price}" aria-label="Harga satuan" data-manual="${it.price !== '' ? 1 : 0}">
    <div class="sub">Subtotal: <span class="i-sub">Rp 0</span></div></div></div>`;

  // Opsi lanjutan disembunyikan; terbuka otomatis bila sedang edit/duplikat dengan isi yang tidak standar.
  const advOpen = !!(edit || dupId) && !!(p.locTime || p.address || p.discountValue || p.taxRate || p.dp || p.note || p.date !== todayStr());
  el.innerHTML = `<div class="page-head">${edit ? '<a class="icon-btn" href="#/riwayat" aria-label="Kembali">‹</a>' : ''}<h1>${edit ? 'Edit ' + esc(edit.no) : 'Buat Nota'}</h1></div>
    <form id="f" novalidate>
      <div class="two"><label class="field"><span>Nama pelanggan *</span><input type="text" name="customerName" list="dl-cust" maxlength="80" required value="${esc(p.customerName)}" autocomplete="off"></label>
      <label class="field"><span>No. WhatsApp</span><input type="tel" name="phone" inputmode="tel" maxlength="20" value="${esc(p.phone)}"></label></div>
      <datalist id="dl-cust">${[...custMap.values()].map((n) => `<option value="${esc(n.customerName)}">`).join('')}</datalist>
      <datalist id="dl-menu">${menu.map((m) => `<option value="${esc(m.name)}">${rupiah(m.price)}</option>`).join('')}</datalist>
      <div class="field"><span>Menu *</span><div id="items">${p.items.map(rowHTML).join('')}</div><button class="btn block" type="button" id="add-item">+ Tambah menu</button></div>
      <div class="total-line"><span>Total</span><span id="total">Rp 0</span></div>
      <div class="field"><span>Status pembayaran</span><div class="chips" id="paidseg" style="margin:0">
        <button type="button" class="chip ${p.paid ? '' : 'on'}" data-paid="0" aria-pressed="${p.paid ? 'false' : 'true'}">Belum lunas</button><button type="button" class="chip ${p.paid ? 'on' : ''}" data-paid="1" aria-pressed="${p.paid ? 'true' : 'false'}">Lunas</button></div>
        <input type="hidden" name="paid" value="${p.paid ? 1 : 0}"></div>
      <details class="adv" ${advOpen ? 'open' : ''}><summary>Opsi lainnya: tanggal, jam, alamat, diskon, pajak, DP, catatan</summary>
        <div class="two"><label class="field"><span>Tanggal</span><input type="date" name="date" required value="${esc(p.date)}"></label>
        <label class="field"><span>Jam di lokasi</span><input type="time" name="locTime" value="${esc(p.locTime)}"></label></div>
        <label class="field"><span>Alamat lokasi</span><textarea name="address" maxlength="250" placeholder="Alamat pengantaran / lokasi acara">${esc(p.address)}</textarea></label>
        <div class="card" style="background:#F8FAFC">
          <div class="two"><label class="field"><span>Diskon</span><div class="row"><select name="discountType" style="width:74px;flex:none"><option value="rp" ${p.discountType !== 'pct' ? 'selected' : ''}>Rp</option><option value="pct" ${p.discountType === 'pct' ? 'selected' : ''}>%</option></select><input type="number" name="discountValue" inputmode="decimal" min="0" step="any" value="${p.discountValue || ''}" placeholder="0"></div></label>
          <label class="field"><span>Pajak (%)</span><input type="number" name="taxRate" inputmode="decimal" min="0" max="100" step="any" value="${p.taxRate || ''}" placeholder="0"></label></div>
          <div class="two"><label class="field"><span>DP (Rp)</span><input type="number" name="dp" inputmode="numeric" min="0" value="${p.dp || ''}" placeholder="0"></label><span></span></div>
          <div class="sumrow"><span>Subtotal</span><span id="r-sub">Rp 0</span></div><div class="sumrow"><span>Diskon</span><span id="r-disc">Rp 0</span></div><div class="sumrow"><span>Pajak</span><span id="r-tax">Rp 0</span></div>
          <div class="sumrow"><span>DP</span><span id="r-dp">Rp 0</span></div><div class="sumrow strong"><span>Sisa tagihan</span><span id="r-rem">Rp 0</span></div></div>
        <label class="field"><span>Catatan</span><textarea name="note" maxlength="300">${esc(p.note)}</textarea></label>
      </details>
      <button class="btn primary block" type="submit" data-after="img">${edit ? 'Simpan & Kirim ke Pelanggan' : 'Buat & Kirim ke Pelanggan'}</button>
      <button class="btn block" type="submit" style="margin-top:8px">${edit ? 'Simpan Perubahan Saja' : 'Simpan Saja'}</button>
    </form>`;

  const form = el.querySelector('#f'), itemsEl = el.querySelector('#items');
  const readItems = () => [...itemsEl.querySelectorAll('.item-row')].map((r) => ({ name: r.querySelector('.i-name').value.trim(), qty: parseFloat(r.querySelector('.i-qty').value), price: r.querySelector('.i-price').value === '' ? NaN : parseFloat(r.querySelector('.i-price').value) }));
  const opts = () => ({ discountType: form.discountType.value, discountValue: form.discountValue.value, taxRate: form.taxRate.value, dp: form.dp.value });
  function recalc() {
    itemsEl.querySelectorAll('.item-row').forEach((r) => { r.querySelector('.i-sub').textContent = rupiah(Math.round((parseFloat(r.querySelector('.i-qty').value) || 0) * (parseFloat(r.querySelector('.i-price').value) || 0))); });
    const b = orderBreakdown(orderTotal(readItems()), opts());
    const set = (id, v) => { el.querySelector(id).textContent = v; };
    set('#r-sub', rupiah(b.subtotal)); set('#r-disc', '-' + rupiah(b.discount)); set('#r-tax', rupiah(b.tax)); set('#total', rupiah(b.total)); set('#r-dp', '-' + rupiah(b.dp)); set('#r-rem', rupiah(Math.max(0, b.remaining)));
  }
  el.onclick = (e) => {
    const seg = e.target.closest('[data-paid]');
    if (seg) {
      form.paid.value = seg.dataset.paid;
      el.querySelectorAll('[data-paid]').forEach((b) => { const on = b === seg; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      return;
    }
    if (e.target.id === 'add-item') { itemsEl.insertAdjacentHTML('beforeend', rowHTML({ name: '', qty: 1, price: '' })); itemsEl.lastElementChild.querySelector('.i-name').focus(); }
    if (e.target.closest('[data-rm]')) { if (itemsEl.children.length > 1) e.target.closest('.item-row').remove(); else toast('Minimal satu menu', 'err'); recalc(); }
  };
  el.oninput = (e) => {
    const t = e.target;
    if (t.classList.contains('i-price')) t.dataset.manual = t.value === '' ? '0' : '1';
    if (t.classList.contains('i-name')) {
      const m = menu.find((x) => x.name.toLowerCase() === t.value.trim().toLowerCase());
      const pe = t.closest('.item-row').querySelector('.i-price');
      if (m && pe.dataset.manual !== '1') pe.value = m.price;
    }
    if (t.name === 'customerName') {
      const c = custMap.get(t.value.trim().toLowerCase());
      if (c) { if (!form.phone.value) form.phone.value = c.phone || ''; if (!form.address.value) form.address.value = c.address || ''; }
    }
    recalc();
  };
  el.onsubmit = async (e) => {
    e.preventDefault();
    const sendImg = e.submitter?.dataset.after === 'img';
    const d = formData(form);
    if (!d.customerName) return toast('Nama pelanggan wajib diisi', 'err');
    if (!d.date) return toast('Tanggal wajib diisi', 'err');
    const raw = readItems().filter((i) => i.name || Number.isFinite(i.price));
    if (!raw.length) return toast('Tambahkan minimal satu menu', 'err');
    for (const i of raw) {
      if (!i.name) return toast('Ada item tanpa nama menu', 'err');
      if (!(i.qty > 0)) return toast(`Jumlah "${i.name}" harus lebih dari 0`, 'err');
      if (!Number.isFinite(i.price) || i.price < 0) return toast(`Harga "${i.name}" belum diisi`, 'err');
    }
    const items = raw.map((i) => ({ name: i.name, qty: i.qty, price: Math.round(i.price) }));
    const subtotal = orderTotal(items);
    const dv = Number(d.discountValue || 0), tr = Number(d.taxRate || 0), dpv = Number(d.dp || 0);
    if (!(dv >= 0)) return toast('Diskon tidak valid', 'err');
    if (d.discountType === 'pct' && dv > 100) return toast('Diskon maksimal 100%', 'err');
    if (d.discountType === 'rp' && dv > subtotal) return toast('Diskon melebihi subtotal', 'err');
    if (!(tr >= 0 && tr <= 100)) return toast('Pajak harus antara 0 dan 100%', 'err');
    if (!(dpv >= 0)) return toast('DP tidak valid', 'err');
    const bd = orderBreakdown(subtotal, { discountType: d.discountType, discountValue: dv, taxRate: tr, dp: dpv });
    if (bd.dp > bd.total) return toast('DP melebihi total', 'err');
    const chatWindow = sendImg ? reserveWhatsAppChat(d.phone) : null;
    let no;
    try { no = edit?.no || notaNo(await db.nextCounter()); }
    catch (err) {
      if (chatWindow && !chatWindow.closed) chatWindow.close();
      toast('Gagal membuat nomor nota: ' + (err.message || err), 'err');
      return;
    }
    const nota = { id: edit?.id || db.uid(), no, customerName: d.customerName, phone: d.phone, date: d.date, locTime: d.locTime || '', address: d.address || '',
      items, subtotal, discountType: d.discountType, discountValue: dv, discount: bd.discount, taxRate: tr, tax: bd.tax, total: bd.total, dp: bd.dp, paid: d.paid === '1', note: d.note,
      createdAt: edit?.createdAt || Date.now(), updatedAt: Date.now() };
    try { await db.put('notas', nota); } catch (err) {
      if (chatWindow && !chatWindow.closed) chatWindow.close();
      return toast('Gagal menyimpan: ' + (err.message || err), 'err');
    }
    toast(edit ? 'Nota diperbarui' : `Nota ${nota.no} tersimpan`);
    if (sendImg) {
      try { await sendNotaImage(nota, profile, { mode: 'chat', chatWindow }); } catch (err) { console.error(err); toast('Nota tersimpan, tetapi gambar gagal dibuat: ' + (err.message || err), 'err'); }
    }
    showNota(nota, profile, { title: nota.no });
    if (edit) location.hash = '#/riwayat'; else if (dupId) location.hash = '#/buat'; else draw(el);
  };
  recalc();
}
