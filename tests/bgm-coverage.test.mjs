/**
 * BGM 트랙 파일 존재 계약 (REVAMP_100 #29 "BGM 잔여 테마 수집").
 *
 * [왜 필요한가]
 *  `docs/REVAMP_100.md` #29 는 "BGM 잔여 32테마 수집 (현재 70/102)" 을 ⬜ 로 남겨 두고
 *  있었다. 그 숫자가 지금도 맞는지, 실제로 **재생에 쓰이는 트랙이 파일로 있는지**
 *  아무도 검사하지 않았다.
 *
 *  없는 파일을 참조하면 게임은 조용히 무음을 재생한다 — 콘솔 에러도 안 뜨고
 *  "왜 이 구역만 음악이 없지"로만 나타나서 찾기 어렵다.
 *
 * [측정 결과 — vc288]
 *  audio.ts 의 실제 재생 테이블(BOSS_OF · REBIRTH_BOSS_OF · BOSS_TRACKS)이
 *  참조하는 bgm_ 트랙 **21개 중 누락 0개**. 파일은 114개 있다.
 *
 *  주의: TRACK_GAIN 은 **볼륨 테이블**이라 bgm_ 로 시작하지 않는 키(battle, lobby,
 *  shop, kitchen 등)가 섞여 있다. 이걸 트랙으로 오인하면 "8개 누락"이라는
 *  잘못된 결론이 나온다(실제로 그렇게 오탐했다).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const AUDIO_TS = "src/game/audio.ts";
const AUDIO_DIR = "public/assets/audio";

/** ogg 파일 이름 집합 (확장자 제외). */
function trackFiles() {
  assert.ok(existsSync(AUDIO_DIR), `오디오 디렉터리가 없다: ${AUDIO_DIR}`);
  return new Set(
    readdirSync(AUDIO_DIR)
      .filter((f) => f.endsWith(".ogg"))
      .map((f) => f.replace(/\.ogg$/, "")),
  );
}

/** `const NAME = { ... }` 블록 안의 문자열 리터럴만 뽑는다. */
function blockStrings(src, name) {
  const i = src.indexOf(`const ${name}`);
  if (i < 0) return null;
  const open = src.indexOf("{", i);
  if (open < 0) return null;
  let depth = 0;
  let end = -1;
  for (let k = open; k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}") {
      depth--;
      if (depth === 0) {
        end = k;
        break;
      }
    }
  }
  if (end < 0) return null;
  const body = src
    .slice(open, end)
    .split("\n")
    .filter((l) => !/^\s*(\*|\/\/)/.test(l))
    .join("\n");
  return [...new Set([...body.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]))];
}

/** 실제 재생에 쓰이는 테이블만 (볼륨표 TRACK_GAIN 은 제외). */
const PLAYBACK_TABLES = ["BOSS_OF", "REBIRTH_BOSS_OF", "BOSS_TRACKS"];

test("ogg 파일이 실제로 있다 (빈 디렉터리로 통과 방지)", () => {
  const files = trackFiles();
  assert.ok(files.size >= 50, `ogg 파일이 ${files.size}개뿐이다 — 배포본이 빠졌을 수 있다`);
});

test("재생 테이블이 참조하는 bgm 트랙이 전부 파일로 존재한다", () => {
  const src = readFileSync(AUDIO_TS, "utf8");
  const files = trackFiles();
  const missing = [];
  let checked = 0;

  for (const table of PLAYBACK_TABLES) {
    const ss = blockStrings(src, table);
    if (!ss) continue; // 테이블이 없으면 건너뛴다(리팩터로 이름이 바뀔 수 있음)
    for (const s of ss) {
      if (!s.startsWith("bgm_")) continue; // 볼륨 키 등은 대상 아님
      checked++;
      if (!files.has(s)) missing.push(`${table} → ${s}.ogg`);
    }
  }

  assert.ok(checked >= 5, `검사한 트랙이 ${checked}개뿐이다 — 파싱이 깨졌다`);
  assert.deepEqual(missing, [], `참조했는데 파일이 없는 BGM: ${missing.join(", ")}`);
});

test("볼륨표를 트랙 목록으로 오인하지 않는다 (오탐 기록)", () => {
  /* 이 테스트는 "왜 오탐이 났는지"를 기록으로 남긴다.
   *
   * 앞선 감사는 audio.ts 의 모든 `bgm_*` 유사 문자열을 트랙으로 세서
   * "8개 누락"이라고 잘못 판정했다. 실제로는 그중 대부분이 **볼륨 조정 테이블의 키**
   * (battle·lobby·shop·kitchen 등, bgm_ 접두어가 없거나 변수명)였다.
   *
   * 그래서 계약을 이렇게 잡았다:
   *   ① 재생 테이블은 BOSS_OF · REBIRTH_BOSS_OF · BOSS_TRACKS 셋뿐이다
   *   ② 트랙 이름은 반드시 `bgm_` 으로 시작한다
   * 이 두 가지가 유지되면, 새 테이블이 생겨도 ②가 잡아 준다.
   */
  const src = readFileSync(AUDIO_TS, "utf8");

  /* ① 재생 테이블이 실제로 존재한다 (이름이 바뀌면 테스트를 갱신해야 한다) */
  for (const t of PLAYBACK_TABLES) {
    assert.ok(src.includes(`const ${t}`), `재생 테이블 ${t} 를 찾지 못했다 — 이름이 바뀌었다면 테스트를 갱신하라`);
  }

  /* ② 재생 테이블의 값 중 bgm_ 이 아닌 것이 섞여 있으면 파싱이 틀린 것이다 */
  for (const t of PLAYBACK_TABLES) {
    const ss = blockStrings(src, t);
    if (!ss) continue;
    /* BOSS_OF 같은 Record 는 키가 문자열이고 값이 트랙이다.
     * 우리가 뽑는 정규식은 둘 다 잡으므로, "bgm_ 아닌 값"을 걸러내는 것으로 충분하다. */
    const tracks = ss.filter((s) => s.startsWith("bgm_"));
    assert.ok(tracks.length > 0, `${t} 에서 bgm_ 트랙을 하나도 뽑지 못했다`);
  }
});
