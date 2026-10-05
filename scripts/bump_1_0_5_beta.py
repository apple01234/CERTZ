#!/usr/bin/env python3
# v1.0.5-beta (vc126) 버전 게이트 4종 일괄 승격 — package.json·build.gradle·server.js·api/version
# 주제: 구글 로그인 완성 — Firebase 콘솔 연동값(google-services.json) 수령·투입
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project")
VER, CODE = "1.0.5-beta", 126
NOTE = ("v1.0.5-beta — 구글 로그인 완성: Firebase 콘솔 연동값(google-services.json·SHA-1 등록) 투입 — "
        "네이티브 구글 계정 선택창·ID토큰 발급 정상화(vc125까지의 '구글 로그인 서버 설정 미완료' 안내 해소)")
MIRROR = f"https://github.com/apple01234/CERTZ/releases/download/v{VER}/SERTZ-v{VER}.apk"
GC = 'android/app/build.gradle'

def sub1(pat, rep, txt, flags=0):
    out, n = re.subn(pat, rep, txt, count=1, flags=flags)
    assert n == 1, f"패턴 미매칭: {pat}"
    return out

# 1) package.json
p = ROOT / "package.json"
p.write_text(sub1(r'"version":\s*"[^"]+"', f'"version": "{VER}"', p.read_text()))

# 2) build.gradle — versionCode·versionName(주석 제외한 실제 라인) + 최상단 변경 이력 주석 프리펜드
g = (ROOT / GC).read_text()
g = sub1(r'versionCode \d+', f"versionCode {CODE}", g)
g = sub1(r'versionName "[^"]*"', f'versionName "{VER}"', g)
hist = ('/* v1.0.5-beta (vc126) — 구글 로그인 완성: google-services.json 투입(콘솔 SHA-1 등록 완료) — '
        '네이티브 구글 계정 선택창 정상화 */\n')
if "v1.0.5-beta (vc126)" not in g:
    g = hist + g
(ROOT / GC).write_text(g)

# 3) server.js + 4) api/version/route.ts — 게이트 3종(버전·코드·노트) + APK 미러
for f in ["server.js", "src/app/api/version/route.ts"]:
    fp = ROOT / f
    s = fp.read_text()
    s = sub1(r'LATEST_VERSION = "[^"]+"', f'LATEST_VERSION = "{VER}"', s)
    s = sub1(r'LATEST_CODE = \d+', f"LATEST_CODE = {CODE}", s)
    s = sub1(r'VERSION_NOTE =\s*\n?\s*"[^"]*"', f'VERSION_NOTE =\n  "{NOTE}"', s, re.S)
    if "APK_MIRROR" in s:
        s = sub1(r'APK_MIRROR =\s*\n?\s*"[^"]*"', f'APK_MIRROR =\n  "{MIRROR}"', s, re.S)
    fp.write_text(s)

print(f"OK 버전 승격 완료: {VER} / vc{CODE}")
