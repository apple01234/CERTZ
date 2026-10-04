#!/usr/bin/env python3
# bump_1_0_1_beta.py — v1.0.1-beta/vc122 버전 승격 4종 (결제·광고 실연동)
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project")
V, C = "1.0.1-beta", 122
NOTE = ("v1.0.1-beta — 결제·광고 실연동: ①구글 플레이 인앱 결제(에메랄드 충전 4종·현금 패키지 3종) 소비(consume) 흐름 확정 — "
        "재구매 차단 버그 픽스 ②결제 성공 직후 종료 시 미지급 결제 부팅 자동 복구(이중 지급 차단) "
        "③충전소에 Play 등록 실가격 표시 ④AdMob 보상형 광고 실연동(AD_ID 권한 복원 — v1.4.3 잔재 제거) · "
        "콘솔 상품 등록 가이드: download/결제_광고_연동_가이드.txt")
URL = f"https://github.com/apple01234/CERTZ/releases/download/v{V}/SERTZ-v{V}.apk"
GNote = ("v1.0.1-beta (vc122) — 결제·광고 실연동(Play Billing 소비 흐름+부팅 복구+실가격 UI / AdMob 보상형+AD_ID 복원) — 재구매 차단 버그 픽스")

# 1) package.json
p = ROOT / "package.json"; s = p.read_text()
s = s.replace('"version": "1.0.0-beta"', f'"version": "{V}"')
p.write_text(s)

# 2) build.gradle — versionCode/Name + 주석 프리펜드
p = ROOT / "android/app/build.gradle"; s = p.read_text()
s = s.replace("versionCode 121", f"versionCode {C}")
s = s.replace('versionName "1.0.0-beta"', f'versionName "{V}"')
s = re.sub(r'/\* v1\.0\.0-beta \(vc121\)', "/* " + GNote + " */ /* v1.0.0-beta (vc121)", s, count=1)
p.write_text(s)

# 3) server.js 게이트
p = ROOT / "server.js"; s = p.read_text()
s = s.replace("releases/download/v1.0.0-beta/SERTZ-v1.0.0-beta.apk", f"releases/download/v{V}/SERTZ-v{V}.apk")
s = s.replace('const LATEST_VERSION = "1.0.0-beta";', f'const LATEST_VERSION = "{V}";')
s = s.replace("const LATEST_CODE = 121;", f"const LATEST_CODE = {C};")
s = re.sub(r'const VERSION_NOTE = "v1\.0\.0-beta — [^"]*";', f'const VERSION_NOTE = "{NOTE}";', s, count=1)
p.write_text(s)

# 4) api/version/route.ts 게이트
p = ROOT / "src/app/api/version/route.ts"; s = p.read_text()
s = s.replace("releases/download/v1.0.0-beta/SERTZ-v1.0.0-beta.apk", f"releases/download/v{V}/SERTZ-v{V}.apk")
s = s.replace('const LATEST_VERSION = "1.0.0-beta";', f'const LATEST_VERSION = "{V}";')
s = s.replace("const LATEST_CODE = 121;", f"const LATEST_CODE = {C};")
s = re.sub(r'const VERSION_NOTE =\s*\n?\s*"v1\.0\.0-beta — [^"]*";', f'const VERSION_NOTE =\n  "{NOTE}";', s, count=1)
s = s.replace("(v1.0.0-beta 기준)", f"({V} 기준)")
p.write_text(s)

print("승격 완료 — 검증:")
for f in ["package.json", "server.js", "src/app/api/version/route.ts"]:
    t = (ROOT / f).read_text()
    print(f"  {f}: {'OK' if V in t and str(C) in t else '확인필요'}")
g = (ROOT / "android/app/build.gradle").read_text()
print(f"  build.gradle: {'OK' if f'versionCode {C}' in g and f'versionName \"{V}\"' in g else '확인필요'}")
print("NOTE 일관성:", "OK" if NOTE in (ROOT/"server.js").read_text() and NOTE in (ROOT/"src/app/api/version/route.ts").read_text() else "불일치!")
