// Panel hasil/detail nota: simpan PDF, kirim WhatsApp (pelanggan / grup), salin teks.
import { esc, rupiah, fmtDate, openSheet, toast, downloadBlob } from './util.js';
import { waNumber } from './calc.js';
import { shareTextCustomer, shareTextGroup, notaFileName, sisa } from './nota.js';

export function reserveWhatsAppChat(phone) {
  const wa = waNumber(phone);
  return wa ? window.open(`https://wa.me/${wa}`, '_blank') : null;
}

// Selalu membuat PNG. WhatsApp tidak mengizinkan aplikasi web melampirkan gambar
// secara otomatis ke chat tertentu, jadi pengguna tetap memilih gambar dan menekan kirim.
export async function sendNotaImage(n, profile, { mode = 'chat', chatWindow } = {}) {
  const wa = waNumber(n.phone);
  const targetWindow = mode === 'chat' && wa ? (chatWindow || reserveWhatsAppChat(n.phone)) : null;
  if (mode === 'share' && n.phone) { try { await navigator.clipboard.writeText(n.phone); } catch { /* abaikan */ } }
  try {
    const { buildNotaPng } = await import('./nota-image.js');
    const { blob, filename } = await buildNotaPng({ nota: n, profile });
    const file = new File([blob], filename, { type: 'image/png' });
    if (mode === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
      toast(n.phone ? `Pilih kontak ${n.customerName} (nomor ${n.phone} sudah disalin)` : `Pilih kontak ${n.customerName}`);
      // Hanya file, tanpa teks: WhatsApp kadang membuang gambar bila ikut ada teks.
      try { await navigator.share({ files: [file] }); }
      catch (err) { if (err.name !== 'AbortError') throw err; }
      return;
    }
    downloadBlob(filename, blob);
    if (wa) {
      toast(targetWindow && !targetWindow.closed
        ? `Gambar tersimpan. Di chat ${n.customerName}, ketuk lampiran lalu pilih gambar nota`
        : `Gambar tersimpan. Buka chat WhatsApp ${n.customerName} secara manual`);
    } else toast(`Gambar tersimpan: ${filename}`);
  } catch (err) {
    if (targetWindow && !targetWindow.closed) targetWindow.close();
    throw err;
  }
}

export function showNota(n, profile, { title, extra = '', onAction } = {}) {
  const wa = waNumber(n.phone);
  const custText = shareTextCustomer(n, profile), grpText = shareTextGroup(n, profile);
  openSheet(title || n.no, `
    <div class="actions"><button class="btn primary" data-a="img" type="button">Kirim Gambar &amp; Buka Chat</button><button class="btn" data-a="pdf" type="button">Simpan PDF</button></div>
    <div class="badges" style="margin:10px 0 6px"><span class="badge">${esc(n.no)}</span><span class="badge ${n.paid ? 'ok' : 'warn'}">${n.paid ? 'Lunas' : n.dp > 0 ? 'DP, sisa ' + rupiah(sisa(n)) : 'Belum lunas'}</span></div>
    <dl class="kv"><dt>Pelanggan</dt><dd>${esc(n.customerName)}</dd><dt>Telepon</dt><dd>${esc(n.phone) || '-'}</dd><dt>Tanggal</dt><dd>${fmtDate(n.date)}${n.locTime ? ' · ' + esc(n.locTime) + ' WIB' : ''}</dd>
      ${n.address ? `<dt>Alamat</dt><dd>${esc(n.address)}</dd>` : ''}${n.note ? `<dt>Catatan</dt><dd>${esc(n.note)}</dd>` : ''}</dl>
    <table class="items-table"><thead><tr><th>Menu</th><th class="r">Harga</th><th class="r">Jml</th><th class="r">Subtotal</th></tr></thead><tbody>
      ${n.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${rupiah(i.price)}</td><td class="r">${i.qty}</td><td class="r">${rupiah(Math.round(i.qty * i.price))}</td></tr>`).join('')}</tbody></table>
    ${n.discount > 0 ? `<div class="sumrow"><span>Diskon</span><span>-${rupiah(n.discount)}</span></div>` : ''}${n.tax > 0 ? `<div class="sumrow"><span>Pajak (${n.taxRate}%)</span><span>${rupiah(n.tax)}</span></div>` : ''}
    <div class="total-line"><span>Total</span><span>${rupiah(n.total)}</span></div>${n.dp > 0 ? `<div class="sumrow"><span>DP</span><span>${rupiah(n.dp)}</span></div>` : ''}
    <details class="adv"><summary>Cara kirim lainnya</summary>
      ${wa ? '<div class="actions"><button class="btn" data-a="share-img" type="button">Bagikan gambar (pilih aplikasi/kontak)</button></div>' : ''}
      <div class="actions">${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(custText)}">WhatsApp Teks</a>` : ''}<a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(grpText)}">Teks ke Grup</a><button class="btn" data-a="copy" type="button">Salin Teks</button></div></details>
    ${extra ? `<div class="actions">${extra}</div>` : ''}`, {
    onMount: (body, close) => {
      body.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        if (a === 'pdf') {
          const btn = e.target.closest('button'); btn.disabled = true;
          try {
            const { buildNotaPdf } = await import('./nota-pdf.js');
            const { blob, filename } = await buildNotaPdf({ nota: n, profile });
            downloadBlob(filename, blob); toast(`Tersimpan: ${filename}`);
          } catch (err) { console.error(err); toast('Gagal membuat PDF: ' + (err.message || err), 'err'); }
          btn.disabled = false; return;
        }
        if (a === 'img' || a === 'chat' || a === 'share-img') {
          const btn = e.target.closest('button'); btn.disabled = true;
          try { await sendNotaImage(n, profile, { mode: a === 'share-img' ? 'share' : 'chat' }); }
          catch (err) { console.error(err); toast('Gagal membuat gambar: ' + (err.message || err), 'err'); }
          btn.disabled = false; return;
        }
        if (a === 'copy') { try { await navigator.clipboard.writeText(grpText); toast('Teks nota disalin'); } catch { toast('Gagal menyalin', 'err'); } return; }
        if (onAction) onAction(a, close);
      });
    },
  });
}
