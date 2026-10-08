/**
 * v1.4.32 (#구글로그인 버그) 검증 — fbverify.ts의 인증서 경로 3종 실측
 *  ① 새 X509 URL (robot 단수) → 200 + kid→PEM 매핑
 *  ② JWKS 폴백 URL → 200 + kid→JWK (createPublicKey jwk 포맷 파싱 성공)
 *  ③ PEM/JWK 두 경로 모두 실제 공개키 생성 성공 (createPublicKey)
 */
import { createPublicKey } from "node:crypto";

const X509 = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const OLD = "https://www.googleapis.com/robots/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name); } };

// ① 구 URL이 여전히 404인지 (버그 재현 확인)
const oldRes = await fetch(OLD);
ok(oldRes.status === 404, `구 URL(robots) 404 확인 — 실측 ${oldRes.status}`);

// ② 새 X509 URL
const x = await fetch(X509);
ok(x.status === 200, `신 URL(robot) 200 — 실측 ${x.status}`);
const certs = await x.json();
const kid0 = Object.keys(certs)[0];
ok(!!kid0 && certs[kid0].includes("BEGIN CERTIFICATE"), `kid→PEM 매핑 (${Object.keys(certs).length}키, kid=${kid0?.slice(0, 8)}..)`);
let pemOk = false;
try { createPublicKey(certs[kid0]); pemOk = true; } catch {}
ok(pemOk, "PEM → createPublicKey 성공");

// ③ JWKS 폴백
const j = await fetch(JWKS);
ok(j.status === 200, `JWKS 폴백 200 — 실측 ${j.status}`);
const body = await j.json();
const k0 = (body.keys ?? []).find((k) => k.kid && k.n && k.e);
ok(!!k0, `JWK kid/n/e 존재 (${(body.keys ?? []).length}키)`);
let jwkOk = false;
try { createPublicKey({ key: k0, format: "jwk" }); jwkOk = true; } catch {}
ok(jwkOk, "JWK → createPublicKey(format:jwk) 성공");

// ④ kid 교집합 — X509과 JWKS가 같은 서명키 세트인지
const jkids = new Set((body.keys ?? []).map((k) => k.kid));
const xkids = Object.keys(certs);
ok(xkids.some((k) => jkids.has(k)), `X509↔JWKS kid 교집합 존재 (X509 ${xkids.length} / JWKS ${jkids.size})`);

// ⑤ publicKeyFrom 로직 재현 — PEM 우선, 실패 시 JWK JSON 문자열
const publicKeyFrom = (v) => { try { return createPublicKey(v); } catch {} return createPublicKey({ key: JSON.parse(v), format: "jwk" }); };
let bothOk = false;
try { publicKeyFrom(certs[kid0]); publicKeyFrom(JSON.stringify(k0)); bothOk = true; } catch {}
ok(bothOk, "publicKeyFrom(PEM) + publicKeyFrom(JWK문자열) 모두 성공");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
