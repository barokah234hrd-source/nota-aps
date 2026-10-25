// Membuat gambar PNG nota (untuk dikirim lewat WhatsApp) dengan canvas.
import { rupiah, fmtDate } from './calc.js';
import { notaFileName, accountLine } from './nota.js';

export const notaImageName = (n) => notaFileName(n).replace(/\.pdf$/, '.png');

const W = 640, S = 2, PAD = 28;
const FONT = (sz, bold) => `${bold ? '700 ' : ''}${sz}px "Helvetica Neue", Arial, "Liberation Sans", sans-serif`;

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      let w = word;
      while (ctx.measureText(w).width > maxW) { // kata sangat panjang dipotong
        let k = w.length; while (k > 1 && ctx.measureText(w.slice(0, k)).width > maxW) k--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, k)); w = w.slice(k);
      }
      const t = line ? line + ' ' + w : w;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

async function loadLogo() {
  try { return await createImageBitmap(await (await fetch('icons/logo-320.png')).blob()); } catch { return null; }
}

export async function buildNotaPng({ nota: o, profile }) {
  const logo = await loadLogo();
  const tall = document.createElement('canvas');
  tall.width = W * S; tall.height = (500 + o.items.length * 90 + (o.note ? 200 : 0) + (o.address ? 120 : 0) + ((profile.accounts || []).length * 30 + 50)) * S;
  const c = tall.getContext('2d');
  c.scale(S, S);
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, tall.height / S);
  const TXT = '#2d2d2d', MUT = '#5a5a5a';
  const text = (t, x, y, { size = 14, bold = false, color = TXT, align = 'left' } = {}) => { c.font = FONT(size, bold); c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(t, x, y); };

  /* Kepala */
  let nx = PAD;
  if (logo) { c.drawImage(logo, PAD, 22, 84, 84); nx = PAD + 100; }
  c.font = FONT(24, true);
  let size = 24; while (size > 14 && c.measureText(profile.businessName).width > 330 - (nx - PAD)) { size--; c.font = FONT(size, true); }
  text(profile.businessName, nx, 52, { size, bold: true, color: '#141414' });
  let y = 76; c.font = FONT(13);
  for (const ln of wrap(c, profile.address || '', 330 - (nx - PAD))) { if (ln) { text(ln, nx, y, { size: 13 }); y += 18; } }
  if (profile.phone) text(profile.phone, nx, y, { size: 13 });
  const R = W - PAD;
  text(`No: ${o.no}`, R, 48, { size: 14, align: 'right' });
  text(`Tgl: ${fmtDate(o.date)}`, R, 68, { size: 14, align: 'right' });
  if (o.locTime) text(`Jam di lokasi: ${o.locTime} WIB`, R, 88, { size: 14, align: 'right' });

  /* Kepada */
  y = Math.max(y + 30, 136);
  text('Kepada:', PAD, y, { size: 14, color: MUT });
  c.font = FONT(15);
  for (const t of [o.customerName, o.phone, o.address].filter(Boolean)) for (const ln of wrap(c, t, W - 2 * PAD)) { y += 21; text(ln, PAD, y, { size: 15, bold: t === o.customerName }); }

  /* Tabel */
  y += 22;
  const X = { name: PAD + 10, qty: 360, price: 420, sub: R - 8 };
  c.fillStyle = '#0E5A68'; c.fillRect(PAD, y, W - 2 * PAD, 30);
  text('Produk', X.name, y + 20, { size: 14, bold: true, color: '#fff' }); text('Qty', X.qty, y + 20, { size: 14, bold: true, color: '#fff' });
  text('Harga', X.price, y + 20, { size: 14, bold: true, color: '#fff' }); text('Subtotal', X.sub, y + 20, { size: 14, bold: true, color: '#fff', align: 'right' });
  y += 30;
  c.font = FONT(14);
  o.items.forEach((it, i) => {
    const lines = wrap(c, it.name, X.qty - X.name - 16);
    const h = Math.max(32, lines.length * 19 + 14);
    if (i % 2 === 0) { c.fillStyle = '#f2f2f2'; c.fillRect(PAD, y, W - 2 * PAD, h); }
    lines.forEach((ln, k) => text(ln, X.name, y + 21 + k * 19, { size: 14 }));
    text(String(it.qty), X.qty, y + 21, { size: 14 }); text(rupiah(it.price), X.price, y + 21, { size: 14 });
    text(rupiah(Math.round(it.qty * it.price)), X.sub, y + 21, { size: 14, align: 'right' });
    y += h; c.font = FONT(14);
  });

  /* Total */
  y += 14;
  const rows = [['Subtotal', rupiah(o.subtotal ?? o.total)]];
  if (o.discount > 0) rows.push([`Diskon${o.discountType === 'pct' ? ` (${o.discountValue}%)` : ''}`, '-' + rupiah(o.discount)]);
  if (o.tax > 0) rows.push([`Pajak (${o.taxRate}%)`, rupiah(o.tax)]);
  rows.push(['TOTAL', rupiah(o.total), true]);
  if (o.dp > 0) { rows.push(['DP', '-' + rupiah(o.dp)]); rows.push(o.paid ? ['Pelunasan', rupiah(o.total - o.dp)] : ['SISA TAGIHAN', rupiah(o.total - o.dp), true]); }
  const noteTop = y;
  for (const [l, v, strong] of rows) {
    y += 26;
    if (strong) { c.strokeStyle = '#b4b4b4'; c.lineWidth = 1; c.beginPath(); c.moveTo(340, y - 18); c.lineTo(R, y - 18); c.stroke(); }
    text(l, 346, y, { size: strong ? 15 : 14, bold: !!strong }); text(v, R - 8, y, { size: strong ? 15 : 14, bold: !!strong, align: 'right' });
  }
  y += 30;
  text(o.paid ? 'Status: LUNAS' : 'Status: BELUM LUNAS', R - 8, y, { size: 14, bold: true, align: 'right', color: o.paid ? '#059669' : '#c82828' });

  const accts = (profile.accounts || []).filter((a) => a.number);
  if (accts.length) {
    y += 30; text('Pembayaran ke:', R - 8, y, { size: 14, bold: true, align: 'right' });
    for (const a of accts) { y += 22; text(accountLine(a), R - 8, y, { size: 14, align: 'right' }); }
  }

  /* Catatan (kiri, sejajar total) */
  let ny = noteTop + 26;
  if (o.note) { text('Catatan:', PAD, ny, { size: 13, bold: true, color: MUT }); c.font = FONT(13); for (const ln of wrap(c, o.note, 290)) { ny += 18; text(ln, PAD, ny, { size: 13, color: MUT }); } }
  y = Math.max(y, ny) + 34;
  text('Terima kasih', W / 2, y, { size: 13, color: MUT, align: 'center' });
  y += 24;

  const out = document.createElement('canvas');
  out.width = W * S; out.height = Math.ceil(y * S);
  out.getContext('2d').drawImage(tall, 0, 0, W * S, out.height, 0, 0, W * S, out.height);
  const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Gagal membuat gambar');
  return { blob, filename: notaImageName(o) };
}
