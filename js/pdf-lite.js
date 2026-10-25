// Pembuat PDF minimal tanpa dependensi: teks Helvetica, kotak, garis, gambar JPEG. Satuan dalam milimeter.
const REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
export const WIDTHS = { REG, BOLD };

const PT = 72 / 25.4;
const PAGE_W = 595.28, PAGE_H = 841.89;
const num = (n) => (Math.round(n * 100) / 100).toString();

// Hanya ASCII yang aman untuk font standar; huruf beraksen diubah ke huruf dasarnya.
export function clean(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[–—]/g, '-').replace(/·/g, '-')
    .replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e]/g, '?');
}
const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);

export class Pdf {
  constructor() { this.pages = []; this.images = []; this.addPage(); }
  addPage() { this.cur = { ops: [], uses: new Set() }; this.pages.push(this.cur); return this; }
  width(str, size, bold = false) {
    const t = bold ? BOLD : REG;
    let w = 0;
    for (const ch of clean(str)) w += t[ch.charCodeAt(0) - 32] ?? 556;
    return ((w / 1000) * size) / PT; // mm
  }
  wrap(str, maxMm, size, bold = false) {
    const out = [];
    for (const para of clean(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const cand = line ? line + ' ' + word : word;
        if (this.width(cand, size, bold) <= maxMm) { line = cand; continue; }
        if (line) out.push(line);
        let w = word;
        while (this.width(w, size, bold) > maxMm && w.length > 1) { // kata sangat panjang dipotong
          let i = w.length - 1;
          while (i > 1 && this.width(w.slice(0, i), size, bold) > maxMm) i--;
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        line = w;
      }
      out.push(line);
    }
    return out;
  }
  _c(c, stroke) { return `${c.map((v) => num(v / 255)).join(' ')} ${stroke ? 'RG' : 'rg'}`; }
  text(str, x, y, { size = 10, bold = false, align = 'left', color = [0, 0, 0] } = {}) {
    const s = clean(str);
    const w = this.width(s, size, bold);
    const px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.cur.ops.push(`BT ${this._c(color)} /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(px * PT)} ${num(PAGE_H - y * PT)} Td (${esc(s)}) Tj ET`);
  }
  rect(x, y, w, h, { fill = null, stroke = null, lineWidth = 0.3 } = {}) {
    const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.cur.ops.push(`q ${fill ? this._c(fill) : ''} ${stroke ? this._c(stroke, true) : ''} ${num(lineWidth)} w ${num(x * PT)} ${num(PAGE_H - (y + h) * PT)} ${num(w * PT)} ${num(h * PT)} re ${op} Q`);
  }
  line(x1, y1, x2, y2, { color = [0, 0, 0], lineWidth = 0.3 } = {}) {
    this.cur.ops.push(`q ${this._c(color, true)} ${num(lineWidth)} w ${num(x1 * PT)} ${num(PAGE_H - y1 * PT)} m ${num(x2 * PT)} ${num(PAGE_H - y2 * PT)} l S Q`);
  }
  addJpeg(bytes, pxW, pxH) { this.images.push({ bytes, pxW, pxH }); return this.images.length; }
  image(id, x, y, w, h) {
    this.cur.uses.add(id);
    this.cur.ops.push(`q ${num(w * PT)} 0 0 ${num(h * PT)} ${num(x * PT)} ${num(PAGE_H - (y + h) * PT)} cm /Im${id} Do Q`);
  }
  output(title = '') {
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let len = 0;
    const push = (u8) => { chunks.push(u8); len += u8.length; };
    const str = (s) => push(enc.encode(s));
    const obj = (n, fn) => { offsets[n] = len; str(`${n} 0 obj\n`); fn(); str('\nendobj\n'); };
    const nImg = this.images.length;
    const first = 5 + nImg;
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    obj(1, () => str('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => str(`<< /Type /Pages /Count ${this.pages.length} /Kids [${this.pages.map((_, i) => `${first + i * 2} 0 R`).join(' ')}] >>`));
    obj(3, () => str('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    obj(4, () => str('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
    this.images.forEach((im, i) => obj(5 + i, () => {
      str(`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
      push(im.bytes);
      str('\nendstream');
    }));
    const xo = nImg ? ` /XObject << ${this.images.map((_, i) => `/Im${i + 1} ${5 + i} 0 R`).join(' ')} >>` : '';
    this.pages.forEach((p, i) => {
      const pn = first + i * 2, cn = pn + 1;
      obj(pn, () => str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo} >> /Contents ${cn} 0 R >>`));
      const body = enc.encode(p.ops.join('\n'));
      obj(cn, () => { str(`<< /Length ${body.length} >>\nstream\n`); push(body); str('\nendstream'); });
    });
    const infoN = first + this.pages.length * 2;
    obj(infoN, () => str(`<< /Title (${esc(clean(title))}) /Producer (Nota Surabaya) >>`));
    const xref = len;
    str(`xref\n0 ${infoN + 1}\n0000000000 65535 f \n`);
    for (let n = 1; n <= infoN; n++) str(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
    str(`trailer\n<< /Size ${infoN + 1} /Root 1 0 R /Info ${infoN} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
}
