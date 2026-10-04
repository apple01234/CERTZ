#!/usr/bin/env python3
# v1.0.4-beta (vc125) 버전 게이트 4종 일괄 승격 — package.json·build.gradle·server.js·api/version
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project")
VER, CODE = "1.0.4-beta", 125
NOTE = ("v1.0.4-beta — 유저 버그 리포트 3건: ①랭킹 부적절 닉네임 항목 운영 제거(서버 DB 조치) "
        "②구글 로그인 실패 원인별 안내 강화+플러그인 설정 보완(Firebase 콘솔 연동값 등록 후 정상 동작) "
        "③초반 1~3챕터 BGM 원곡(Kevin MacLeod) 복구")
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
hist = ('/* v1.0.4-beta (vc125) — 유저 버그 3건: 랭킹 닉네임 운영 제거(서버)·구글 로그인 안내 강화+플러그인 설정·'
        '초반 1~3챕터 BGM 원곡 복구 */\n')
if "v1.0.4-beta (vc125)" not in g:
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

print(f"✓ 버전 승격 완료: {VER} / vc{CODE}")
