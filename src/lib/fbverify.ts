/**
 * v1.0.5-beta — Firebase ID 토큰 + 구글 OIDC ID 토큰 이중 검증 (구글 로그인 실연동)
 *  · Firebase ID 토큰 (iss=https://securetoken.google.com/{pid}, aud={pid})
 *      — 웹(브라우저 Firebase JS SDK signInWithPopup → user.getIdToken()) 경로
 *  · 구글 OIDC ID 토큰 (iss=accounts.google.com, aud=구글 OAuth 클라이언트 ID)
 *      — 앱(@capacitor-firebase/authentication signInWithGoogle().credential.idToken) 경로
 *      (vc126 실측: 플러그인 credential은 구글 OIDC 토큰 — securetoken 서명키·iss/aud 규격이
 *       달라 Firebase 전용 검증에서는 무조건 실패 → 서버에서 이를 수용해야 APK 재빌드 없이 정상화)
 *  · 프로젝트: sertz-681eb (유저 Firebase 콘솔 기준). env SERTZ_FIREBASE_PROJECT_ID로 오버라이드 가능.
 *  · 의존성 없음(node:crypto + fetch) — Vercel serverless 안전. 인증서/JWKS는 60분 캐시.
 *  v1.4.30 (#10 구글 로그인 검증 실패 버그) — 기존엔 서명·만료 실패가 무경고로 null을
 *   반환해 "검증 실패"의 원인을 알 수 없었다(Vercel 로그 블라인드스팟). 개선:
 *   ① 모든 실패 분기에 warn + 이유 코드 반환 (클라에 구체적 원인 표시)
 *   ② kid가 캐시된 인증서셋에 없으면 인증서를 1회 강제 재조회(로테이션 대응)
 *   ③ iss 불일치 시 env 오버라이드 값도 함께 로그 (SERTZ_FIREBASE_PROJECT_ID 오탐 진단)
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

export const FIREBASE_PROJECT_ID = process.env.SERTZ_FIREBASE_PROJECT_ID || "sertz-681eb";

/* Firebase ID 토큰 서명키 (RS256 X.509)
 *  v1.4.32 (#구글로그인 버그) — 기존 URL이 robots(복수형) 오타로 404를 반환해
 *  웹(파이어베이스) 로그인이 전부 "서버가 구글 인증서를 조회하지 못했어요"로 실패했다.
 *  실측: robots→404 · robot(단수)→200 (2026-10 기준). */
const FB_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
/* v1.4.32 — 동일 서명키의 JWKS 표현 (X509 엔드포인트 장애 시 폴백) */
const FB_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
/* 구글 OIDC ID 토큰 서명키 (RS256 JWKS) */
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

/** 프로젝트 소속 구글 OAuth 클라이언트 ID (android/app/google-services.json 기준 — 콘솔에 클라이언트 추가 시 갱신) */
const GOOGLE_CLIENT_IDS = (process.env.SERTZ_GOOGLE_CLIENT_IDS ||
  "650738641826-29c196sq1db27re7hrat5b0e8qcoionj.apps.googleusercontent.com," +
  "650738641826-3to3nfhcfipe56rgm0edmkdmh7s0sfnc.apps.googleusercontent.com"
).split(",").map((s) => s.trim()).filter(Boolean);

const CERT_TTL_MS = 60 * 60 * 1000;
/* v1.4.32 — 인증서 조회 타임아웃: 네트워크 블랙홀 시 로그인 요청이 무한 대기하지 않게 */
const CERT_FETCH_TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`인증서 조회 실패 (${r.status})`);
  return r.json();
}

let certCache: { certs: Record<string, string>; at: number } | null = null;
async function loadCerts(bypassCache = false): Promise<Record<string, string>> {
  if (!bypassCache && certCache && Date.now() - certCache.at < CERT_TTL_MS) return certCache.certs;
  /* 1차 — X509 (정식 URL, kid → PEM) */
  let lastErr: unknown = null;
  try {
    const certs = (await fetchJson(FB_CERTS_URL)) as Record<string, string>;
    if (certs && Object.keys(certs).length) {
      certCache = { certs, at: Date.now() };
      return certs;
    }
  } catch (e) { lastErr = e; }
  /* v1.4.32 폴백 — JWKS 엔드포인트(동일 서명키): kid → JWK(JSON 문자열).
   *  createPublicKey는 publicKeyFrom()에서 JWK 분기로 처리한다. */
  try {
    const body = (await fetchJson(FB_JWKS_URL)) as { keys?: Jwk[] };
    if (body.keys?.length) {
      const certs: Record<string, string> = {};
      for (const k of body.keys) if (k.kid && k.n && k.e) certs[k.kid] = JSON.stringify(k);
      if (Object.keys(certs).length) {
        certCache = { certs, at: Date.now() };
        return certs;
      }
    }
  } catch (e) { lastErr = e; }
  throw lastErr ?? new Error("인증서 응답이 비어 있어요");
}

/** v1.4.32 — PEM 또는 JWK(JSON 문자열) 모두 수용 (JWKS 폴백 경로 대응) */
function publicKeyFrom(v: string) {
  try { return createPublicKey(v); } catch { /* PEM 파싱 실패 → JWK 시도 */ }
  return createPublicKey({ key: JSON.parse(v) as unknown as JsonWebKey, format: "jwk" });
}

type Jwk = { kid?: string; kty?: string; alg?: string; use?: string; n?: string; e?: string };
let jwksCache: { keys: Jwk[]; at: number } | null = null;
async function loadGoogleJwks(bypassCache = false): Promise<Jwk[]> {
  if (!bypassCache && jwksCache && Date.now() - jwksCache.at < CERT_TTL_MS) return jwksCache.keys;
  const r = await fetch(GOOGLE_JWKS_URL, { cache: "no-store", signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`구글 JWKS 조회 실패 (${r.status})`);
  const body = (await r.json()) as { keys?: Jwk[] };
  if (!body.keys?.length) throw new Error("구글 JWKS가 비어 있어요");
  jwksCache = { keys: body.keys, at: Date.now() };
  return body.keys;
}

export type FbIdentity = { sub: string; email?: string; name?: string; picture?: string };
/** v1.4.30 — 검증 결과 + 이유 코드 (실패 원인을 클라/로그에 노출해 진단 가능하게) */
export type FbVerifyResult = { ident: FbIdentity | null; reason: string };

/** JWT 헤더·페이로드 파싱 — 실패 시 null */
function parseJwt(idToken: string): { header: { kid?: string; alg?: string }; payload: Record<string, unknown>; parts: string[] } | null {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return { header, payload, parts };
  } catch {
    return null;
  }
}

function identityFromPayload(payload: Record<string, unknown>): FbIdentity | null {
  const sub = String(payload.sub ?? payload.user_id ?? "");
  if (!sub || sub.length > 128) return null;
  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/** Firebase ID 토큰 경로 — securetoken 서명키로 RS256 검증 + iss/aud/exp 클레임 */
async function verifyFirebase(parts: string[], header: { kid?: string; alg?: string }, payload: Record<string, unknown>): Promise<FbVerifyResult> {
  if (header.alg !== "RS256" || !header.kid) return { ident: null, reason: "토큰 헤더 비정상(alg/kid)" };
  let certs = await loadCerts().catch(() => null);
  if (!certs || !certs[header.kid]) {
    /* v1.4.30 — 구글 서명키 로테이션 대응: 캐시에 kid가 없으면 1회 강제 재조회 */
    console.warn("[SERTZ-fb] Firebase 서명키 kid 캐시 미스 — 강제 재조회", header.kid);
    certs = await loadCerts(true).catch(() => null);
  }
  if (!certs) return { ident: null, reason: "서버가 구글 인증서를 조회하지 못했어요" };
  if (!certs[header.kid]) { console.warn("[SERTZ-fb] Firebase 서명키 kid 없음", header.kid); return { ident: null, reason: "토큰 서명키(kid)를 인식하지 못했어요" }; }
  const key = publicKeyFrom(certs[header.kid]);
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], "base64url");
  /* v1.4.30 — 서명 실패도 이제 warn이 남는다 (기존 블라인드스팟) */
  if (!cryptoVerify("RSA-SHA256", data, key, sig)) { console.warn("[SERTZ-fb] Firebase 서명 불일치 (kid)", header.kid); return { ident: null, reason: "토큰 서명이 유효하지 않아요" }; }

  const now = Math.floor(Date.now() / 1000);
  const iss = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.iss !== iss) {
    console.warn("[SERTZ-fb] iss 불일치 — 토큰:", payload.iss, "/ 서버 기대:", iss, "/ env:", process.env.SERTZ_FIREBASE_PROJECT_ID ? "SERTZ_FIREBASE_PROJECT_ID 오버라이드 사용" : "기본값");
    return { ident: null, reason: "토큰 발급 프로젝트가 다릅니다 (iss)" };
  }
  if (payload.aud !== FIREBASE_PROJECT_ID) { console.warn("[SERTZ-fb] aud 불일치", payload.aud, "기대:", FIREBASE_PROJECT_ID); return { ident: null, reason: "토큰 대상(aud)이 다릅니다" }; }
  /* vc134 — ±60초 시계 오차 허용 (Vercel·기기 간 NTP 미세 차이로 정상 토큰이 만료로 쳐지는 것 방지) */
  if (typeof payload.exp !== "number" || payload.exp < now - 60) { console.warn("[SERTZ-fb] 토큰 만료 — exp:", payload.exp, "now:", now); return { ident: null, reason: "토큰이 만료됐어요 — 다시 로그인해 주세요" }; }
  if (typeof payload.auth_time === "number" && payload.auth_time > now + 60) return { ident: null, reason: "토큰 발급 시각이 미래예요" };
  const ident = identityFromPayload(payload);
  if (!ident) return { ident: null, reason: "토큰에 사용자 식별자(sub)가 없어요" };
  return { ident, reason: "" };
}

/** 구글 OIDC ID 토큰 경로 — accounts.google.com 서명키(JWKS)로 RS256 검증 + aud 허용목록 */
async function verifyGoogleOidc(parts: string[], header: { kid?: string; alg?: string }, payload: Record<string, unknown>): Promise<FbVerifyResult> {
  if (header.alg !== "RS256" || !header.kid) return { ident: null, reason: "토큰 헤더 비정상(alg/kid)" };
  const iss = String(payload.iss ?? "");
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") { console.warn("[SERTZ-fb] 구글 iss 불일치", iss); return { ident: null, reason: "토큰 발급자(iss)가 다릅니다" }; }

  /* aud — 프로젝트 소속 OAuth 클라이언트 ID만 허용 (문자열 또는 배열) */
  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud.map(String) : [String(aud ?? "")];
  if (!audList.some((a) => GOOGLE_CLIENT_IDS.includes(a))) {
    console.warn("[SERTZ-fb] 구글 aud 불일치", audList.join(","), "허용:", GOOGLE_CLIENT_IDS.join(","));
    return { ident: null, reason: "등록되지 않은 앱 클라이언트예요 (aud)" };
  }

  let keys = await loadGoogleJwks().catch(() => null);
  if (!keys) return { ident: null, reason: "서버가 구글 서명키를 조회하지 못했어요" };
  let jwk = keys.find((k) => k.kid === header.kid && (k.alg ?? "RS256") === "RS256" && (k.use ?? "sig") === "sig");
  if (!jwk) {
    /* v1.4.30 — JWKS 로테이션 대응 1회 강제 재조회 */
    keys = await loadGoogleJwks(true).catch(() => null);
    jwk = (keys?.find((k) => k.kid === header.kid && (k.alg ?? "RS256") === "RS256" && (k.use ?? "sig") === "sig")) ?? undefined;
  }
  if (!jwk || !jwk.n || !jwk.e) { console.warn("[SERTZ-fb] 구글 JWKS kid 없음", header.kid); return { ident: null, reason: "토큰 서명키(kid)를 인식하지 못했어요" }; }
  const key = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], "base64url");
  if (!cryptoVerify("RSA-SHA256", data, key, sig)) { console.warn("[SERTZ-fb] 구글 서명 불일치"); return { ident: null, reason: "토큰 서명이 유효하지 않아요" }; }

  const now = Math.floor(Date.now() / 1000);
  /* vc134 — ±60초 시계 오차 허용 */
  if (typeof payload.exp !== "number" || payload.exp < now - 60) { console.warn("[SERTZ-fb] 구글 토큰 만료"); return { ident: null, reason: "토큰이 만료됐어요 — 다시 로그인해 주세요" }; }
  const ident = identityFromPayload(payload);
  if (!ident) { console.warn("[SERTZ-fb] 구글 sub 없음"); return { ident: null, reason: "토큰에 사용자 식별자(sub)가 없어요" }; }
  /* email_verified인 경우에만 신뢰 가능하나, 구글 계정 idToken은 가입 이메일 검증이 강제되므로 그대로 수용 */
  return { ident, reason: "" };
}

/** ID 토큰 검증 진입 — iss로 경로 분기 (Firebase / 구글 OIDC). 실패 시 reason에 원인 코드 */
export async function verifyFirebaseIdTokenDetailed(idToken: string): Promise<FbVerifyResult> {
  const parsed = parseJwt(idToken);
  if (!parsed) return { ident: null, reason: "토큰 형식이 비정상이에요" };
  const { header, payload, parts } = parsed;
  const iss = String(payload.iss ?? "");
  if (iss.startsWith("https://accounts.google.com") || iss === "accounts.google.com") {
    return verifyGoogleOidc(parts, header, payload);
  }
  return verifyFirebase(parts, header, payload);
}

/** 하위 호환 — 성공 시 identity, 실패 시 null */
export async function verifyFirebaseIdToken(idToken: string): Promise<FbIdentity | null> {
  return (await verifyFirebaseIdTokenDetailed(idToken)).ident;
}
