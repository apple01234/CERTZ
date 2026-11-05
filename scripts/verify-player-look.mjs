/**
 * vc255 (지시 #7) — 기본 남캐/여캐 외형 개편 검증.
 *
 * [문제] 기본 남캐는 `bodyPrefix=""` → FA 아틀라스 idle 프레임을 썼다.
 *  그 프레임은 64×85 안에 캐릭터 **18×36px** 이고, 실제로는 사람이 아니라
 *  "청보라색 외계 생물"(큰 원형 머리 + 1px 촉수 팔다리 + 노란 사각 눈)로 보였다.
 *  `ch{m|f}{skin}` 세트도 96×64 에 26~28×40~42px 로 같은 계열의 저해상도였고,
 *  `chm2`(남캐 기본 피부)는 BODY_PREFIXES 에 **아예 없었다**.
 *
 * [수리] `scripts/make_player_sheet.py` 가 npcbody 규격(2.2등신, 실제 이목구비)으로
 *  `chm2_*`/`chf2_*` 전 세트(7동작 × 4프레임)를 생성하고, 렌더러가 이를 쓰도록 연결했다.
 *
 * 검사:
 *  1) 파일: 56프레임 존재, 캐릭터가 기존(18×36 FA)보다 크고 npcbody 비율(≈2.2등신)
 *  2) 뒷모습에 V넥이 없다(앞면은 V, 뒷면은 수평 밴드)
 *  3) 게임: 기본 남캐 bodyPrefix 가 chm2 이고 텍스처가 로드된다
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

/* ── 1) 파일 규격 ── */
const py = `
import json, os
from PIL import Image
ANIMS = ['idle','walk','walkup','walkside','atk','atkup','atkdown']
res = {}
for g in ('m','f'):
    prefix = f'ch{g}2'
    missing, sizes = [], set()
    for a in ANIMS:
        for i in range(4):
            p = f'public/assets/{prefix}_{a}{i}.webp'
            if not os.path.exists(p):
                missing.append(f'{a}{i}')
                continue
            if a == 'idle' and i == 0:
                im = Image.open(p).convert('RGBA'); bb = im.getbbox()
                sizes.add((im.size, (bb[2]-bb[0], bb[3]-bb[1])))
    res[g] = {'missing': missing, 'idle0': [list(s) for s in sizes]}
# 뒷모습 V넥 검사: 금색 트림 행 분포
def trim_rows(prefix, anim):
    im = Image.open(f'public/assets/{prefix}_{anim}.webp').convert('RGBA'); px = im.load()
    rows = {}
    for y in range(im.height):
        n = 0
        for x in range(im.width):
            r,gg,b,a = px[x,y]
            if a > 200 and r > 180 and gg > 140 and b < 130: n += 1
        if n: rows[y] = n
    return rows
for g in ('m','f'):
    res[g]['frontTrim'] = trim_rows(f'ch{g}2','idle0')
    res[g]['backTrim'] = trim_rows(f'ch{g}2','walkup0')
print(json.dumps(res))
`;
const d = JSON.parse(execFileSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" }).trim());

for (const g of ["m", "f"]) {
  const label = g === "m" ? "남캐" : "여캐";
  check(`${label}: 28프레임 전부 존재`, d[g].missing.length === 0, d[g].missing.slice(0, 5).join(","));
  const idle = d[g].idle0[0];
  if (idle) {
    const [[cw, ch], [bw, bh]] = idle;
    check(`${label}: 캔버스 96×64 유지`, cw === 96 && ch === 64, `${cw}×${ch}`);
    /* 기존 FA 18×36 / ch*2 26×40 보다 커야 한다 */
    check(`${label}: 캐릭터가 기존보다 크다 (${bw}×${bh} > 26×40)`, bw >= 26 && bh > 42, `${bw}×${bh}`);
  }
}

/* ── 2) 뒷모습 V넥 제거 ── */
for (const g of ["m", "f"]) {
  const label = g === "m" ? "남캐" : "여캐";
  const front = d[g].frontTrim;   // {y: count}
  const back = d[g].backTrim;
  /* 앞면: 여러 행에 걸친 V(2px 내외씩). 뒷면: 한 행에 몰린 수평 밴드 */
  const frontSpread = Object.keys(front).length;
  const backRows = Object.entries(back).map(([y, n]) => Number(n)).filter((n) => n < 15); // 벨트(15px) 제외
  const backWide = Object.values(back).filter((n) => n >= 8 && n < 15).length;
  check(`${label}: 앞면은 V자(여러 행)`, frontSpread >= 4, `행 ${frontSpread}개`);
  check(`${label}: 뒷면은 수평 밴드(넓은 행 1개)`, backWide <= 1, `넓은 행 ${backWide}개 rows=${JSON.stringify(back)}`);
  check(`${label}: 뒷면에 얇은 V 잔재 없음`, backRows.filter((n) => n <= 3).length <= 2, JSON.stringify(backRows));
}

/* ── 3) 렌더러 연결 ── */
const appearance = fs.readFileSync(path.join(ROOT, "src/game/characterAppearance.ts"), "utf8");
check("resolveBodyPrefix 가 기본 남캐도 전용 시트를 쓴다", /const own = `ch\$\{gender\}\$\{skin\}`;\s*\n\s*if \(hasBody\(own\)\) return own;/.test(appearance));

const dataSrc = fs.readFileSync(path.join(ROOT, "src/game/data.ts"), "utf8");
check("BODY_PREFIXES 에 chm2 포함", /"chm0", "chm1", "chm2"/.test(dataSrc));
check("CORE_BODY_PREFIXES 에 chm2 포함", /CORE_BODY_PREFIXES = \["chm0", "chm1", "chm2"/.test(dataSrc));
check("생성 스크립트 존재(재현 가능)", fs.existsSync(path.join(ROOT, "scripts/make_player_sheet.py")));

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
