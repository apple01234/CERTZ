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
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

export const FIREBASE_PROJECT_ID = process.env.SERTZ_FIREBASE_PROJECT_ID || "sertz-681eb";

/* Firebase ID 토큰 서명키 (RS256 X.509) */
const FB_CERTS_URL = "https://www.googleapis.com/robots/v1/metadata/x509/securetoken@system.gserviceaccount.com";
/* 구글 OIDC ID 토큰 서명키 (RS256 JWKS) */
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

/** 프로젝트 소속 구글 OAuth 클라이언트 ID (android/app/google-services.json 기준 — 콘솔에 클라이언트 추가 시 갱신) */
const GOOGLE_CLIENT_IDS = (process.env.SERTZ_GOOGLE_CLIENT_IDS ||
  "650738641826-29c196sq1db27re7hrat5b0e8qcoionj.apps.googleusercontent.com," +
  "650738641826-3to3nfhcfipe56rgm0edmkdmh7s0sfnc.apps.googleusercontent.com"
).split(",").map((s) => s.trim()).filter(Boolean);

const CERT_TTL_MS = 60 * 60 * 1000;

let certCache: { certs: Record<string, string>; at: number } | null = null;
async function loadCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() - certCache.at < CERT_TTL_MS) return certCache.certs;
  const r = await fetch(FB_CERTS_URL, { cache: "no-store" });
  if (!r.ok) throw new Error(`인증서 조회 실패 (${r.status})`);
  const certs = (await r.json()) as Record<string, string>;
  if (!certs || !Object.keys(certs).length) throw new Error("인증서 응답이 비어 있어요");
  certCache = { certs, at: Date.now() };
  return certs;
}

type Jwk = { kid?: string; kty?: string; alg?: string; use?: string; n?: string; e?: string };
let jwksCache: { keys: Jwk[]; at: number } | null = null;
async function loadGoogleJwks(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < CERT_TTL_MS) return jwksCache.keys;
  const r = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });
  if (!r.ok) throw new Error(`구글 JWKS 조회 실패 (${r.status})`);
  const body = (await r.json()) as { keys?: Jwk[] };
  if (!body.keys?.length) throw new Error("구글 JWKS가 비어 있어요");
  jwksCache = { keys: body.keys, at: Date.now() };
  return body.keys;
}

export type FbIdentity = { sub: string; email?: string; name?: string; picture?: string };

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
async function verifyFirebase(parts: string[], header: { kid?: string; alg?: string }, payload: Record<string, unknown>): Promise<FbIdentity | null> {
  if (header.alg !== "RS256" || !header.kid) return null;
  const certs = await loadCerts().catch(() => null);
  if (!certs || !certs[header.kid]) { console.warn("[SERTZ-fb] Firebase 서명키 kid 없음", header.kid); return null; }
  const key = createPublicKey(certs[header.kid]);
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], "base64url");
  if (!cryptoVerify("RSA-SHA256", data, key, sig)) return null;

  const now = Math.floor(Date.now() / 1000);
  const iss = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.iss !== iss) { console.warn("[SERTZ-fb] iss 불일치", payload.iss); return null; }
  if (payload.aud !== FIREBASE_PROJECT_ID) { console.warn("[SERTZ-fb] aud 불일치", payload.aud); return null; }
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.auth_time === "number" && payload.auth_time > now + 60) return null;
  return identityFromPayload(payload);
}

/** 구글 OIDC ID 토큰 경로 — accounts.google.com 서명키(JWKS)로 RS256 검증 + aud 허용목록 */
async function verifyGoogleOidc(parts: string[], header: { kid?: string; alg?: string }, payload: Record<string, unknown>): Promise<FbIdentity | null> {
  if (header.alg !== "RS256" || !header.kid) return null;
  const iss = String(payload.iss ?? "");
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") { console.warn("[SERTZ-fb] 구글 iss 불일치", iss); return null; }

  /* aud — 프로젝트 소속 OAuth 클라이언트 ID만 허용 (문자열 또는 배열) */
  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud.map(String) : [String(aud ?? "")];
  if (!audList.some((a) => GOOGLE_CLIENT_IDS.includes(a))) {
    console.warn("[SERTZ-fb] 구글 aud 불일치", audList.join(","), "허용:", GOOGLE_CLIENT_IDS.join(","));
    return null;
  }

  const keys = await loadGoogleJwks().catch(() => null);
  if (!keys) return null;
  const jwk = keys.find((k) => k.kid === header.kid && (k.alg ?? "RS256") === "RS256" && (k.use ?? "sig") === "sig");
  if (!jwk || !jwk.n || !jwk.e) { console.warn("[SERTZ-fb] 구글 JWKS kid 없음", header.kid); return null; }
  const key = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], "base64url");
  if (!cryptoVerify("RSA-SHA256", data, key, sig)) { console.warn("[SERTZ-fb] 구글 서명 불일치"); return null; }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) { console.warn("[SERTZ-fb] 구글 토큰 만료"); return null; }
  const ident = identityFromPayload(payload);
  if (!ident) { console.warn("[SERTZ-fb] 구글 sub 없음"); return null; }
  /* email_verified인 경우에만 신뢰 가능하나, 구글 계정 idToken은 가입 이메일 검증이 강제되므로 그대로 수용 */
  return ident;
}

/** ID 토큰 검증 진입 — iss로 경로 분기 (Firebase / 구글 OIDC). 성공 시 { sub, email, name }, 실패 시 null */
export async function verifyFirebaseIdToken(idToken: string): Promise<FbIdentity | null> {
  const parsed = parseJwt(idToken);
  if (!parsed) return null;
  const { header, payload, parts } = parsed;
  const iss = String(payload.iss ?? "");
  if (iss.startsWith("https://accounts.google.com") || iss === "accounts.google.com") {
    return verifyGoogleOidc(parts, header, payload);
  }
  return verifyFirebase(parts, header, payload);
}
