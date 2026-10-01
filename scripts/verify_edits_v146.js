// \uC218\uC815\uBD84 \uBC14\uC774\uD2B8 \uAC80\uC99D — \uD55C\uAE00\uC740 \uBAA8\uB450 \uB9CC\uB4E4\uAE30\uB85C \uAC80\uC0AC
const fs = require('fs');
let fail = 0;
function chk(name, file, patterns) {
  const s = fs.readFileSync(file, 'utf8');
  const lines = [];
  for (const [label, re, must] of patterns) {
    const ok = typeof re === 'string' ? s.includes(re) : re.test(s);
    if (must && !ok) fail++;
    lines.push(`${label}:${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`${name}: ${lines.join(' ')}`);
}

// \uD55C\uAE00 \uBB38\uC790\uC5F4 (\uB9CC\uB4E4\uAE30)
const JIWEON = '\uC9C0\uC6D0'; // \uC9C0\uC6D0
const SENter = JIWEON + '\uC13C\uD130'; // \uC9C0\uC6D0\uC13C\uD130
const MUNUI = '\uBB38\uC758'; // \uBB38\uC758
const BIMIL = '\uBE44\uBC00'; // \uBE44\uBC00
const DOT = '\u00B7'; // \u00B7 (middle dot)
const TARGET_BTN = SENter + DOT + MUNUI; // \uC9C0\uC6D0\uC13C\uD704\u00B7... no wait
// \uC9C0\uC6D0\uC13C\uD130\uB9CC \uAC80\uC0AC\uD558\uC790

chk('Panels', 'src/components/game/Panels.tsx', [
  ['support-link', /\/support/, true],
  ['senter-btn', SENter, true],
  ['v146-comment', /v1\.4\.6/, true],
  ['clipboard-fallback', /navigator\.clipboard/, true],
]);

chk('Overlays', 'src/components/game/Overlays.tsx', [
  ['v146', /v1\.4\.6/, true],
  ['bimil-munui-404', new RegExp(BIMIL + DOT + MUNUI + ' \\uD398\\uC774\\uC9C0 404'), true],
]);

chk('support-page', 'src/app/support/page.tsx', [
  ['apiBase', /apiBase/, true],
  ['import-net', /from "@\/game\/net"/, true],
  ['auth-delete', /\/api\/auth\/delete/, true],
  ['api-support', /\/api\/support/, true],
]);

chk('net', 'src/game/net.ts', [
  ['export-resolve', /export function resolveServerUrl/, true],
]);

chk('server.js', 'server.js', [
  ['SECRET_FILES', /SECRET_FILES/, true],
  ['alias-regex', /inquiry\|contact\|account-delete/, true],
  ['ver-146', /1\.4\.6/, true],
  ['code-98', /LATEST_CODE = 98/, true],
  ['mirror-146', /download\/v1\.4\.6\/SERTZ-v1\.4\.6\.apk/, true],
]);

chk('gradle', 'android/app/build.gradle', [
  ['vc98', /versionCode 98/, true],
  ['vn146', /versionName "1\.4\.6"/, true],
]);

chk('package.json', 'package.json', [
  ['v146', /"version": "1\.4\.6"/, true],
]);

chk('apk-guide', 'public/apk-guide.html', [
  ['old-title', /v1\.4\.5 APK \uB2E4\uC6B4\uB85C\uB4DC \uC548\uB0B4/, false], // \uC544\uC9C1 v1.4.5 \uB0A8\uC544\uC784(\uBBF8\uD328\uCE58)
]);

console.log(fail === 0 ? 'ALL-CHECKS-PASSED' : `FAILURES: ${fail}`);
