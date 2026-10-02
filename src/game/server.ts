/**
 * v1.4.20 — 서버 해석 단일 모듈 (Vercel 멀티서버 분리 아키텍처)
 *
 *  배포 구조:
 *   [Vercel]        = 정적 프론트 미러 (output:export — 소켓/API 서버 없음, CDN 캐시)
 *   [게임 서버]      = sertz11.space-z.ai (server.js — socket.io + 계정/거래소/랭킹 API + 정적 서빙)
 *
 *  클라이언트 해석 우선순위:
 *   ① localStorage 'sertz.server.url' 저장 주소 (APK/EXE 설정 UI + 웹 수동 오버라이드)
 *   ② 게임 서버 오리진(localhost / *.space-z.ai)에서 열었으면 same-origin (기존 동작 유지)
 *   ③ 그 외 정적 배포(Vercel 등)에서 열었으면 원격 게임 서버(GAME_SERVER)로 직접 접속
 *
 *  GAME_SERVER는 빌드타임 env NEXT_PUBLIC_GAME_SERVER로 교체 가능 (Vercel 프로젝트별
 *  다른 게임 서버 연결 — 멀티서버 운영 시 프로젝트 env만 바꾸면 된다).
 */

/** 기본 게임 서버 (소켓 + 계정/거래소/랭킹 API 본체) */
export const GAME_SERVER = (
  process.env.NEXT_PUBLIC_GAME_SERVER || "https://sertz11.space-z.ai"
).replace(/\/+$/, "");

/**
 * same-origin 게임 서버 오리진 판정 — 이 오리진에서 열린 페이지는
 * server.js(소켓+API)가 살아있으므로 same-origin 접속이 최선(쿠키 세션·무 CORS).
 */
export function isGameServerHost(hostname: string): boolean {
  const h = (hostname || "").toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".space-z.ai") // sertz11 본체 + space-z 프리뷰 배포 전체
  );
}

/**
 * 정적 프론트 미러 호스트 판정 — 이 오리진은 소켓/API 서버가 없으므로
 * 실제 게임 서버(GAME_SERVER)로 우회 접속해야 한다.
 * (v1.4.21 — APK 기본 주소를 Vercel 미러로: 미러는 '입구 주소'일 뿐,
 *  실제 연결은 빌드 타임에 인라인된 게임 서버 본체로 향한다)
 */
export function isStaticMirrorHost(hostname: string): boolean {
  const h = (hostname || "").toLowerCase();
  return h === "vercel.app" || h.endsWith(".vercel.app");
}

/**
 * 저장된 서버 주소 조회 — http/ws는 https/wss로 강제 승격 (v1.4.3 데이터보안 계약 유지).
 * 없거나 형식이 틀리면 null.
 */
export function storedServerUrl(): string | null {
  try {
    const u = (window.localStorage.getItem("sertz.server.url") || "").trim();
    if (u && /^(https?|wss?):\/\//i.test(u)) {
      return u
        .replace(/^http:\/\//i, "https://")
        .replace(/^ws:\/\//i, "wss://")
        .replace(/\/+$/, "");
    }
  } catch {
    /* localStorage 접근 불가 — 폴백 */
  }
  return null;
}

/**
 * 저장 주소(엔트리)를 실제 소켓/API 접속 대상으로 해석:
 *  - 미러 호스트(vercel.app) → GAME_SERVER (게임 서버 본체)
 *  - 그 외 → 주소 그대로 (셀프호스트 게임 서버 직접 지정)
 * fallback: 저장 주소가 없을 때의 반환값 (undefined= same-origin, null=오프라인)
 */
export function resolveEntryTarget(entry: string | null, fallback: string | null | undefined): string | null | undefined {
  if (!entry) return fallback;
  try {
    if (isStaticMirrorHost(new URL(entry).hostname)) return GAME_SERVER;
  } catch {
    /* URL 파싱 실패 — 주소 그대로 */
  }
  return entry;
}

/**
 * 계정/거래소/랭킹/버전 API 베이스 URL (account.ts·Overlays.tsx 공용).
 *  - 저장 주소 최우선 (APK 웹뷰 + 웹 수동 오버라이드 공통) — 미러 주소는 게임 서버 본체로 해석
 *  - 게임 서버 오리진 → "" (same-origin — 쿠키 세션 동작)
 *  - 정적 배포(Vercel 등) → GAME_SERVER (크로스오리진 — Bearer/쿼리 토큰 + 서버 CORS 화이트리스트)
 */
export function resolveApiBase(): string {
  if (typeof window === "undefined") return "";
  const stored = storedServerUrl();
  if (stored) {
    const t = resolveEntryTarget(stored, stored);
    return typeof t === "string" ? t : "";
  }
  if (isGameServerHost(window.location.hostname)) return "";
  return GAME_SERVER;
}
