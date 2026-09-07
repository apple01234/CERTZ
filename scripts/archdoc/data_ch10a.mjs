// 모듈 10 (091~095): 보안, 어드민 및 라이브 서비스 — 전반부
// 스택: uWebSockets.js, Kysely, Fastify(어드민 API), OAuth2

export const items = [
  {
    id: "091",
    title: "클라이언트 메모리 변조 및 스피드핵 탐지 검증",
    role: [
      "웹 게임의 클라 메모리는 공개되어 있다 — 디버거로 HP/골드/속도 변수를 직접 고칠 수 있다. 방어 원칙은 '클라 값은 참조용이고 서버가 유일 권위(016번)'지만, 탐지 계층을 두면 어뷰징을 조기에 잡을 수 있다. 스피드핵 탐지는 (1) 클라 자체 시계 이중 검증(performance.now vs Date.now vs rAF 누적), (2) 서버측 이동 속도 검증(016번), (3) 액션 빈도 통계(초당 공격 횟수)의 3중 구조로 수행한다.",
      "클라 셀프 체크는 소프트 계층이다. 중요 변수(전투 상태, 세이브 데이터)에 체크섬을 유지해 변조 시 서버 동기화가 불일치로 드러나게 하고, rAF 간격의 통계적 이상(고정 10ms 간격 반복)을 서버로 보고한다. 최종 판정은 항상 서버가 하며, 클라 탐지 신호는 '참고 데이터'로 취급해 오탐(느린 기기, 스로틀링 브라우저)을 배제한다.",
    ],
    blocks: [
      {
        lang: "server/security/SpeedHackDetector.ts",
        code: `import type uWS from "uWebSockets.js";

export interface MoveSample { at: number; x: number; y: number; }

export class SpeedHackDetector {
  private samples = new Map<number, MoveSample[]>();  // charId → 최근 샘플
  private strikes = new Map<number, number>();

  /** 서버 틱에서 이동 변위 샘플 수집(016번 MoveAuthority와 결합) */
  sample(charId: number, x: number, y: number, now: number) {
    const arr = this.samples.get(charId) ?? [];
    arr.push({ at: now, x, y });
    if (arr.length > 60) arr.shift();               // 최근 60샘플(1초)
    this.samples.set(charId, arr);
  }

  /** 초당 변위 기반 속도 검증 */
  detect(charId: number, maxSpeedPx: number, now: number): boolean {
    const arr = this.samples.get(charId);
    if (!arr || arr.length < 30) return false;      // 표본 부족 → 판정 보류
    const span = (arr[arr.length - 1].at - arr[0].at) / 1000;
    if (span <= 0) return false;
    const dist = Math.hypot(
      arr[arr.length - 1].x - arr[0].x,
      arr[arr.length - 1].y - arr[0].y);
    const speed = dist / span;
    if (speed > maxSpeedPx * 1.6) {                 // 60% 초과 = 의심
      this.addStrike(charId, "speed", speed / maxSpeedPx);
      return true;
    }
    return false;
  }

  /** 액션 빈도 검증(스킬/공격) — 초당 상한 대비 비율 */
  detectActionSpam(charId: number, actions: number[], perSecLimit = 8): boolean {
    if (actions.length < 10) return false;
    // 정규 분포 이상치: 평균 + 4시그마 초과 지속
    const perSec = new Map<number, number>();
    for (const t of actions) {
      const sec = Math.floor(t / 1000);
      perSec.set(sec, (perSec.get(sec) ?? 0) + 1);
    }
    const values = [...perSec.values()];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const peak = Math.max(...values);
    if (peak > avg * 3 && peak > perSecLimit * 2) {
      this.addStrike(charId, "action_spam", peak);
      return true;
    }
    return false;
  }

  addStrike(charId: number, kind: string, severity: number) {
    const n = (this.strikes.get(charId) ?? 0) + 1;
    this.strikes.set(charId, n);
    // 3회 누적 → 어드민 알림(094번) + 자동 CAPTCHA(093번) 트리거
    if (n === 3) this.onSuspect?.(charId, kind, severity);
  }
  onSuspect: ((charId: number, kind: string, severity: number) => void) | null = null;
}

/** 클라 셀프 체크(참고 신호) — 발췌 */
// const CHECK_INTERVAL = 5000;
// let drift = 0;
// setInterval(() => {
//   const pNow = performance.now();
//   const dNow = Date.now();
//   drift += Math.abs((pNow % 1000000) - (dNow % 1000000)) / 1000000;
//   if (drift > 0.5) socket.send(reportSpeedAnomaly());  // 클록 불일치 보고
// }, CHECK_INTERVAL);
// 최종 판정은 서버 — 클라 신호는 참고로만 기록(095번 텔레메트리)`,
      },
    ],
    tips: [
      "속도 판정은 '60% 초과 지속'처럼 여유 마진을 두어야 네트워크 지터/탭 복귀 스파이크를 오탐하지 않는다.",
      "클라 클록 이중 검증(performance.now vs Date.now)은 스피드핵이 훅(hook)한 시계를 걸러내는 저비용 신호다.",
      "탐지는 즉시 밴이 아니라 strike 누적 + CAPTCHA(093번) 순서로 — 오탐 비용(정상 유저 제재)이 탐지 이득보다 크면 안 된다.",
      "모든 탐지 이벤트는 텔레메트리(095번)로 남겨 패턴을 축적해야 2차 자동화 스크립트(회피형)도 잡힌다.",
    ],
  },
  {
    id: "092",
    title: "서버 측 이동 거리 및 타일 충돌 재연산 (벽뚫기 방지)",
    role: [
      "벽뚫기 방지의 핵심은 서버가 클라 좌표를 수신하는 것이 아니라, 클라의 이동 '입력'으로부터 서버가 직접 시뮬레이션(016번 ServerAuthority)한다는 점이다. 이 항목은 그 위에 두 개의 독립 검증을 얹는다. (1) 거리 검증 — 이전 승인 위치에서 한 틱 허용 변위를 초과하면 롤백, (2) 타일 충돌 재연산 — blocked 그리드(041번, 043번 충돌 판정과 동일 그리드)로 새 위치가 벽 위인지 확인해 벽 위 위치는 이전 유효 위치로 되돌린다.",
      "충돌 재연산의 세부는 '축 분리 슬라이딩'이다. X 이동과 Y 이동을 분리해 각각 충돌 검사하면 코너에서 벽에 붙어 끼는 현상 없이 벽면 미끄러짐이 자연스럽고, 클라의 이동 함수(shared/movement.ts, 011번)와 완전히 동일한 결과를 보장한다. 또한 반경(circle) 충돌(캐릭터 반경 12px)을 타일 검사에 곱해 '타일 모서리 꿰뚫기'를 방지한다.",
    ],
    blocks: [
      {
        lang: "server/security/MoveValidator.ts",
        code: `import type { Vec } from "../../shared/hitbox";

export interface MoveCheckResult {
  ok: boolean;
  corrected: Vec;                 // 서버가 최종 인정하는 위치
  reason?: "wall" | "too_far" | "corner";
}

export class MoveValidator {
  private static CHAR_RADIUS = 12;
  private static TILE = 32;

  constructor(private blocked: Uint8Array,
              private mapW: number, private mapH: number,
              private maxTickDist = 16) {}      // 한 틱 최대 변위(속도 140 * 1/60 * 1.5)

  /** 축 분리 이동 + 충돌 재연산(클라 shared/movement.ts와 동일 규칙) */
  simulate(from: Vec, dx: number, dy: number, dtMs: number): MoveCheckResult {
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { ok: true, corrected: from };

    // 1) 변위 상한 검증(거리 핵 방지)
    const move = Math.min(dist, this.maxTickDist) * Math.min(1, dtMs / 16.67);
    const ux = dx / dist, uy = dy / dist;

    // 2) 축 분리(슬라이딩) — X 먼저
    let cur: Vec = { ...from };
    const nx = cur.x + ux * move;
    if (!this.circleBlocked(nx, cur.y)) cur.x = nx;
    const ny = cur.y + uy * move;
    if (!this.circleBlocked(cur.x, ny)) cur.y = ny;

    // 3) 최종 위치가 여전히 벽(코너)이면 이전 위치 유지
    if (this.circleBlocked(cur.x, cur.y)) {
      return { ok: false, corrected: from, reason: "corner" };
    }
    const totalMove = Math.hypot(cur.x - from.x, cur.y - from.y);
    if (totalMove > this.maxTickDist * 1.05) {
      return { ok: false, corrected: from, reason: "too_far" };
    }
    return { ok: true, corrected: cur };
  }

  /** 원 반경 충돌: 캐릭터 반경을 감안한 4코너 검사 */
  private circleBlocked(x: number, y: number): boolean {
    const r = MoveValidator.CHAR_RADIUS;
    const T = MoveValidator.TILE;
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
      [x, y],                                  // 중심(빈 타일 통과 보장)
    ];
    for (const [cx, cy] of corners) {
      const tx = Math.floor(cx / T), ty = Math.floor(cy / T);
      if (tx < 0 || ty < 0 || tx >= this.mapW || ty >= this.mapH) return true;
      if (this.blocked[ty * this.mapW + tx]) return true;
    }
    return false;
  }

  /** 텔레포트/웨이프인 감지: 틱 간 변위가 물리 상한 초과 */
  static isWarp(prev: Vec, next: Vec, maxTickDist: number): boolean {
    return Math.hypot(next.x - prev.x, next.y - prev.y) > maxTickDist * 2;
  }
}`,
      },
    ],
    tips: [
      "충돌 그리드는 클라(TiledLoader 041번)와 완전히 동일한 바이트열을 써야 — 클라/서버 판정 불일치로 '평평한 곳에서 끼임' 클레임이 생긴다.",
      "원 반경 4코너 검사로 '타일 모서리 꿰뚫기'를 막는다 — 중심점만 검사하면 반쪽 위치가 통과된다.",
      "축 분리 슬라이딩은 벽면 미끄러짐 UX와 서버 검증을 동시에 해결하는 표준 기법이다.",
      "거리 검증(maxTickDist)과 타일 검증은 독립적으로 실행해 — 어느 쪽 조작이든 정확한 reason으로 로그가 남는다.",
    ],
  },
  {
    id: "093",
    title: "매크로/봇 패턴 탐지 및 자동 캡차(CAPTCHA) 트리거",
    role: [
      "봇 패턴의 특징은 '너무 완벽한 인간 행동'이다. 반복 주기가 정확히 일정(±5ms), 이동 경로가 매번 동일, 무반응 구간이 없다(24시간 연속 조작), 클릭 좌표가 픽셀 단위 동일 등이다. 탐지는 통계 기반으로 — 이동 방향 시퀀스 엔트로피, 액션 간격의 표준편차, 세션 지속 시간 분포를 윈도우별로 계산해 점수화한다.",
      "트리거 단계는 3단계다. (1) 점수 임계 초과 → 스텔스 챌린지(투명 CAPTCHA — 클라에 응답 요구, 정상 유저는 티 안 나게 배경 클릭 1회), (2) 미응답/반복 실패 → 가시 CAPTCHA(이미지/수학), (3) 반복 회피 → 제재(099번) 대상 기록. 캡차는 게임 중단을 최소화해야 — 대화형 이벤트(간단한 퍼즐)나 마우스 궤적 인간성 검증(자연스러운 커브 여부)을 선호한다.",
    ],
    blocks: [
      {
        lang: "server/security/BotDetector.ts",
        code: `export interface BehaviorWindow {
  moveDirs: number[];                 // 이동 방향(라디안) 시퀀스
  actionGapsMs: number[];             // 액션 간격
  sessionStartAt: number;
  clicks: { x: number; y: number; t: number }[];
}

export class BotDetector {
  /** 행동 인간성 점수(0~1, 낮을수록 봇 의심) */
  score(w: BehaviorWindow): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 1;

    // 1) 이동 방향 엔트로피(인간은 방향이 다양)
    if (w.moveDirs.length > 50) {
      const entropy = dirEntropy(w.moveDirs);
      if (entropy < 0.35) { flags.push("low_move_entropy"); score -= 0.3; }
    }
    // 2) 액션 간격 표준편차(인간은 변동이 크다)
    if (w.actionGapsMs.length > 30) {
      const cv = coefficientOfVariation(w.actionGapsMs);
      if (cv < 0.08) { flags.push("perfect_rhythm"); score -= 0.35; }   // ±8% 미만 = 기계
      const avg = w.actionGapsMs.reduce((s, v) => s + v, 0) / w.actionGapsMs.length;
      if (avg < 250) { flags.push("inhuman_speed"); score -= 0.2; }     // 250ms 미만 연타
    }
    // 3) 클릭 좌표 동일성(픽셀 단위 반복)
    const same = w.clicks.filter(c =>
      w.clicks.some(c2 => c2 !== c && c2.x === c.x && c2.y === c.y)).length;
    if (w.clicks.length > 20 && same / w.clicks.length > 0.8) {
      flags.push("pixel_repeat"); score -= 0.25;
    }
    // 4) 무중단 세션(인간은 휴식이 있다)
    const sessionMin = (Date.now() - w.sessionStartAt) / 60000;
    if (sessionMin > 480) { flags.push("session_8h+"); score -= 0.15; }

    return { score: Math.max(0, Math.min(1, score)), flags };
  }

  /** 점수 → 트리거 단계 결정 */
  triggerOf(score: number): "none" | "stealth_challenge" | "captcha" | "review" {
    if (score >= 0.55) return "none";
    if (score >= 0.35) return "stealth_challenge";
    if (score >= 0.2) return "captcha";
    return "review";                    // 어드민(094번) 수동 검토 큐
  }
}

function dirEntropy(dirs: number[]): number {
  const bins = new Array(8).fill(0);    // 45도씩 8분할
  for (const d of dirs) bins[Math.floor(((d + Math.PI) / (Math.PI * 2)) * 8) % 8]++;
  const total = dirs.length;
  let h = 0;
  for (const b of bins) {
    if (!b) continue;
    const p = b / total;
    h -= p * Math.log2(p);
  }
  return h / 3;                          // log2(8)=3 정규화
}
function coefficientOfVariation(xs: number[]): number {
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance) / mean;
}`,
      },
    ],
    tips: [
      "탐지 신호의 왕은 '액션 간격 표준편차'다 — 인간은 절대 ±8% 이하의 정확한 리듬을 유지할 수 없다.",
      "스텔스 챌린지(투명 CAPTCHA)는 정상 유저에게 보이지 않는 검증으로 — 가시 CAPTCHA는 최후 단계로 남긴다.",
      "8시간 이상 무중단 세션은 강한 신호지만 단독으로 제재하지 않는다 — 커피 마시며 방치한 정상 유저도 있다.",
      "클릭 좌표 픽셀 동일성은 해상도별로 다르게 임계를 잡아야 — 고해상도 모니터와 저해상도 노트북의 클릭 분포가 다르다.",
    ],
  },
  {
    id: "094",
    title: "어드민 웹 대시보드 (유저 조회, 아이템 지급, 공지, 제재 API)",
    role: [
      "어드민 대시보드는 Fastify 기반 REST API + 감사 로그 구조로 만든다. 4계층 권한(viewer / support / admin / root)이 모든 엔드포인트를 게이팅하고, 민감 작업(아이템 지급, 제재)은 반드시 (1) 2인 승인 또는 사유 필수, (2) 감사 로그(admin_audit) 기록, (3) 결과 확인 응답을 거친다. 유저 조회는 검색(이름/ID/IP/디바이스) + 상태(재화/아이템/로그 요약)의 읽기 전용 뷰로 시작해, 제재·지급은 별도 엔드포인트로 분리한다.",
      "보안 요건은 운영망 분리(내부 네트워크/VPN만 접근), JWT 세션 + IP 화이트리스트, 모든 요청의 operator 기록이다. 공지(긴급 점검/이벤트 안내)는 게임 서버로 방송 이벤트를 전달(013번 시스템 채널 재사용)하는 API로 노출하고, 제재(099번)는 즉시 적용 + 사전 안내 정책을 설정으로 선택할 수 있게 한다.",
    ],
    blocks: [
      {
        lang: "server/admin/AdminApi.ts — Fastify 엔드포인트",
        code: `import Fastify from "fastify";
import { Kysely } from "kysely";
type DB = import("../schema").Database;

const ROLE_BITS = { viewer: 1, support: 3, admin: 7, root: 15 };
const PERM = {
  READ_USER: 1, GRANT_ITEM: 2, NOTICE: 2, BAN: 4, AUDIT_VIEW: 4, ROOT_OP: 8,
};

const app = Fastify({ logger: true });
let db: Kysely<DB>;
let gameBus: { broadcastNotice(msg: string): void };

/** 인증/권한 미들웨어 */
app.addHook("preHandler", async (req, reply) => {
  const token = req.headers["x-admin-token"];
  const session = verifyAdminJwt(String(token));       // JWT + IP 화이트리스트 검사
  if (!session) return reply.code(401).send({ error: "unauthorized" });
  (req as any).admin = session;
});

function requirePerm(bit: number) {
  return async (req: any, reply: any) => {
    const role = (req as any).admin.role as keyof typeof ROLE_BITS;
    if ((ROLE_BITS[role] & bit) === 0) return reply.code(403).send({ error: "forbidden" });
  };
}

/** 유저 조회(읽기 전용) */
app.get("/admin/users/:id", { preHandler: requirePerm(PERM.READ_USER) },
  async (req, reply) => {
    const id = Number((req.params as any).id);
    const [user, items, wallet, recent] = await Promise.all([
      db.selectFrom("characters").where("id", "=", id).select().executeTakeFirst(),
      db.selectFrom("character_items").where("character_id", "=", id).limit(20).execute(),
      db.selectFrom("wallets").where(eb => eb.and([
        eb("owner_type", "=", "char"), eb("owner_id", "=", id)])).execute(),
      db.selectFrom("currency_ledger").where("owner_id", "=", id)
        .orderBy("at desc").limit(30).execute(),
    ]);
    if (!user) return reply.code(404).send({ error: "not_found" });
    return { user, items, wallet, recent };
  });

/** 아이템 지급(사유 필수 + 감사 로그) */
app.post("/admin/users/:id/grant", { preHandler: requirePerm(PERM.GRANT_ITEM) },
  async (req, reply) => {
    const id = Number((req.params as any).id);
    const { itemCode, qty, reason } = (req.body as any);
    if (!reason || reason.length < 10)
      return reply.code(400).send({ error: "reason_required_min10chars" });
    const ref = "admin:" + (req as any).admin.id + ":" + Date.now();
    await db.transaction().execute(async tx => {
      await tx.updateTable("character_items")
        .set(eb => ({ qty: eb("qty", "+", qty ?? 1) }))
        .where("character_id", "=", id).where("item_code", "=", itemCode).execute();
      await tx.insertInto("admin_audit").values({
        operator: (req as any).admin.id, action: "grant_item",
        target_id: id, payload: JSON.stringify({ itemCode, qty, reason }),
        ref, at: new Date(),
      }).execute();
    });
    return { ok: true, ref };
  });

/** 공지 방송 */
app.post("/admin/notice", { preHandler: requirePerm(PERM.NOTICE) },
  async (req) => {
    const { message, channel = "system" } = (req.body as any);
    gameBus.broadcastNotice(message);
    await db.insertInto("admin_audit").values({
      operator: (req as any).admin.id, action: "notice",
      target_id: 0, payload: JSON.stringify({ message, channel }), at: new Date(),
    }).execute();
    return { ok: true };
  });

/** 제재(099번 미들웨어와 연결) */
app.post("/admin/users/:id/ban", { preHandler: requirePerm(PERM.BAN) },
  async (req) => {
    const { kind, durationH, reason } = (req.body as any);
    return applyBan(Number((req.params as any).id), kind, durationH, reason,
      (req as any).admin.id, db);
  });

async function applyBan(charId: number, kind: string, durationH: number,
                       reason: string, operator: number, db: Kysely<DB>) {
  const until = durationH > 0 ? new Date(Date.now() + durationH * 3600000) : null;
  await db.insertInto("sanctions").values({
    character_id: charId, kind, until,
    reason, operator, at: new Date(),
  }).execute();
  return { ok: true, until };
}

app.listen({ port: 4000, host: "127.0.0.1" });   // 운영망 내부 바인딩`,
      },
    ],
    tips: [
      "어드민은 감사 로그가 본질이다 — 모든 쓰기 작업에 operator + 사유 + ref가 없으면 내부 사고 추적이 불가능하다.",
      "권한은 비트(role)로 관리해 '지급은 되지만 제재는 안 되는 support' 같은 세분화가 한 줄로 가능하다.",
      "운영망 바인딩(127.0.0.1 + VPN)과 JWT는 필수이며, 2인 승인(root 작업)은 대형 사고의 마지막 안전장치다.",
      "유저 조회 API는 읽기 전용 엔드포인트로 먼저 완성해야 — 제재/지급은 그 위에 얹는다.",
    ],
  },
  {
    id: "095",
    title: "인게임 재화 유동성 및 유저 데이터 로그/텔레메트리 수집",
    role: [
      "텔레메트리는 (1) 이벤트 로그(행동 데이터 — 퀘스트 완료, 결제, 전투), (2) 성능 메트릭(RTT 019번, fps 001번), (3) 경제 지표(085번 흐름)의 3계층을 수집한다. 클라는 배치 큐(5초/50개)로 전송해 네트워크 비용을 낮추고, 서버는 비동기 버퍼 → Kafka/파일 → 집계 파이프라인(일 단위 OLAP)으로 흘려보낸다. 개인정보 규정상 IP/기기 식별자는 해시 처리 + 보관 기간(90일)을 명시한다.",
      "수집 설계 원칙은 '게임 패스를 막지 않는다'다. 전송 실패는 드롭(재시도 없음), 큐 상한 초과는 샘플링(10%만 수집), 중요 이벤트(결제/제재)만 우선 전송이다. 이벤트 스키마는 (name, ts, charId, props JSON)의 단일 구조로 유지해 분석 쿼리가 스키마 진화에 강건하다.",
    ],
    blocks: [
      {
        lang: "src/telemetry/Telemetry.ts — 클라 배치 전송",
        code: `export interface TelemetryEvent {
  name: string;                        // "quest_complete" | "boss_kill" | "fps_sample"
  props?: Record<string, unknown>;
}
export class TelemetryClient {
  private queue: { name: string; ts: number; props: Record<string, unknown> }[] = [];
  private timer = 0;
  private static MAX_QUEUE = 200;
  private static FLUSH_MS = 5000;
  private sampled = Math.random() < 1;   // 샘플링 비율(운영에서 0.1로 조정)

  constructor(private endpoint = "/api/telemetry") {}

  start() {
    this.timer = window.setInterval(() => this.flush(), TelemetryClient.FLUSH_MS);
    window.addEventListener("pagehide", () => this.flush(true));   // 종료 시 마지막 전송
  }
  track(name: string, props?: Record<string, unknown>) {
    if (!this.sampled) return;
    this.queue.push({ name, ts: Date.now(), props: props ?? {} });
    if (this.queue.length > TelemetryClient.MAX_QUEUE) this.queue.shift();  // 오래된 것 드롭
  }

  async flush(sendBeacon = false) {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify({ events: batch });
    if (sendBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    try {
      await fetch(this.endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body, keepalive: true,
      });
    } catch { /* 실패 = 드롭(게임에 영향 없음) */ }
  }
}`,
      },
      {
        lang: "server/telemetry/Ingest.ts — 서버 수집 버퍼",
        code: `import uWS from "uWebSockets.js";
import fs from "node:fs";
import { createGzip } from "node:zlib";

/** JSONL 버퍼 → 분 단위 파일 플러시(간단 파이프라인; Kafka로 치환 가능) */
export class TelemetryIngest {
  private buffer: string[] = [];
  private lastFlush = Date.now();
  private stream = fs.createWriteStream("/var/log/game/tel.jsonl", { flags: "a" });
  private gzip = createGzip();

  /** 클라 배치 수신(uWS POST 핸들러) */
  handleBatch(raw: ArrayBuffer) {
    try {
      const parsed = JSON.parse(Buffer.from(raw).toString());
      if (!Array.isArray(parsed.events)) return;
      for (const e of parsed.events) {
        if (typeof e.name !== "string") continue;
        this.buffer.push(JSON.stringify({
          n: e.name, ts: e.ts,
          // 개인정보: charId는 서버가 재매핑한 pseudo id
          pid: pseudoId(e.charId),
          p: sanitize(e.props ?? {}),
        }));
      }
    } catch { /* malformed = 드롭 */ }
    if (this.buffer.length > 5000 || Date.now() - this.lastFlush > 60000) {
      this.flushFile();
    }
  }

  private flushFile() {
    const chunk = this.buffer.join("\\n") + "\\n";
    this.buffer = [];
    this.lastFlush = Date.now();
    this.stream.write(chunk);
  }
}

function pseudoId(charId: number): string {
  // salt 해시로 재식별 불가(개인정보 최소화)
  return require("node:crypto")
    .createHmac("sha256", process.env.TEL_SALT!)
    .update(String(charId)).digest("hex").slice(0, 16);
}
function sanitize(p: Record<string, unknown>): Record<string, unknown> {
  // 금지 필드 제거(ip, email, 디바이스 ID)
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (/ip|email|device|token/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/** 집계 예시(일 단위): 퀘스트 완료율, 결제 전환율, 재화 유동성(085번 연계) */
// SELECT n, count(*) FROM tel WHERE ts BETWEEN ... GROUP BY n;`,
      },
    ],
    tips: [
      "클라 배치(5초/50개) + sendBeacon(페이지 종료) 조합이 텔레메트리 표준이며, 실패는 절대 재시도하지 않는다.",
      "charId는 서버에서 salt 해시(pseudo id)로 변환해 저장해야 개인정보 규정(보관 최소화)을 통과한다.",
      "샘플링 비율은 유저 수에 반비례해 조정한다 — DAU 10만이면 10% 샘플링으로도 통계가 충분하다.",
      "이벤트 스키마는 name+props 단일 구조로 — 스키마 버전 관리가 아니라 props 내 확장으로 진화시킨다.",
    ],
  },
];
