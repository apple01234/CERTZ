/**
 * v1.4.20 — 서버 해석 단일 모듈 (Vercel 멀티서버 분리 아키텍처)
 *  v1.4.22 — ②안 전환: 계정·거래소·랭킹·클라우드세이브 API가 Vercel serverless로 이주
 *  (GitHub-as-DB — apple01234/CERTZ-DB :: db-backup/accounts.enc).
 *
 *  배포 구조:
 *   [Vercel]        = 게임 웹 + 계정/거래소/랭킹 API 본체 (serverless 라우트)
 *   [게임 서버]      = 없음 (멀티플레이 제외 — 소켓은 오프라인 모드, GAME_SERVER로 재지정 가능)
 *
 *  클라이언트 해석 우선순위:
 *   ① localStorage 'sertz.server.url' 저장 주소 (APK/EXE 설정 UI + 웹 수동 오버라이드)
 *      — 미러(vercel.app) 포함 그 주소가 이제 API 본체다 (그대로 사용)
 *   ② 게임 서버 오리진(localhost / *.space-z.ai)에서 열었으면 same-origin (구 FC 배포 호환)
 *   ③ Vercel(.vercel.app)에서 열었으면 same-origin (serverless API)
 *   ④ 그 외 — GAME_SERVER (기본 "": same-origin)
 *
 *  GAME_SERVER는 빌드타임 env NEXT_PUBLIC_GAME_SERVER로 교체 가능 —
 *  멀티 서버를 다시 운영할 때 이 값을 채우면 소켓·계정 API 우회가 부활한다.
 */

/** 기본 게임 서버 (소켓 본체 — v1.4.22: 없음 = 오프라인 모드). API는 Vercel serverless가 담당 */
export const GAME_SERVER = (
  process.env.NEXT_PUBLIC_GAME_SERVER || ""
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
 *  v1.4.22 — Vercel이 API 본체가 됐다:
 *  - 저장 주소 최우선 — 미러(vercel.app) 포함 "그 주소 그대로"가 API 베이스
 *    (APK 웹뷰 https://localhost에서 sertz.vercel.app API를 크로스오리진 호출 —
 *     서버 CORS가 https://localhost를 허용하므로 동작)
 *  - 게임 서버 오리진(구 FC) → "" (same-origin, 쿠키 세션)
 *  - Vercel 오리진 → "" (same-origin serverless API — 쿠키 세션 동작)
 *  - 그 외(커스텀 도메인) → GAME_SERVER (기본 "" = same-origin)
 */
export function resolveApiBase(): string {
  if (typeof window === "undefined") return "";
  const stored = storedServerUrl();
  if (stored) return stored;
  if (isGameServerHost(window.location.hostname)) return "";
  if (isStaticMirrorHost(window.location.hostname)) return ""; // v1.4.22 — serverless API same-origin
  return GAME_SERVER;
}
