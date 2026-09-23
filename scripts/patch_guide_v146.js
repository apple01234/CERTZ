// v1.4.6 버전체인 — apk-guide.html + APK_다운로드_안내.txt 패치 (ASCII 앵커 + 검증)
const fs = require('fs');
let fail = 0;
function rep(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [re, to, label] of pairs) {
    const before = s;
    s = typeof re === 'string' ? s.replace(re, to) : s.replace(re, to);
    if (s === before) { console.log(`${file} :: ${label} :: NO-MATCH`); fail++; }
    else console.log(`${file} :: ${label} :: OK`);
  }
  fs.writeFileSync(file, s);
}

// ── apk-guide.html ────────────────────────────────────────────────
rep('public/apk-guide.html', [
  [/SERTZ v1\.4\.5 APK/g, 'SERTZ v1.4.6 APK', 'title-h1'],
  [/versionCode 97 · /, 'versionCode 98 · ', 'sub-vc'],
  [/<b>이번 버전\(v1\.4\.5\)[^<]*<\/b><br>\n/,
`<b>이번 버전(v1.4.6) — "비밀 페이지·문의 페이지 404" 근본 수정</b><br>
    🔐 비밀 페이지(세계수의 기록) 404 수정 — /secret/ 접속 시 308→404로 착지하던 사슬 제거, 서버에서 직접 서빙 (후행 슬래시 유무 무관)<br>
    🛰 문의 페이지 404 수정 — /inquiry·/contact·/account-delete·/delete-account 등 주소를 전부 지원센터(/support)로 안내<br>
    🎮 게임 안 진입로 신설 — 설정창 비밀수첩에 [지원센터·문의] 버튼 추가<br>
    📱 APK에서도 문의 가능 — 지원센터의 문의 폼·계정 삭제가 저장된 서버(HTTPS)로 전송<br>
    ♻️ v1.4.5 — 이상한 비석·ARG 접속 후 무한 재부팅 근본 차단 + 플레이스토어 대비(AD_ID 미사용 선언·지원센터/개인정보/계정삭제·HTTPS 강제)<br>
`, 'notice-header'],
  [/download\/v1\.4\.5\/SERTZ-v1\.4\.5\.apk/, 'download/v1.4.6/SERTZ-v1.4.6.apk', 'link'],
  [/112MB/, '117MB', 'size'],
  [/c497b5fc[0-9a-f]*<\/code> \(<b>117541690B<\/b> · versionCode 97\)/, '빌드 후 자동 기재</code> (<b>versionCode 98</b>)', 'md5-line'],
  [/(\n    v1\.4\.4 변경점:)/,
`\n    v1.4.6 변경점: 비밀·문의 페이지 404 근본 수정 — /secret 서버 직접 서빙(308→404 사슬 제거) · /inquiry·/contact·/account-delete·/delete-account → /support 유도 · 비밀수첩 [지원센터·문의] 버튼 신설 · APK에서도 문의/계정삭제 API 원격 서버(HTTPS) 호출\n    v1.4.5 변경점: 이상한 비석·ARG 페이지 접속 후 무한 재부팅 근본 차단(재부팅 예산 2회/2분·수동 복구 오버레이·네이티브 비석 클립보드 안내·복귀 15초 유예) · 플레이스토어 대비(AD_ID 미사용 선언·/support 지원센터+/privacy+계정삭제·문의 API·HTTPS 강제) · 멀티 진입 HUD 노출$1`, 'footer-history'],
]);

// ── download/APK_다운로드_안내.txt ────────────────────────────────
rep('download/APK_다운로드_안내.txt', [
  [/v1\.4\.5 \(최신\) — 무한 재부팅 근본 차단 \+ 플레이스토어 대비\n/,
`v1.4.6 (최신) — 비밀·문의 페이지 404 근본 수정
· 다운로드: https://github.com/apple01234/CERTZ/releases/download/v1.4.6/SERTZ-v1.4.6.apk
· md5: (빌드 후 자동 기재 — versionCode 98)
· 비밀 페이지(세계수의 기록) 404 근본 수정 — /secret/ 308→404 사슬 제거, 후행 슬래시 유무 무관 직접 서빙
· 문의 페이지 404 수정 — /inquiry·/contact·/account-delete·/delete-account 등 → /support 지원센터로 안내
· 게임 설정창 비밀수첩에 [지원센터·문의] 버튼 신설 — 문의/계정삭제/FAQ 통합 입구
· APK에서도 문의 폼·계정 삭제가 저장된 서버(HTTPS)로 전송

v1.4.5 — 무한 재부팅 근본 차단 + 플레이스토어 대비
`, 'txt-header'],
]);

// ── 최종 검증 ────────────────────────────────────────────────────
const g = fs.readFileSync('public/apk-guide.html', 'utf8');
const t = fs.readFileSync('download/APK_다운로드_안내.txt', 'utf8');
const checks = [
  ['guide v1.4.5 잔존', !/SERTZ v1\.4\.5 APK/.test(g)],
  ['guide v1.4.6 존재', g.includes('SERTZ v1.4.6 APK')],
  ['guide vc98', g.includes('versionCode 98')],
  ['guide 404 헤더', g.includes('비밀 페이지·문의 페이지 404')],
  ['guide 지원센터 버튼', g.includes('지원센터·문의')],
  ['guide footer v1.4.6', g.includes('v1.4.6 변경점')],
  ['txt v1.4.6 최신', t.includes('v1.4.6 (최신)')],
  ['txt v1.4.5 강등', t.includes('v1.4.5 — 무한 재부팅')],
  ['txt link 146', t.includes('download/v1.4.6/SERTZ-v1.4.6.apk')],
];
for (const [n, ok] of checks) { if (!ok) fail++; console.log(`chk :: ${n} :: ${ok ? 'OK' : 'FAIL'}`); }
console.log(fail === 0 ? 'GUIDE-PATCH-ALL-OK' : `GUIDE-PATCH-FAILURES: ${fail}`);
