/**
 * GET/PUT /api/maps — 맵 에디터가 만든 맵을 읽고 쓴다.
 *
 * [왜 API 가 필요한가]
 *  에디터가 JSON 을 다운로드만 하면 매번 수동으로 파일을 옮겨야 한다.
 *  "맵메이커 최종 완성"은 **에디터에서 저장 → 게임에 반영**이 한 흐름이어야 완성이다.
 *
 * [저장 위치]
 *  `public/assets/maps/<seed>.json` + `_index.json`.
 *  · 정적 파일이라 git 으로 버전 관리되고 APK/Electron 정적 export 에도 실린다.
 *  · DB·인증을 건드리지 않는다(사용자 지시 "무관한 보안·인증·DB 코드는 건드리지 말 것").
 *
 * [보안]
 *  · seed 는 `[a-z0-9_]{1,40}` 만 허용 — 경로 탈출(`../`) 차단.
 *  · 2MB 캡, 깊이 제한(JSON.parse 로만 검사하므로 깊이는 구조 검증으로 대체).
 *  · **쓰기는 관리자만**. 맵은 모든 플레이어가 보는 데이터라 아무나 바꾸면 안 된다.
 *    읽기는 공개(게임 부팅 시 fetch).
 *
 * [실패 시]
 *  파일 쓰기가 막힌 환경(읽기 전용 배포)에서는 503 과 안내를 준다.
 *  에디터는 이 경우 JSON 다운로드로 폴백한다.
 */

import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { loadDb } from "@/lib/ghdb";
import { currentUser, isAdminUser, json, options } from "@/lib/sapi";

const DIR = path.join(process.cwd(), "public", "assets", "maps");
const INDEX = path.join(DIR, "_index.json");
const SEED_RE = /^[a-z0-9_]{1,40}$/;
const MAX_BYTES = 2 * 1024 * 1024;

export function OPTIONS(req: NextRequest) { return options(req); }

/** 저장된 맵 목록. 게임 부팅 시 `/assets/maps/_index.json` 을 직접 fetch 하므로
 *  이 GET 은 에디터의 "현재 저장된 것 보기" 용도다. */
export async function GET(req: NextRequest) {
  try {
    const seed = req.nextUrl.searchParams.get("seed");
    if (seed) {
      if (!SEED_RE.test(seed)) return json(req, 400, { error: "seed 형식이 올바르지 않아요" });
      try {
        const raw = await fs.readFile(path.join(DIR, `${seed}.json`), "utf8");
        return json(req, 200, JSON.parse(raw));
      } catch {
        return json(req, 404, { error: "해당 맵이 없어요" });
      }
    }
    try {
      const raw = await fs.readFile(INDEX, "utf8");
      return json(req, 200, JSON.parse(raw));
    } catch {
      return json(req, 200, []);   // 아직 저장된 맵이 없음 = 정상
    }
  } catch (e) {
    return json(req, 500, { error: String((e as Error).message ?? e).slice(0, 200) });
  }
}

/** 맵 저장 — 관리자 전용. */
export async function PUT(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    if (!isAdminUser(me)) return json(req, 403, { error: "관리자 권한이 필요해요" });

    const body = (await req.json()) as { seed?: string; map?: unknown };
    const seed = String(body.seed ?? "");
    if (!SEED_RE.test(seed)) return json(req, 400, { error: "seed 는 영소문자·숫자·밑줄 40자 이내" });

    const map = body.map as Record<string, unknown> | null;
    if (!map || typeof map !== "object") return json(req, 400, { error: "map 객체가 필요해요" });

    /* 구조 최소 검증 — 게임이 읽을 때 런타임 오류가 나지 않도록 */
    const cols = Number(map.cols), rows = Number(map.rows);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 3 || rows < 3 || cols > 64 || rows > 64) {
      return json(req, 400, { error: "cols/rows 는 3~64 정수여야 해요" });
    }
    if (!Array.isArray(map.openRows) || map.openRows.length !== rows) {
      return json(req, 400, { error: "openRows 길이가 rows 와 달라요" });
    }
    for (const r of map.openRows) {
      if (typeof r !== "string" || r.length !== cols || /[^.#]/.test(r)) {
        return json(req, 400, { error: "openRows 는 cols 길이의 '.'/'#' 문자열이어야 해요" });
      }
    }

    const text = JSON.stringify(map);
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      return json(req, 413, { error: "맵이 너무 커요(2MB 초과)" });
    }

    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, `${seed}.json`), text, "utf8");

    /* 인덱스 갱신 — 게임 부팅이 이 파일을 읽어 오버라이드를 찾는다 */
    let list: { seed: string; file: string }[] = [];
    try {
      const raw = await fs.readFile(INDEX, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed
          .map((it) => (typeof it === "string" ? { seed: it, file: `${it}.json` } : it))
          .filter((it): it is { seed: string; file: string } => !!it && typeof it.seed === "string");
      }
    } catch { /* 인덱스 없음 — 새로 만든다 */ }

    if (!list.some((it) => it.seed === seed)) list.push({ seed, file: `${seed}.json` });
    await fs.writeFile(INDEX, JSON.stringify(list, null, 2), "utf8");

    return json(req, 200, { ok: true, seed, bytes: Buffer.byteLength(text, "utf8"), total: list.length });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    /* 읽기 전용 배포(서버리스) — 에디터가 JSON 다운로드로 폴백하도록 알린다 */
    if (/EROFS|EACCES|read-only/i.test(msg)) {
      return json(req, 503, { error: "이 서버는 파일 쓰기가 막혀 있어요. JSON 다운로드를 사용하세요." });
    }
    return json(req, 500, { error: msg.slice(0, 200) });
  }
}
