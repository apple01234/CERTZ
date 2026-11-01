// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/character-appearance.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const file = new URL("../src/game/characterAppearance.ts", import.meta.url);
assert.ok(fs.existsSync(file), "선택창과 인게임이 공유하는 기존 외형 resolver가 필요하다");
const { resolveBodyPrefix, resolveCharacterPreview } = await import(pathToFileURL(file.pathname));
const { CLASSES } = await import("../src/game/classes.ts");
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
for (const gender of ["m", "f"]) {
  for (const cls of Object.values(CLASSES)) {
    const prefix = resolveBodyPrefix({ gender, cls: cls.key, skinIdx: 2 });
    const expected = cls.tier >= 2 ? `job${gender}_${cls.key}` : gender === "f" ? "chf2" : "";
    eq(prefix, expected, `${gender} ${cls.key}: 현재 전직 외형 사용`);
    if (prefix) assert.ok(fs.existsSync(new URL(`../public/assets/${prefix}_idle0.webp`, import.meta.url)), prefix);
  }
}
eq(resolveBodyPrefix({ cls: "warbringer", gender: "f", outfit: "outfit_royal" }), "cost_royal", "코스튬은 직업보다 우선");
eq(resolveBodyPrefix({ cls: "warbringer", gender: "m", outfit: "outfit_royal", gmSkin: true, gmApproved: true }), "gm", "승인된 GM은 코스튬보다 우선");
eq(resolveBodyPrefix({ cls: "warbringer", gmSkin: true, gmApproved: false }), "jobm_warbringer", "미승인 GM 외형은 사용하지 않음");
eq(resolveBodyPrefix({ cls: "warbringer" }, p => p !== "jobm_warbringer"), "jobm_berserker", "실제 전용 외형이 없을 때만 2차 폴백");
eq(resolveBodyPrefix({ cls: "not-a-job", gender: "f", skinIdx: 4 }), "chf4", "구 세이브 무효 직업은 피부 외형");
eq(resolveBodyPrefix({ skinIdx: 999 }), "", "무효 피부는 기본 외형");
const fa = resolveCharacterPreview({});
eq(fa.src, "/assets/fa/p1.png", "기본 남성은 Player.faActive와 같은 기존 FA 아틀라스");
const atlas = JSON.parse(fs.readFileSync(new URL("../public/assets/fa/p1.json", import.meta.url)));
eq(fa.crop, atlas.frames.fa_p1_idle__0.frame, "FA 크롭은 실제 아틀라스 메타와 일치");
eq(fa.sheet, atlas.meta.size, "FA 시트 크기 일치");
eq(resolveCharacterPreview({ cls: "arclord", gender: "f" }).src, "/assets/jobf_arclord_idle0.webp", "전직 카드도 인게임 idle 텍스처");
eq(Object.keys(resolveCharacterPreview({ cls: "arclord", isFifth: true })).includes("aura"), false, "선택창 아우라 없음");
// Phaser를 부팅하지 않고 실제 Player 메서드를 실행: 미로드와 파일 부재는 다르다.
const playerSrc = fs.readFileSync(new URL("../src/game/entities/Player.ts", import.meta.url), "utf8");
const applySource = playerSrc.slice(playerSrc.indexOf("  applyBodyLook() {"), playerSrc.indexOf("  /** 로비 생성 시 고른 외형 색조 설정"));
const ts = (await import("typescript")).default;
const { tier2RootOf } = await import("../src/game/classes.ts");
const loads = [];
const apply = new Function("resolveBodyPrefix", "tier2RootOf", "loadBodyPrefix", "FA_DISPLAY_SCALE", ts.transpile(`function applyBodyLook() ${applySource.slice(applySource.indexOf("{"))}; return applyBodyLook;`))(resolveBodyPrefix, tier2RootOf, (_scene, prefix) => loads.push(prefix), 1.17);
const ready = new Set(["jobm_berserker_idle0"]);
const p = { cls: "warbringer", gender: "m", skinIdx: 2, outfit: null, gmSkin: false, gmApproved: false, scene: { textures: { exists: key => ready.has(key) }, anims: { exists: () => false } }, texture: { key: "hero_idle0" }, bodyKey: key => key, setTexture() {}, faActive: () => false, setScale() {}, applyBodyOffset() {}, applyLookTint() {} };
apply.call(p);
eq(p.bodyPending, "jobm_warbringer", "미로드 4차 외형을 2차로 고정하지 않고 직접 로드");
eq(loads, ["jobm_warbringer"], "현재 직업 시트 로드 요청");
ready.add("jobm_warbringer_idle0");
apply.call(p);
eq(p.bodyPrefix, "jobm_warbringer", "로드 후 선택창과 같은 외형 적용");
// FA와 직업 외형 전환 시 이전 외형의 애니메이션이 덮어쓰지 않아야 한다.
const played = [];
p.anims = { currentAnim: { key: "fa-p1-run" }, isPlaying: true, stop() { this.stopped = true; } };
p.animKey = key => `${p.bodyPrefix}-${key.slice(5)}`;
p.scene.anims.exists = () => true;
p.play = key => played.push(key);
apply.call(p);
eq(played.pop(), "jobm_warbringer-walk", "FA 이동 애니를 새 직업 외형으로 재매핑");
eq(p.anims.stopped, true, "이전 외형 애니 중지");
p.cls = null;
p.bodyPrefix = "jobm_warbringer";
p.anims.currentAnim.key = "jobm_warbringer-walk";
p.faActive = () => !p.bodyPrefix;
p.animKey = key => key === "hero-walk" ? "fa-p1-run" : key;
let texture;
p.setTexture = (...args) => { texture = args; };
apply.call(p);
eq(texture, ["fa_p1", "fa_p1_idle__0"], "기본 남성 정지 프레임도 FA와 일치");
eq(played.pop(), "fa-p1-run", "직업 이동 애니를 FA로 복원");
// idle뿐 아니라 loadBodyPrefix가 요청하는 28프레임 모두 실존해야 한다.
const frames = ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"].flatMap(name => [0, 1, 2, 3].map(i => `${name}${i}`));
const prefixes = new Set();
for (const gender of ["m", "f"]) {
  for (const cls of Object.values(CLASSES)) prefixes.add(resolveBodyPrefix({ gender, cls: cls.key }));
  for (let skinIdx = 0; skinIdx < 6; skinIdx++) prefixes.add(resolveBodyPrefix({ gender, skinIdx }));
}
prefixes.add("gm");
prefixes.add("cost_royal");
prefixes.add("costm_royal");
for (const prefix of prefixes) {
  for (const frame of frames) {
    assert.ok(fs.existsSync(new URL(`../public/assets/${prefix || "hero"}_${frame}.webp`, import.meta.url)), `${prefix || "hero"}_${frame}`); checks++;
  }
}
assert.ok(fs.existsSync(new URL(`../public${fa.src}`, import.meta.url)), "FA 이미지 실존"); checks++;
const tier1 = Object.values(CLASSES).filter(cls => cls.tier === 1);
const dedicated = tier1.filter(cls => ["m", "f"].every(g => frames.every(frame => fs.existsSync(new URL(`../public/assets/job${g}_${cls.key}_${frame}.webp`, import.meta.url))))).map(cls => cls.key);
console.log(`ASSETS: ${prefixes.size} body sets x ${frames.length} frames; tier1 dedicated ${dedicated.length}/${tier1.length}: ${dedicated.join(", ")}`);
const lobbySrc = fs.readFileSync(new URL("../src/components/game/Lobby.tsx", import.meta.url), "utf8");
assert.ok(lobbySrc.includes("resolveCharacterPreview(look)"), "선택창은 공유 resolver 사용"); checks++;
assert.ok(!lobbySrc.includes("portraitOf("), "별도 생성 초상화 대신 실제 몸체만 표시"); checks++;
assert.ok(lobbySrc.includes("readCharSave(m.id)"), "슬롯 메타 대신 최신 세이브의 직업/코스튬 반영"); checks++;
console.log(`ALL CHECKS PASS (${checks} appearance checks)`);
