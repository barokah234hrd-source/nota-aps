// Membuat file PDF nota pesanan (A4) dan nama berkasnya.
import { Pdf } from './pdf-lite.js';
import { rupiah, fmtDate } from './calc.js';
import { notaFileName, accountLine } from './nota.js';

const L = 18, R = 192, BLUE = [14, 90, 104], GREY = [242, 242, 242], TEXT = [45, 45, 45], MUTED = [90, 90, 90];

async function logoJpeg() {
  try {
    const blob = await (await fetch('icons/logo-320.png')).blob();
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(bmp, 0, 0);
    const jpg = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
    return { bytes: new Uint8Array(await jpg.arrayBuffer()), w: cv.width, h: cv.height };
  } catch { return null; } // PDF tetap dibuat tanpa logo bila gagal
}

export async function buildNotaPdf({ nota: o, profile }) {
  const pdf = new Pdf();
  const logo = await logoJpeg();

  /* Kepala */
  let nameX = L;
  if (logo) { pdf.image(pdf.addJpeg(logo.bytes, logo.w, logo.h), L, 12, 26, 26); nameX = L + 31; }
  let nameSize = 17;
  while (nameSize > 10 && pdf.width(profile.businessName, nameSize) > 112 - nameX) nameSize -= 1;
  pdf.text(profile.businessName, nameX, 24, { size: nameSize, color: [20, 20, 20] });
  let ay = 30;
  for (const line of pdf.wrap(profile.address || '', 112 - nameX, 9.5)) { if (line) { pdf.text(line, nameX, ay, { size: 9.5, color: TEXT }); ay += 4.6; } }
  if (profile.phone) pdf.text(profile.phone, nameX, ay, { size: 9.5, color: TEXT });

  pdf.text(`No: ${o.no}`, R, 24, { size: 9.5, align: 'right', color: TEXT });
  pdf.text(`Tgl: ${fmtDate(o.date)}`, R, 28.6, { size: 9.5, align: 'right', color: TEXT });
  if (o.locTime) pdf.text(`Jam di lokasi: ${o.locTime} WIB`, R, 33.2, { size: 9.5, align: 'right', color: TEXT });

  /* Kepada */
  let y = 56;
  pdf.text('Kepada:', L, y, { size: 10, color: TEXT });
  const to = [o.customerName, o.phone, o.address].filter(Boolean);
  for (const t of to) for (const ln of pdf.wrap(t, 110, 10)) { y += 5.2; pdf.text(ln, L, y, { size: 10, color: TEXT }); }

  /* Tabel */
  const X = { name: L + 2, qty: 128, price: 142, sub: 168 };
  const head = (top) => {
    pdf.rect(L, top, R - L, 8, { fill: BLUE });
    const by = top + 5.5;
    for (const [t, x] of [['Produk', X.name], ['Qty', X.qty], ['Harga', X.price], ['Subtotal', X.sub]]) pdf.text(t, x, by, { size: 10, bold: true, color: [255, 255, 255] });
    return top + 8;
  };
  y = head(Math.max(y + 8, 84));
  o.items.forEach((it, idx) => {
    const lines = pdf.wrap(it.name, X.qty - X.name - 4, 10);
    const h = Math.max(8, lines.length * 4.8 + 3.6);
    if (y + h > 275) { pdf.addPage(); y = head(18); }
    if (idx % 2 === 0) pdf.rect(L, y, R - L, h, { fill: GREY });
    lines.forEach((ln, i) => pdf.text(ln, X.name, y + 5.2 + i * 4.8, { size: 10, color: TEXT }));
    pdf.text(String(it.qty), X.qty, y + 5.2, { size: 10, color: TEXT });
    pdf.text(rupiah(it.price), X.price, y + 5.2, { size: 10, color: TEXT });
    pdf.text(rupiah(Math.round(it.qty * it.price)), X.sub, y + 5.2, { size: 10, color: TEXT });
    y += h;
  });

  /* Total */
  const dp = o.dp || 0;
  const rows = [];
  rows.push(['Subtotal', rupiah(o.subtotal ?? o.total)]);
  if (o.discount > 0) rows.push([`Diskon${o.discountType === 'pct' ? ` (${o.discountValue}%)` : ''}`, '-' + rupiah(o.discount)]);
  if (o.tax > 0) rows.push([`Pajak (${o.taxRate}%)`, rupiah(o.tax)]);
  rows.push(['TOTAL', rupiah(o.total), true]);
  if (dp > 0) {
    rows.push([`DP${o.dpDate ? ' (' + fmtDate(o.dpDate) + ')' : ''}`, '-' + rupiah(dp)]);
    rows.push(o.paid ? ['Pelunasan', rupiah(o.total - dp)] : ['SISA TAGIHAN', rupiah(o.total - dp), true]);
  }
  const need = rows.length * 6 + 40;
  if (y + 8 + need > 285) { pdf.addPage(); y = 14; }
  const noteTop = y + 8;
  y += 10;
  for (const [label, val, strong] of rows) {
    if (strong) pdf.line(128, y - 4.4, R, y - 4.4, { color: [180, 180, 180], lineWidth: 0.25 });
    pdf.text(label, 130, y, { size: strong ? 10.5 : 10, bold: !!strong, color: TEXT });
    pdf.text(val, R - 2, y, { size: strong ? 10.5 : 10, bold: !!strong, align: 'right', color: TEXT });
    y += 6;
  }
  pdf.text(o.paid ? `Status: LUNAS` : 'Status: BELUM LUNAS', R - 2, y + 1, { size: 10, bold: true, align: 'right', color: o.paid ? [5, 150, 105] : [200, 40, 40] });

  /* Rekening pembayaran (selalu tampil bila sudah diisi) */
  const accts = (profile.accounts || []).filter((a) => a.number);
  if (accts.length) {
    let ay2 = y + 12;
    if (ay2 + 8 + accts.length * 5.4 > 285) { pdf.addPage(); ay2 = 20; }
    pdf.text('Pembayaran ke:', R - 2, ay2, { size: 10, bold: true, align: 'right', color: TEXT });
    accts.forEach((a, i) => pdf.text(accountLine(a), R - 2, ay2 + 5.6 * (i + 1), { size: 10, align: 'right', color: TEXT }));
  }

  /* Catatan */
  if (o.note) {
    pdf.text('Catatan:', L, noteTop + 2, { size: 9.5, bold: true, color: MUTED });
    pdf.wrap(o.note, 100, 9.5).forEach((ln, i) => pdf.text(ln, L, noteTop + 7 + i * 4.6, { size: 9.5, color: MUTED }));
  }

  return { blob: pdf.output(`Nota ${o.no}`), filename: notaFileName(o) };
}
