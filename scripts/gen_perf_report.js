// SERTZ 웹 성능 감사 보고서 — docx 생성 엔진 (R1 표지 + DM-1 팔레트 + 3섹션 페이지 번호)
"use strict";
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents, SectionType, TableLayoutType,
} = require("docx");
const fs = require("fs");

const contentA = require("./perf_content_a.js");
const contentB = require("./perf_content_b.js");
const blocks = [...contentA, ...contentB];

// ── DM-1 Deep Cyan 팔레트 (design-system.md) ──
const PAL = {
  bg: "162235", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
};
const INK = "000000";          // 본문 순흑 (프로필 A)
const HEAD_COLOR = "1B6B7A";   // 본문 제목(페이지용 어두운 액센트)
const CAP_COLOR = "33414A";

const BODY_FONT = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "Malgun Gothic" };
const HEAD_FONT = { ascii: "Arial", hAnsi: "Arial", eastAsia: "Malgun Gothic" };
const CODE_FONT = { ascii: "Consolas", hAnsi: "Consolas", eastAsia: "Malgun Gothic" };

const nb = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb };
const noBorders = { top: nb, bottom: nb, left: nb, right: nb };

// ── 표지 유틸 (design-system.md 그대로) ──
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\uff0c\u3002\u3001\uff1b\uff1a\uff01\uff1f", ..."-_\u2014\u2013\u00b7/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(p) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = p;
  const SAFETY = 1200;
  const usable = pageHeight - marginTop - marginBottom - SAFETY;
  const titleH = titleLineCount * (titlePt * 23 + 200);
  const subH = hasSubtitle ? (12 * 23 + 600) : 0;
  const engH = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaH = metaLineCount * (10 * 23 + 100);
  const content = titleH + subH + engH + metaH + fixedHeight + 3 * 300;
  const remaining = Math.max(usable - content, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(remaining * 0.45), rawBottom = Math.floor(remaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(remaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ── R1 표지 (Pure Paragraph Left) ──
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18,
        color: P.accent, font: HEAD_FONT, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.cover.titleColor, font: HEAD_FONT })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor, font: BODY_FONT })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor, font: BODY_FONT })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Malgun Gothic" } }),
      new TextRun({ text: "                                        ", size: 16 }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Malgun Gothic" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: PAL.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── 블록 렌더러 ──
function mkRuns(text, base) {
  const parts = String(text).split("**");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    out.push(new TextRun(Object.assign({ text: parts[i] }, base, i % 2 === 1 ? { bold: true } : {})));
  }
  return out.length ? out : [new TextRun(Object.assign({ text: " " }, base))];
}
function renderBlock(b) {
  if (b.t === "h1") {
    return [new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160, line: 312 },
      children: [new TextRun({ text: b.x, bold: true, size: 32, color: HEAD_COLOR, font: HEAD_FONT })],
    })];
  }
  if (b.t === "h2") {
    return [new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120, line: 312 },
      children: [new TextRun({ text: b.x, bold: true, size: 28, color: HEAD_COLOR, font: HEAD_FONT })],
    })];
  }
  if (b.t === "p") {
    return [new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 480 },
      spacing: { line: 312, after: 120 },
      children: mkRuns(b.x, { size: 24, color: INK, font: BODY_FONT }),
    })];
  }
  if (b.t === "bullet") {
    return [new Paragraph({
      alignment: AlignmentType.LEFT,
      bullet: { level: 0 },
      spacing: { line: 312, after: 80 },
      children: mkRuns(b.x, { size: 24, color: INK, font: BODY_FONT }),
    })];
  }
  if (b.t === "code") {
    return b.lines.map((ln, i) => new Paragraph({
      alignment: AlignmentType.LEFT,
      shading: { type: ShadingType.CLEAR, fill: "F2F7F8" },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: PAL.table.accentLine, space: 8 } },
      indent: { left: 240, right: 120 },
      spacing: { before: i === 0 ? 120 : 0, after: i === b.lines.length - 1 ? 160 : 0, line: 264 },
      children: [new TextRun({ text: ln.length ? ln : " ", size: 18, color: "1E2A30", font: CODE_FONT })],
    }));
  }
  if (b.t === "img") {
    const buf = fs.readFileSync(b.path);
    const w = 520, h = Math.round(w * b.h / b.w);
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 40 },
        children: [new ImageRun({ data: buf, transformation: { width: w, height: h }, type: "png" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 160 },
        children: [new TextRun({ text: b.cap, bold: true, size: 20, color: CAP_COLOR, font: BODY_FONT })],
      }),
    ];
  }
  if (b.t === "table") {
    const cellSize = b.size || 18;
    const capPara = new Paragraph({
      keepNext: true, alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: b.cap, bold: true, size: 20, color: CAP_COLOR, font: BODY_FONT })],
    });
    const headerRow = new TableRow({
      tableHeader: true, cantSplit: true,
      children: b.header.map((tx, i) => new TableCell({
        shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        width: { size: b.widths[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.LEFT, spacing: { line: 264 },
          children: [new TextRun({ text: tx, bold: true, size: cellSize, color: PAL.table.headerText, font: BODY_FONT })],
        })],
      })),
    });
    const dataRows = b.rows.map((row, r) => new TableRow({
      cantSplit: true,
      children: row.map((tx, i) => new TableCell({
        shading: r % 2 === 1 ? { type: ShadingType.CLEAR, fill: PAL.table.surface } : undefined,
        margins: { top: 50, bottom: 50, left: 100, right: 100 },
        width: { size: b.widths[i], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.LEFT, spacing: { line: 264 },
          children: [new TextRun({ text: tx, size: cellSize, color: "1E2A30", font: BODY_FONT })],
        })],
      })),
    }));
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: PAL.table.accentLine },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: PAL.table.accentLine },
        left: nb, right: nb,
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine },
        insideVertical: nb,
      },
      rows: [headerRow, ...dataRows],
    });
    const tail = new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: " ", size: 12 })] });
    return [capPara, table, tail];
  }
  throw new Error("unknown block: " + b.t);
}

const bodyChildren = [];
for (const b of blocks) bodyChildren.push(...renderBlock(b));

// ── 목차 섹션 ──
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "\ubaa9  \ucc28", bold: true, size: 32, color: HEAD_COLOR, font: HEAD_FONT })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "\u203b \ubcf8 \ubaa9\ucc28\ub294 \ud544\ub4dc \ucf54\ub4dc\ub85c \uc0dd\uc131\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ubb38\uc11c \ud3b8\uc9d1 \ud6c4 \ud398\uc774\uc9c0 \ubc88\ud638\uac00 \ubd80\uc815\ud655\ud558\uba74 \ubaa9\ucc28\ub97c \ub9c8\uc6b0\uc2a4 \uc624\ub978\ucabd \ubc84\ud2bc\uc73c\ub85c \ud074\ub9ad\ud558\uc5ec [\ud544\ub4dc \uc5c5\ub370\uc774\ud2b8]\ub97c \uc120\ud0dd\ud558\uc138\uc694.",
      italics: true, size: 18, color: "888888", font: BODY_FONT })],
  }),
];

const pageFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: BODY_FONT })],
  })],
});
const bodyHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.innerLine, space: 4 } },
    spacing: { after: 60 },
    children: [new TextRun({ text: "SERTZ \uc6f9 \uc131\ub2a5 \ucd5c\uc801\ud654 \uac10\uc0ac \ubcf4\uace0\uc11c", size: 18, color: "808080", font: BODY_FONT })],
  })],
});

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "SERTZ Performance Audit",
  title: "SERTZ \uc6f9 \uc131\ub2a5 \ucd5c\uc801\ud654 \uac10\uc0ac \ubcf4\uace0\uc11c",
  styles: {
    default: {
      document: {
        run: { font: BODY_FONT, size: 24, color: INK },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: HEAD_FONT, size: 32, bold: true, color: HEAD_COLOR },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: HEAD_FONT, size: 28, bold: true, color: HEAD_COLOR },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    { // 섹션 1: 표지 (여백 0, 페이지번호 없음)
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "SERTZ \uc6f9 \uc131\ub2a5 \ucd5c\uc801\ud654 \uac10\uc0ac \ubcf4\uace0\uc11c",
        subtitle: "Next.js 16 + Phaser 3 MMORPG \u2014 \uc2e4\uce21 \uae30\ubc18 \uc9c4\ub2e8 \ubc0f \uac1c\uc120 \ub85c\ub4dc\ub9f5",
        englishLabel: "WEB PERFORMANCE AUDIT",
        metaLines: [
          "\ud504\ub85c\uc81d\ud2b8: CERTZ / SERTZ MMORPG (sertz4.space-z.ai)",
          "\ub300\uc0c1 \ud658\uacbd: Next.js 16 \u00b7 Phaser 3.90 \u00b7 socket.io 4 \u00b7 Prisma 6",
          "\uce21\uc815 \ubc29\ubc95: \uc6cc\ud06c\uc2a4\ud398\uc774\uc2a4 \ube4c\ub4dc \uc0b0\ucd9c\ubb3c \ubc0f \uc18c\uc2a4 \uc2e4\uce21",
          "\uc791\uc131\uc77c: 2026-09-07 (\uae30\uc900 \ubc84\uc804 v4.1.5)",
        ],
        footerLeft: "SERTZ PERFORMANCE AUDIT",
        footerRight: "2026.09",
        palette: PAL,
      }),
    },
    { // 섹션 2: 목차 (로만 페이지 번호)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: tocChildren,
    },
    { // 섹션 3: 본문 (아라비아 1부터)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/SERTZ_\uc6f9\uc131\ub2a5_\ucd5c\uc801\ud654_\uac10\uc0ac\ubcf4\uace0\uc11c.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync("/home/z/my-project/download", { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log("OK:", OUT, buf.length, "bytes");
});
