/**
 * v1.0.2-beta — Firebase ID 토큰 서버 검증 (구글 로그인 실연동)
 *  · 클라(@capacitor-firebase/authentication / Firebase JS SDK)가 받은 Firebase ID 토큰(JWT RS256)을
 *    서버에서 검증한다 — Google의 공개 X.509 인증서로 서명 확인 후 클레임 검사.
 *  · 프로젝트: sertz-681eb (유저 Firebase 콘솔 기준). env SERTZ_FIREBASE_PROJECT_ID로 오버라이드 가능.
 *  · 의존성 없음(node:crypto + fetch) — Vercel serverless 안전. 인증서는 60분 캐시.
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

export const FIREBASE_PROJECT_ID = process.env.SERTZ_FIREBASE_PROJECT_ID || "sertz-681eb";

const CERTS_URL = "https://www.googleapis.com/robots/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { certs: Record<string, string>; at: number } | null = null;
const CERT_TTL_MS = 60 * 60 * 1000;

async function loadCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() - certCache.at < CERT_TTL_MS) return certCache.certs;
  const r = await fetch(CERTS_URL, { cache: "no-store" });
  if (!r.ok) throw new Error(`인증서 조회 실패 (${r.status})`);
  const certs = (await r.json()) as Record<string, string>;
  if (!certs || !Object.keys(certs).length) throw new Error("인증서 응답이 비어 있어요");
  certCache = { certs, at: Date.now() };
  return certs;
}

export type FbIdentity = { sub: string; email?: string; name?: string; picture?: string };

/** Firebase ID 토큰 검증 — 성공 시 { sub, email, name }, 실패 시 null (이유는 콘솔) */
export async function verifyFirebaseIdToken(idToken: string): Promise<FbIdentity | null> {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  let header: { kid?: string; alg?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  /* 서명 검증 — Google 공개 인증서(kid 매칭)로 RS256 확인 */
  const certs = await loadCerts().catch(() => null);
  if (!certs || !certs[header.kid]) return null;
  const key = createPublicKey(certs[header.kid]);
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], "base64url");
  const ok = cryptoVerify("RSA-SHA256", data, key, sig);
  if (!ok) return null;

  /* 클레임 검사 — Firebase ID 토큰 규격 (iss/aud/exp/iat/auth_time/sub) */
  const now = Math.floor(Date.now() / 1000);
  const iss = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.iss !== iss) { console.warn("[SERTZ-fb] iss 불일치", payload.iss); return null; }
  if (payload.aud !== FIREBASE_PROJECT_ID) { console.warn("[SERTZ-fb] aud 불일치", payload.aud); return null; }
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.auth_time === "number" && payload.auth_time > now + 60) return null;
  const sub = String(payload.sub ?? payload.user_id ?? "");
  if (!sub || sub.length > 128) return null;

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
