import Phaser from "phaser";

/**
 * 외부 리소스 0 — 전부 캔버스로 즉석 픽셀아트 생성
 * 결정적 랜덤(LCG)을 써서 매 실행 동일한 텍스처가 나오도록 한다.
 */
type Ctx = CanvasRenderingContext2D;

let seed = 1337;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx);
  tex.refresh();
}

function p(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function speckle(c: Ctx, w: number, h: number, colors: string[], size = 3, count = 26) {
  for (let i = 0; i < count; i++) {
    p(c, Math.floor(rnd() * w), Math.floor(rnd() * h), size, size, colors[Math.floor(rnd() * colors.length)]);
  }
}

/* ================= 타일 ================= */

function tileGrass(c: Ctx) {
  p(c, 0, 0, 64, 64, "#4d9e3a");
  speckle(c, 64, 64, ["#57ad42", "#439032", "#63bd4e", "#3c8a2e"], 3, 30);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rnd() * 60);
    const y = Math.floor(rnd() * 60);
    p(c, x, y + 2, 1, 3, "#2f7524");
    p(c, x + 2, y + 1, 1, 3, "#2f7524");
  }
}

function tileDark(c: Ctx) {
  p(c, 0, 0, 64, 64, "#3a2f63");
  speckle(c, 64, 64, ["#443876", "#2f2452", "#4e4187", "#291f47"], 3, 30);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rnd() * 58);
    const y = Math.floor(rnd() * 58);
    p(c, x, y, 4, 2, "#5b4da0");
    p(c, x + 1, y - 2, 2, 2, "#7366bd");
  }
}

function tilePath(c: Ctx) {
  p(c, 0, 0, 64, 64, "#a8895a");
  speckle(c, 64, 64, ["#b89a68", "#93774c", "#c2a575", "#86693f"], 3, 34);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * 54);
    const y = Math.floor(rnd() * 54);
    p(c, x, y, 6, 4, "#8f7448");
    p(c, x + 1, y + 1, 3, 2, "#9c8054");
  }
}

/* ================= 지형 소품 ================= */

function makeTree(c: Ctx) {
  // 56×88, 뿌리 기준 (28, 84)
  p(c, 24, 52, 10, 32, "#6b4a2b");
  p(c, 26, 52, 3, 32, "#7d5833");
  // 캐노피 3단
  p(c, 12, 26, 34, 26, "#2f7524");
  p(c, 18, 12, 22, 18, "#378528");
  p(c, 24, 4, 12, 12, "#3f9630");
  p(c, 16, 30, 8, 6, "#4aa33a");
  p(c, 34, 20, 8, 6, "#4aa33a");
  p(c, 26, 8, 6, 4, "#56b447");
}

function makeRock(c: Ctx) {
  p(c, 4, 10, 28, 14, "#8a8f98");
  p(c, 8, 6, 18, 8, "#9aa0ab");
  p(c, 6, 20, 24, 4, "#6c7078");
  p(c, 12, 8, 6, 4, "#b3b8c2");
}

function makeFlower(c: Ctx, petal: string) {
  // 10×12, 줄기
  p(c, 4, 6, 2, 6, "#2f7524");
  p(c, 6, 8, 2, 2, "#2f7524");
  p(c, 3, 2, 4, 4, petal);
  p(c, 4, 1, 2, 6, petal);
  p(c, 2, 3, 6, 2, petal);
  p(c, 4, 3, 2, 2, "#ffd76a");
}

/* ================= 주인공 ================= */

// 26×32 기본, 공격 프레임은 34×32. facing right.
function heroBody(c: Ctx, ox: number, oy: number, legs: "idle" | "walkA" | "walkB" | "walkC", lean = 0) {
  const x = (v: number) => v + ox + lean;
  // 머리카락
  p(c, x(8), oy + 2, 10, 5, "#3d2b1f");
  p(c, x(7), oy + 4, 1, 4, "#3d2b1f");
  p(c, x(18), oy + 4, 1, 4, "#3d2b1f");
  // 얼굴
  p(c, x(9), oy + 7, 8, 5, "#f0c8a0");
  p(c, x(14), oy + 8, 2, 2, "#22262e"); // 눈(오른쪽 향함)
  // 몸통(튜닉)
  p(c, x(8), oy + 12, 10, 8, "#3f7d2e");
  p(c, x(8), oy + 18, 10, 2, "#6b4a2b"); // 벨트
  p(c, x(11), oy + 12, 4, 6, "#4a8f38"); // 밝은 패널
  // 팔
  p(c, x(6), oy + 13, 2, 5, "#f0c8a0");
  p(c, x(18), oy + 13, 2, 5, "#f0c8a0");
  // 다리
  if (legs === "idle") {
    p(c, x(9), oy + 20, 3, 7, "#4a5a8a");
    p(c, x(14), oy + 20, 3, 7, "#4a5a8a");
    p(c, x(9), oy + 27, 3, 2, "#6b4a2b");
    p(c, x(14), oy + 27, 3, 2, "#6b4a2b");
  } else if (legs === "walkA") {
    p(c, x(7), oy + 20, 3, 7, "#4a5a8a"); // 앞다리
    p(c, x(16), oy + 20, 3, 6, "#4a5a8a"); // 뒷다리
    p(c, x(7), oy + 27, 3, 2, "#6b4a2b");
    p(c, x(16), oy + 26, 3, 2, "#6b4a2b");
  } else if (legs === "walkB") {
    p(c, x(10), oy + 20, 3, 7, "#4a5a8a");
    p(c, x(13), oy + 20, 3, 7, "#4a5a8a");
    p(c, x(10), oy + 27, 3, 2, "#6b4a2b");
    p(c, x(13), oy + 27, 3, 2, "#6b4a2b");
  } else {
    p(c, x(16), oy + 20, 3, 7, "#4a5a8a");
    p(c, x(7), oy + 20, 3, 6, "#4a5a8a");
    p(c, x(16), oy + 27, 3, 2, "#6b4a2b");
    p(c, x(7), oy + 26, 3, 2, "#6b4a2b");
  }
}

function heroSword(c: Ctx, pose: "back" | "mid" | "down", ox: number, oy: number) {
  const steel = "#d7dce4";
  const edge = "#ffffff";
  const hilt = "#6b4a2b";
  if (pose === "back") {
    // 등 뒤로 뽑은 대기 자세 (왼쪽 위 대각선)
    p(c, ox + 3, oy + 4, 2, 8, steel);
    p(c, ox + 4, oy + 3, 2, 2, edge);
    p(c, ox + 4, oy + 12, 3, 2, hilt);
  } else if (pose === "mid") {
    // 수평 베기 — 오른쪽으로 쭉
    p(c, ox + 20, oy + 14, 12, 2, steel);
    p(c, ox + 20, oy + 13, 12, 1, edge);
    p(c, ox + 18, oy + 12, 2, 5, hilt);
    p(c, ox + 17, oy + 13, 1, 3, "#c9a44a");
  } else {
    // 내려베기 마무리 — 오른쪽 아래 대각선
    p(c, ox + 21, oy + 18, 3, 3, steel);
    p(c, ox + 24, oy + 21, 3, 3, steel);
    p(c, ox + 27, oy + 24, 3, 3, edge);
    p(c, ox + 19, oy + 16, 3, 3, hilt);
  }
}

/* ================= 늑대 / 하수인 ================= */

function wolfFrame(c: Ctx, legs: "idle" | "runA" | "runB" | "runC", tailUp: number) {
  // 40×28 facing right
  const body = "#7a8090";
  const dark = "#565b66";
  // 꼬리
  p(c, 2, 8 - tailUp, 7, 3, dark);
  p(c, 3, 6 - tailUp, 4, 3, body);
  // 몸통
  p(c, 8, 11, 22, 9, body);
  p(c, 8, 9, 20, 3, dark);
  p(c, 10, 17, 18, 3, "#6a707e");
  // 머리
  p(c, 27, 6, 10, 10, body);
  p(c, 28, 3, 3, 4, dark); // 귀
  p(c, 27, 10, 4, 3, dark);
  p(c, 35, 10, 5, 4, "#c9ccd4"); // 주둥이
  p(c, 39, 10, 1, 2, "#22262e");
  p(c, 32, 8, 2, 2, "#e84a5a"); // 눈
  // 다리
  const leg = dark;
  if (legs === "idle") {
    p(c, 10, 20, 3, 6, leg); p(c, 14, 20, 3, 6, leg);
    p(c, 23, 20, 3, 6, leg); p(c, 27, 20, 3, 6, leg);
  } else if (legs === "runA") {
    p(c, 7, 20, 3, 5, leg); p(c, 15, 20, 3, 6, leg);
    p(c, 25, 20, 4, 6, leg); p(c, 30, 19, 3, 5, leg);
  } else if (legs === "runB") {
    p(c, 11, 20, 3, 6, leg); p(c, 13, 20, 3, 6, leg);
    p(c, 24, 20, 3, 6, leg); p(c, 27, 20, 3, 6, leg);
  } else {
    p(c, 8, 19, 3, 5, leg); p(c, 16, 20, 3, 6, leg);
    p(c, 22, 20, 4, 6, leg); p(c, 31, 20, 3, 5, leg);
  }
}

function minionFrame(c: Ctx, bob: number, feet: number) {
  // 26×30
  const skin = "#2e4a5f";
  const belly = "#3e6478";
  p(c, 6, 10 + bob, 14, 16, skin);
  p(c, 8, 18 + bob, 10, 7, belly);
  // 뿔
  p(c, 4, 4 + bob, 3, 7, "#d8d4c8");
  p(c, 19, 4 + bob, 3, 7, "#d8d4c8");
  // 눈 (심연 빛)
  p(c, 8, 13 + bob, 3, 3, "#6ae8ff");
  p(c, 15, 13 + bob, 3, 3, "#6ae8ff");
  // 입
  p(c, 11, 20 + bob, 4, 1, "#16232e");
  // 발
  p(c, 7, 26 + feet, 5, 4, "#22374a");
  p(c, 14, 26 - feet, 5, 4, "#22374a");
}

/* ================= 보스 ================= */

function bossFrame(c: Ctx, frame: number) {
  // 72×88
  const armor = "#2d2440";
  const plate = "#3d3458";
  const dark = "#1d1830";
  const glow = frame === 0 ? "#6ae8ff" : "#bdf6ff";
  const bob = frame === 1 ? -1 : 0;
  // 다리
  p(c, 24, 62, 10, 22, dark);
  p(c, 38, 62, 10, 22, dark);
  p(c, 22, 82, 14, 6, dark);
  p(c, 36, 82, 14, 6, dark);
  // 팔
  p(c, 10, 30 + bob, 8, 26, armor);
  p(c, 54, 30 + bob, 8, 26, armor);
  p(c, 8, 54 + bob, 12, 10, plate); // 주먹
  p(c, 52, 54 + bob, 12, 10, plate);
  // 몸통
  p(c, 18, 20 + bob, 36, 44, armor);
  p(c, 20, 26 + bob, 32, 6, plate);
  p(c, 20, 40 + bob, 32, 6, plate);
  p(c, 20, 54 + bob, 32, 6, plate);
  // 어깨
  p(c, 10, 18 + bob, 18, 16, plate);
  p(c, 44, 18 + bob, 18, 16, plate);
  p(c, 14, 12 + bob, 4, 8, "#c9ccd4"); // 어깨 스파이크
  p(c, 52, 12 + bob, 4, 8, "#c9ccd4");
  // 머리
  p(c, 28, 4 + bob, 16, 18, armor);
  p(c, 30, 10 + bob, 12, 5, glow); // 눈 슬릿
  p(c, 22, 0 + bob, 5, 10, "#c9ccd4"); // 뿔
  p(c, 45, 0 + bob, 5, 10, "#c9ccd4");
  // 빛 균열
  p(c, 26, 34 + bob, 2, 8, glow);
  p(c, 40, 30 + bob, 2, 6, glow);
  p(c, 34, 46 + bob, 2, 10, glow);
  p(c, 44, 48 + bob, 2, 6, glow);
}

/* ================= 이펙트 ================= */

function slashArc(c: Ctx) {
  // 80×80 참격 초승달 (오른쪽으로 베는 형태, 게임에서 회전/플립)
  c.save();
  c.translate(8, 40);
  c.lineCap = "round";
  // 외곽 글로우
  c.strokeStyle = "rgba(120, 220, 255, 0.5)";
  c.lineWidth = 14;
  c.beginPath();
  c.arc(0, 0, 32, -1.1, 1.1);
  c.stroke();
  // 본선 흰색
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.lineWidth = 6;
  c.beginPath();
  c.arc(0, 0, 32, -1.0, 1.0);
  c.stroke();
  // 안쪽 옅은 잔상
  c.strokeStyle = "rgba(200, 240, 255, 0.35)";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, 22, -0.7, 0.7);
  c.stroke();
  c.restore();
}

function slashRing(c: Ctx) {
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.lineWidth = 8;
  c.beginPath();
  c.arc(70, 70, 56, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "rgba(120, 220, 255, 0.45)";
  c.lineWidth = 16;
  c.beginPath();
  c.arc(70, 70, 56, 0, Math.PI * 2);
  c.stroke();
}

function beaconTex(c: Ctx) {
  // 48×512 빛 기둥 — 아래가 밝고 위로 퍼짐
  const g = c.createLinearGradient(0, 0, 48, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(210, 245, 255, 1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 48, 512);
  const v = c.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, "rgba(255,255,255,0)");
  v.addColorStop(0.75, "rgba(255,255,255,0.55)");
  v.addColorStop(1, "rgba(255,255,255,0.95)");
  c.globalCompositeOperation = "destination-in";
  c.fillStyle = v;
  c.fillRect(0, 0, 48, 512);
  c.globalCompositeOperation = "source-over";
}

function glowTex(c: Ctx) {
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(180, 240, 255, 0.55)");
  g.addColorStop(1, "rgba(180, 240, 255, 0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
}

function edgeArrow(c: Ctx) {
  // 28×28 오른쪽 향한 쉐브론
  p(c, 6, 4, 6, 4, "#ffd76a");
  p(c, 12, 8, 6, 4, "#ffd76a");
  p(c, 18, 12, 6, 4, "#ffd76a");
  p(c, 12, 16, 6, 4, "#ffd76a");
  p(c, 6, 20, 6, 4, "#ffd76a");
  p(c, 4, 6, 3, 16, "#b8860b");
}

function questMark(c: Ctx) {
  p(c, 3, 0, 6, 3, "#ffd76a");
  p(c, 6, 3, 3, 4, "#ffd76a");
  p(c, 4, 7, 4, 3, "#ffd76a");
  p(c, 4, 10, 4, 3, "#fff3c4");
  p(c, 4, 14, 4, 2, "#ffd76a");
}

function ringTex(c: Ctx) {
  // 128×128 보스 범위 텔레그래프
  c.strokeStyle = "rgba(255, 90, 90, 0.9)";
  c.lineWidth = 4;
  c.beginPath();
  c.arc(64, 64, 58, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "rgba(255, 90, 90, 0.18)";
  c.beginPath();
  c.arc(64, 64, 58, 0, Math.PI * 2);
  c.fill();
}

function orbTex(c: Ctx) {
  const g = c.createRadialGradient(7, 7, 1, 7, 7, 7);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.5, "#6ae8ff");
  g.addColorStop(1, "rgba(40,120,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 14, 14);
}

function sparkTex(c: Ctx) {
  c.fillStyle = "#ffffff";
  c.fillRect(3, 0, 2, 8);
  c.fillRect(0, 3, 8, 2);
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.fillRect(2, 2, 4, 4);
}

function crackTex(c: Ctx) {
  c.strokeStyle = "rgba(30,20,40,0.85)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(40, 20);
  c.lineTo(24, 34);
  c.lineTo(30, 30);
  c.lineTo(12, 26);
  c.moveTo(40, 20);
  c.lineTo(58, 32);
  c.lineTo(52, 27);
  c.lineTo(68, 24);
  c.moveTo(40, 20);
  c.lineTo(36, 38);
  c.stroke();
}

function portalFrame(c: Ctx, f: number) {
  // 56×80 — 바닥 받침 + 소용돌이
  p(c, 12, 70, 32, 8, "#565b66");
  p(c, 16, 66, 24, 6, "#6c7078");
  c.strokeStyle = "#9d7aff";
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(28, 40, 18, 30, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = f === 0 ? "#c9b3ff" : "#7a5cff";
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(28, 40, 10 + f * 3, 20 - f * 4, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = f === 1 ? "rgba(157,122,255,0.5)" : "rgba(157,122,255,0.28)";
  c.beginPath();
  c.ellipse(28, 40, 12, 24, 0, 0, Math.PI * 2);
  c.fill();
}

function fragmentTex(c: Ctx) {
  // 18×22 세계수 파편 (청록 수정)
  p(c, 7, 0, 4, 4, "#d8fbff");
  p(c, 5, 4, 8, 6, "#7ae0f0");
  p(c, 3, 10, 12, 6, "#57c8e8");
  p(c, 5, 16, 8, 4, "#3aa8d0");
  p(c, 7, 20, 4, 2, "#2a88b8");
  p(c, 8, 5, 2, 8, "#ffffff");
}

/* ================= 엔트리 ================= */

export function buildAllTextures(scene: Phaser.Scene) {
  seed = 1337;

  makeTex(scene, "tile_grass", 64, 64, tileGrass);
  makeTex(scene, "tile_dark", 64, 64, tileDark);
  makeTex(scene, "tile_path", 64, 64, tilePath);
  makeTex(scene, "tree", 56, 88, makeTree);
  makeTex(scene, "rock", 36, 26, makeRock);
  makeTex(scene, "flower_r", 10, 12, (c) => makeFlower(c, "#e85a5a"));
  makeTex(scene, "flower_y", 10, 12, (c) => makeFlower(c, "#ffd76a"));
  makeTex(scene, "flower_w", 10, 12, (c) => makeFlower(c, "#f5f5f5"));
  makeTex(scene, "shadow", 28, 12, (c) => {
    c.fillStyle = "rgba(0,0,0,0.28)";
    c.beginPath();
    c.ellipse(14, 6, 13, 5, 0, 0, Math.PI * 2);
    c.fill();
  });

  // 주인공: idle 4 / walk 4 / atk 3
  for (let i = 0; i < 4; i++) {
    const bob = i % 2 === 1 ? -1 : 0;
    makeTex(scene, `hero_idle${i}`, 26, 32, (c) => heroBody(c, 0, 2 + bob, "idle"));
  }
  const legs = ["walkA", "walkB", "walkC", "walkB"] as const;
  for (let i = 0; i < 4; i++) {
    const bob = i % 2 === 1 ? -1 : 0;
    makeTex(scene, `hero_walk${i}`, 26, 32, (c) => heroBody(c, 0, 2 + bob, legs[i]));
  }
  // 공격 3프레임: 34×32 (0 등뒤 준비 / 1 수평 베기 / 2 내려베기)
  makeTex(scene, "hero_atk0", 34, 32, (c) => {
    heroBody(c, 4, 2, "idle", -1);
    heroSword(c, "back", 0, 0);
  });
  makeTex(scene, "hero_atk1", 34, 32, (c) => {
    heroBody(c, 0, 2, "idle", 1);
    heroSword(c, "mid", 0, 0);
  });
  makeTex(scene, "hero_atk2", 34, 32, (c) => {
    heroBody(c, 0, 2, "idle", 2);
    heroSword(c, "down", 0, 0);
  });

  // 늑대
  makeTex(scene, "wolf_idle0", 40, 28, (c) => wolfFrame(c, "idle", 0));
  makeTex(scene, "wolf_idle1", 40, 28, (c) => wolfFrame(c, "idle", 2));
  const wolfLegs = ["runA", "runB", "runC", "runB"] as const;
  for (let i = 0; i < 4; i++) makeTex(scene, `wolf_run${i}`, 40, 28, (c) => wolfFrame(c, wolfLegs[i], 1));

  // 하수인
  makeTex(scene, "minion_idle0", 26, 30, (c) => minionFrame(c, 0, 0));
  makeTex(scene, "minion_idle1", 26, 30, (c) => minionFrame(c, -1, 0));
  const mFeet = [2, 0, -2, 0];
  for (let i = 0; i < 4; i++)
    makeTex(scene, `minion_run${i}`, 26, 30, (c) => minionFrame(c, i % 2 === 1 ? -1 : 0, mFeet[i]));

  // 보스
  makeTex(scene, "boss_idle0", 72, 88, (c) => bossFrame(c, 0));
  makeTex(scene, "boss_idle1", 72, 88, (c) => bossFrame(c, 1));

  // 이펙트/마커
  makeTex(scene, "slash_arc", 80, 80, slashArc);
  makeTex(scene, "slash_ring", 140, 140, slashRing);
  makeTex(scene, "beacon", 48, 512, beaconTex);
  makeTex(scene, "glow", 64, 64, glowTex);
  makeTex(scene, "edge_arrow", 28, 28, edgeArrow);
  makeTex(scene, "quest_mark", 12, 16, questMark);
  makeTex(scene, "ring", 128, 128, ringTex);
  makeTex(scene, "orb", 14, 14, orbTex);
  makeTex(scene, "spark", 8, 8, sparkTex);
  makeTex(scene, "crack", 80, 40, crackTex);
  makeTex(scene, "fragment", 18, 22, fragmentTex);
  for (let f = 0; f < 3; f++) makeTex(scene, `portal${f}`, 56, 80, (c) => portalFrame(c, f));
}

/** 전역 애니메이션 등록 (최초 1회) */
export function buildAllAnims(scene: Phaser.Scene) {
  const a = scene.anims;
  if (a.exists("hero-idle")) return;
  const fr = (prefix: string, n: number, rate: number, repeat: number) => ({
    frames: Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}` })),
    frameRate: rate,
    repeat,
  });
  a.create({ key: "hero-idle", ...fr("hero_idle", 4, 5, -1) });
  a.create({ key: "hero-walk", ...fr("hero_walk", 4, 10, -1) });
  a.create({ key: "hero-atk", ...fr("hero_atk", 3, 14, 0) });
  a.create({ key: "wolf-idle", ...fr("wolf_idle", 2, 3, -1) });
  a.create({ key: "wolf-run", ...fr("wolf_run", 4, 10, -1) });
  a.create({ key: "minion-idle", ...fr("minion_idle", 2, 3, -1) });
  a.create({ key: "minion-run", ...fr("minion_run", 4, 9, -1) });
  a.create({ key: "boss-idle", ...fr("boss_idle", 2, 2, -1) });
  a.create({ key: "portal-spin", ...fr("portal", 3, 6, -1) });
}
