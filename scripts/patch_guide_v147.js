// v1.4.7 버전체인 — apk-guide.html + APK_다운로드_안내.txt 패치 (ASCII 앵커 + 검증)
const fs = require('fs');
let fail = 0;
function rep(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [re, to, label] of pairs) {
    const before = s;
    s = s.replace(re, to);
    if (s === before) { console.log(`${file} :: ${label} :: NO-MATCH`); fail++; }
    else console.log(`${file} :: ${label} :: OK`);
  }
  fs.writeFileSync(file, s);
}

// ── apk-guide.html ────────────────────────────────────────────────
rep('public/apk-guide.html', [
  [/SERTZ v1\.4\.6 APK/g, 'SERTZ v1.4.7 APK', 'title-h1-button'],
  [/versionCode 98 · /, 'versionCode 99 · ', 'sub-vc'],
  [/<b>이번 버전\(v1\.4\.6\) — "비밀 페이지·문의 페이지 404" 근본 수정<\/b><br>\n/,
`<b>이번 버전(v1.4.7) — "오류나는 페이지 전면 철거" (유저 지시)</b><br>
    🪦 마을 이상한 비석 완전 철거 — ARG 웹페이지(/secret/)를 열던 트리거 오브제를 게임에서 제거 (무한 재부팅 사건의 근원)<br>
    🗑️ 세계수의 기록(/secret) 페이지 서버에서 완전 삭제 — 구버전 APK·북마크의 잔존 링크는 지원센터(/support)로 자동 안내<br>
    📕 비밀수첩 [힌트 페이지] 버튼 철거 — [지원센터·문의] 버튼만 유지<br>
    🌐 ARG 힌트는 외부 공식 지원센터 웹페이지로 이원화 — 정답 코드 입력은 비밀수첩에 그대로 유지<br>
    🛡️ 재부팅 방어(예산·수동 복구 오버레이·복귀 유예)는 그대로 유지 — 이중 안전망<br>
    <b>이전 버전(v1.4.6) — "비밀 페이지·문의 페이지 404" 근본 수정</b><br>
`, 'notice-header'],
  [/download\/v1\.4\.6\/SERTZ-v1\.4\.6\.apk/g, 'download/v1.4.7/SERTZ-v1.4.7.apk', 'link'],
  [/3350dceab41698a85dd580f610520fe6<\/code> \(<b>117545433B<\/b> · versionCode 98\)/, '빌드 후 자동 기재</code> (<b>versionCode 99</b>)', 'md5-line'],
  [/(\n    v1\.4\.6 변경점:)/,
`\n    v1.4.7 변경점: 오류나는 페이지 전면 철거(유저 지시) — 마을 이상한 비석 완전 제거(무한 재부팅 근원 오브제) · 세계수의 기록(/secret) 정적 페이지 삭제+지원센터 308 유도 · 비밀수첩 힌트 페이지 버튼 철거 · ARG 힌트는 외부 공식 지원센터 웹페이지로 이원화(정답 코드 입력은 비밀수첩 유지) · 재부팅 방어 체계 유지<br>
    v1.4.6 변경점:`, 'footer-history'],
]);

// ── download/APK_다운로드_안내.txt ────────────────────────────────
rep('download/APK_다운로드_안내.txt', [
  [/v1\.4\.6 \(최신\) — 비밀·문의 페이지 404 근본 수정\n/,
`v1.4.7 (최신) — 오류나는 페이지 전면 철거 (유저 지시)
· 다운로드: https://github.com/apple01234/CERTZ/releases/download/v1.4.7/SERTZ-v1.4.7.apk
· md5: 빌드 후 자동 기재 (versionCode 99)
· 마을 이상한 비석 완전 철거 — ARG 웹페이지 개방 트리거 제거 (무한 재부팅 사건의 근원 오브제)
· 세계수의 기록(/secret) 페이지 서버에서 완전 삭제 — 잔존 링크는 /support 지원센터로 자동 안내(308)
· 비밀수첩 [힌트 페이지] 버튼 철거 — [지원센터·문의] 버튼만 유지
· ARG 힌트는 외부 공식 지원센터 웹페이지로 이원화 — 정답 코드 입력은 비밀수첩에 유지
· 재부팅 방어 체계(예산·수동 복구 오버레이·복귀 유예) 유지

v1.4.6 — 비밀·문의 페이지 404 근본 수정
`, 'txt-header'],
]);

if (fail) { console.log(`FAIL — ${fail} patch(es) missing`); process.exit(1); }
console.log('v1.4.7 guide/txt patch 완료');
