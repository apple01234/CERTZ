/** Pure hazard geometry: every attack snapshots the target before its warning. */
export const STORY_ATTACKS = ["tentacleslam", "inkflood", "shadowcopies", "cursefield", "bloodseal", "corruption", "rosecore", "jadeclones", "ringpush"] as const;
export type StoryAttack = typeof STORY_ATTACKS[number];
export type Hazard = { x: number; y: number; w: number; h: number; radius?: number };
export type StoryPattern = { title: string; color: number; hazards: Hazard[]; duration: number; clones?: string; safe?: Hazard };
export function storyPattern(kind: StoryAttack, boss: { x: number; y: number; phase: number; key: string }, target: { x: number; y: number }): StoryPattern {
  const circle = (x: number, y: number, radius: number): Hazard => ({ x, y, w: radius * 2, h: radius * 2, radius });
  const rect = (x: number, y: number, w: number, h: number): Hazard => ({ x, y, w, h });
  const count = boss.phase > 1 ? 3 : 2;
  switch (kind) {
    case "tentacleslam": return { title: "촉수 강타 · 틈으로 이동", color: 0x49aabb, duration: 380,
      hazards: [-160, 0, 160].map((dx) => rect(target.x + dx, target.y, 72, 360)) };
    case "inkflood": return { title: "먹물 범람 · 마른 바닥으로", color: 0x62437e, duration: 3600,
      hazards: [-1, 1].map((n) => circle(target.x + n * 145, target.y, 105)), safe: rect(target.x, target.y, 60, 260) };
    case "shadowcopies": return { title: "그림자 분신 · 검격 예고", color: 0x86629f, duration: 400,
      clones: boss.key === "dio" ? "dio" : boss.key === "desknis" || boss.key === "nagr" || boss.key === "nidhog" ? "desknis" : "feron",
      hazards: Array.from({ length: count }, (_, i) => rect(target.x + (i - (count - 1) / 2) * 150, target.y, 66, 260)) };
    case "cursefield": return { title: boss.key === "reversecore" || boss.key === "vord" || boss.key === "guardian" ? "독가스 배출 · 환기 구간으로" : "저주와 흑마법 · 표식 밖으로", color: 0x9e6dbe, duration: 3000,
      hazards: [circle(target.x, target.y, 100), circle(target.x + 220, target.y - 90, 75)] };
    case "bloodseal": return { title: "피의 영역 · 흡혈 표식 회피", color: 0xd93f65, duration: 2800,
      hazards: [circle(target.x, target.y, 88), circle(boss.x - 155, boss.y, 70), circle(boss.x + 155, boss.y, 70)] };
    case "corruption": return { title: "잠식 · 밝은 틈으로 이동", color: 0x71479c, duration: 3300,
      hazards: [-1, 1].map((n) => rect(target.x + n * 155, target.y, 210, 400)), safe: rect(target.x, target.y, 80, 400) };
    case "rosecore": return { title: "장미의 동력 · 노출된 핵 공격", color: 0xe36eaa, duration: 700,
      hazards: [0, 1, 2, 3].map((n) => circle(boss.x + Math.cos(n * Math.PI / 2) * 165, boss.y + Math.sin(n * Math.PI / 2) * 165, 62)), safe: circle(boss.x, boss.y, 80) };
    case "jadeclones": return { title: "에너지 분신 · 빔 사이로", color: 0x64dcd3, duration: 550, clones: "jade",
      hazards: [-1, 1].map((n) => rect(target.x + n * 140, target.y, 64, 360)), safe: rect(target.x, target.y, 100, 360) };
    case "ringpush": return { title: "밀어내기 · 측면으로 회피", color: 0xf0bb75, duration: 300,
      hazards: [rect(target.x, target.y, 105, 210)] };
  }
}
export function hazardContains(h: Hazard, p: { x: number; y: number }): boolean {
  return h.radius !== undefined ? (h.x - p.x) ** 2 + (h.y - p.y) ** 2 <= h.radius ** 2
    : Math.abs(h.x - p.x) <= h.w / 2 && Math.abs(h.y - p.y) <= h.h / 2;
}
