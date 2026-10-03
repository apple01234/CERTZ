#!/usr/bin/env python3
# bump_1_0_0_beta.py — 정식 출시 베타 v1.0.0-beta/vc121 버전 승격 4종
# (package.json·build.gradle·server.js·api/version) — bump_1_4_28.py 패턴 계승
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project")
V, C = "1.0.0-beta", 121
NOTE = ("v1.0.0-beta — 정식 출시(베타): v1.4.28까지의 전체 기능 포함 — ①채팅·파티 부활(Vercel 릴레이 폴링) "
        "②자동전투 튜닝(포위 시 선제 물약·HP 안전망 40%) ③채팅 입력·전송 버튼 대화창 가림 픽스 "
        "④세로 좁은 화면 물약·자동 버튼 공격 버튼 인접 재배치 · Google Play AAB 출시용 · APK: GitHub 릴리스 v1.0.0-beta")
URL = f"https://github.com/apple01234/CERTZ/releases/download/v{V}/SERTZ-v{V}.apk"
GNote = ("v1.0.0-beta (vc121) — 정식 출시 베타(Play Store AAB 포함) — v1.4.28 전체 기능 포함, 버전 체계를 1.0.0-beta로 전환")

# 1) package.json
p = ROOT / "package.json"; s = p.read_text()
s = s.replace('"version": "1.4.28"', f'"version": "{V}"')
p.write_text(s)

# 2) build.gradle — versionCode/Name + 주석 프리펜드
p = ROOT / "android/app/build.gradle"; s = p.read_text()
s = s.replace("versionCode 120", f"versionCode {C}")
s = s.replace('versionName "1.4.28"', f'versionName "{V}"')
s = re.sub(r'/\* v1\.4\.28 \(vc120\)', "/* " + GNote + " */ /* v1.4.28 (vc120)", s, count=1)
p.write_text(s)

# 3) server.js 게이트
p = ROOT / "server.js"; s = p.read_text()
s = s.replace("releases/download/v1.4.28/SERTZ-v1.4.28.apk", f"releases/download/v{V}/SERTZ-v{V}.apk")
s = s.replace('const LATEST_VERSION = "1.4.28";', f'const LATEST_VERSION = "{V}";')
s = s.replace("const LATEST_CODE = 120;", f"const LATEST_CODE = {C};")
s = re.sub(r'const VERSION_NOTE = "v1\.4\.28 — 변경:[^"]*";', f'const VERSION_NOTE = "{NOTE}";', s, count=1)
p.write_text(s)

# 4) api/version/route.ts 게이트
p = ROOT / "src/app/api/version/route.ts"; s = p.read_text()
s = s.replace("releases/download/v1.4.28/SERTZ-v1.4.28.apk", f"releases/download/v{V}/SERTZ-v{V}.apk")
s = s.replace('const LATEST_VERSION = "1.4.28";', f'const LATEST_VERSION = "{V}";')
s = s.replace("const LATEST_CODE = 120;", f"const LATEST_CODE = {C};")
s = re.sub(r'const VERSION_NOTE =\s*\n?\s*"v1\.4\.28 — 변경:[^"]*";', f'const VERSION_NOTE =\n  "{NOTE}";', s, count=1)
s = s.replace("(1.4.28 기준)", f"({V} 기준)")
p.write_text(s)

print("승격 완료 — 검증:")
for f in ["package.json", "server.js", "src/app/api/version/route.ts"]:
    t = (ROOT / f).read_text()
    ok = V in t and str(C) in t
    print(f"  {f}: {'OK' if ok else '확인필요'}")
g = (ROOT / "android/app/build.gradle").read_text()
print(f"  build.gradle: {'OK' if f'versionCode {C}' in g and f'versionName \"{V}\"' in g else '확인필요'}")
print("NOTE 일관성:", "OK" if NOTE in (ROOT/"server.js").read_text() and NOTE in (ROOT/"src/app/api/version/route.ts").read_text() else "불일치!")
print("잔여 1.4.28(게이트):", [f for f in ["package.json","server.js","src/app/api/version/route.ts"] if "1.4.28" in (ROOT/f).read_text()])
