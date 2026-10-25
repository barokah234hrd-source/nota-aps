// Logika murni nota (bisa diuji di Node).
import { rupiah, fmtDate } from './calc.js';

export const notaNo = (n) => `N-${String(n).padStart(4, '0')}`;
// Nama berkas PDF berurutan: NOTA-TanggalNota-NomorUrut, mis. NOTA-20261022-0003.pdf
export const notaFileName = (nota) => `NOTA-${String(nota.date).replace(/-/g, '')}-${String(nota.no).replace(/\D/g, '').padStart(4, '0')}.pdf`;
// Rekening pembayaran, mis. "BCA 1234567890 a.n. Nama".
export const accountLine = (a) => [a.bank, a.number, a.holder ? 'a.n. ' + a.holder : ''].filter(Boolean).join(' ');
export const sisa = (n) => (n.paid ? 0 : Math.max(0, (Number(n.total) || 0) - (Number(n.dp) || 0)));

function lines(n, { forCustomer, businessName, accounts }) {
  const L = [];
  L.push(forCustomer ? `*NOTA ${n.no}* - ${businessName || ''}`.trim() : `*PESANAN ${n.no}*${businessName ? ' - ' + businessName : ''}`);
  L.push(`Pelanggan: ${n.customerName}`);
  if (n.phone) L.push(`Telepon: ${n.phone}`);
  L.push(`Tanggal: ${fmtDate(n.date)}`);
  if (n.locTime) L.push(`Jam di lokasi: ${n.locTime} WIB`);
  if (n.address) L.push(`Alamat: ${n.address}`);
  L.push('', '*Menu:*');
  for (const i of n.items || []) L.push(forCustomer ? `- ${i.qty}x ${i.name} @ ${rupiah(i.price)}` : `- ${i.qty}x ${i.name}`);
  L.push('');
  if (forCustomer && n.discount > 0) L.push(`Diskon: -${rupiah(n.discount)}`);
  if (forCustomer && n.tax > 0) L.push(`Pajak (${n.taxRate}%): ${rupiah(n.tax)}`);
  L.push(`Total: ${rupiah(n.total)}`);
  if (n.dp > 0) L.push(`DP: ${rupiah(n.dp)}`);
  L.push(n.paid ? 'Pembayaran: Lunas' : `Sisa tagihan: ${rupiah(sisa(n))}`);
  if (n.note) L.push('', `Catatan: ${n.note}`);
  if (forCustomer && (accounts || []).length) { L.push('', '*Pembayaran ke:*'); for (const a of accounts) L.push(accountLine(a)); }
  return L.join('\n');
}
export const shareTextCustomer = (n, biz = {}) => lines(n, { forCustomer: true, businessName: biz.businessName, accounts: biz.accounts }) + '\n\nTerima kasih.';
export const shareTextGroup = (n, biz = {}) => lines(n, { forCustomer: false, businessName: biz.businessName });
