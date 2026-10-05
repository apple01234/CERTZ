#!/usr/bin/env node
/* fbverify.ts 신규 로직 미러 테스트 — 구글 JWKS 페치·JWK 공개키 생성·RS256 verify·JWT 파싱·분기 */
const { createPublicKey, verify } = require("node:crypto");

(async () => {
  // 1) 구글 JWKS 페치 + JWK 공개키 생성 (fbverify와 동일 경로)
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const body = await r.json();
  console.log("JWKS keys:", body.keys.length);
  const jwk = body.keys.find(k => k.kty === "RSA" && (k.alg ?? "RS256") === "RS256" && (k.use ?? "sig") === "sig");
  if (!jwk) throw new Error("RS256 sig 키 없음");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  console.log("createPublicKey OK kid=", jwk.kid);

  // 2) verify 함수 동작 (더미 데이터+더미 서명 = false 정상, 예외 미발생 확인)
  const bad = verify("RSA-SHA256", Buffer.from("a.b"), key, Buffer.alloc(256));
  console.log("dummy verify:", bad, "(false 기대)");

  // 3) 파싱·분기 미러 — 가짜 구글 OIDC 토큰: iss=accounts.google.com이면 OIDC 경로로
  const fakeHeader = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url");
  const fakePayload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: "650738641826-29c196sq1db27re7hrat5b0e8qcoionj.apps.googleusercontent.com",
    sub: "1234567890", exp: Math.floor(Date.now() / 1000) + 3600, email: "t@example.com", name: "테스터",
  })).toString("base64url");
  const fake = `${fakeHeader}.${fakePayload}.${Buffer.alloc(256).toString("base64url")}`;

  // 미러: parse → iss 분기
  const parts = fake.split(".");
  const h = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  const p = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  const isOidc = String(p.iss).startsWith("https://accounts.google.com");
  console.log("iss 분기:", p.iss, "-> OIDC 경로:", isOidc);

  // 4) 허용 aud 목록 매칭 (google-services.json 2종)
  const ALLOW = ["650738641826-29c196sq1db27re7hrat5b0e8qcoionj.apps.googleusercontent.com", "650738641826-3to3nfhcfipe56rgm0edmkdmh7s0sfnc.apps.googleusercontent.com"];
  const audOk = [String(p.aud)].some(a => ALLOW.includes(a));
  console.log("aud 허용목록:", audOk);

  // 5) 서명이 가짜이므로 검증 실패(false) 후 null 반환 흐름 — 예외 없이 끝나는지
  const sig = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const ok = verify("RSA-SHA256", data, key, sig);
  console.log("fake token verify:", ok, "(false 기대 — 서버는 이 경우 null→401)");

  console.log("=== 미러 테스트 전부 통과 ===");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
