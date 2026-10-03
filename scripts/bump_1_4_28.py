#!/usr/bin/env python3
# bump_1_4_28.py — v1.4.28/vc120 버전 승격 4종 (package.json·build.gradle·server.js·api/version)
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project")
V, C = "1.4.28", 120
NOTE = ("v1.4.28 — 변경: ①채팅 입력·전송 버튼이 NPC 대화창에 가려져 탭이 대화 진행으로 먹히던 문제 수정(입력행 z-40 상승) "
        "②세로 좁은 화면 물약·자동 버튼을 공격 버튼 바로 왼쪽으로 재배치(~270px → 83px — v1.4.25 가로 화면 픽스와 동일 위상) "
        "③v1.4.27 포함: 채팅·파티 부활(릴레이 폴링)·발신자명 픽스 · APK: GitHub 릴리스 v1.4.28")
URL = f"https://github.com/apple01234/CERTZ/releases/download/v{V}/SERTZ-v{V}.apk"
GNote = ("v1.4.28 (vc120) — 채팅 입력·전송 버튼 대화창 가림 픽스(z-40) + 세로 좁은 화면 물약·자동 버튼 공격 버튼 우측 앵커 재배치(~270px→83px)")

# 1) package.json
p = ROOT / "package.json"; s = p.read_text()
s = s.replace('"version": "1.4.27"', f'"version": "{V}"')
p.write_text(s)

# 2) build.gradle — versionCode/Name + 주석 프리펜드
p = ROOT / "android/app/build.gradle"; s = p.read_text()
s = s.replace("versionCode 119", f"versionCode {C}")
s = s.replace('versionName "1.4.27"', f'versionName "{V}"')
s = re.sub(r'/\* v1\.4\.27 \(vc119\)', "/* " + GNote + " */ /* v1.4.27 (vc119)", s, count=1)
p.write_text(s)

# 3) server.js 게이트
p = ROOT / "server.js"; s = p.read_text()
s = s.replace("releases/download/v1.4.27/SERTZ-v1.4.27.apk", f"releases/download/v{V}/SERTZ-v{V}.apk")
s = s.replace('const LATEST_VERSION = "1.4.27";', f'const LATEST_VERSION = "{V}";')
s = s.replace("const LATEST_CODE = 119;", f"const LATEST_CODE = {C};")
s = re.sub(r'const VERSION_NOTE = "v1\.4\.27 — 변경:[^"]*";', f'const VERSION_NOTE = "{NOTE}";', s, count=1)
p.write_text(s)

# 4) api/version/route.ts 게이트
p = ROOT / "src/app/api/version/route.ts"; s = p.read_text()
s = s.replace("releases/download/v1.4.27/SERTZ-v1.4.27.apk", f"releases/download/v{V}/SERTZ-v{V}.apk")
s = s.replace('const LATEST_VERSION = "1.4.27";', f'const LATEST_VERSION = "{V}";')
s = s.replace("const LATEST_CODE = 119;", f"const LATEST_CODE = {C};")
s = re.sub(r'const VERSION_NOTE =\s*\n?\s*"v1\.4\.27 — 변경:[^"]*";', f'const VERSION_NOTE =\n  "{NOTE}";', s, count=1)
s = s.replace("(v1.4.27 기준)", f"({V} 기준)")
p.write_text(s)

print("승격 완료 — 검증:")
for f in ["package.json", "server.js", "src/app/api/version/route.ts"]:
    t = (ROOT / f).read_text()
    ok = V in t and str(C) in t and "v1.4.27" not in re.sub(r"v1\.4\.27 포함|/\* v1\.4\.27|v1\.4\.27 \(vc119\)", "", t)
    print(f"  {f}: {'OK' if V in t and str(C) in t else '확인필요'}")
g = (ROOT / "android/app/build.gradle").read_text()
print(f"  build.gradle: {'OK' if f'versionCode {C}' in g and f'versionName \"{V}\"' in g else '확인필요'}")
print("NOTE 일관성:", "OK" if NOTE in (ROOT/"server.js").read_text() and NOTE in (ROOT/"src/app/api/version/route.ts").read_text() else "불일치!")
