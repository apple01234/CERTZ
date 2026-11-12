import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const frames = JSON.parse(fs.readFileSync(path.join(root, "src/game/appearanceFrames.json"), "utf8"));
const pixels = async src => sharp(path.join(root, "public", src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function bounds(data, width, height, top = 0, bottom = height) {
  let left = width, right = 0, first = height, last = 0, count = 0;
  for (let y = top; y < bottom; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x + 1);
    first = Math.min(first, y); last = Math.max(last, y + 1); count++;
  }
  return { left, right, first, last, count };
}

test("default skins retain transparent original animation frames and consistent DOM sizing", async () => {
  for (const gender of ["m", "f"]) {
    for (const pose of ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]) {
      for (let i = 0; i < 4; i++) {
        const src = `/assets/ch${gender}2_${pose}${i}`;
        const webp = await pixels(`${src}.webp`), png = await pixels(`${src}.png`);
        assert.deepEqual(webp.data, png.data, `${src}: PNG/WebP pixels must match`);
        const box = bounds(webp.data, webp.info.width, webp.info.height);
        /* 2026-11-12 — 유저 지시로 기본 피부(2번)를 다른 피부와 같은 치비 그림으로 되돌렸다.
         * 치비는 몸이 작고 꽉 차서 "자기 경계 상자 점유율"로는 불투명 배경판과 구별되지 않는다.
         * 배경판(58×56 ≈ 캔버스의 53%)은 캔버스 전체 대비 점유율로 잡는다. */
        const occupancy = box.count / (webp.info.width * webp.info.height);
        assert.ok(occupancy < 0.3, `${src}: opaque rectangular matte returned`);
      }
    }
    const front = await pixels(`/assets/ch${gender}2_idle0.webp`);
    const back = await pixels(`/assets/ch${gender}2_walkup0.webp`);
    assert.notDeepEqual(front.data, back.data, "up-facing pose must have an actual back view");
    for (let skin = 0; skin < 6; skin++) {
      const src = `/assets/ch${gender}${skin}_idle0.webp`;
      const image = await pixels(src), box = bounds(image.data, image.info.width, image.info.height);
      assert.deepEqual(frames[src].crop, { x: box.left, y: box.first, w: box.right - box.left, h: box.last - box.first });
    }
  }
});

test("every cast portrait crops the complete head from its unchanged atlas at the visual center", async () => {
  for (const [key, frame] of Object.entries(frames)) {
    if (!key.includes("cutscene-cast/portraits/")) continue;
    // Only the first 96px-wide cell belongs to this character's down-facing idle.
    const first = await sharp(path.join(root, "public", frame.src)).extract({ left: 0, top: 0, width: 96, height: 96 }).ensureAlpha().raw().toBuffer();
    const cell = bounds(first, 96, 96);
    const head = bounds(first, 96, 96, cell.first, cell.first + Math.round((cell.last - cell.first) * 0.58));
    const crop = frame.crop;
    assert.equal(crop.w, crop.h, key);
    assert.ok(Math.abs((head.left + head.right) / 2 - (crop.x + crop.w / 2)) <= 0.5, `${key}: head center drift`);
    assert.ok(crop.x <= head.left && crop.x + crop.w >= head.right, `${key}: head clipped`);
  }
});
