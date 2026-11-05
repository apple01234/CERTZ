/**
 * vc251 — PC 클라이언트 로그인 불가 수리 검증.
 *
 * [증상] Electron PC 클라이언트에서 로그인이 유지되지 않는다.
 * [원인] Electron 은 게임을 `http://127.0.0.1:<port>` 오리진에서 띄우는데,
 *   세션 쿠키에 항상 `Secure` 가 붙어 있었다. Chromium 은 Secure 쿠키를
 *   https(또는 localhost 예외)에서만 저장하므로 127.0.0.1 에서는 Set-Cookie 가 버려지고
 *   새로고침/재실행마다 세션이 사라진다.
 *
 * [양방향 고정] 한쪽만 고치면 반드시 다른 쪽이 깨진다:
 *  · Electron(http) → Secure 없음
 *  · 운영/APK(https 또는 프록시 헤더 https) → Secure 있음
 */
const m = await import('../src/lib/sessionCookie.ts');
const { isHttpsRequest, sessionCookieString, clearCookieString, TOKEN_TTL_MS } = m;

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

const TOKEN = "a".repeat(64);

/* ── 스킴 판정 ── */
check("프록시 헤더 https → https 판정", isHttpsRequest((n) => (n === "x-forwarded-proto" ? "https" : null), "http://x/api") === true);
check("헤더 체인 'https,http' → https", isHttpsRequest((n) => (n === "x-forwarded-proto" ? "https,http" : null), "http://x/api") === true);
check("헤더 'http' → http 판정", isHttpsRequest((n) => (n === "x-forwarded-proto" ? "http" : null), "https://x/api") === false);
check("헤더 없음 + http URL → http", isHttpsRequest((n) => null, "http://127.0.0.1:51234/api") === false);
check("헤더 없음 + https URL → https", isHttpsRequest((n) => null, "https://sertz.vercel.app/api") === true);
check("판단 불가 → 안전한 쪽(https)", isHttpsRequest(() => null, undefined) === true);

/* ── 쿠키 문자열 ── */
const https = sessionCookieString(TOKEN, true);
const http = sessionCookieString(TOKEN, false);

check("운영(https) 쿠키에 Secure", https.includes("Secure"), https);
check("Electron(http) 쿠키에 Secure 없음", !http.includes("Secure"), http);
check("HttpOnly 유지(양쪽)", https.includes("HttpOnly") && http.includes("HttpOnly"));
check("SameSite=Lax 유지(양쪽)", https.includes("SameSite=Lax") && http.includes("SameSite=Lax"));
check("Path=/ 유지(양쪽)", https.includes("Path=/") && http.includes("Path=/"));
check("토큰 값 보존", http.includes(`sertz_auth=${TOKEN}`));
check("Max-Age 는 TTL 과 일치(14일)", http.includes(`Max-Age=${TOKEN_TTL_MS / 1000}`), http);

/* ── 삭제 쿠키도 같은 규칙 ── (다르면 http 오리진에서 로그아웃이 안 된다) */
check("로그아웃(http) Secure 없음", !clearCookieString(false).includes("Secure"), clearCookieString(false));
check("로그아웃(https) Secure 있음", clearCookieString(true).includes("Secure"));
check("삭제 쿠키 Max-Age=0", clearCookieString(false).includes("Max-Age=0"));

console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
