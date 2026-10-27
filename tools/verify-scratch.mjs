/**
 * vc195 — getAllTargetsIn 공유 스크래치 버퍼 시맨틱 **정밀** 검증
 *
 * 앞선 하네스는 정적 배열로 테스트해 "재호출해도 같은 내용으로 다시 채워진다"는
 * 사실을 놓쳤다. 실제 위험은 **순회 중 배열이 변하는 경우**다:
 *
 *   (a) 순회 중 대상이 죽어 active=false 가 되면 → 재호출 결과에서 빠진다
 *   (b) 순회 중 new Enemy 가 스폰되면 → 재호출 결과에 추가된다
 *
 * (a) 는 for...of 가 내부적으로 index 를 증가시키며 같은 배열을 읽으므로
 * **원소가 줄면 뒤 원소를 건너뛴다**(skip) — 실제 피해 누락 버그다.
 * 이 하네스는 두 시나리오를 결정론적으로 재현해 수정 전/후를 비교한다.
 */

class FakePlayer {
  constructor() {
    this.x = 0; this.y = 0;
    this.targetScratch = [];
    this.targets = [];
  }
  /* Player.ts L3177 실제 구현과 동일 */
  getAllTargetsIn(radius) {
    const out = this.targetScratch;
    out.length = 0;
    const cx = this.x, cy = this.y, r2 = radius * radius;
    for (const e of this.targets) {
      if (!e.active) continue;
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= r2) out.push(e);
    }
    return out;
  }
}

function makeEnemies(n, { killOnHit = false, spawnOnHit = false } = {}) {
  const list = Array.from({ length: n }, (_, i) => ({
    active: true, hp: 1e6, x: 10 + i * 5, y: 10, id: i, hit: 0,
  }));
  for (const e of list) {
    e.takeDamage = function () {
      this.hit++;
      if (killOnHit) this.active = false;                       // (a) 순회 중 사망
      if (spawnOnHit && this.hit === 1) {
        const extra = { active: true, hp: 1e6, x: 12, y: 10, id: 99, hit: 0, takeDamage() { this.hit++; } };
        this.__list.push(extra);                                 // (b) 순회 중 스폰
      }
    };
  }
  return list;
}

/* ── 수정 전 (원본): for...of(this.getAllTargetsIn(620)) ─────── */
function oldLoop(P, reenact) {
  for (const e of P.getAllTargetsIn(620)) {
    const share = Math.max(1, Math.round(reenact / Math.max(1, P.getAllTargetsIn(620).length)));
    e.takeDamage(share);
  }
}

/* ── 수정 후 (vc195): 루프 밖 스냅샷 + 대상 수 1회 계산 ──────── */
function newLoop(P, reenact) {
  const reproTargets = P.getAllTargetsIn(620).slice();
  const share = Math.max(1, Math.round(reenact / Math.max(1, reproTargets.length)));
  for (const e of reproTargets) {
    e.takeDamage(share);
  }
}

function run(loopFn, opts) {
  const P = new FakePlayer();
  const enemies = makeEnemies(6, opts);
  P.targets = enemies;
  enemies.forEach((e) => { e.__list = enemies; });
  loopFn(P, 6000);
  const hit = enemies.map((e) => e.hit).reduce((a, b) => a + b, 0);
  return { spawned: enemies.length, totalHits: hit, perEnemy: enemies.map((e) => e.hit) };
}

const cases = [
  ["순회 중 적 사망 (killOnHit)", { killOnHit: true }],
  ["순회 중 적 스폰 (spawnOnHit)", { spawnOnHit: true }],
  ["변화 없음 (대조군)", {}],
];

let failed = 0;
for (const [name, opts] of cases) {
  const before = run(oldLoop, opts);
  const after = run(newLoop, opts);
  const same = before.totalHits === after.totalHits && before.spawned === after.spawned;
  if (!same) failed++;
  console.log(JSON.stringify({ case: name, before, after, differs: !same }));
}

console.log(failed > 0
  ? `\n재현 확인 — ${failed}개 시나리오에서 수정 전/후가 다르게 동작한다(수정이 실제 동작을 바꾼다).`
  : "\n모든 시나리오에서 수정 전/후 동일 — 이 변경은 방어적이지만 실제 동작 차이는 없다.");
