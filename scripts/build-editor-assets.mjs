/**
 * 에디터 에셋 카탈로그 생성기.
 *
 * [왜 스크립트인가]
 *  `/editor` · `/skill-editor` 는 클라이언트 컴포넌트다 — 브라우저에 fs 가 없어 디스크를
 *  훑을 수 없고, 손으로 목록을 적으면 반드시 어긋난다. (기존 `TilemapEditor` 의 PROPS 주석은
 *  "실제 존재하는 에셋만" 이라고 주장했지만 그걸 검증하는 코드는 없었다.)
 *  여기서 `public/assets` 를 한 번 훑어 **타입 붙은 TS 모듈**로 굳히고, 에디터는 그걸 정적 import 한다.
 *
 * [재생성]
 *  에셋을 추가/삭제했을 때:   node scripts/build-editor-assets.mjs
 *  결과물 `src/game/editorAssetManifest.ts` 를 커밋한다.
 *
 * [왜 JSON 이 아니라 .ts 인가]
 *  JSON + 별도 리더 모듈 = 파일 2개. TS 로 바로 내보내면 파일 1개로 끝나고
 *  `resolveJsonModule` 설정에도 기대지 않는다. 필터 헬퍼도 같은 파일에 함께 내보낸다.
 *
 * [의도적으로 안 하는 것]
 *  이미지 픽셀 크기를 읽지 않는다(PNG/WebP 헤더 파싱). 데코는 이미 `catalog.json` 에
 *  w/h 가 있어 그걸 병합하고, 나머지는 `<img>` 가 스스로 크기를 잡게 둔다.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

const ROOT = process.cwd();
const ASSETS_DIR = join(ROOT, "public", "assets");
const OUT = join(ROOT, "src", "game", "editorAssetManifest.ts");

/** 이미지 확장자만 — 사운드/아틀라스 JSON 은 에디터에서 그릴 수 없다. */
const IMAGE_EXT = new Set([".png", ".webp", ".jpg", ".jpeg"]);

/** 에디터와 무관한 디렉터리(오디오/백업). */
const SKIP_DIRS = new Set(["audio", "sfx2", ".tile_backup", ".tile_pack_backup", ".vfx_alpha_backup"]);

/** 최상위 디렉터리 → 카테고리 라벨. 표에 없는 디렉터리는 이름 그대로 노출한다. */
const CATEGORY_LABEL = {
  ground: "지면 타일",
  tiles: "타일셋",
  tilesets: "타일셋",
  objects: "장식물",
  player: "플레이어",
  npcbody: "NPC 몸",
  npcface: "NPC 표정",
  npcportrait: "초상화",
  skillicon: "스킬 아이콘",
  ui: "UI",
  ui2: "UI",
  fx: "이펙트",
  fx2: "이펙트",
  vfx: "이펙트",
  vfx2: "이펙트",
  vfx3: "이펙트",
  fa: "플립북 아틀라스",
  aura: "오라",
  gen: "생성물",
  map: "맵",
};

/** 카테고리 표시 순서 — 에디터에서 자주 쓰는 것부터. */
const CATEGORY_ORDER = [
  "objects", "ground", "tiles", "tilesets", "player", "npcbody", "npcface",
  "npcportrait", "skillicon", "ui", "ui2", "fx", "fx2", "vfx", "vfx2", "vfx3",
  "fa", "aura", "gen", "map",
];

/** 세부 그룹 — 같은 카테고리 안에서 파일이 수백 개일 때 좁히는 용도.
 *  데코는 세트(dungeon/forest/town), 스킬아이콘은 직업, NPC 표정은 종족으로 나눈다. */
function groupOf(category, fileBase) {
  if (category === "skillicon" || category === "npcface") return fileBase.split("_")[0];
  return "";
}

function walk(dir, category, group, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      /* objects/<세트>/ 는 그 세트가 곧 그룹이다 */
      if (category === "objects") {
        walk(full, category, ent.name, out);
        continue;
      }
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full, category, group, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!IMAGE_EXT.has(extname(ent.name).toLowerCase())) continue;
    const base = basename(ent.name, extname(ent.name));
    /* 절대 URL — public/ 기준 경로 */
    const url = "/" + full.slice(join(ROOT, "public").length + 1).split("\\").join("/");
    out.push({
      url,
      name: base,
      category,
      group: group || groupOf(category, base),
    });
  }
}

/** 데코 카탈로그 병합 — `objects/<set>/catalog.json` 에 사람이 읽는 이름/크기/태그가 있다. */
function mergeDecorMeta(list) {
  const byUrl = new Map(list.map((a) => [a.url, a]));
  for (const set of ["dungeon", "forest", "town"]) {
    const p = join(ASSETS_DIR, "objects", set, "catalog.json");
    if (!existsSync(p)) continue;
    let rows;
    try { rows = JSON.parse(readFileSync(p, "utf8")); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (!r || typeof r.file !== "string") continue;
      const a = byUrl.get(`/assets/objects/${set}/${r.file}`);
      if (!a) continue;
      if (typeof r.name === "string" && r.name) a.label = r.name;
      if (Number.isFinite(r.w) && Number.isFinite(r.h) && r.w > 0 && r.h > 0) {
        a.w = r.w; a.h = r.h;
        /* 카탈로그 좌표계는 4배 확대본이 섞여 있다(`scaled`). 원본 px 로 되돌린다. */
        if (Number.isFinite(r.scaled) && r.scaled > 1) {
          a.w = Math.round(r.w / r.scaled);
          a.h = Math.round(r.h / r.scaled);
        }
      }
      if (typeof r.tag === "string" && r.tag) a.tag = r.tag;
    }
  }
}

/* ── 수집 ── */
const found = [];
if (existsSync(ASSETS_DIR)) {
  for (const ent of readdirSync(ASSETS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith(".") || SKIP_DIRS.has(ent.name)) continue;
    walk(join(ASSETS_DIR, ent.name), ent.name, "", found);
  }
}
mergeDecorMeta(found);

/* 정렬 — 카테고리 순서 고정, 그 안은 그룹 → 이름. 재생성 시 diff 가 안정적이다. */
const rank = (c) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return i < 0 ? 999 : i;
};
found.sort((a, b) =>
  rank(a.category) - rank(b.category) ||
  (a.category < b.category ? -1 : a.category > b.category ? 1 : 0) ||
  a.group.localeCompare(b.group) ||
  a.name.localeCompare(b.name),
);

const categories = [...new Set(found.map((a) => a.category))];
const groups = {};
for (const a of found) {
  (groups[a.category] ??= new Set()).add(a.group);
}

/* ── TS 모듈 출력 ──
 * 데이터와 함께 **필터 헬퍼**를 같이 내보낸다. 두 에디터가 같은 필터 규칙을 쓰도록. */
const rows = found.map((a) => {
  const parts = [
    `url:${JSON.stringify(a.url)}`,
    `name:${JSON.stringify(a.name)}`,
    `category:${JSON.stringify(a.category)}`,
    /* group 은 항상 출력한다 — 타입에서 필수라 빼면 tsc 가 막는다. */
    `group:${JSON.stringify(a.group ?? "")}`,
  ];
  if (a.label) parts.push(`label:${JSON.stringify(a.label)}`);
  if (a.w) parts.push(`w:${a.w}`);
  if (a.h) parts.push(`h:${a.h}`);
  if (a.tag) parts.push(`tag:${JSON.stringify(a.tag)}`);
  return `  { ${parts.join(", ")} },`;
}).join("\n");

const ts = `/**
 * ⚠️ 생성 파일 — 직접 고치지 마세요.
 *    \`node scripts/build-editor-assets.mjs\` 로 다시 만듭니다.
 *
 * 왜 생성하나: 브라우저에는 fs 가 없어 \`public/assets\` 를 훑을 수 없다.
 * 손으로 적은 목록은 반드시 디스크와 어긋난다(실제로 그런 주석이 있었다).
 * 이 파일은 디스크를 실제로 훑은 결과이며, 에셋을 추가/삭제하면 재생성 후 커밋한다.
 *
 * 총 ${found.length}개 · 카테고리 ${categories.length}종 · 생성 ${new Date().toISOString().slice(0, 10)}
 */

export type EditorAsset = {
  /** public 기준 절대 URL — \`<img src>\` 에 그대로 쓴다 */
  url: string;
  /** 확장자를 뺀 파일명 */
  name: string;
  /** 최상위 디렉터리 */
  category: string;
  /** 카테고리 안의 세부 그룹(데코 세트 / 직업 / 종족). 없으면 빈 문자열 */
  group: string;
  /** 사람이 읽는 이름(데코 catalog.json 에서 병합). 없으면 name 을 쓴다 */
  label?: string;
  /** 원본 픽셀 크기 — 데코만 알려져 있다 */
  w?: number;
  h?: number;
  /** 데코 분류 태그(wall/big/…) */
  tag?: string;
};

/** 카테고리 표시명 */
export const CATEGORY_LABELS: Record<string, string> = ${JSON.stringify(CATEGORY_LABEL, null, 2)};

/** 카테고리 노출 순서 */
export const CATEGORY_ORDER: string[] = ${JSON.stringify(categories, null, 2)};

/** 카테고리별 세부 그룹 목록 */
export const CATEGORY_GROUPS: Record<string, string[]> = {
${categories.map((c) => `  ${JSON.stringify(c)}: ${JSON.stringify([...groups[c]].sort())},`).join("\n")}
};

export const EDITOR_ASSETS: EditorAsset[] = [
${rows}
];

/** 표시용 이름 */
export function assetLabel(a: EditorAsset): string {
  return a.label || a.name;
}

/**
 * 검색/카테고리/그룹 필터. \`query\` 는 이름·URL·태그에 대한 소문자 부분일치.
 * 반환 순서는 \`EDITOR_ASSETS\` 의 원래 순서를 유지한다(안정적).
 */
export function filterAssets(opts: {
  category?: string;
  group?: string;
  query?: string;
}): EditorAsset[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return EDITOR_ASSETS.filter((a) => {
    if (opts.category && a.category !== opts.category) return false;
    if (opts.group && a.group !== opts.group) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.url.toLowerCase().includes(q) ||
      (a.label ?? "").toLowerCase().includes(q) ||
      (a.tag ?? "").toLowerCase().includes(q)
    );
  });
}
`;

writeFileSync(OUT, ts, "utf8");

/* 콘솔 요약 — 생성이 실제로 무엇을 했는지 확인할 수 있게 */
const perCat = categories.map((c) => `${c}=${found.filter((a) => a.category === c).length}`);
console.log(`[editor-assets] ${found.length}개 → ${OUT.replace(ROOT + "\\\\", "")}`);
console.log(`[editor-assets] ${perCat.join(" ")}`);
