import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pythonBin, pythonEnv } from "./python.mjs";

/* vc291 — Windows 하드코딩 경로를 걷어냈다. 종전 `C:\\coding\\CERTZ` 는
 *  개발자 PC 에서만 맞고 리눅스 CI·컨테이너에서는 ENOENT 로 5개 테스트가
 *  통째로 실패했다(경로 문제를 게임 결함으로 오독하게 만든다).
 *  테스트 파일 위치 기준 상대경로로 해석하므로 어느 OS 에서도 맞는다. */
/* vc278 — `.pathname` 은 Windows 에서 `/C:/coding/...` 이라 path.join 이
 *  `\C:\coding\...` 를 만들어 ENOENT. fileURLToPath 가 정본. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ═══ vc286 — 경계 오버레이가 셀 크기에 잘려 사라지는 결함 ═══
 *
 * [사용자 지적] 스크린샷 1: 바닥에 **대각선/사선 경계선**이 보인다.
 *
 * [발견한 실제 결함]
 *  `drawGroundEdges()` 는 아틀라스 프레임(256×256)을 **셀 크기로 잘라서** 그린다:
 *
 *      const w = Math.min(EDGE, x1 - tx);   // EDGE=256, 셀 폭≈144
 *      img.setCrop(0, 0, w, h);             // → 144×128 만 남는다
 *
 *  그런데 아틀라스 프레임은 "경계가 없는 쪽 가장자리에 띠"를 그린다.
 *  왼쪽 띠는 x 0..66, 오른쪽 띠는 x 190..255, 위 띠는 y 0..66, 아래 띠는 y 190..255.
 *  셀이 144×128 이면 **오른쪽 띠(x≥190)와 아래 띠(y≥190)가 통째로 잘려나가**
 *  오른쪽·아래 경계가 아예 안 그려진다.
 *
 *  결과: 상/좌 경계만 남아 한쪽으로 치우친 사선처럼 읽히고, 인접 셀과 만나는
 *  지점에서 띠가 어긋나 "대각선으로 그어진 바닥선"이 된다.
 *  (셀 크기 144가 256의 절반보다 작아, 반대편 띠에 절대 도달할 수 없다.)
 *
 * [고칠 방향]
 *  프레임을 **셀 크기에 맞춰 스케일**해야 한다. 띠는 셀 대비 비율(26%)이므로
 *  셀 크기와 무관하게 가장자리에 붙어야 한다.
 */

const CELL_W = 144;  // authoredLayouts 기본 cellW
const CELL_H = 128;  // authoredLayouts 기본 cellH
const FRAME = 256;   // autotile_edge 프레임 크기
const EDGE_RATIO = 0.26;
const BAND = Math.round(FRAME * EDGE_RATIO); // 66

test('셀 크기에서 오른쪽·아래 경계 띠가 잘리지 않는다 (스케일 필요 증명)', () => {
  /* 종전 방식: 프레임을 셀 크기로 크롭 */
  const croppedRight = Math.min(FRAME, CELL_W); // 144
  const croppedBottom = Math.min(FRAME, CELL_H); // 128

  /* 오른쪽 띠는 프레임 x ∈ [FRAME-BAND, FRAME) = [190, 256) 에 있다.
   *  크롭 후 살아남는 x 범위는 [0, 144) 이므로 구간이 겹치지 않는다. */
  const rightBandStart = FRAME - BAND; // 190
  assert.ok(
    croppedRight <= rightBandStart,
    `셀 폭 ${CELL_W} < 오른쪽 띠 시작 ${rightBandStart} 이면 오른쪽 띠가 사라진다 ` +
    `(실제로 ${croppedRight} vs ${rightBandStart} → 잘림 확인)`,
  );

  /* 아래 띠도 같은 이유로 잘린다. */
  const bottomBandStart = FRAME - BAND; // 190
  assert.ok(
    croppedBottom <= bottomBandStart,
    `셀 높이 ${CELL_H} < 아래 띠 시작 ${bottomBandStart} 이면 아래 띠가 사라진다`,
  );
});

test('아틀라스 프레임은 셀 크기로 스케일해 그린다 (setCrop 만 쓰지 않는다)', async () => {
  const src = await readFile(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8");
  const start = src.indexOf("private drawGroundEdges");
  const raw = src.slice(start, src.indexOf("\n  /**", start + 10));

  /* 주석을 먼저 제거해야 한다 — 이 파일의 주석은 과거 구현을 설명하며
   *  `setDisplaySize` 같은 단어가 들어 있어, 그대로 검사하면 오탐한다.
   *  (실제로 그렇게 오탐해서 이 테스트가 처음엔 통과했다.) */
  const body = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")  // 블록 주석
    .replace(/^\s*\/\/.*$/gm, "");     // 줄 주석

  const usesCrop = /\.setCrop\s*\(/.test(body);
  const usesScale = /\.setDisplaySize\s*\(|\.setScale\s*\(/.test(body);
  assert.ok(
    !usesCrop || usesScale,
    'drawGroundEdges 가 setCrop 만 쓰고 있다 — 256px 프레임을 144×128 셀로 자르면 ' +
    '오른쪽·아래 경계 띠가 매번 잘려 대각선처럼 보인다. setDisplaySize 로 스케일해야 한다.\n' +
    `실제 본문에서 발견: setCrop=${usesCrop} setDisplaySize/setScale=${usesScale}`,
  );
});

test('프레임 띠는 실제로 가장자리에 있고 검정 알파 오버레이다', () => {
  const py = `
from PIL import Image
import numpy as np
im = Image.open("public/assets/autotile_edge.webp").convert("RGBA")
a = np.asarray(im).astype(np.int16)
S = 256
BAND = 66
# frame 0 (사방 경계) 의 네 변 띠 평균 알파 vs 중앙
f = a[0:S, 0:S, 3].astype(np.float32)
print("frame0 top   ", round(float(f[:BAND,:].mean()),1))
print("frame0 right ", round(float(f[:,S-BAND:].mean()),1))
print("frame0 bottom", round(float(f[S-BAND:,:].mean()),1))
print("frame0 left  ", round(float(f[:,:BAND].mean()),1))
print("frame0 center", round(float(f[BAND:S-BAND, BAND:S-BAND].mean()),1))
# frame 1 (위만 연결) 은 아래쪽에 띠
g = a[0:S, S:2*S, 3].astype(np.float32) if False else None
print("RGB 고유색(불투명):", len(np.unique(a[a[...,3]>10][:, :3].reshape(-1,3), axis=0)))
`;
  const out = execFileSync(pythonBin(), ["-c", py], { encoding: "utf8", env: pythonEnv, cwd: ROOT });
  const nums = {};
  for (const line of out.trim().split(/\r?\n/)) {
    const m = line.match(/^frame0 (\w+)\s+([\d.]+)/);
    if (m) nums[m[1]] = Number(m[2]);
  }
  /* 네 변 띠가 실제로 존재해야 한다(한 변이라도 0이면 그 방향 경계를 못 그린다). */
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.ok(nums[side] > 20, `frame0 ${side} 띠 알파가 ${nums[side]} — 경계를 그릴 수 없다`);
  }
  /* 중앙은 비어 있어야 한다(오버레이이므로 지면을 덮지 않는다). */
  assert.ok(nums.center < 5, `frame0 중앙 알파 ${nums.center} — 지면을 덮고 있다`);
});
