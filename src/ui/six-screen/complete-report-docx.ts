import { strToU8, zipSync } from "fflate";
import type { CompleteReport, CompleteReportBlock } from "./complete-report-data";
import { completeReportFigureSvg, completeReportCoverTitle } from "./complete-report-pdf";
import { reportFontData } from "./report-fonts";
import { completeReportSectionStyle } from "./complete-report-style";

const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "")
  .replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const relType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const ink = "20354C", teal = "087F79", muted = "62748A";
const fontKey = "{00112233-4455-6677-8899-AABBCCDDEEFF}";
function embeddedFont(weight: "regular" | "bold") {
  const bytes = reportFontData(weight).bytes.slice();
  // ECMA-376 font obfuscation: reverse the GUID bytes, XOR the first 32 bytes.
  const key = Uint8Array.from(fontKey.replace(/[{}-]/gu, "").match(/../gu)!.map((byte) => parseInt(byte, 16))).reverse();
  for (let i = 0; i < 32; i++) bytes[i] = bytes[i]! ^ key[i % 16]!;
  return bytes;
}

/** Native editable Word paragraphs and tables. The shared design-map drawing
 * is embedded directly as SVG, so export does not depend on browser canvas or
 * blob-image support. Full unabridged panel text follows the drawing. */
export function generateCompleteReportDocx(report: CompleteReport): Uint8Array {
  const relations: string[] = [];
  const relation = (type: string, target: string, external = false) => {
    const id = `rId${relations.length + 1}`;
    relations.push(`<Relationship Id="${id}" Type="${relType}${type}" Target="${xml(target)}"${external ? ' TargetMode="External"' : ""}/>`);
    return id;
  };
  relation("styles", "styles.xml");
  relation("settings", "settings.xml");
  relation("fontTable", "fontTable.xml");
  const headerId = relation("header", "header.xml"), footerId = relation("footer", "footer.xml");
  const landscapeFooterId = relation("footer", "footer-landscape.xml");
  const blankHeaderId = relation("header", "header-blank.xml");
  const pictureId = relation("image", "media/design-map.svg");
  const r = (text: string, bold = false, color = ink, size = 20) => `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text).replace(/\n/gu, '</w:t><w:br/><w:t xml:space="preserve">')}</w:t></w:r>`;
  const p = (text: string, style = "Normal", extra = "", run = "") => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${run || r(text)}</w:p>`;
  const label = (text: string) => p("", "Label", "", r(text, true, teal, 18));
  const paragraph = (text: string, note = false) => p("", note ? "Note" : "Normal", "", r(text, false, note ? muted : ink));
  const heading = (text: string, major = false, anchor?: string) => {
    const number = anchor ? Number(anchor.replace(/\D/gu, "")) : 0;
    return `<w:p><w:pPr><w:pStyle w:val="${major ? "Heading1" : "Heading2"}"/></w:pPr>${anchor ? `<w:bookmarkStart w:id="${number}" w:name="${anchor}"/>` : ""}${r(text, true, "000000", major ? 40 : 24)}${anchor ? `<w:bookmarkEnd w:id="${number}"/>` : ""}</w:p>`;
  };
  const section = (landscape = false, cover = false) => `<w:sectPr><w:headerReference w:type="default" r:id="${cover || landscape ? blankHeaderId : headerId}"/><w:footerReference w:type="default" r:id="${landscape ? landscapeFooterId : footerId}"/><w:type w:val="nextPage"/><w:pgSz w:w="${landscape ? 16838 : 11906}" w:h="${landscape ? 11906 : 16838}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${landscape ? 0 : 1360}" w:right="${landscape ? 420 : 840}" w:bottom="${landscape ? 1000 : 1300}" w:left="${landscape ? 420 : 840}" w:header="${landscape ? 0 : 480}" w:footer="620" w:gutter="0"/></w:sectPr>`;
  const sectionBreak = (landscape = false, cover = false) => `<w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/>${section(landscape, cover)}</w:pPr></w:p>`;
  const table = (columns: string[], rows: string[][], weights?: number[], header = true) => {
    const total = (weights ?? columns.map(() => 1)).reduce((a, b) => a + b, 0);
    const widths = (weights ?? columns.map(() => 1)).map((n) => Math.round(10226 * n / total));
    const row = (cells: string[], index: number, isHeader = false) => `<w:tr><w:trPr>${isHeader ? "<w:tblHeader/>" : ""}</w:trPr>${cells.map((text, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:shd w:fill="${isHeader ? "173C50" : index % 2 ? "FFFFFF" : "F3F7F9"}"/></w:tcPr>${p("", "TableText", "", r(text || "—", isHeader, isHeader ? "FFFFFF" : ink, isHeader ? 18 : 20))}</w:tc>`).join("")}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="10226" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="140" w:type="dxa"/><w:left w:w="220" w:type="dxa"/><w:bottom w:w="140" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${header ? row(columns, 0, true) : ""}${rows.map((cells, i) => row(cells, i)).join("")}</w:tbl>`;
  };
  const sectionBanner = (number: string, title: string, subtitle: string,
    anchor: string) => {
    const style = completeReportSectionStyle(number);
    const accent = style.accent.slice(1), tint = style.tint.slice(1);
    return `<w:tbl><w:tblPr><w:tblW w:w="10226" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="300" w:type="dxa"/><w:left w:w="280" w:type="dxa"/><w:bottom w:w="300" w:type="dxa"/><w:right w:w="280" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="720"/><w:gridCol w:w="9506"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="720" w:type="dxa"/><w:tcMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar><w:shd w:fill="${accent}"/></w:tcPr>${p("", "Normal", "", r(number === "REF" ? "R" : number, true, "FFFFFF", 24))}</w:tc><w:tc><w:tcPr><w:tcW w:w="9506" w:type="dxa"/><w:shd w:fill="${tint}"/></w:tcPr>${p("", "Label", "", r(number === "REF" ? "REFERENCE DIRECTORY" : `SECTION ${number}`, true, accent, 18))}${heading(title, true, anchor)}${p("", "Note", "", r(subtitle, false, muted, 18))}</w:tc></w:tr></w:tbl>${p("", "Normal", "<w:spacing w:after=\"120\"/>", "")}`;
  };
  function block(value: CompleteReportBlock) {
    const parts: string[] = [];
    if (value.title) parts.push(heading(value.title));
    if (value.label && !value.text) parts.push(label(value.label));
    for (const field of value.fields ?? []) parts.push(p("", "Normal", "", r(`${field.label}: `, true, teal) + r(field.value)));
    if (value.table) parts.push(table(value.table.columns, value.table.rows, value.table.widths));
    if (value.timeline) parts.push(p("", "Label", "", r(`${value.timeline.date} · ${value.timeline.label}`, true)), paragraph(value.timeline.detail));
    if (value.text) parts.push(value.label ? p("", "Normal", "", r(`${value.label}: `, true, teal) + r(value.text)) : paragraph(value.text, value.tone === "note"));
    if (value.chain?.length) parts.push(p("", "Normal", "", r(value.chain.join(" → "), true, teal)));
    for (const [i, item] of (value.numbered ?? []).entries()) parts.push(paragraph(`${i + 1}. ${item}`));
    for (const item of value.bullets ?? []) parts.push(p(`•  ${item}`, "Bullet"));
    if (value.references?.length) parts.push(p("", "Source", "", r(`Sources: ${value.references.map((key) => `[${key}]`).join(" · ")}`, false, muted, 16)));
    return parts.join("");
  }
  const coverBanner = `<w:tbl><w:tblPr><w:tblW w:w="10226" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="420" w:type="dxa"/><w:left w:w="360" w:type="dxa"/><w:bottom w:w="420" w:type="dxa"/><w:right w:w="360" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="320"/><w:gridCol w:w="9906"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="320" w:type="dxa"/><w:shd w:fill="173C50"/></w:tcPr>${p("", "Normal")}</w:tc><w:tc><w:tcPr><w:tcW w:w="9906" w:type="dxa"/><w:shd w:fill="EAF1F4"/></w:tcPr>${p("", "Normal", "", r("SHOCKAUDIT", true, teal, 22))}${p("", "CoverTitle", "", r("Complete Research Report", true, "000000", 48))}${p("", "Normal", "", r(completeReportCoverTitle(report.title).join("\n"), false, ink, 28))}</w:tc></w:tr></w:tbl>`;
  const date = new Date(report.generatedAt);
  const prepared = Number.isNaN(date.getTime()) ? report.generatedAt : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const body = [coverBanner, paragraph("Natural experiment research · Screens 2–6", true), paragraph(`Prepared ${prepared}`, true), label("STUDY AT A GLANCE")];
  // Keep the cover brief; complete values are also present in the report body.
  const glance = report.study.slice(0, 8).map((item) => `${item.label.toLocaleUpperCase()}\n${item.value.length > 140 ? `${item.value.slice(0, 137)}…` : item.value}`);
  body.push(table(["", ""], Array.from({ length: Math.ceil(glance.length / 2) }, (_, i) => glance.slice(i * 2, i * 2 + 2).map((s) => s)), undefined, false));
  body.push(label("CONTENTS"));
  [...report.sections.map((item) => item.title), "Literature and source access"].forEach((title, index) => {
    const link = `<w:hyperlink w:anchor="section${index + 1}">${r(`${String(index + 1).padStart(2, "0")}  ${title}`, false, teal)}</w:hyperlink>`;
    body.push(p("", "Contents", "", link));
  });
  body.push(paragraph("Research planning record · Assumptions and proposed pathways remain conditional.", true), sectionBreak(false, true));
  report.sections.forEach((item, i) => {
    if (i && !item.figure) body.push(p("", "Normal", "<w:pageBreakBefore/>"));
    if (item.figure) {
      body.push(sectionBreak());
      // Same drawing as the landscape PDF, without shrinking to portrait width.
      body.push(`<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="10160000" cy="6661585"/><wp:docPr id="1" name="Study design map" descr="${xml(report.designMap.comparison.method)}. Full design dependencies follow."/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Study design map"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${pictureId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10160000" cy="6661585"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
      body.push(sectionBreak(true), sectionBanner(item.number,
        "Design dependencies and research checks", item.subtitle,
        `section${i + 1}`));
    } else body.push(sectionBanner(item.number, item.title, item.subtitle,
      `section${i + 1}`));
    body.push(...item.blocks.map(block));
  });
  body.push(p("", "Normal", "<w:pageBreakBefore/>"), sectionBanner("REF",
    "Literature and source access",
    "References are keyed to the research content and retain their evidence boundary.",
    `section${report.sections.length + 1}`),
  paragraph("A model-suggested citation supports only its stated proposition and is kept distinct from independently inspected evidence.", true));
  for (const category of ["L", "M", "P", "E"]) {
    const items = report.references.filter((item) => item.key[0] === category);
    if (!items.length) continue;
    body.push(heading(category === "L" ? "Scholarly literature" : category === "M" ? "Method references" : category === "P" ? "Shock and institutional sources" : "Concurrent-event sources"));
    for (const item of items) {
      body.push(p(`[${item.key}] ${item.citation}`, "Reference", item.url || item.note ? "<w:keepNext/>" : ""));
      if (item.url) body.push(p("", "Source", item.note ? "<w:keepNext/>" : "", `<w:hyperlink r:id="${relation("hyperlink", item.url, true)}">${r(item.url, false, teal, 17)}</w:hyperlink>`));
      if (item.note) body.push(p("", "Source", "", r(item.note, false, muted, 17)));
    }
  }
  if (!report.references.length) body.push(paragraph("No source references were saved in the exported research content."));
  const namespaces = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const style = (id: string, props: string, run = "", name = id) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr>${props}</w:pPr><w:rPr>${run}</w:rPr></w:style>`;
  const spacing = (after: number, before = 0) => `<w:spacing w:before="${before}" w:after="${after}" w:line="324" w:lineRule="auto"/>`;
  const styles = `${declaration}<w:styles ${namespaces}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="DejaVu Sans" w:hAnsi="DejaVu Sans" w:cs="DejaVu Sans"/><w:sz w:val="20"/><w:color w:val="${ink}"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl/>${spacing(100)}</w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${style("Heading1", `<w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/>${spacing(180)}`, "<w:b/><w:sz w:val=\"40\"/>", "heading 1")}${style("Heading2", `<w:keepNext/><w:keepLines/><w:outlineLvl w:val="1"/>${spacing(100, 200)}`, "<w:b/><w:sz w:val=\"24\"/>", "heading 2")}${style("Label", `<w:keepNext/><w:keepLines/>${spacing(40, 60)}`)}${style("Note", spacing(140))}${style("Source", spacing(80), "<w:sz w:val=\"17\"/>")}${style("Reference", spacing(60))}${style("TableText", spacing(0))}${style("Contents", spacing(80))}${style("CoverTitle", `<w:keepNext/>${spacing(200, 180)}`)}${style("Bullet", `<w:ind w:left="300" w:hanging="300"/>${spacing(80)}`)}</w:styles>`;
  const footer = `${declaration}<w:ftr ${namespaces}>${p("", "Normal", '<w:tabs><w:tab w:val="right" w:pos="10226"/></w:tabs>', `${r("ShockAudit · Complete Research Report", false, muted, 16)}<w:r><w:tab/></w:r><w:fldSimple w:instr="PAGE">${r("1", false, muted, 16)}</w:fldSimple>${r(" / ", false, muted, 16)}<w:fldSimple w:instr="NUMPAGES">${r("1", false, muted, 16)}</w:fldSimple>`)}</w:ftr>`;
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, content: string) => { files[path] = strToU8(content); };
  put("[Content_Types].xml", `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>${[["document", "document.main"], ["styles", "styles"], ["settings", "settings"], ["fontTable", "fontTable"], ["header", "header"], ["footer", "footer"], ["header-blank", "header"], ["footer-landscape", "footer"]].map(([name, type]) => `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  put("_rels/.rels", `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relType}officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  put("word/document.xml", `${declaration}<w:document ${namespaces}><w:body>${body.join("")}${section()}</w:body></w:document>`);
  put("word/_rels/document.xml.rels", `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations.join("")}</Relationships>`);
  put("word/styles.xml", styles);
  put("word/settings.xml", `${declaration}<w:settings ${namespaces}><w:updateFields w:val="true"/><w:embedTrueTypeFonts/><w:embedSystemFonts/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  put("word/header.xml", `${declaration}<w:hdr ${namespaces}>${p("", "Normal", "", r("SHOCKAUDIT", true, "000000", 20))}</w:hdr>`);
  put("word/footer.xml", footer);
  put("word/footer-landscape.xml", footer.replace('<w:tabs>', '<w:ind w:left="420" w:right="420"/><w:tabs>').replace('w:pos="10226"', 'w:pos="15578"'));
  put("word/header-blank.xml", `${declaration}<w:hdr ${namespaces}><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p></w:hdr>`);
  put("word/fontTable.xml", `${declaration}<w:fonts ${namespaces}><w:font w:name="DejaVu Sans"><w:family w:val="swiss"/><w:embedRegular r:id="font1" w:fontKey="${fontKey}"/><w:embedBold r:id="font2" w:fontKey="${fontKey}"/></w:font></w:fonts>`);
  put("word/_rels/fontTable.xml.rels", `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="font1" Type="${relType}font" Target="fonts/regular.odttf"/><Relationship Id="font2" Type="${relType}font" Target="fonts/bold.odttf"/></Relationships>`);
  put("docProps/core.xml", `${declaration}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(`ShockAudit Complete Report — ${report.title}`)}</dc:title><dc:creator>ShockAudit</dc:creator></cp:coreProperties>`);
  files["word/fonts/regular.odttf"] = embeddedFont("regular");
  files["word/fonts/bold.odttf"] = embeddedFont("bold");
  files["word/media/design-map.svg"] = strToU8(completeReportFigureSvg(report));
  return zipSync(files, { level: 6 });
}
