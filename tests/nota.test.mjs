import assert from 'node:assert/strict';
import test from 'node:test';
import { notaNo, notaFileName, sisa, shareTextCustomer, shareTextGroup } from '../js/nota.js';

const N = { no: 'N-0003', customerName: 'Ani', phone: '0812', date: '2026-10-22', locTime: '12:30', address: 'Jl. Mawar 5', items: [{ name: 'Ayam', qty: 3, price: 30000 }], discount: 0, tax: 0, total: 90000, dp: 30000, paid: false, note: 'Pedas' };
test('nomor dan nama berkas berurutan', () => {
  assert.equal(notaNo(3), 'N-0003'); assert.equal(notaNo(12345), 'N-12345');
  assert.equal(notaFileName(N), 'NOTA-20261022-0003.pdf');
});
test('sisa tagihan', () => { assert.equal(sisa(N), 60000); assert.equal(sisa({ ...N, paid: true }), 0); assert.equal(sisa({ ...N, dp: 999999 }), 0); });
test('teks WhatsApp pelanggan vs grup', () => {
  const c = shareTextCustomer(N, { businessName: 'Penyetan 234' }), g = shareTextGroup(N, { businessName: 'Penyetan 234' });
  assert.match(c, /\*NOTA N-0003\*/); assert.match(c, /@ Rp\s?30\.000/); assert.match(c, /Terima kasih/);
  assert.match(g, /\*PESANAN N-0003\*/); assert.doesNotMatch(g, /@ Rp/); assert.match(g, /Jam di lokasi: 12:30 WIB/); assert.match(g, /Alamat: Jl. Mawar 5/); assert.match(g, /Sisa tagihan: Rp\s?60\.000/);
});

import { accountLine } from '../js/nota.js';
test('rekening tampil di teks pelanggan, tidak di teks grup', () => {
  const acc = [{ bank: 'BCA', number: '1234567890', holder: 'Budi' }];
  assert.equal(accountLine(acc[0]), 'BCA 1234567890 a.n. Budi');
  assert.match(shareTextCustomer(N, { accounts: acc }), /\*Pembayaran ke:\*\nBCA 1234567890 a\.n\. Budi/);
  assert.match(shareTextCustomer({ ...N, paid: true }, { accounts: acc }), /1234567890/);
  assert.doesNotMatch(shareTextCustomer(N, { accounts: [] }), /Pembayaran ke/);
  assert.doesNotMatch(shareTextGroup(N, { accounts: acc }), /1234567890/);
});
