#!/usr/bin/env node
/**
 * vc229 — 세이브 압축/평문 혼재 안전성.
 *
 * ## 왜 이 테스트가 필요한가
 *
 * 세이브를 압축 저장으로 바꾸면 `db.saves[uid].data` 를 직접 읽던 8곳이
 * **조용히** 깨진다(data.owned → undefined → 거래소가 "미보유" 거절,
 * data.gold → undefined → 골드 증발). 컴파일은 통과한다(타입이 any/unknown).
 *
 * 이 테스트가 지키는 것:
 *  1. 압축 roundtrip 이 원본과 **완전히** 같은가
 *  2. 구 세이브(평문)와 신 세이브(압축)를 **같은 코드**가 읽는가
 *  3. 서버가 값을 고칠 때 압축 상태가 유지되는가(mutateSaveData)
 *  4. 압축본 재압축이 누적되지 않는가(무한 래핑 방지)
 *  5. 손상된 압축본이 **빈 세이브로 둔갑하지 않는가**(데이터 손실 방지)
 *
 * 실행: node tests/save-codec.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  compressJson, decompressJson, saveFingerprint,
} from "../src/lib/saveCodec.ts";
import {
  saveDataOf, saveCharsOf, unpackSaveRec, packSaveRec, mutateSaveData,
} from "../src/lib/saveAccess.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

/* 실제 SaveData 와 비슷한 표본 */
const SAVE = {
  v: 1, gold: 12345, emerald: 7, lv: 120, playerName: "테스트",
  owned: ["sword1", "sword1", "armor2"], accessories: ["ring1"],
  seen: Array.from({ length: 300 }, (_, i) => `seen_${i}`),
  visited: Array.from({ length: 150 }, (_, i) => `vis_${i}`),
  monsterKills: Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`m${i}`, i])),
  inf: { rebirths: 3, towerBest: 45 },
  potentials: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`p${i}`, { grade: (i % 5) + 1, lv: i }])),
};
const CHARS = { 캐릭A: { lv: 80, playerName: "캐릭A" }, 캐릭B: { lv: 40, playerName: "캐릭B" } };

console.log("1) 압축 roundtrip 무손실");
{
  const j = JSON.stringify(SAVE);
  const c = compressJson(j);
  ok("압축본이 원본보다 짧다", c.length < j.length, `(${j.length} → ${c.length})`);
  ok("압축 접두사(BR:/GZ:)가 붙는다", c.startsWith("BR:") || c.startsWith("GZ:"), c.slice(0, 4));
  ok("복원 결과가 바이트 동일", decompressJson(c) === j);
  ok("복원 JSON 이 원본과 동등", JSON.stringify(JSON.parse(decompressJson(c))) === j);
}
{
  /* 작은 페이로드는 압축하지 않는다 */
  const tiny = JSON.stringify({ a: 1 });
  ok("작은 페이로드는 원본 유지", compressJson(tiny) === tiny);
  ok("원본 유지는 복원도 그대로", decompressJson(tiny) === tiny);
}

console.log("\n2) 구(평문)·신(압축) 세이브를 같은 코드가 읽는다");
{
  const plainRec = { data: SAVE, updatedAt: 1000 };
  const packedRec = { data: compressJson(JSON.stringify(SAVE)), updatedAt: 2000, packed: true };
  const a = saveDataOf(plainRec), b = saveDataOf(packedRec);
  ok("평문 읽기", a && a.gold === 12345 && a.owned.length === 3);
  ok("압축 읽기", b && b.gold === 12345 && b.owned.length === 3);
  ok("두 형태 결과 동일", JSON.stringify(a) === JSON.stringify(b));
  ok("updatedAt 각각 보존", plainRec.updatedAt === 1000 && packedRec.updatedAt === 2000);
}
{
  /* chars 도 두 형태 모두.
   *  주의: chars 가 512바이트 미만이면 compressJson 이 **압축하지 않고 원문을 준다**
   *  (작은 페이로드는 압축 이득이 없어 태그 3바이트가 손해다).
   *  그래서 실제 크기에 가까운 chars 로 검증한다 — 작은 표본으로 테스트하면
   *  "압축 경로"를 전혀 타지 않아 통과해도 의미가 없다. */
  const big = {};
  for (let i = 0; i < 30; i++) big[`캐릭${i}`] = { lv: i, playerName: `c${i}`, seen: Array.from({ length: 40 }, (_, k) => `s${k}`) };
  const plainChars = { data: SAVE, updatedAt: 1, chars: big };
  const packedChars = { data: compressJson(JSON.stringify(SAVE)), updatedAt: 1, packed: true, chars: compressJson(JSON.stringify(big)) };
  ok("압축 대상 chars 가 실제로 압축됐다", String(packedChars.chars).startsWith("BR:") || String(packedChars.chars).startsWith("GZ:"));
  ok("평문 chars 읽기", Object.keys(saveCharsOf(plainChars)).length === 30);
  ok("압축 chars 읽기", Object.keys(saveCharsOf(packedChars)).length === 30);
  const u1 = unpackSaveRec(plainChars), u2 = unpackSaveRec(packedChars);
  ok("unpackSaveRec 두 형태 동일", JSON.stringify(u1.data) === JSON.stringify(u2.data));
  ok("unpackSaveRec chars 동일", JSON.stringify(u1.chars) === JSON.stringify(u2.chars));
}
{
  ok("레코드 없으면 null", unpackSaveRec(undefined) === null);
  ok("data 없으면 null", unpackSaveRec({ updatedAt: 1 }) === null);
}

console.log("\n3) 서버 수정이 압축 상태를 유지한다 (거래소·IAP)");
{
  const rec = { data: compressJson(JSON.stringify(SAVE)), updatedAt: 1, packed: true };
  const changed = mutateSaveData(rec, (d) => { d.gold = 100; return true; });
  ok("mutate 반환 true", changed === true);
  ok("저장이 다시 압축돼 있다", typeof rec.data === "string" && (rec.data.startsWith("BR:") || rec.data.startsWith("GZ:")));
  ok("packed 플래그 유지", rec.packed === true);
  ok("수정값이 읽힌다", saveDataOf(rec).gold === 100);
  ok("나머지 필드 보존", saveDataOf(rec).owned.length === 3);
  ok("updatedAt 갱신", rec.updatedAt > 1);
}
{
  /* 평문 레코드를 고치면 압축 형태로 승격된다 */
  const rec = { data: SAVE, updatedAt: 1 };
  mutateSaveData(rec, (d) => { d.emerald = 99; return true; });
  ok("평문 → 압축으로 승격", typeof rec.data === "string" && rec.packed === true);
  ok("승격 후 값 유지", saveDataOf(rec).emerald === 99 && saveDataOf(rec).gold === 12345);
}
{
  /* 변경 없음(false) 반환이면 아무것도 안 바뀐다 */
  const rec = { data: compressJson(JSON.stringify(SAVE)), updatedAt: 777, packed: true };
  const before = rec.data;
  ok("false 반환 시 변경 없음", mutateSaveData(rec, () => false) === false && rec.data === before && rec.updatedAt === 777);
}

console.log("\n4) 재압축 누적 없음");
{
  let rec = { data: compressJson(JSON.stringify(SAVE)), updatedAt: 1, packed: true };
  const size1 = rec.data.length;
  for (let i = 0; i < 5; i++) mutateSaveData(rec, (d) => { d.gold = i; return true; });
  const size2 = rec.data.length;
  ok("5회 반복 후에도 크기 안정", Math.abs(size2 - size1) < size1 * 0.1, `(${size1} → ${size2})`);
  ok("5회 후에도 값 정확", saveDataOf(rec).gold === 4);
}

console.log("\n5) 손상본이 빈 세이브로 둔갑하지 않는다");
{
  const bad = { data: "BR:!!!not-valid-base64!!!", updatedAt: 1, packed: true };
  ok("손상된 압축본은 null", saveDataOf(bad) === null);
  /* `typeof null === "object"` 이므로 typeof 로는 구분할 수 없다.
   *  "빈 객체를 주지 않는다"는 것은 Object.keys 로 확인해야 한다. */
  ok("빈 객체를 주지 않는다", saveDataOf(bad) === null);
  const badPack = { data: "BR:" + Buffer.from("not json at all").toString("base64"), updatedAt: 1, packed: true };
  ok("압축은 풀리지만 JSON 이 아니면 null", saveDataOf(badPack) === null);
}
{
  ok("data 가 배열이면 null", saveDataOf({ data: [1, 2, 3] }) === null);
  ok("data 가 숫자면 null", saveDataOf({ data: 42 }) === null);
}

console.log("\n6) 지문(fingerprint) — 무변경 쓰기 생략용");
{
  ok("같은 내용 = 같은 지문", saveFingerprint({ d: SAVE, c: null }) === saveFingerprint({ d: SAVE, c: null }));
  ok("다른 내용 = 다른 지문", saveFingerprint({ d: SAVE }) !== saveFingerprint({ d: { ...SAVE, gold: 1 } }));
  ok("chars 차이도 감지", saveFingerprint({ d: SAVE, c: null }) !== saveFingerprint({ d: SAVE, c: CHARS }));
}

console.log("\n7) 서버 코드가 직접 접근하지 않는다 (회귀 방지)");
{
  const files = [
    "src/app/api/auth/cloud-save/route.ts",
    "src/app/api/market/buy/route.ts",
    "src/app/api/market/collect/route.ts",
    "src/app/api/market/list/route.ts",
    "src/app/api/iap/verify/route.ts",
    "src/lib/sapi.ts",
  ];
  const offenders = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    /* 주석 제거 후 검사 */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    /* `saves[x].data` 를 곧바로 쓰는 패턴 — 헬퍼(saveDataOf 등)를 거치면 잡히지 않는다 */
    const bad = [
      /saves\[[^\]]+\]\s*\??\.\s*data\s*[.\[]/g,
      /\brec\s*\.\s*data\s*\./g,
      /\bsaveRec\s*\.\s*data\s*\./g,
      /\bmeSave\s*\.\s*data\s*\./g,
    ];
    for (const re of bad) if (re.test(code)) offenders.push(`${f}: ${re}`);
  }
  ok("직접 접근 0곳", offenders.length === 0, offenders.join(" | "));
}

console.log("\n8) 팩/언팩 헬퍼 왕복");
{
  const rec = packSaveRec(SAVE, { chars: CHARS, updatedAt: 555, fp: "abc" });
  ok("packed 플래그", rec.packed === true);
  ok("fp 보존", rec.fp === "abc");
  ok("updatedAt 보존", rec.updatedAt === 555);
  const out = unpackSaveRec(rec);
  ok("왕복 data 동일", JSON.stringify(out.data) === JSON.stringify(SAVE));
  /* CHARS 는 512바이트 미만이라 압축되지 않고 원문(객체)로 저장된다 —
   *  packSaveRec 은 compressJson 결과를 그대로 넣으므로 객체가 그대로 남는다.
   *  값 자체가 보존되는지가 핵심이다. */
  ok("왕복 chars 동일", JSON.stringify(out.chars) === JSON.stringify(CHARS),
    `(out=${JSON.stringify(out.chars)?.slice(0, 60)})`);
}
{
  /* chars 를 null 로 주면 기존 것을 보존한다(미포함 요청이 백업을 지우지 않게) */
  const rec = packSaveRec(SAVE, { chars: null, updatedAt: 1 });
  ok("chars 미지정 시 필드 없음", rec.chars === undefined);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
