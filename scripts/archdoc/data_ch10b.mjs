// 모듈 10 (096~100): 보안, 어드민 및 라이브 서비스 — 후반부

export const items = [
  {
    id: "096",
    title: "웹 브라우저 무중단 핫픽스(Hot-Fix) 리소스 업데이트",
    role: [
      "웹 게임의 장점은 재접속 없이 코드를 갈아끼울 수 있다는 것이다. 핫픽스 파이프라인은 (1) 빌드 해시가 담긴 manifest.json, (2) 주기적(3분) manifest 폴링, (3) 해시 변경 감지 → 새 청크 프리로드 → 안전 시점(씬 전환/메인 화면)에 교체, (4) 실패 시 롤백의 4단계다. JS 모듈은 동적 import()로 교체하고, 게임 밸런스 데이터(JSON)는 캐시 무효화로 즉시 적용한다.",
      "무중단 핵심은 '안전 시점에만 교체'다. 전투 중 코드 교체는 씬 참조가 깨지므로, 교체 지점을 (씬 전환, 로비 복귀, 리스폰)으로 제한한다. 또한 교체 실패(청크 로드 실패) 시 이전 버전 유지 + 재시도 백오프로 — 실패가 유저 세션을 죽이면 핫픽스가 아니라 사고가 된다. 긴급 서버 코드 수정은 이 파이프라인과 별개로 서버 재시작(100번 롤링)으로 처리한다.",
    ],
    blocks: [
      {
        lang: "src/hotfix/HotfixManager.ts",
        code: `export interface HotfixManifest {
  version: string;                     // "3.0.29-hotfix2"
  builtAt: number;
  chunks: Record<string, string>;      // 모듈명 → 해시 파일 경로
  dataFiles: Record<string, string>;   // JSON 밸런스 → 경로
  minClientVersion: string;            // 하위 호환 하한
}

export class HotfixManager {
  private current: HotfixManifest;
  private pollTimer = 0;
  private pending: HotfixManifest | null = null;

  constructor(private manifestUrl: string,
              private currentVersion: string,
              private hooks: { safePoint(): boolean; applyModule(path: string): Promise<void> }) {}

  start() {
    this.pollTimer = window.setInterval(() => this.poll(), 3 * 60_000);
  }

  /** 1) manifest 폴링 → 해시 변화 감지 */
  private async poll() {
    try {
      const res = await fetch(this.manifestUrl, { cache: "no-store" });
      const m = (await res.json()) as HotfixManifest;
      if (m.version === this.currentVersion) return;
      if (compareVersion(m.minClientVersion, this.currentVersion) > 0) {
        // 하위 호환 하한 초과 → 전체 새로고침 유도(재접속 안내)
        this.promptReload(m);
        return;
      }
      // 2) 새 청크 사전 프리로드(실패해도 현재 세션 유지)
      const ok = await this.preload(m);
      if (ok) this.pending = m;           // 안전 시점까지 대기
    } catch { /* 네트워크 실패 = 다음 폴링 */ }
  }

  private async preload(m: HotfixManifest): Promise<boolean> {
    try {
      for (const path of Object.values(m.chunks)) {
        await import(/* @vite-ignore */ path);   // 브라우저 캐시에 미리 적재
      }
      for (const path of Object.values(m.dataFiles)) {
        await fetch(path, { cache: "reload" });
      }
      return true;
    } catch {
      return false;                    // 실패 → 이전 버전 유지, 다음 폴링 재시도
    }
  }

  /** 3) 안전 시점(씬 전환/로비)에서 호출 */
  tryApplyAtSafePoint(): boolean {
    if (!this.pending || !this.hooks.safePoint()) return false;
    const m = this.pending;
    this.pending = null;
    (async () => {
      try {
        for (const [name, path] of Object.entries(m.chunks)) {
          await this.hooks.applyModule(path);          // 모듈 핫스왑(010번 패턴)
          console.info("[hotfix] applied " + name);
        }
        this.currentVersion = m.version;
        document.dispatchEvent(new CustomEvent("hotfix-applied",
          { detail: { version: m.version } }));
      } catch (e) {
        console.error("[hotfix] apply failed — keep old version", e);
        // 롤백: 상태는 이전 버전 유지(이미 로드된 모듈은 교체 실패 무시)
      }
    })();
    return true;
  }

  private promptReload(m: HotfixManifest) {
    // 메이저 업데이트: 유저 동의 후 새로고침
    document.dispatchEvent(new CustomEvent("update-available",
      { detail: { version: m.version } }));
  }
}
function compareVersion(a: string, b: string): number {
  const pa = a.split(/[.-]/).map(Number), pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}`,
      },
    ],
    tips: [
      "교체 시점은 씬 전환/로비로 제한한다 — 전투 중 모듈 스왑은 씬 참조 붕괴로 즉시 크래시가 난다.",
      "프리로드(캐시 워밍) 후 안전 시점에 실제 교체하면 적용이 밀리초 단위로 끝난다.",
      "적용 실패는 '이전 버전 유지'가 원칙이다 — 반쪽 교체 상태보다 구버전이 훨씬 안전하다.",
      "manifest에 minClientVersion(하위 호환 하한)을 두면 급격한 프로토콜 변경 시 강제 재접속으로 안내할 수 있다.",
    ],
  },
  {
    id: "097",
    title: "다국어(i18n) localization 텍스트 파싱 및 폰트 레이아웃",
    role: [
      "i18n은 (1) 키 기반 텍스트 조회(플레이스홀더 치환), (2) 복수형/성별 규칙(CLDR), (3) RTL(아랍어) 레이아웃 반전, (4) CJK 폰트 폴백 체인의 4요소다. 텍스트는 JSON 리소스(언어별 분리, 지연 로딩 — 004번 번들)로 관리하고, 키는 코드에 하드코딩하지 않는다. 플레이스홀더({name}, {count})는 Intl.MessageFormat 스타일의 단순 치환기로 처리한다.",
      "폰트 레이아웃 핵심은 CJK/라틴 혼합 폭 문제다. 한글+영문 혼합 텍스트는 이상적인 행 래핑이 언어마다 다르므로, UI 컴포넌트는 텍스트 길이가 아니라 실측 너비(ctx.measureText)로 배치해야 한다. 폰트 폴백 체인(맑은 고딕 → Noto Sans KR → sans-serif)을 CSS/캔버스 양쪽에 명시하고, 비트맵 폰트(데미지 텍스트)는 언어별로 별도 생성해야 글자가 네모(□)로 깨지지 않는다.",
    ],
    blocks: [
      {
        lang: "src/i18n/I18n.ts",
        code: `import en from "./locales/en.json";
import ko from "./locales/ko.json";
import ja from "./locales/ja.json";

const BUNDLES: Record<string, Record<string, string>> = { en, ko, ja };
type Lang = "en" | "ko" | "ja";

export class I18n {
  private lang: Lang;
  private listeners = new Set<() => void>();

  constructor(private fallback: Lang = "en") {
    this.lang = (localStorage.getItem("lang") as Lang)
      ?? this.detectFromBrowser();
  }

  /** 브라우저 언어 감지 → 지원 언어 매핑 */
  private detectFromBrowser(): Lang {
    const nav = navigator.language.toLowerCase();      // "ko-KR" → "ko"
    if (nav.startsWith("ko")) return "ko";
    if (nav.startsWith("ja")) return "ja";
    return this.fallback;
  }

  setLang(l: Lang) {
    this.lang = l;
    localStorage.setItem("lang", l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";  // RTL 확장 대비
    this.listeners.forEach(fn => fn());
  }
  get current() { return this.lang; }

  /** 텍스트 조회 + 플레이스홀더 치환: t("quest.complete", {count: 3}) */
  t(key: string, params?: Record<string, string | number>): string {
    let text = BUNDLES[this.lang][key] ?? BUNDLES[this.fallback][key];
    if (!text) return key;                              // 누락 키는 키 자체 표시(디버그)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll("{" + k + "}", String(v));
      }
    }
    return text;
  }

  /** 복수형: Intl.PluralRules(CLRD 규칙) */
  tPlural(key: string, count: number): string {
    const rules = new Intl.PluralRules(this.lang);
    const cat = rules.select(count);                    // one/other/zero...
    return this.t(key + "." + cat, { count });
  }
  onChange(fn: () => void) { this.listeners.add(fn); }
}

// 캔버스 텍스트 폭 실측(Phaser 비트맵/일반 텍스트 레이아웃)
export function measureFit(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number,
): { text: string; lines: string[] } {
  ctx.font = '14px "Malgun Gothic", "Noto Sans KR", sans-serif';
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur); cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return { text: lines.join("\\n"), lines };
}`,
      },
      {
        lang: "locales/ko.json 예시 + 폰트 폴백",
        code: `// ── locales/ko.json ──
// {
//   "quest.complete": "퀘스트 {name} 완료!",
//   "inventory.item_count": "보유 {count}개",
//   "chat.muted": "채팅 금지 상태입니다.",
//   "common.plural.item.one": "아이템 {count}개",
//   "common.plural.item.other": "아이템 {count}개"
// }

// ── 폰트 폴백 체인(CSS + 캔버스 공통) ──
// CSS:  font-family: "Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
// 캔버스: ctx.font = '14px "Malgun Gothic", "Noto Sans KR", sans-serif';
// 비트맵 폰트는 언어별 생성(한글 2350자 기본 + 사용 빈도 상위 확장)

// ── UI 폭 안전 규칙 ──
// 1) 버튼 라벨은 길이 기준(한글 6자 이내) + overflow 시 폰트 축소(scale)
// 2) 데미지 텍스트(비트맵)는 숫자 전용 폰트 — 언어 무관
// 3) RTL(ar) 확장 시 레이아웃 방향만 반전(logical property 사용)`,
      },
    ],
    tips: [
      "누락 키는 키 자체를 표시하면(디버그 모드) 번역 누락을 런타임에 즉시 발견할 수 있다.",
      "CJK/라틴 혼합 텍스트는 실측(measureText) 기반 줄바꿈만 안전하다 — 글자 수 기반은 언어별 폭 차이로 깨진다.",
      "비트맵 폰트(데미지 텍스트)는 언어별 생성이 필수다 — 라틴 전용 비트맵 폰트에 한글을 넣으면 네모가 된다.",
      "RTL 지원은 처음부터 logical property(margin-inline-start 등)로 작성해야 나중에 아랍어 추가가 반나절로 끝난다.",
    ],
  },
  {
    id: "098",
    title: "소셜 로그인(구글, 카카오 등) OAuth2 & 게스트 계정 연동/이전",
    role: [
      "OAuth2 연동은 '인증 코드 → 토큰 교환(서버) → 유저 식별(provider+subject) → 세션 발급'의 서버 권위 흐름이다. 클라는 provider별 SDK/리디렉션으로 인증 코드를 얻고, 서버는 code를 provider 토큰 엔드포인트로 교환해 사용자 정보(id_token/sub)를 확인한다. state 파라미터(CSRF 방지)와 redirect_uri 정확 매칭은 필수다. 여러 프로바이더를 하나의 accounts 테이블(provider, subject)로 정규화해 계정 이중화(같은 유저가 구글+카카오 동시 연동)를 지원한다.",
      "게스트 계정은 디바이스 토큰(localStorage + 서버 발급)으로 운영하며, 소셜 연동 시점에 '게스트 → 소셜' 계정 이전(마이그레이션)을 트랜잭션으로 수행한다. 이전 규칙은 (1) 대상 소셜 계정이 기존 유저면 '병합 요청' 확인 UI, (2) 기존 유저가 없으면 바로 연결, (3) 이미 연동된 계정은 거부의 3분기다. 세션은 JWT(단기) + refresh 토큰(장기, 로테이션)으로 관리한다.",
    ],
    blocks: [
      {
        lang: "server/auth/OAuth2.ts",
        code: `import { Kysely } from "kysely";
import crypto from "node:crypto";
type DB = import("../schema").Database;

export type Provider = "google" | "kakao" | "guest";
export interface OAuthConfig {
  clientId: string; clientSecret: string;
  tokenUrl: string; userInfoUrl: string;
  redirectUri: string;
}
const CONFIGS: Record<"google" | "kakao", OAuthConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    redirectUri: process.env.OAUTH_REDIRECT!,
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID!,
    clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    userInfoUrl: "https://kapi.kakao.com/v2/user/me",
    redirectUri: process.env.OAUTH_REDIRECT!,
  },
};

export class AuthService {
  constructor(private db: Kysely<DB>) {}

  /** 1) 인증 URL 생성(state로 CSRF 방지) */
  authorizeUrl(provider: "google" | "kakao"): { url: string; state: string } {
    const c = CONFIGS[provider];
    const state = crypto.randomBytes(16).toString("hex");
    // state는 임시 저장(TTL 10분) 후 콜백에서 검증
    const params = new URLSearchParams({
      client_id: c.clientId, redirect_uri: c.redirectUri,
      response_type: "code", scope: provider === "google" ? "openid email" : "profile_nickname",
      state,
    });
    return { url: (provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : "https://kauth.kakao.com/oauth/authorize") + "?" + params, state };
  }

  /** 2) 콜백: code → 토큰 → 사용자 식별 → 세션 발급 */
  async callback(provider: "google" | "kakao", code: string, state: string, expectedState: string) {
    if (state !== expectedState) throw new Error("CSRF_STATE_MISMATCH");
    const c = CONFIGS[provider];
    // 토큰 교환(서버 전용 secret — 클라에 노출 금지)
    const tokenRes = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code,
        client_id: c.clientId, client_secret: c.clientSecret,
        redirect_uri: c.redirectUri,
      }),
    });
    const tokens = await tokenRes.json() as { access_token: string; id_token?: string };
    // 사용자 식별
    const infoRes = await fetch(c.userInfoUrl, {
      headers: { Authorization: "Bearer " + tokens.access_token },
    });
    const info = await infoRes.json() as { sub?: string; id?: number };
    const subject = String(info.sub ?? info.id);
    return this.loginWithIdentity(provider, subject);
  }

  /** 3) 정규화 계정 조회/생성 + 게스트 이전 */
  async loginWithIdentity(provider: Provider, subject: string, guestCharId?: number) {
    return this.db.transaction().execute(async tx => {
      let account = await tx.selectFrom("oauth_accounts")
        .where("provider", "=", provider).where("subject", "=", subject)
        .select("character_id").executeTakeFirst();
      if (account && guestCharId && account.character_id !== guestCharId) {
        throw new Error("OAUTH_ALREADY_LINKED");   // 병합 요청 UI로 유도
      }
      let charId = account?.character_id ?? guestCharId ?? 0;
      if (!charId) {
        // 신규 유저 생성
        const created = await tx.insertInto("characters")
          .values({ account_id: 0, name: "user_" + subject.slice(0, 6),
                    class_code: "novice" }).returning("id").executeTakeFirstOrThrow();
        charId = created.id;
      }
      await tx.insertInto("oauth_accounts").values({
        provider, subject, character_id: charId,
      }).onConflict(oc => oc.doNothing()).execute();
      // 게스트 이전이면 디바이스 토큰 무효화(중복 접속 차단)
      if (guestCharId) {
        await tx.updateTable("device_tokens").set({ revoked: true })
          .where("character_id", "=", guestCharId).execute();
      }
      return { charId };
    });
  }
}`,
      },
      {
        lang: "PostgreSQL DDL — 계정 정규화",
        code: `CREATE TABLE oauth_accounts (
  provider      VARCHAR(12) NOT NULL,    -- google | kakao | guest
  subject       VARCHAR(64) NOT NULL,    -- provider 내부 고유 id(sub)
  character_id  BIGINT NOT NULL REFERENCES characters(id),
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE UNIQUE INDEX uq_char_provider ON oauth_accounts(character_id, provider)
  WHERE provider != 'guest';   -- 동일 유저, 동일 provider 중복 연동 방지

CREATE TABLE device_tokens (
  token        VARCHAR(64) PRIMARY KEY,  -- 게스트 디바이스 토큰
  character_id BIGINT NOT NULL REFERENCES characters(id),
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      },
    ],
    tips: [
      "client_secret은 절대 클라에 두지 않는다 — 토큰 교환은 반드시 서버에서 수행한다(코드 교환 흐름, code flow).",
      "state(CSRF) 검증과 redirect_uri 정확 매칭은 OAuth2의 최소 보안선이며, 생략하면 계정 탈취가 가능해진다.",
      "계정 정규화(oauth_accounts)로 '게스트 → 소셜 이전'이 UPDATE 한 줄이 된다 — 유저 데이터를 통째로 옮기는 방식은 절대 금물이다.",
      "게스트 토큰 폐기(revoke)를 이전 트랜잭션에 포함해야 동일 디바이스 토큰으로 두 계정 접속하는 사고가 막힌다.",
    ],
  },
  {
    id: "099",
    title: "계정/IP/디바이스 단위 제재(Ban) 및 채팅 금지(Mute) 미들웨어",
    role: [
      "제재는 대상(계정/디바이스/IP), 종류(접속 차단/채팅 금지/거래 금지), 기간(임시/영구)의 3차원이며, sanctions 테이블의 행으로 표현된다. 적용 지점은 두 곳이다. (1) 연결 수립 시(소켓 핸드셰이크 후 인증 단계) 접속 제재 검사, (2) 채팅/거래 등 액션 단계(094번 어드민과 연결)별 미들웨어 검사. 디바이스/IP 제재는 '새 계정 생성 우회'를 막는 2차 방어선이다.",
      "미들웨어 설계 원칙은 '검사는 캐시, 원본은 DB'다. 제재 목록을 Redis(또는 프로세스 캐시)로 미러링해 소켓 패킷 핫패스에서 O(1) 검사를 수행하고, 제재 부여/해제 시 캐시를 즉시 갱신한다. Mute는 채팅 전용(게임 플레이는 허용)이며, 임시 제재 만료는 TTL로 자동 해제된다. 제재 이력은 유저 단위 조회 API(094번)로 CS에 노출한다.",
    ],
    blocks: [
      {
        lang: "server/security/SanctionGate.ts — 제재 게이트 + 캐시",
        code: `import Redis from "ioredis";
import { Kysely } from "kysely";
type DB = import("../schema").Database;

export type SanctionKind = "ban" | "mute" | "trade_ban";
export interface SanctionRow {
  id: number; character_id: number; kind: SanctionKind;
  until: Date | null; reason: string;
  ip_prefix?: string; device_hash?: string;
}

export class SanctionGate {
  private cache = new Map<string, { kinds: Set<SanctionKind>; until: number | null }>();

  constructor(private redis: Redis, private db: Kysely<DB>) {}

  /** 제재 부여(094번 어드민 API에서 호출) — DB + 캐시 동시 갱신 */
  async apply(s: Omit<SanctionRow, "id">) {
    await this.db.insertInto("sanctions").values({
      character_id: s.character_id, kind: s.kind,
      until: s.until, reason: s.reason,
      ip_prefix: s.ip_prefix ?? null, device_hash: s.device_hash ?? null,
    }).execute();
    const key = "sanc:" + s.character_id;
    const ttl = s.until ? Math.max(1, Math.floor((s.until.getTime() - Date.now()) / 1000)) : 86400;
    await this.redis.sadd(key, s.kind);
    await this.redis.expire(key, ttl);
    this.cache.set(key, { kinds: new Set([s.kind]), until: s.until?.getTime() ?? null });
  }

  /** 연결/액션 게이트(핫패스 O(1)) */
  check(charId: number, need: SanctionKind): boolean {
    const c = this.cache.get("sanc:" + charId);
    if (c) {
      if (c.until && c.until < Date.now()) { this.cache.delete("sanc:" + charId); return true; }
      return !c.kinds.has(need);
    }
    return true;                          // 캐시 미스 = 정상(폴백은 비동기 로드)
  }

  /** 채팅 미들웨어(051번 ChatService에서 호출) */
  chatAllowed(charId: number): { ok: boolean; reason?: string } {
    if (!this.check(charId, "mute")) return { ok: false, reason: "muted" };
    if (!this.check(charId, "ban")) return { ok: false, reason: "banned" };
    return { ok: true };
  }

  /** 접속 게이트(소켓 open 후 인증 직후) — 디바이스/IP 확장 검사 */
  async connectionAllowed(charId: number, ip: string, deviceHash: string): Promise<boolean> {
    if (!this.check(charId, "ban")) return false;
    // 디바이스/IP 제재(우회 계정 방지) — DB 조회(저빈도 경로)
    const rows = await this.db.selectFrom("sanctions")
      .where(eb => eb.or([
        eb.and([eb("device_hash", "=", deviceHash), eb("kind", "=", "ban")]),
        eb.and([eb("ip_prefix", "=", ip.split(".").slice(0, 3).join(".") + "."),
                eb("kind", "=", "ban")]),
      ]))
      .where(eb => eb.or([
        eb("until", "is", null),
        eb("until", ">", new Date()),
      ])).select("id").execute();
    return rows.length === 0;
  }
}`,
      },
    ],
    tips: [
      "제재 검사는 핫패스(캐시)와 콜드패스(DB)를 분리해 — 패킷 처리 성능에 영향을 주지 않고 정확성을 유지한다.",
      "IP 제재는 /24 프리픽스 단위로 과하게 잡으면 공유기/학교 네트워크 정상 유저까지 막힌다 — 마지막 수단으로만.",
      "Mute는 '만료 TTL + 사유'를 함께 기록해 CS 문의에 즉시 답할 수 있게 한다.",
      "제재 대상 계정의 파티/길드 영향(팀 이탈)은 제재 API에서 이벤트로 방송해 자동 정리되게 한다.",
    ],
  },
  {
    id: "100",
    title: "DB 자동 스냅샷 백업 및 분산 서버 패일오버(Failover)",
    role: [
      "백업 전략은 '전일 스냅샷 + WAL 아카이브(포인트 인 타임 복구)'의 PostgreSQL 표준이다. 스냅샷은 매일 새벽(basebackup)을 S3로 업로드하고, WAL은 5분 단위로 아카이브해 RPO(복구 시점 손실)를 5분 이하로 유지한다. 복구 훈련(월 1회 리스토어 리허설) 없는 백업은 없는 것이나 다름 없으므로, 복구 소요 시간(RTO) 측정을 운영 절차에 포함한다.",
      "패일오버는 (1) PostgreSQL 스트리밍 복제(대기 노드) + 자동 승격(패트로니테/pg_auto_failover), (2) 게임 서버 노드 헬스 체크 + 세션 이관(017번 룸 레지스트리 재할당), (3) 로드밸런서 헬스 체크로 구성된다. 게임 서버는 스테이트리스(세션은 Redis/DB에)가 이상적이지만, 룸 상태는 프로세스 내에 있으므로 '룸 소유 노드 다운 → 룸 재생성(진행 중 던전은 실패 처리 + 보상 조정)'의 명시적 정책이 필요하다.",
    ],
    blocks: [
      {
        lang: "ops/backup.sh + server/failover/Health.ts",
        code: `#!/bin/bash
# ── ops/backup.sh — 일일 스냅샷 + WAL 아카이브(S3 업로드) ──
set -euo pipefail
STAMP=$(date +%Y%m%d_%H%M%S)
PG_HOST=$DB_HOST PG_PORT=5432

# 1) basebackup(전일 스냅샷)
pg_basebackup -h $PG_HOST -U replicator -D /backup/base_$STAMP \\
  -Ft -z -X stream --checkpoint=fast
# 2) 압축 + S3 업로드(3개월 보존 정책)
tar -czf /backup/base_$STAMP.tar.gz -C /backup base_$STAMP
aws s3 cp /backup/base_$STAMP.tar.gz \\
  s3://sertz-backups/base/ --storage-class STANDARD_IA
# 3) 30일 경과 로컬 정리
find /backup -name "base_*.tar.gz" -mtime +30 -delete

# PITR 복구 절차(훈련 문서화 필수):
# 1) 최신 basebackup 다운로드/복원
# 2) recovery.signal + restore_command(archived WAL)
# 3) recovery_target_time = "사고 1분 전"
# 4) 승격 → 앱 재연결`,
      },
      {
        lang: "server/failover/Health.ts — 노드 헬스 + 룸 이관",
        code: `import Redis from "ioredis";
import { Kysely } from "kysely";
type DB = import("../schema").Database;

export class FailoverCoordinator {
  private readonly NODE_KEY = "nodes:alive";     // ZSET: nodeId → heartbeat
  constructor(private redis: Redis, private db: Kysely<DB>,
              private nodeId: string) {}

  /** 하트비트(5초 주기) */
  async heartbeat() {
    await this.redis.zadd(this.NODE_KEY, Date.now(), this.nodeId);
  }

  /** 감시자(리더 노드가 크론 30초): 죽은 노드 감지 → 룸 재할당 */
  async sweep(onRoomLost: (roomId: string) => void) {
    const now = Date.now();
    const dead = (await this.redis.zrangebyscore(this.NODE_KEY, "-inf", now - 15000))
      .filter(n => n !== this.nodeId);
    for (const deadNode of dead) {
      // 죽은 노드 소유 룸 조회 → 재생성 이벤트
      const all = await this.redis.hvals("rooms:");
      for (const raw of all) {
        const r = JSON.parse(raw);
        if (r.ownerId === deadNode && r.phase !== "CLOSED") {
          onRoomLost(r.roomId);       // 던전은 실패 처리 + 보상 조정, 필드는 재생성
          await this.redis.hdel("rooms:", r.roomId);
        }
      }
      await this.redis.zrem(this.NODE_KEY, deadNode);
    }
  }

  /** PostgreSQL 헬스(복제 지표) — pgbouncer/패트로니테가 1차, 앱은 2차 검사 */
  async dbHealthy(): Promise<boolean> {
    try {
      const r = await this.db.selectFrom("characters")
        .select(eb => eb.fn.count("id").as("n")).executeTakeFirst();
      return Number(r?.n ?? 0) >= 0;
    } catch { return false; }
  }
}

/** 절차 요약(운영 런북):
 * 1) DB 장애: 패트로니테 자동 승격(대기 노드 → 주) → 앱은 재시도로 재연결
 * 2) 게임 노드 장애: 감시자가 15초 내 감지 → 룸 재생성 방송 → 유저 재접속 유도
 * 3) 리전 전체 장애: DNS/로드밸런서 → 백업 리전(롤백 RPO 5분 선언)
 * 4) 모든 조치는 상태 페이지 + 인게임 공지(094번)로 즉시 안내
 */`,
      },
    ],
    tips: [
      "백업의 진짜 지표는 RTO/RPO다 — 월 1회 리스토어 리허설로 실측하지 않으면 문서상 수치는 허구다.",
      "WAL 아카이브 5분 = RPO 5분이며, 결제 관련 트랜잭션은 별도 즉시 복제(동기 커밋)로 보호한다.",
      "게임 노드 패일오버는 '룸 소유 상태'가 스테이트리스가 아니므로, 진행 중 던전/전장은 명시적 실패 정책(보상 조정)을 미리 선언해야 유저 분쟁이 없다.",
      "장애 공지(094번 어드민 → 051번 시스템 채널 + 080번 푸시)가 유저 이탈을 절반으로 줄인다 — 무소식이 최악이다.",
    ],
  },
];
