/**
 * 에셋 출처·라이선스 계약.
 *
 * [왜 필요한가]
 *  이 프로젝트의 철칙은 **"게임 아트를 AI 로 생성하지 않는다. 라이선스가 있는
 *  외부 에셋만 쓴다"** 이다. 그런데 그 규칙을 코드가 강제하는 곳이 없었다.
 *  CREDITS.md 에 사람이 손으로 적어 둔 것이 전부였다.
 *
 * [vc288 에서 실제로 찾은 결함]
 *  런타임 이미지 7,054개 · 오디오 114개(150.8MB)인데,
 *  CREDITS.md 는 v3.0.21 시점 목록에서 멈춰 있었다.
 *  실제 ogg 114개 중 CREDITS 에 이름이 있는 것은 **18개뿐**이었다.
 *  89개가 통째로 누락 — 그중 다수가 CC-BY(저작자 표시 의무) 곡이다.
 *
 *  더 심각한 것: `bgm_hw*` 15곡이 audio.ts 주석에
 *  "ai_song 의 노이즈 필터 통과 곡"이라고 적혀 있었다 = **AI 생성 음악**.
 *  철칙은 "게임 아트 AI 생성 금지"이므로 음악은 범위 밖으로 두기로 했고
 *  (2026-11-09 사용자 판단), 대신 **CREDITS 에 그 사실을 명시**하기로 했다.
 *
 * [이 테스트가 하는 일]
 *   ① CREDITS 가 존재하고 라이선스/출처 구조를 갖춘다
 *   ② 모든 오디오 파일이 CREDITS 에 이름을 올린다  ← vc288 의 실제 결함
 *   ③ AI 생성 곡은 그 사실이 명시된다
 *   ④ 라이선스가 허용 목록 안에 있다
 *   ⑤ 사용자 요청으로 허용된 컷씬 생성 아트의 제작 방식·참조 출처를 명시한다
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";

const CREDITS = "public/assets/CREDITS.md";
const AUDIO_DIR = "public/assets/audio";

/** 허용 라이선스 — 이 목록에 없는 라이선스는 사람이 검토해야 한다. */
const ALLOWED = [
  /CC0/i,
  /CC-BY(-SA)?\s*\d/i,
  /Public Domain/i,
  /MIT/i,
  /OFL/i,
  /Apache/i,
  /* vc288 — 자체 제작분. 외부 라이선스가 아니라 권리를 직접 보유한 에셋이다. */
  /자체\s*제작|in-house/i,
  /* vc288 — AI 생성물. 철칙은 "게임 아트 AI 생성 금지"이며 음악은 범위 밖으로
   * 결정했다(2026-11-09 사용자 판단). CREDITS 에 **명시**하는 것을 조건으로 허용한다. */
  /AI\s*생성/i,
  /* 외부 사이트의 자체 이용조건을 문장으로 적은 경우 (예: soundeffect-lab) */
  /무료|금지|불필요|허용|이용/,
];

function creditLines() {
  assert.ok(existsSync(CREDITS), `${CREDITS} 가 없다 — 에셋 출처를 기록해야 한다`);
  return readFileSync(CREDITS, "utf8").split("\n").map((l) => l.trim());
}

function creditText() {
  return creditLines().join("\n");
}

test("CREDITS.md 가 존재하고 충분히 기록돼 있다", () => {
  const text = creditText();
  assert.ok(text.length > 2000, `CREDITS.md 가 ${text.length}자뿐이다 — 팩 출처를 기록해야 한다`);
  assert.match(text, /License/i, "License 표기가 하나도 없다");
  assert.match(text, /Source/i, "Source 표기가 하나도 없다");
});

test("모든 오디오 파일이 CREDITS 에 이름이 있다", () => {
  /* 이름 비교는 밑줄을 무시한다 — `bgm_cave1`(옛 표기)과 `bgm_cave_1`(파일명)은
   * 같은 곡이며, CREDITS 에 둘 중 하나만 있어도 출처는 밝혀진 것이다. */
  assert.ok(existsSync(AUDIO_DIR), `${AUDIO_DIR} 가 없다`);
  const files = readdirSync(AUDIO_DIR).filter((f) => f.endsWith(".ogg"));
  assert.ok(files.length > 50, `ogg 가 ${files.length}개뿐이다 — 배포본이 빠졌을 수 있다`);

  const text = creditText();
  const norm = (s) => s.replace(/_/g, "");
  const covered = new Set([...text.matchAll(/([a-z0-9_]{3,})/gi)].map((m) => norm(m[1])));

  const missing = files.filter((f) => !covered.has(norm(f.replace(/\.ogg$/, ""))));
  assert.deepEqual(
    missing,
    [],
    `CREDITS 에 출처가 없는 오디오 ${missing.length}개: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? " 외" : ""}`,
  );
});

test("AI 생성 음악은 CREDITS 에 그 사실이 명시돼 있다", () => {
  /* 철칙은 "게임 아트 AI 생성 금지". vc288 에서 `hw*` 15곡이 AI 생성임을 발견했다.
   * 음악은 철칙 범위 밖으로 두기로 했지만, **어떤 곡이 AI 생성인지는 밝혀야 한다**. */
  const text = creditText();
  const hw = readdirSync(AUDIO_DIR).filter((f) => /^bgm_hw\d+_\d+\.ogg$/.test(f));
  if (hw.length === 0) return; // 해당 곡이 없으면 계약 대상 아님

  assert.match(text, /AI\s*생성/, "CREDITS 에 AI 생성 표기가 없다");
  for (const f of hw) {
    assert.ok(text.includes(f.replace(/\.ogg$/, "")), `AI 곡 ${f} 가 CREDITS 에 없다`);
  }
});

test("Source 와 License 표기가 짝을 이룬다", () => {
  const lines = creditLines();
  const sources = lines.filter((l) => /^-?\s*Source\s*:/i.test(l)).length;
  const licenseLines = lines.filter((l) => /^-?\s*License\s*:/i.test(l)).length;
  /* 제목에 라이선스를 적은 팩도 있다(예: `## pixelfx — MIT`). */
  const licenseHeadings = lines.filter(
    (l) => /^#{2,4}\s/.test(l) && ALLOWED.some((re) => re.test(l)),
  ).length;

  assert.ok(sources > 0, "Source 항목이 하나도 없다");
  const covered = licenseLines + licenseHeadings;
  assert.ok(
    covered >= sources,
    `라이선스 표기 ${covered}개(줄 ${licenseLines} + 제목 ${licenseHeadings}) < Source ${sources}개 — 라이선스 미확인 팩이 있다`,
  );
});

test("모든 라이선스가 허용 목록 안에 있다", () => {
  const declared = creditLines().filter((l) => /^-?\s*License\s*:/i.test(l));
  assert.ok(declared.length > 0, "License 항목이 없다");

  const bad = [];
  for (const line of declared) {
    const value = line.replace(/^-?\s*License\s*:\s*/i, "");
    if (!ALLOWED.some((re) => re.test(value))) bad.push(value);
  }
  assert.deepEqual(
    bad,
    [],
    `허용 목록에 없는 라이선스: ${bad.join(" | ")} — 사람이 검토하고 ALLOWED 에 추가해야 한다`,
  );
});

test("사용자가 요청한 컷씬 생성 아트는 제작 방식과 참조 출처를 숨기지 않는다", () => {
  // Latest user instruction explicitly authorizes portrait-matched atlas generation and correcting bad portraits.
  const text = creditText();
  const cast = text.slice(text.indexOf('초상화에 맞춘 컷씬 등장인물'));
  assert.match(cast, /image_gen\.imagegen.*AI 생성/);
  assert.match(cast, /npcportrait\/dxp_/);
  assert.match(cast, /cutscene-cast-sources\.json/);
  assert.match(cast, /원본 SHA-256/);
});

test("textures.ts 가 참조하는 스프라이트가 CREDITS 에 있다 (vc288 실제 결함)", () => {
  /* [발견 경위]
   *  textures.ts 의 BOSS_ATLAS 가 `file: "boss_*.png"` 로 참조하는 스프라이트 6개가
   *  CREDITS 에 **전혀 없었다.** 보스는 게임에서 가장 눈에 띄는 아트인데
   *  출처가 문서화되지 않은 상태였다.
   *
   *  코드 주석에 "AI 생성 원본" 이라는 문구가 있어 AI 생성물로 오해했으나,
   *  실제로는 vc235 에서 라이선스 팩으로 교체된 뒤였다
   *  (근거: docs/BOSS_SPRITE_PLAN.md — AI 생성 13종 중 11종 하단 잘림).
   *  빠진 것은 **출처 표시**뿐이었다.
   *
   *  이 테스트는 새 보스 스프라이트를 추가하면서 CREDITS 를 잊는 것을 막는다. */
  const tex = readFileSync("src/game/textures.ts", "utf8");
  const refs = new Set([...tex.matchAll(/file:\s*"([^"]+\.png)"/g)].map((m) => m[1]));
  assert.ok(refs.size > 0, "textures.ts 에서 스프라이트 참조를 찾지 못했다");

  const text = creditText();

  /* 파일이 실재하는지 */
  const assetFiles = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else assetFiles.add(e.name);
    }
  };
  assert.ok(existsSync("public/assets"), "public/assets 가 없다");
  walk("public/assets");

  const missingFile = [...refs].filter((r) => !assetFiles.has(r));
  assert.deepEqual(missingFile, [], `참조했지만 파일이 없는 스프라이트: ${missingFile.join(", ")}`);

  /* CREDITS 에 이름이 있는지 */
  const uncredited = [...refs].filter((r) => !text.includes(r.replace(/\.png$/, "")));
  assert.deepEqual(
    uncredited,
    [],
    `CREDITS 에 출처가 없는 스프라이트: ${uncredited.join(", ")} — 라이선스 표시 의무`,
  );
});

test("저장소의 용량 큰 에셋 팩이 CREDITS 에 언급돼 있다", () => {
  /* 이미지·오디오 팩을 새로 넣으면서 출처를 빠뜨리는 것을 막는다.
   * 1MB 이상 파일이 있는 하위 디렉터리는 출처를 남겨야 한다. */
  const roots = readdirSync("public/assets", { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const text = creditText();
  const big = [];
  for (const r of roots) {
    let bytes = 0;
    let count = 0;
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.(png|webp|ogg|mp3)$/i.test(e.name)) {
          count++;
          bytes += statSync(p).size;
        }
      }
    };
    walk(`public/assets/${r}`);
    if (bytes < 1048576) continue; // 1MB 미만은 대상 아님
    if (!text.includes(r)) big.push(`${r} (${(bytes / 1048576).toFixed(1)}MB, ${count}개)`);
  }
  assert.deepEqual(big, [], `CREDITS 에 출처가 없는 대용량 에셋 루트: ${big.join(" | ")}`);
});
test("CREDITS 가 가리키는 저장소 경로가 실제로 있다", () => {
  /* CREDITS 는 팩을 **글롭**으로 적기도 한다
   * (예: `public/assets/ground/ground_*`, `public/assets/npcbody/*.png`).
   * 글롭을 그대로 existsSync 하면 항상 실패한다 — 상위 디렉터리로 바꿔 확인한다. */
  const referenced = [];
  for (const l of creditLines()) {
    const m = /`(public\/assets\/[^`]+)`/.exec(l);
    if (m) referenced.push(m[1]);
  }

  const missing = [];
  for (const raw of referenced) {
    const globAt = raw.search(/[*?[]/);
    const target = globAt >= 0 ? raw.slice(0, globAt) : raw;
    const dir = target.endsWith("/") ? target : target.replace(/\/[^/]*$/, "");
    const check = (dir || target).replace(/\/$/, "");
    if (!existsSync(check)) missing.push(raw);
  }
  assert.deepEqual(missing, [], `CREDITS 가 가리키는 경로가 없다: ${missing.join(", ")}`);
});
