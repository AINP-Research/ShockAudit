import { zlibSync } from "fflate";
import { reportFontData } from "./report-fonts";
import type { CompleteReport, CompleteReportBlock } from "./complete-report-data";
import type { Screen6DesignMapPanel } from "../../core/six-screen/screen6-design-map";
import { completeReportSectionStyle } from "./complete-report-style";

const xml = (value: string) => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

type Weight = "regular" | "bold";
type RGB = readonly [number, number, number];
const encoder = new TextEncoder();
const ink = "#20354c", muted = "#62748a", teal = "#087f79";
const color = (hex: string): RGB => [1, 3, 5].map((index) =>
  parseInt(hex.slice(index, index + 2), 16) / 255) as unknown as RGB;
const decimal = (value: number) => Number(value.toFixed(3)).toString();
const rgb = (hex: string) => color(hex).map(decimal).join(" ");
const hex4 = (number: number) => number.toString(16).padStart(4, "0").toUpperCase();
function unicodeHex(text: string) {
  return Array.from({ length: text.length }, (_, index) => hex4(text.charCodeAt(index))).join("");
}
function pdfString(text: string) { return `<FEFF${unicodeHex(text)}>`; }
function joined(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

/** Small TrueType reader: widths and Unicode cmap are the same metrics used
 * by the embedded PDF font. Wrapping does not depend on browser zoom or DPI. */
class ReportFont {
  data: ReturnType<typeof reportFontData>;
  view: DataView;
  tables = new Map<string, number>();
  units = 1000;
  ascender = 800;
  descender = -200;
  box = [0, -200, 1000, 1000];
  widths: number[] = [];
  glyphs = new Map<number, number>();
  cids = new Map<number, number>();
  constructor(readonly weight: Weight) {
    this.data = reportFontData(weight);
    this.view = new DataView(this.data.bytes.buffer);
    const v = this.view;
    for (let i = 0; i < v.getUint16(4); i++) {
      const offset = 12 + i * 16;
      const tag = String.fromCharCode(...this.data.bytes.slice(offset, offset + 4));
      this.tables.set(tag, v.getUint32(offset + 8));
    }
    const head = this.tables.get("head")!, hhea = this.tables.get("hhea")!;
    this.units = v.getUint16(head + 18);
    this.ascender = v.getInt16(hhea + 4) * 1000 / this.units;
    this.descender = v.getInt16(hhea + 6) * 1000 / this.units;
    this.box = [36, 38, 40, 42].map((offset) => v.getInt16(head + offset) * 1000 / this.units);
    const metrics = v.getUint16(hhea + 34), hmtx = this.tables.get("hmtx")!;
    const glyphCount = v.getUint16(this.tables.get("maxp")! + 4);
    for (let i = 0; i < glyphCount; i++) this.widths.push(
      v.getUint16(hmtx + Math.min(i, metrics - 1) * 4) * 1000 / this.units);
    const cmap = this.tables.get("cmap")!;
    const maps: number[] = [];
    for (let i = 0; i < v.getUint16(cmap + 2); i++) maps.push(
      cmap + v.getUint32(cmap + 4 + i * 8 + 4));
    const table = maps.find((offset) => v.getUint16(offset) === 12) ??
      maps.find((offset) => v.getUint16(offset) === 4)!;
    if (v.getUint16(table) === 12) {
      for (let i = 0; i < v.getUint32(table + 12); i++) {
        const offset = table + 16 + i * 12;
        const start = v.getUint32(offset), end = v.getUint32(offset + 4), first = v.getUint32(offset + 8);
        for (let c = start; c <= end; c++) this.glyphs.set(c, first + c - start);
      }
    } else {
      const count = v.getUint16(table + 6) / 2, ends = table + 14;
      const starts = ends + count * 2 + 2, deltas = starts + count * 2, ranges = deltas + count * 2;
      for (let i = 0; i < count; i++) {
        const delta = v.getInt16(deltas + i * 2), range = v.getUint16(ranges + i * 2);
        for (let c = v.getUint16(starts + i * 2); c <= v.getUint16(ends + i * 2) && c < 65535; c++) {
          let glyph = range ? v.getUint16(ranges + i * 2 + range + (c - v.getUint16(starts + i * 2)) * 2) : c;
          if (!range || glyph) glyph = (glyph + delta) & 65535;
          this.glyphs.set(c, glyph);
        }
      }
    }
  }
  width(text: string, size: number) {
    return [...text].reduce((sum, char) => sum +
      (this.widths[this.glyphs.get(char.codePointAt(0)!) ?? 0] ?? 600) * size / 1000, 0);
  }
  encode(text: string) {
    return [...text].map((char) => {
      const point = char.codePointAt(0)!;
      if (!this.cids.has(point)) this.cids.set(point, this.cids.size + 1);
      return hex4(this.cids.get(point)!);
    }).join("");
  }
  wrap(text: string, maximum: number, size: number) {
    const lines: string[] = [];
    for (const paragraph of text.replace(/\r/gu, "").split("\n")) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/u).filter(Boolean)) {
        if (this.width(word, size) > maximum) {
          if (line) { lines.push(line); line = ""; }
          let piece = "";
          for (const character of word) {
            if (piece && this.width(piece + character, size) > maximum) {
              lines.push(piece); piece = "";
            }
            piece += character;
          }
          line = piece;
        } else if (line && this.width(`${line} ${word}`, size) > maximum) {
          lines.push(line); line = word;
        } else line += `${line ? " " : ""}${word}`;
      }
      lines.push(line);
    }
    return lines;
  }
}

class ReportPage {
  operations: string[] = [];
  svg: string[] = [];
  links: Array<{ url: string; x: number; y: number; w: number; h: number }> = [];
  constructor(readonly document: ReportPdf, readonly width: number, readonly height: number) {}
  text(text: string, x: number, top: number, size = 10, weight: Weight = "regular", fill = ink) {
    const font = this.document.fonts[weight];
    this.svg.push(`<text x="${x}" y="${top + font.ascender * size / 1000}" font-family="DejaVu Sans" font-size="${size}" font-weight="${weight === "bold" ? 700 : 400}" fill="${fill}">${xml(text)}</text>`);
    this.operations.push(`BT /${weight === "bold" ? "F2" : "F1"} ${decimal(size)} Tf ${rgb(fill)} rg 1 0 0 1 ${decimal(x)} ${decimal(this.height - top - font.ascender * size / 1000)} Tm <${font.encode(text)}> Tj ET`);
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke = "#dce5eb", width = 1, dashed = false) {
    this.svg.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dashed ? 'stroke-dasharray="3 3"' : ""}/>`);
    this.operations.push(`q ${rgb(stroke)} RG ${decimal(width)} w ${dashed ? "[3 3] 0 d" : "[] 0 d"} ${decimal(x1)} ${decimal(this.height - y1)} m ${decimal(x2)} ${decimal(this.height - y2)} l S Q`);
  }
  rect(x: number, y: number, w: number, h: number, fill: string, stroke?: string, radius = 0) {
    this.svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="0.75"` : ""}/>`);
    const bottom = this.height - y - h, k = 0.552285, r = Math.min(radius, w / 2, h / 2);
    const coordinates = !r ? `${x} ${bottom} ${w} ${h} re` : [
      `${x + r} ${bottom} m`, `${x + w - r} ${bottom} l`,
      `${x + w - r + r * k} ${bottom} ${x + w} ${bottom + r - r * k} ${x + w} ${bottom + r} c`,
      `${x + w} ${bottom + h - r} l`, `${x + w} ${bottom + h - r + r * k} ${x + w - r + r * k} ${bottom + h} ${x + w - r} ${bottom + h} c`,
      `${x + r} ${bottom + h} l`, `${x + r - r * k} ${bottom + h} ${x} ${bottom + h - r + r * k} ${x} ${bottom + h - r} c`,
      `${x} ${bottom + r} l`, `${x} ${bottom + r - r * k} ${x + r - r * k} ${bottom} ${x + r} ${bottom} c h`,
    ].join(" ");
    this.operations.push(`q ${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG 0.75 w` : ""} ${coordinates} ${stroke ? "B" : "f"} Q`);
  }
  link(url: string, x: number, y: number, w: number, h = 12) {
    if (/^https?:\/\//iu.test(url)) this.links.push({ url, x, y, w, h });
  }
}

class ReportPdf {
  fonts = { regular: new ReportFont("regular"), bold: new ReportFont("bold") };
  pages: ReportPage[] = [];
  bookmarks: Array<{ title: string; page: number }> = [];
  page(landscape = false) {
    const page = new ReportPage(this, landscape ? 841.89 : 595.28, landscape ? 595.28 : 841.89);
    this.pages.push(page);
    return page;
  }
  bytes(title: string, generatedAt: string) {
    const objects: Array<Uint8Array | null> = [];
    const reserve = () => { objects.push(null); return objects.length; };
    const set = (id: number, content: string | Uint8Array) => {
      objects[id - 1] = typeof content === "string" ? encoder.encode(content) : content;
    };
    const add = (content: string | Uint8Array) => { const id = reserve(); set(id, content); return id; };
    const stream = (data: Uint8Array, dictionary = "") => joined([
      encoder.encode(`<< /Length ${data.length} ${dictionary} >>\nstream\n`), data, encoder.encode("\nendstream"),
    ]);
    const catalog = reserve(), pageTree = reserve();
    function embed(font: ReportFont) {
      const file = add(stream(font.data.compressed, `/Filter /FlateDecode /Length1 ${font.data.bytes.length}`));
      const name = font.weight === "bold" ? "ShockAuditSansBold" : "ShockAuditSans";
      const descriptor = add(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${font.box.map(decimal).join(" ")}] /ItalicAngle 0 /Ascent ${decimal(font.ascender)} /Descent ${decimal(font.descender)} /CapHeight ${decimal(font.ascender)} /StemV 80 /FontFile2 ${file} 0 R >>`);
      const cidMap = new Uint8Array((font.cids.size + 1) * 2);
      const widths: string[] = [], mappings: string[] = [];
      for (const [point, cid] of font.cids) {
        const glyph = font.glyphs.get(point) ?? 0;
        cidMap[cid * 2] = glyph >> 8; cidMap[cid * 2 + 1] = glyph & 255;
        widths.push(`${cid} [${decimal(font.widths[glyph] ?? 600)}]`);
        mappings.push(`<${hex4(cid)}> <${unicodeHex(String.fromCodePoint(point))}>`);
      }
      const mapping = add(stream(zlibSync(cidMap), "/Filter /FlateDecode"));
      const descendant = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 600 /W [${widths.join(" ")}] /CIDToGIDMap ${mapping} 0 R >>`);
      const unicode = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap", "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def", "/CMapName /ShockAuditUnicode def", "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"];
      for (let i = 0; i < mappings.length; i += 100) unicode.push(
        `${Math.min(100, mappings.length - i)} beginbfchar`, ...mappings.slice(i, i + 100), "endbfchar");
      unicode.push("endcmap CMapName currentdict /CMap defineresource pop end end");
      const toUnicode = add(stream(zlibSync(encoder.encode(unicode.join("\n"))), "/Filter /FlateDecode"));
      return add(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${toUnicode} 0 R >>`);
    }
    const regular = embed(this.fonts.regular), bold = embed(this.fonts.bold);
    const pageIds = this.pages.map(() => reserve());
    for (const [index, page] of this.pages.entries()) {
      const content = add(stream(zlibSync(encoder.encode(page.operations.join("\n"))), "/Filter /FlateDecode"));
      const annotations = page.links.map((link) => add(`<< /Type /Annot /Subtype /Link /Rect [${decimal(link.x)} ${decimal(page.height - link.y - link.h)} ${decimal(link.x + link.w)} ${decimal(page.height - link.y)}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(link.url)} >> >>`));
      set(pageIds[index]!, `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${decimal(page.width)} ${decimal(page.height)}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R ${annotations.length ? `/Annots [${annotations.map((id) => `${id} 0 R`).join(" ")}]` : ""} >>`);
    }
    set(pageTree, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
    const outline = reserve(), bookmarkIds = this.bookmarks.map(() => reserve());
    for (const [index, bookmark] of this.bookmarks.entries()) set(bookmarkIds[index]!,
      `<< /Title ${pdfString(bookmark.title)} /Parent ${outline} 0 R ${index ? `/Prev ${bookmarkIds[index - 1]} 0 R` : ""} ${index < bookmarkIds.length - 1 ? `/Next ${bookmarkIds[index + 1]} 0 R` : ""} /Dest [${pageIds[bookmark.page]} 0 R /Fit] >>`);
    set(outline, `<< /Type /Outlines /Count ${bookmarkIds.length} /First ${bookmarkIds[0]} 0 R /Last ${bookmarkIds.at(-1)} 0 R >>`);
    set(catalog, `<< /Type /Catalog /Pages ${pageTree} 0 R /Outlines ${outline} 0 R /PageMode /UseOutlines /Lang (en) >>`);
    const date = new Date(generatedAt);
    const creationDate = Number.isNaN(date.getTime()) ? "" : ` /CreationDate (D:${date.toISOString().slice(0, 19).replace(/[-:T]/gu, "")}Z)`;
    const info = add(`<< /Title ${pdfString(`ShockAudit Complete Report — ${title}`)} /Author (ShockAudit) /Creator (ShockAudit Complete Report) /Subject ${pdfString("Natural experiment research design: Screens 2–6")}${creationDate} >>`);
    const parts = [encoder.encode("%PDF-1.7\n%ShockAudit\n")], offsets = [0];
    let length = parts[0]!.length;
    for (const [index, object] of objects.entries()) {
      if (!object) throw new Error("The report contains an incomplete PDF object.");
      offsets.push(length);
      const bytes = joined([encoder.encode(`${index + 1} 0 obj\n`), object, encoder.encode("\nendobj\n")]);
      parts.push(bytes); length += bytes.length;
    }
    const xref = length;
    parts.push(encoder.encode(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    return joined(parts);
  }
}

class ReportFlow {
  page: ReportPage;
  y = 68;
  readonly margin = 42;
  constructor(readonly pdf: ReportPdf, readonly section: string) {
    this.page = this.newPage();
  }
  newPage() {
    const page = this.pdf.page();
    page.text("SHOCKAUDIT", this.margin, 24, 10, "bold", ink);
    page.text(this.section, this.margin, 41, 8, "regular", muted);
    page.line(this.margin, 57, page.width - this.margin, 57);
    this.page = page; this.y = 68;
    return page;
  }
  sectionIntro(number: string, title: string, subtitle: string) {
    const style = completeReportSectionStyle(number);
    const width = this.page.width - this.margin * 2;
    this.page.rect(this.margin, 68, width, 124, style.tint, style.accent, 9);
    this.page.rect(this.margin, 68, 8, 124, style.accent);
    this.page.text(number === "REF" ? "REFERENCE DIRECTORY" : `SECTION ${number}`,
      this.margin + 24, 84, 9, "bold", style.accent);
    const titleWidth = width - 116;
    const lines = this.pdf.fonts.bold.wrap(title, titleWidth, 21).slice(0, 3);
    lines.forEach((line, index) => this.page.text(line,
      this.margin + 24, 107 + index * 25, 21, "bold", "#000000"));
    if (number !== "REF") this.page.text(number, this.page.width - this.margin - 72,
      89, 42, "bold", style.accent);
    const subtitleY = 116 + lines.length * 25;
    this.pdf.fonts.regular.wrap(subtitle, titleWidth, 9).slice(0, 2)
      .forEach((line, index) => this.page.text(line,
        this.margin + 24, subtitleY + index * 13, 9, "regular", muted));
    this.y = 212;
  }
  room(height: number) { if (this.y + height > this.page.height - 65) this.newPage(); }
  heading(text: string, major = false) {
    const size = major ? 20 : 12, leading = major ? 25 : 16;
    const lines = this.pdf.fonts.bold.wrap(text, this.page.width - this.margin * 2, size);
    this.room(lines.length * leading + 52);
    this.y += major ? 0 : 10;
    for (const line of lines) { this.page.text(line, this.margin, this.y, size, "bold"); this.y += leading; }
    this.y += major ? 9 : 5;
  }
  paragraph(text: string, options: { size?: number; fill?: string; weight?: Weight; indent?: number; gap?: number; url?: string } = {}) {
    if (!text.trim()) return;
    const size = options.size ?? 10, weight = options.weight ?? "regular";
    const leading = size * 1.35, indent = options.indent ?? 0;
    const lines = this.pdf.fonts[weight].wrap(text, this.page.width - this.margin * 2 - indent, size);
    this.room(Math.min(lines.length, 2) * leading);
    let offset = 0;
    while (offset < lines.length) {
      let capacity = Math.floor((this.page.height - 65 - this.y) / leading);
      if (capacity < Math.min(2, lines.length - offset)) { this.newPage(); continue; }
      if (lines.length - offset > capacity && lines.length - offset - capacity === 1 && capacity > 2) capacity--;
      const chunk = lines.slice(offset, offset + capacity);
      for (const line of chunk) {
        this.page.text(line, this.margin + indent, this.y, size, weight, options.fill ?? ink);
        if (options.url) this.page.link(options.url, this.margin + indent, this.y,
          this.pdf.fonts[weight].width(line, size), leading);
        this.y += leading;
      }
      offset += chunk.length;
      if (offset < lines.length) this.newPage();
    }
    this.y += options.gap ?? 5;
  }
  labelled(label: string, value: string) {
    const prefix = `${label}: `, maximum = this.page.width - this.margin * 2;
    const prefixWidth = this.pdf.fonts.bold.width(prefix, 10);
    const words = value.trim().split(/\s+/u), first: string[] = [];
    while (words.length && this.pdf.fonts.regular.width([...first, words[0]!].join(" "), 10) <= maximum - prefixWidth) first.push(words.shift()!);
    this.room(32);
    this.page.text(prefix, this.margin, this.y, 10, "bold", teal);
    if (first.length) this.page.text(first.join(" "), this.margin + prefixWidth, this.y, 10);
    this.y += 13.5;
    if (words.length) this.paragraph(words.join(" "), { gap: 6 });
    else this.y += 6;
  }
  block(block: CompleteReportBlock, next?: CompleteReportBlock) {
    if (block.title && next?.title && Object.keys(block).every(key => key === "title")) {
      const width = this.page.width - this.margin * 2;
      const lines = [block.title, next.title].reduce((sum, title) =>
        sum + this.pdf.fonts.bold.wrap(title, width, 12).length, 0);
      this.room(lines * 16 + 82);
    }
    if (block.title) this.heading(block.title);
    if (block.label && !block.text) {
      this.room(42);
      this.paragraph(block.label, { size: 9.5, weight: "bold", fill: teal, gap: 3 });
    }
    // Full-width prose avoids narrow narrative tables and excessive row gaps.
    for (const field of block.fields ?? []) this.labelled(field.label, field.value);
    if (block.table) this.table(block.table);
    if (block.timeline) {
      this.room(45);
      this.paragraph(`${block.timeline.date} · ${block.timeline.label}`, { weight: "bold", gap: 3 });
      this.paragraph(block.timeline.detail);
    }
    if (block.text) {
      if (block.label) this.labelled(block.label, block.text);
      else if (block.tone === "note") this.note(block.text);
      else this.paragraph(block.text);
    }
    if (block.chain?.length) this.pathway(block.chain);
    if (block.numbered?.length) this.numbered(block.numbered);
    for (const bullet of block.bullets ?? []) {
      this.room(30);
      this.page.text("•", this.margin + 1, this.y, 10, "bold", teal);
      this.paragraph(bullet, { indent: 15, gap: 4 });
    }
    if (block.references?.length) this.paragraph(
      `Sources: ${block.references.map((key) => `[${key}]`).join(" · ")}`,
      { size: 8, fill: muted, gap: 6 });
  }
  table(table: NonNullable<CompleteReportBlock["table"]>, header = true) {
    const width = this.page.width - this.margin * 2;
    const total = (table.widths ?? table.columns.map(() => 1)).reduce((sum, value) => sum + value, 0);
    const widths = (table.widths ?? table.columns.map(() => 1)).map((value) => width * value / total);
    const positions = widths.map((_value, index) => this.margin + widths.slice(0, index).reduce((sum, value) => sum + value, 0));
    const drawHeader = () => {
      if (!header) return;
      const lines = table.columns.map((value, index) => this.pdf.fonts.bold.wrap(value, widths[index]! - 22, 9));
      const height = Math.max(...lines.map((value) => value.length)) * 13 + 18;
      this.room(height + 46);
      this.page.rect(this.margin, this.y, width, height, "#173c50");
      lines.forEach((cell, index) => cell.forEach((line, n) => this.page.text(line,
        positions[index]! + 11, this.y + 9 + n * 13, 9, "bold", "#ffffff")));
      this.y += height;
    };
    this.room(85);
    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const lines = table.columns.map((_column, index) => this.pdf.fonts[
        !header && index === 0 ? "bold" : "regular"].wrap(row[index] || "—", widths[index]! - 22,
          !header && index === 0 ? 9 : 10));
      const count = Math.max(...lines.map((cell) => cell.length)), leading = 13.5;
      const rowHeight = count * leading + 14;
      if (rowHeight < this.page.height - 180 && this.y + rowHeight > this.page.height - 65) {
        this.newPage(); drawHeader();
      }
      let offset = 0;
      while (offset < count) {
        const capacity = Math.floor((this.page.height - 65 - this.y - 14) / leading);
        if (capacity < Math.min(count - offset, 2)) { this.newPage(); drawHeader(); continue; }
        const take = Math.min(capacity, count - offset), height = take * leading + 14;
        this.page.rect(this.margin, this.y, width, height,
          rowIndex % 2 ? "#ffffff" : "#f3f7f9");
        if (!header) this.page.rect(this.margin, this.y, widths[0]!, height, "#eaf4f3");
        lines.forEach((cell, index) => {
          const displayed = index === 0 && offset > 0 && cell.length <= offset
            ? this.pdf.fonts.bold.wrap(`${row[0]} (continued)`, widths[0]! - 22, 9)
            : cell.slice(offset, offset + take);
          displayed.slice(0, take).forEach((line, n) => this.page.text(line,
            positions[index]! + 11, this.y + 7 + n * leading,
            !header && index === 0 ? 9 : 10, !header && index === 0 ? "bold" : "regular",
            !header && index === 0 ? teal : ink));
        });
        this.page.line(this.margin, this.y + height, this.margin + width, this.y + height, "#dce5eb", 0.5);
        this.y += height;
        offset += take;
        if (offset < count) { this.newPage(); drawHeader(); }
      }
    });
    this.y += 14;
  }
  note(text: string) { this.paragraph(text, { fill: muted, gap: 7 }); }
  numbered(items: string[]) {
    items.forEach((item, index) => this.paragraph(`${index + 1}. ${item}`, { gap: 5 }));
  }
  pathway(nodes: string[]) {
    const text = nodes.join(" → ");
    const width = this.page.width - this.margin * 2;
    const lines = this.pdf.fonts.bold.wrap(text, width - 28, 10);
    const height = lines.length * 14 + 20;
    this.room(height + 8);
    this.page.rect(this.margin, this.y, width, height, "#e6f6f4", "#9fdcd4", 7);
    lines.forEach((line, index) => this.page.text(line, this.margin + 14,
      this.y + 10 + index * 14, 10, "bold", teal));
    this.y += height + 8;
  }
}

const palettes: Record<Screen6DesignMapPanel["id"], [string, string]> = {
  institutional: ["#eaf5ff", "#add0f3"], exposure: ["#eaf9ee", "#acdcbc"],
  counterfactual: ["#f0ebfc", "#cbbbed"], measurement: ["#fff3df", "#edc993"],
  events: ["#ffedf4", "#efbccf"], mechanism: ["#e7f9f7", "#9fdcd4"],
};
function shortLines(font: ReportFont, value: string, width: number, size: number, maximum: number) {
  const lines = font.wrap(value, width, size);
  if (lines.length <= maximum) return lines;
  const result = lines.slice(0, maximum);
  while (font.width(`${result[maximum - 1]}…`, size) > width) result[maximum - 1] = result[maximum - 1]!.slice(0, -1);
  result[maximum - 1] += "…";
  return result;
}
function designFigure(pdf: ReportPdf, report: CompleteReport) {
  const page = pdf.page(true);
  page.text("SHOCKAUDIT", 42, 25, 10, "bold", teal);
  page.text("How the study fits together", 42, 47, 20, "bold");
  const subtitle = shortLines(pdf.fonts.regular, report.title, 758, 9, 1)[0]!;
  page.text(subtitle, 42, 77, 9, "regular", muted);
  const left = ["institutional", "exposure", "counterfactual"], right = ["measurement", "events", "mechanism"];
  for (let row = 0; row < 3; row++) {
    const centerY = 164 + row * 142;
    for (const [x1, x2, direction] of [[257, 316, 1], [585, 526, -1]]) {
      const elbow = x1! + direction! * 29;
      const targetY = 290 + (row - 1) * 33;
      page.line(x1!, centerY, elbow, centerY, "#8dabc0", 1, true);
      page.line(elbow, centerY, elbow, targetY, "#8dabc0", 1, true);
      page.line(elbow, targetY, x2!, targetY, "#8dabc0", 1, true);
      page.line(x2!, targetY, x2! - direction! * 5, targetY - 3, "#8dabc0");
      page.line(x2!, targetY, x2! - direction! * 5, targetY + 3, "#8dabc0");
    }
  }
  for (const panel of report.designMap.panels) {
    const isLeft = left.includes(panel.id), row = (isLeft ? left : right).indexOf(panel.id);
    const x = isLeft ? 42 : 585, y = 102 + row * 142, w = 215, h = 126;
    const [fill, stroke] = palettes[panel.id];
    page.rect(x, y, w, h, fill, stroke, 10);
    const title = shortLines(pdf.fonts.bold, panel.title, w - 24, 10, 2);
    title.forEach((line, i) => page.text(line, x + 12, y + 11 + i * 13, 10, "bold"));
    let cursor = y + 17 + title.length * 13;
    const rows = panel.id === "events" ? panel.rows.filter((item) => item.label.startsWith("Potential event")).slice(0, 3) : panel.rows.slice(0, 2);
    for (const item of rows.length ? rows : panel.rows.slice(0, 1)) {
      const text = `${item.label}: ${item.value}`;
      const lines = shortLines(pdf.fonts.regular, text, w - 24, 8.4, panel.id === "events" ? 2 : 3);
      for (const line of lines) { if (cursor + 10 > y + h - 8) break; page.text(line, x + 12, cursor, 8.4); cursor += 11; }
      cursor += 4;
    }
  }
  page.rect(316, 220, 210, 162, "#173c50", "#173c50", 12);
  page.text("YOUR PROPOSED COMPARISON", 330, 233, 8, "bold", "#a5e1d7");
  let y = 254;
  for (const line of shortLines(pdf.fonts.bold, report.designMap.comparison.method, 182, 13, 3)) {
    page.text(line, 330, y, 13, "bold", "#ffffff"); y += 17;
  }
  const items = [report.designMap.comparison.treatment, `vs. ${report.designMap.comparison.comparisonGroup}`, `Timing: ${report.designMap.comparison.timing}`];
  for (const item of items) {
    for (const line of shortLines(pdf.fonts.regular, item, 182, 8.4, 2)) {
      if (y + 10 > 372) break;
      page.text(line, 330, y, 8.4, "regular", "#eaf6f5"); y += 11;
    }
    y += 4;
  }
  page.text("Dashed arrows show design dependencies; they do not represent established causal effects.", 42, 523, 7.5, "regular", muted);
  page.text("Full event names, mechanisms and dependency details are listed in the following pages.", 42, 535, 7.5, "regular", muted);
}

export function completeReportFigureSvg(report: CompleteReport): string {
  const pdf = new ReportPdf();
  designFigure(pdf, report);
  const page = pdf.pages[0]!;
  const fonts = (["regular", "bold"] as const).map((weight) => {
    const bytes = pdf.fonts[weight].data.bytes;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    return `@font-face{font-family:'DejaVu Sans';font-weight:${weight === "bold" ? 700 : 400};src:url(data:font/ttf;base64,${btoa(binary)}) format('truetype');}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="552" viewBox="0 0 ${page.width} 552"><style>${fonts}</style><rect width="100%" height="100%" fill="white"/>${page.svg.join("")}</svg>`;
}

/** Shared cover fit; the complete title remains in the institutional section. */
export function completeReportCoverTitle(title: string): string[] {
  return shortLines(new ReportFont("regular"), title, 467, 14, 3);
}

/** Self-contained, client-side vector PDF with embedded fonts, selectable
 * text, bookmarks, clickable source links and automatic long-text pagination. */
export function generateCompleteReportPdf(report: CompleteReport): Uint8Array<ArrayBuffer> {
  const pdf = new ReportPdf(), cover = pdf.page();
  cover.rect(0, 0, cover.width, 258, "#eaf1f4");
  cover.rect(0, 0, 18, 258, "#173c50");
  ["01", "02", "03", "04", "05"].forEach((number, index) => {
    const style = completeReportSectionStyle(number);
    cover.rect(430 + index * 28, 0, 28, 52 + index * 18, style.accent);
  });
  cover.text("SHOCKAUDIT", 46, 48, 11, "bold", teal);
  cover.text("Complete Research Report", 46, 78, 27, "bold", "#000000");
  const coverTitle = completeReportCoverTitle(report.title);
  coverTitle.forEach((line, index) => cover.text(line, 46, 128 + index * 21, 14, "regular", ink));
  cover.text("Natural experiment research · Screens 2–6", 46, 222, 9, "regular", muted);
  const date = new Date(report.generatedAt);
  cover.text(`Prepared ${Number.isNaN(date.getTime()) ? report.generatedAt : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`, 46, 240, 9, "regular", muted);
  cover.text("STUDY AT A GLANCE", 46, 282, 10, "bold", teal);
  report.study.slice(0, 8).forEach((item, index) => {
    const x = index % 2 ? 304 : 46, y = 300 + Math.floor(index / 2) * 56;
    const style = completeReportSectionStyle(String(index % 5 + 1).padStart(2, "0"));
    cover.rect(x, y, 245, 48, style.tint);
    cover.rect(x, y, 4, 48, style.accent);
    cover.text(item.label.toLocaleUpperCase(), x + 12, y + 8, 7.5, "bold", muted);
    shortLines(pdf.fonts.regular, item.value, 221, 9.5, 2).forEach((line, n) =>
      cover.text(line, x + 12, y + 22 + n * 12, 9.5));
  });
  cover.text("CONTENTS", 46, 545, 10, "bold", teal);
  const contents: Array<{ title: string; page: number }> = [];
  for (const section of report.sections) {
    const flow = new ReportFlow(pdf, section.title);
    if (section.figure) {
      // Use the landscape page for the figure and a portrait page for the
      // complete text; neither must shrink to fit the other's geometry.
      pdf.pages.pop();
      designFigure(pdf, report);
      const page = pdf.pages.length - 1;
      contents.push({ title: section.title, page });
      pdf.bookmarks.push({ title: `${section.number} ${section.title}`, page });
      flow.newPage();
      flow.sectionIntro(section.number, "Design dependencies and research checks",
        section.subtitle);
    } else {
      const page = pdf.pages.length - 1;
      contents.push({ title: section.title, page });
      pdf.bookmarks.push({ title: `${section.number} ${section.title}`, page });
      flow.sectionIntro(section.number, section.title, section.subtitle);
    }
    section.blocks.forEach((block, index) => flow.block(block, section.blocks[index + 1]));
  }
  const sources = new ReportFlow(pdf, "Literature and source access");
  const sourcePage = pdf.pages.length - 1;
  contents.push({ title: "Literature and source access", page: sourcePage });
  pdf.bookmarks.push({ title: "Literature and source access", page: sourcePage });
  sources.sectionIntro("REF", "Literature and source access",
    "References are keyed to the research content and retain their evidence boundary.");
  sources.paragraph("A model-suggested citation supports only its stated proposition and is kept distinct from independently inspected evidence.", { size: 9.5, fill: muted });
  for (const category of ["L", "M", "P", "E"]) {
    const items = report.references.filter((item) => item.key[0] === category);
    if (!items.length) continue;
    sources.heading(category === "L" ? "Scholarly literature" : category === "M" ? "Method references" : category === "P" ? "Shock and institutional sources" : "Concurrent-event sources");
    for (const item of items) {
      const height = pdf.fonts.regular.wrap(`[${item.key}] ${item.citation}`, 503, 9.5).length * 14.25 + 3 +
        (item.url ? pdf.fonts.regular.wrap(item.url, 503, 8.5).length * 12.75 + 4 : 0) +
        (item.note ? pdf.fonts.regular.wrap(item.note, 503, 8.5).length * 12.75 + 12 : 0);
      sources.room(Math.min(height, 400));
      sources.paragraph(`[${item.key}] ${item.citation}`, { size: 9.5, gap: 3 });
      if (item.url) sources.paragraph(item.url, { size: 8.5, fill: teal, url: item.url, gap: 4 });
      if (item.note) sources.paragraph(item.note, { size: 8.5, fill: muted, gap: 12 });
    }
  }
  if (!report.references.length) sources.paragraph("No source references were saved in the exported research content.");
  contents.forEach((entry, index) => {
    const y = 570 + index * 27;
    const style = completeReportSectionStyle(index < 5
      ? String(index + 1).padStart(2, "0") : "REF");
    cover.rect(46, y - 3, 5, 18, style.accent);
    cover.text(`${String(index + 1).padStart(2, "0")}  ${entry.title}`, 60, y, 10);
    cover.text(String(entry.page + 1), 533, y, 10, "bold", teal);
  });
  cover.text("Research planning record · Assumptions and proposed pathways remain conditional.", 46, 772, 8, "regular", muted);
  for (const [index, page] of pdf.pages.entries()) {
    page.line(46, page.height - 49, page.width - 46, page.height - 49);
    page.text("ShockAudit · Complete Research Report", 46, page.height - 34, 8, "regular", muted);
    const text = `${index + 1} / ${pdf.pages.length}`;
    page.text(text, page.width - 46 - pdf.fonts.regular.width(text, 8), page.height - 34, 8, "regular", muted);
  }
  return pdf.bytes(report.title, report.generatedAt);
}
