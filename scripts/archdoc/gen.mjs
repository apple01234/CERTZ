// gen.mjs — 2D 탑다운 웹 MMORPG 기술 아키텍처 설계서(001~100) docx 생성기
// 구조: 표지(R2·CM-2) → 목차(로마자) → 본문 11장(아라비아, 100개 항목)
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, TableOfContents, PageBreak,
  SectionType, TableLayoutType, PageOrientation,
} from "docx";
import fs from "node:fs";

// ── 챕터 데이터 로드 ─────────────────────────────────────────
const files = ["01a","01b","02a","02b","03a","03b","04a","04b","05a","05b",
               "06a","06b","07a","07b","08a","08b","09a","09b","10a","10b"];
const modItems = {};
for (const f of files) {
  const m = await import("./data_ch" + f + ".mjs");
  const mod = f.slice(0, 2);
  modItems[mod] = (modItems[mod] ?? []).concat(m.items);
}

const MODULES = [
  { m: 1, range: "001~010", title: "웹 & 크로스플랫폼 기술 아키텍처",
    stack: "TypeScript · Phaser 3/PixiJS · uWebSockets.js(Client Ws) · IndexedDB",
    intro: "클라이언트 엔진의 뼈대를 구성하는 10개 항목이다. 렌더링 루프와 바이너리 소켓 핸들러가 성능의 1차 결정 요소이며, 반응형 스케일링·지연 로딩·IndexedDB 캐싱·재접속 복구는 웹 플랫폼 특유의 제약을 해소하는 장치다. 백그라운드 탭 관리·스프라이트 GC·WASM 인터페이스는 장기 세션 안정성과 확장성을 위한 기반으로, 이후 모든 모듈이 이 장의 구조물 위에 얹힌다." },
  { m: 2, range: "011~020", title: "네트워크 및 동기화 시스템",
    stack: "Node.js · uWebSockets.js · ArrayBuffer(TypedArray) · Kysely(PostgreSQL)",
    intro: "멀티플레이의 체감 품질을 결정하는 동기화 계층이다. 클라이언트 예측과 서버 권위 검증의 이중 구조가 핵심 설계이며, AOI 타일 격자 브로드캐스팅과 델타 압축으로 대규모 필드의 트래픽을 통제한다. 랙 컴펜세이션·롤백 보정은 높은 지연 환경에서도 공정한 전투 판정을 보장하고, Kysely 트랜잭션은 재화·아이템 이동의 원자성을 담당한다." },
  { m: 3, range: "021~030", title: "캐릭터 및 성장 시스템",
    stack: "PostgreSQL DDL · Kysely · TypeScript Seed · TypeScript",
    intro: "캐릭터의 모든 수치는 하나의 스탯 파이프라인(합산 순서 고정)에서 산출된다. 경험치 곡선·스킬 트리·장비 슬롯·강화 인챈트·전직·코스튬·칭호·랜덤 옵션·도감까지, 성장의 모든 요소가 데이터 테이블과 순수 함수로 정규화된다. 이 장의 원칙은 '기획 변경은 데이터 삽입으로 끝난다'는 것이며, 서버와 클라가 같은 연산 코드를 공유해 결정론을 유지한다." },
  { m: 4, range: "031~040", title: "전투 및 액션 메커니즘",
    stack: "TypeScript · Phaser 3/PixiJS 물리 · uWebSockets.js",
    intro: "전투 판정의 정확성과 손맛을 동시에 만드는 계층이다. 3형태 히트박스(원/부채꼴/직사각형)와 브로드페이스 2단 판정이 성능을 확보하고, 쿨타임·자원 관리자와 CC 상태머신이 전투 규칙의 단일 진실이 된다. 어그로 AI·파티 시너지·속성 상성·피드백 연출은 전투를 게임으로 만드는 요소로, 모든 판정은 서버 권위(015~016번)에 종속된다." },
  { m: 5, range: "041~050", title: "월드 & 환경 시스템",
    stack: "Tiled Map Editor(JSON) · Phaser 3/PixiJS · TypeScript",
    intro: "월드의 공간감과 상호작용을 담당한다. Tiled 파싱에서 blocked 그리드가 서버·클라 공유의 단일 진실이 되고, Y-Sorting 엔진과 A* 길찾기가 탑다운 뷰의 2대 엔진이다. 동적 조명·날씨 파티클이 환경 몰입을 만들고, 포탈·채집·미니맵·돌발 이벤트·핫스팟 상호작용이 필드를 살아있는 공간으로 완성한다." },
  { m: 6, range: "051~060", title: "소셜 및 커뮤니티 시스템",
    stack: "uWebSockets.js(Pub/Sub Topics) · Kysely · Redis · TypeScript",
    intro: "MMORPG의 사회 계층이다. 채팅 채널은 uWS 토픽과 1:1 매핑되고, 길드·파티·친구는 DDL과 권한 비트로 구조화된다. 1:1 거래와 경매장은 트랜잭션 안전성이 곧 신뢰이며, 공성전 권한·Redis ZSET 랭킹·멘토링 보상은 대규모 상호작용과 장기 동기를 설계한다. 모든 재화 이동 경로는 ledger 감사 로그를 통과한다." },
  { m: 7, range: "061~070", title: "주요 콘텐츠 시스템",
    stack: "TypeScript · Kysely · uWebSockets.js",
    intro: "유저가 매일 돌아오는 이유를 만드는 콘텐츠 계층이다. 퀘스트 트래킹과 미션 시스템은 하나의 이벤트 체커를 공유하고, 던전·필드 보스·PvP는 전용 룸 세션 관리 위에서 운영된다. 제작·펫·하우징·낚시·배틀패스는 각각의 미니 시스템이지만, 보상 지급·기여도 정산·멱등 지급의 공통 패턴을 재사용한다." },
  { m: 8, range: "071~080", title: "UI/UX 및 크로스플랫폼 가용성",
    stack: "HTML5/DOM · Phaser 3 UI · TypeScript · Web Push API",
    intro: "조작의 품질이 곧 게임 품질인 계층이다. 가상 조이스틱과 통합 컨트롤러는 동일한 입력 계약(moveVec + 액션 이벤트)으로 통합되고, 반응형 HUD는 세이프 에어리어와 44px 터치 타깃을 보장한다. 드래그 인벤토리·퀵슬롯 스와이프·장비 비교 툴팁·퀘스트 내비게이션은 일상 조작의 마찰을 제거하고, 절전 모드와 웹 푸시는 게임 밖 경험까지 연결한다." },
  { m: 9, range: "081~090", title: "경제 및 BM(수익화) 시스템",
    stack: "Node.js · Kysely(PostgreSQL) · 결제 PG/IAP API · TypeScript",
    intro: "게임 경제의 원자성과 수익화의 공정성을 동시에 담보한다. 다중 재화는 단일 진입점(지급/소모 분리)과 ledger 감사로 통제되고, 결제·가챠·구독은 서버 검증과 멱등 지급이 절대 규칙이다. 싱크 매커니즘·상하한가·기간제 교환소·트랙 분기·스테미너는 경제 순환과 BM 가치를 데이터로 운영한다." },
  { m: 10, range: "091~100", title: "보안, 어드민 및 라이브 서비스",
    stack: "uWebSockets.js · Kysely · Fastify(어드민 API) · OAuth2 · TypeScript",
    intro: "라이브 서비스의 방어선과 운영 손잡이다. 스피드핵·벽뚫기·매크로 탐지는 서버 권위 재연산과 통계 기반 점수화로 수행되고, 어드민 대시보드는 권한 비트와 감사 로그가 본질이다. 텔레메트리·핫픽스·i18n·OAuth2·제재 미들웨어·백업/패일오버는 서비스가 '살아있는 동안' 계속 요구되는 인프라다." },
];

// ── 팔레트(CM-2 Blue Orange — 화이트페이퍼) ───────────────────
const P = {
  bg: "FEFEFE", primary: "1284BA", accent: "FF862F",
  cover: { titleColor: "1284BA", subtitleColor: "606060", metaColor: "707070", footerColor: "A0A0A0" },
  table: { headerBg: "1284BA", headerText: "FFFFFF", accentLine: "1284BA", innerLine: "D8E4EC", surface: "EDF4F9" },
  code: { fill: "F1F6FA", text: "1F2937" },
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const FONT_BODY = { ascii: "Calibri", eastAsia: "Malgun Gothic" };
const FONT_HEAD = { ascii: "Calibri", eastAsia: "Malgun Gothic" };
const FONT_CODE = { ascii: "Consolas", hAnsi: "Consolas", eastAsia: "Malgun Gothic" };

// ── 제목 레이아웃(한글+라틴 혼합 폭 인식) ────────────────────
function charWidthTw(ch, pt) {
  const code = ch.codePointAt(0);
  const full = (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)
    || (code >= 0x3000 && code <= 0x303F) || (code >= 0xFF00 && code <= 0xFFEF)
    || (code >= 0x2E80 && code <= 0x2EFF) || (code >= 0xAC00 && code <= 0xD7AF)
    || (code >= 0x1100 && code <= 0x11FF) || (code >= 0x3130 && code <= 0x318F);
  return full ? pt * 20 : pt * 11;
}
function textWidthTw(text, pt) {
  let w = 0;
  for (const ch of text) w += charWidthTw(ch, pt);
  return w;
}
function splitLinesWidth(title, maxWidthTw, pt) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const wd of words) {
    const test = cur ? cur + " " + wd : wd;
    if (textWidthTw(test, pt) > maxWidthTw && cur) { lines.push(cur); cur = wd; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  // 마지막 줄 고아(1~2자) 병합
  if (lines.length > 1 && [...lines[lines.length - 1]].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTw, preferredPt = 40, minPt = 24) {
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    lines = splitLinesWidth(title, maxWidthTw, titlePt);
    if (lines.length <= 3 && lines.every(l => textWidthTw(l, titlePt) <= maxWidthTw)) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitLinesWidth(title, maxWidthTw, minPt); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

// ── 표지(R2 Double-Rule Frame) ───────────────────────────────
function buildCoverR2(config) {
  const C = config.palette;
  const padL = 1400, padR = 1400;
  const { titlePt, titleLines } = calcTitleLayout(config.title, 11906 - padL - padR, 40, 24);
  const titleSize = titlePt * 2;
  const thickBorder = { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 20 };
  const children = [];

  children.push(new Paragraph({
    indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 1200, after: 200 },
    border: { top: thickBorder }, children: [],
  }));
  children.push(new Paragraph({ spacing: { before: 1800 } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 500 },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: C.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: i < titleLines.length - 1 ? 80 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: C.cover.titleColor, font: { eastAsia: "Malgun Gothic", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.cover.subtitleColor,
        font: { eastAsia: "Malgun Gothic", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 1200 } }));
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100, line: Math.ceil(18 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: line, size: 36, color: C.cover.metaColor,
        font: { eastAsia: "Malgun Gothic", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 2000 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 200 },
    border: { bottom: thickBorder },
    children: [new TextRun({ text: config.footerRight || "", size: 18, color: C.cover.footerColor, font: { ascii: "Arial" } })],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── 본문 컴포넌트 빌더 ───────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, keepNext: true,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: FONT_HEAD })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, keepNext: true,
    spacing: { before: 280, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: FONT_HEAD })],
  });
}
function bodyP(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420 },
    spacing: { line: 312, after: opts.after ?? 80 },
    children: [new TextRun({ text, size: 22, color: "000000", font: FONT_BODY })],
  });
}
function labelP(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 60, line: 312 },
    children: [new TextRun({ text, bold: true, size: 22, color: P.primary, font: FONT_BODY })],
  });
}
function codeP(line) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312 },
    indent: { left: 200, right: 200 },
    shading: { type: ShadingType.CLEAR, fill: P.code.fill },
    children: [new TextRun({ text: line.length ? line : " ", size: 17, color: P.code.text, font: FONT_CODE })],
  });
}
function tipP(text) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 40 },
    children: [new TextRun({ text, size: 21, color: "000000", font: FONT_BODY })],
  });
}
function tableCaption(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 120, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: "000000", font: FONT_BODY })],
  });
}
function makeTable(headers, rows, widths) {
  const cell = (text, isHead, w) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: isHead ? { type: ShadingType.CLEAR, fill: P.table.headerBg } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { line: 312 },
      children: [new TextRun({ text, bold: isHead, size: 20,
        color: isHead ? P.table.headerText : "000000", font: FONT_BODY })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => cell(t, true, widths[i])),
      }),
      ...rows.map(r => new TableRow({
        cantSplit: true,
        children: r.map((t, i) => cell(t, false, widths[i])),
      })),
    ],
  });
}

function itemBlocks(item) {
  const out = [];
  out.push(h2(item.id + ". " + item.title));
  out.push(labelP("(1) 역할 설명"));
  for (const para of item.role) out.push(bodyP(para));
  out.push(labelP("(2) 구현 코드" + (item.blocks[0]?.lang ? " — " + item.blocks[0].lang : "")));
  item.blocks.forEach((b, bi) => {
    if (bi > 0) out.push(labelP("보조 코드 — " + b.lang));
    for (const line of b.code.split("\n")) out.push(codeP(line));
  });
  out.push(labelP("(3) 성능 최적화 팁"));
  for (const t of item.tips) out.push(tipP(t));
  return out;
}

// ── 제1장 개요 ───────────────────────────────────────────────
function buildOverview() {
  const out = [];
  out.push(h1("제1장 개요 — 문서 구성 및 아키텍처 총람"));
  out.push(bodyP("본 설계서는 2D 탑다운 웹 MMORPG를 브라우저에서 상용 서비스 수준으로 구동하기 위한 100개 항목의 모듈 설계서와 핵심 구현 코드를 담고 있다. 문서는 10개 모듈(항목 001~100)로 구성되며, 각 항목은 (1) 역할 설명, (2) 즉시 실행 가능한 TypeScript/SQL 구현 코드, (3) 성능 최적화 팁의 3단 구조로 작성되었다. 코드는 지정 기술 스택(uWebSockets.js, Kysely, Phaser 3/PixiJS, Tiled, Redis, Fastify)을 기준으로 작성되었고, 클라이언트와 서버가 공유하는 모듈은 shared/ 네임스페이스로 구분했다."));
  out.push(bodyP("전체 아키텍처는 5계층으로 요약된다. 표현 계층(모듈 1·5·8)은 렌더링·월드·UI를 담당하고, 통신 계층(모듈 2·6)은 위치 동기화와 소셜 채널을 운반한다. 데이터 계층(모듈 3·9)은 스탯·성장·경제의 원자성을 보장하며, 콘텐츠 계층(모듈 4·7)은 전투와 게임플레이 시스템을 구성한다. 마지막으로 운영 계층(모듈 10)은 보안·어드민·라이브 서비스 관제를 맡는다. 계층 간 의존 방향은 표현→통신→데이터→운영의 단방향을 원칙으로 하여, 순환 의존에 의한 결합도 상승을 차단한다."));
  out.push(bodyP("각 모듈은 독립적으로 읽을 수 있도록 설계했지만, 몇 가지 공통 패턴이 문서 전체에서 반복된다. 서버 권위(Server-Authoritative) 판정, 멱등 지급(ledger ref), 이벤트 버스 구독 체커, 더티 플래그 재계산, TypedArray 기반 바이너리 코덱이 그것이다. 실무 적용 시에는 먼저 모듈 1~2(엔진·동기화)와 모듈 3(스탯 파이프라인)을 기반으로 구축하고, 이후 모듈 4~9를 콘텐츠 우선순위에 따라 단계적으로 채택한 뒤, 모듈 10을 라이브 오픈 전 완성하는 순서를 권장한다."));
  out.push(tableCaption("표 1-1. 시스템 5계층 구성"));
  out.push(makeTable(
    ["계층", "포함 모듈", "핵심 역할"],
    [
      ["표현 계층", "모듈 1, 5, 8", "렌더링 루프·월드 렌더·조작부와 HUD"],
      ["통신 계층", "모듈 2, 6", "위치 동기화·AOI·채팅·실시간 소셜"],
      ["데이터 계층", "모듈 3, 9", "스탯·성장·재화·경제의 원자적 연산"],
      ["콘텐츠 계층", "모듈 4, 7", "전투·퀘스트·던전·경제 콘텐츠"],
      ["운영 계층", "모듈 10", "보안·어드민·텔레메트리·가용성"],
    ],
    [22, 26, 52],
  ));
  out.push(tableCaption("표 1-2. 모듈 구성 및 기술 스택"));
  out.push(makeTable(
    ["모듈", "항목", "주제", "핵심 기술 스택"],
    MODULES.map(m => [String(m.m), m.range, m.title, m.stack]),
    [8, 12, 38, 42],
  ));
  return out;
}

// ── 문서 조립 ────────────────────────────────────────────────
const DOC_TITLE = "2D 탑다운 웹 MMORPG 기술 아키텍처 설계서";
const bodyChildren = [...buildOverview()];

MODULES.forEach((mod, idx) => {
  bodyChildren.push(h1("제" + (idx + 2) + "장 모듈 " + mod.m + " — " + mod.title + " (" + mod.range + ")"));
  bodyChildren.push(bodyP("기술 스택: " + mod.stack + " 본 장은 " + mod.intro.split(". ")[0] + ". " + mod.intro.split(". ").slice(1).join(". ")));
  for (const item of modItems[String(mod.m).padStart(2, "0")]) bodyChildren.push(...itemBlocks(item));
});

const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const pageFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { line: 312 },
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT_BODY })],
  })],
});
const bodyHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { line: 312 },
    children: [new TextRun({ text: DOC_TITLE, size: 18, color: "888888", font: FONT_BODY })],
  })],
});

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: 22, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT_HEAD, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: FONT_HEAD, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 280, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    { // 1) 표지 — 여백 0, 페이지번호 없음
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR2({
        title: DOC_TITLE,
        subtitle: "모듈 1~10 · 항목 001~100 — 클라이언트 엔진부터 라이브 서비스 운영까지",
        englishLabel: "ARCHITECTURE SPEC",
        metaLines: [
          "문서 버전 v1.0",
          "작성일 2026-09-05",
          "기술 스택 uWebSockets.js · Kysely · Phaser 3 · Tiled · Redis",
        ],
        footerRight: "SERTZ Engineering Docs",
        palette: P,
      }),
    },
    { // 2) 목차 — 로마자 페이지 번호
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360, line: 312 },
          children: [new TextRun({ text: "목  차", bold: true, size: 32, color: "000000", font: FONT_HEAD })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200, line: 312 },
          children: [new TextRun({
            text: "※ 본 목차는 필드 코드로 생성되었습니다. 문서 편집 후 목차를 우클릭하고 '필드 업데이트'를 선택하면 페이지 번호가 갱신됩니다.",
            italics: true, size: 18, color: "888888", font: FONT_BODY }),
            new PageBreak()],
        }),
      ],
    },
    { // 3) 본문 — 아라비아 1부터 재시작
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/2D탑다운-MMORPG-기술아키텍처-설계서-001-100.docx";
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log("written:", OUT, (buf.length / 1024 / 1024).toFixed(2) + "MB");
console.log("body children:", bodyChildren.length);
