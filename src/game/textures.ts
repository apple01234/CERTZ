import Phaser from "phaser";

/**
 * 이펙트/마커 전용 절차 텍스처.
 * 캐릭터·몬스터·타일·장식·UI는 public/assets/ 의 실제 픽셀아트 에셋
 * (Zelda-like by ArMM1998 CC0, Kenney CC0, LPC wolf CC-BY, Sotrak CC-BY)을 사용한다.
 * 광원/참격/텔레그래프 같은 런타임 VFX만 여기서 생성한다.
 */
type Ctx = CanvasRenderingContext2D;

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx);
  tex.refresh();
}

/* ================= 이펙트 ================= */

function slashArc(c: Ctx) {
  // 96x96 참격 초승달 (오른쪽으로 베는 형태, 게임에서 회전/플립)
  c.save();
  c.translate(10, 48);
  c.lineCap = "round";
  c.strokeStyle = "rgba(120, 220, 255, 0.5)";
  c.lineWidth = 16;
  c.beginPath();
  c.arc(0, 0, 38, -1.1, 1.1);
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(0, 0, 38, -1.0, 1.0);
  c.stroke();
  c.strokeStyle = "rgba(200, 240, 255, 0.35)";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, 26, -0.7, 0.7);
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
  // 48x512 빛 기둥 — 아래가 밝고 위로 퍼짐
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
  // 28x28 오른쪽 향한 쉐브론
  const gold = "#ffd76a";
  c.fillStyle = gold;
  c.beginPath();
  c.moveTo(6, 4); c.lineTo(12, 4); c.lineTo(18, 12); c.lineTo(12, 20); c.lineTo(6, 20); c.lineTo(12, 12);
  c.closePath();
  c.fill();
  c.fillStyle = "#b8860b";
  c.fillRect(4, 6, 3, 16);
}

function questMark(c: Ctx) {
  const gold = "#ffd76a";
  c.fillStyle = gold;
  c.fillRect(3, 0, 6, 3);
  c.fillRect(6, 3, 3, 4);
  c.fillRect(4, 7, 4, 3);
  c.fillStyle = "#fff3c4";
  c.fillRect(4, 10, 4, 3);
  c.fillStyle = gold;
  c.fillRect(4, 14, 4, 2);
}

function ringTex(c: Ctx) {
  // 128x128 보스 범위 텔레그래프
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
  // 56x80 — 바닥 받침 + 소용돌이
  const p = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  p(12, 70, 32, 8, "#565b66");
  p(16, 66, 24, 6, "#6c7078");
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

/* ================= 엔트리 ================= */

/** 로드된 실제 에셋 위에 필요한 런타임 VFX만 생성 */
export function buildVfxTextures(scene: Phaser.Scene) {
  makeTex(scene, "slash_arc", 96, 96, slashArc);
  makeTex(scene, "slash_ring", 140, 140, slashRing);
  makeTex(scene, "beacon", 48, 512, beaconTex);
  makeTex(scene, "glow", 64, 64, glowTex);
  makeTex(scene, "edge_arrow", 28, 28, edgeArrow);
  makeTex(scene, "quest_mark", 12, 16, questMark);
  makeTex(scene, "ring", 128, 128, ringTex);
  makeTex(scene, "orb", 14, 14, orbTex);
  makeTex(scene, "crack", 80, 40, crackTex);
  makeTex(scene, "shadow", 28, 12, (c) => {
    c.fillStyle = "rgba(0,0,0,0.28)";
    c.beginPath();
    c.ellipse(14, 6, 13, 5, 0, 0, Math.PI * 2);
    c.fill();
  });
  for (let f = 0; f < 3; f++) makeTex(scene, `portal${f}`, 56, 80, (c) => portalFrame(c, f));
}

/** 전역 애니메이션 등록 (최초 1회) — 실제 에셋 시트 프레임 기반 */
export function buildAllAnims(scene: Phaser.Scene) {
  const a = scene.anims;
  if (a.exists("hero-idle")) return;
  const fr = (prefix: string, n: number, rate: number, repeat: number) => ({
    frames: Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}` })),
    frameRate: rate,
    repeat,
  });
  // 주인공 (방향별 실제 스윙 프레임)
  a.create({ key: "hero-idle", ...fr("hero_idle", 4, 4, -1) });
  a.create({ key: "hero-walk", ...fr("hero_walk", 4, 9, -1) }); // 아래
  a.create({ key: "hero-walk-up", ...fr("hero_walkup", 4, 9, -1) });
  a.create({ key: "hero-walk-side", ...fr("hero_walkside", 4, 9, -1) }); // 오른쪽 기준(좌는 flipX)
  a.create({ key: "hero-atk", ...fr("hero_atk", 4, 16, 0) }); // 측면(오른쪽)
  a.create({ key: "hero-atk-down", ...fr("hero_atkdown", 4, 16, 0) });
  a.create({ key: "hero-atk-up", ...fr("hero_atkup", 4, 16, 0) });
  // 몬스터
  a.create({ key: "wolf-idle", ...fr("wolf_idle", 2, 2, -1) });
  a.create({ key: "wolf-run", ...fr("wolf_run", 4, 10, -1) });
  a.create({ key: "minion-idle", ...fr("minion_idle", 2, 3, -1) });
  a.create({ key: "minion-run", ...fr("minion_run", 4, 8, -1) });
  a.create({ key: "boss-idle", ...fr("boss_idle", 2, 2, -1) });
  a.create({ key: "portal-spin", ...fr("portal", 3, 6, -1) });
  // 장식 이펙트
  a.create({ key: "flame-burn", ...fr("flame", 4, 8, -1) });
  a.create({ key: "sparkle", ...fr("sparkle", 2, 3, -1) });
}
