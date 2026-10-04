#!/usr/bin/env python3
# v1.0.3-beta (vc124) 버전 게이트 4종 일괄 승격 — package.json·build.gradle·server.js·api/version
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project")
VER, CODE = "1.0.3-beta", 124
NOTE = ("v1.0.3-beta — 긴급 픽스: 기기에서 인앱 결제·부팅 복구·충전소 실가격 사용 시 "
        "\"NativePurchases.then() is not implemented\" 크래시(재부팅 오버레이)가 발생하던 버그 수정 — "
        "결제 플러그인 접근을 프록시 thenable 함정 없는 구조로 재설계. v1.0.2-beta 설치 기기는 이 버전으로 업데이트 필요")
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
hist = f'/* v1.0.3-beta (vc124) — 긴급 픽스: NativePurchases thenable 크래시(재부팅 오버레이·결제 불능) — 플러그인 접근 재설계(모듈 캐시+동기 접근자) */\n'
if "v1.0.3-beta (vc124)" not in g:
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

print(f"승격 완료: {VER} / vc{CODE}")
