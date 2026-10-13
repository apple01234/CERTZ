#!/usr/bin/env python3
# vc146 — 정식 릴리스(1.0.6) 버전 게이트 일괄 갱신
#  server.js · src/app/api/version/route.ts · next.config.ts · public/apk-guide.html
import re, io, sys

ROOT = "/home/z/my-project"

NOTE = ("v1.0.6 (vc146) — 첫 정식 릴리스(베타 접미사 제거) · 피드백 10종 반영: "
        "①[GM] 완전 엘릭서 무한 사용(소모 버그 근본 수리 — 퀵슬롯/자동물약/인벤 전 경로) "
        "②5차 제2궁극기 신설(12종 전용 연출·쿨타임 120초·MP150 — Q키/보라 버튼) "
        "③툰 셰이더 밝기 대폭 하향(감광 22% — 툰 감성 유지) "
        "④정식 빌드 전환(1.0.6) "
        "⑤2.5D 카메라(시점 상승+y-depth 정렬+심도 안개·설정 토글) "
        "⑥무릉도장 실시간 피해량(누적·DPS·최고 일격 화면 표시) "
        "⑦우측 구석 유령 이펙트 근본 수리(3D 오버레이 카메라 보정 누락 수정) "
        "⑧챕터 레벨 제한 상향(쿠소디아 12→세계수 뿌리 126) "
        "⑨거래소 전품목 확대(엘릭서·장비 등 GM전용 제외 전체 등록 가능) "
        "⑩크래시 안정화(3D 오버레이 그리기 버퍼 매프레임 재할당 제거 — GPU 메모리 churn 차단)")

def patch(path, subs, must=True):
    try:
        s = io.open(f"{ROOT}/{path}", encoding="utf-8").read()
    except FileNotFoundError:
        print(f"[skip] {path} 없음"); return
    orig = s
    for a, b in subs:
        if a not in s:
            if must:
                print(f"[WARN] {path}: 패턴 미발견 — {a[:60]}...")
            continue
        s = s.replace(a, b)
    if s != orig:
        io.open(f"{ROOT}/{path}", "w", encoding="utf-8").write(s)
        print(f"[ok] {path}")
    else:
        print(f"[no-op] {path}")

# 1) server.js
patch("server.js", [
    ('const LATEST_VERSION = "1.0.5-beta";', 'const LATEST_VERSION = "1.0.6";'),
    ("const LATEST_CODE = 145;", "const LATEST_CODE = 146;"),
    ('"https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-vc145.apk";',
     '"https://github.com/apple01234/CERTZ/releases/download/v1.0.6/SERTZ-vc146.apk";'),
])

# server.js VERSION_NOTE는 길이가 길어 정규식으로 통째 교체
s = io.open(f"{ROOT}/server.js", encoding="utf-8").read()
s = re.sub(r'const VERSION_NOTE =\n  "[^"]*";', f'const VERSION_NOTE =\n  "{NOTE}";', s, count=1)
io.open(f"{ROOT}/server.js", "w", encoding="utf-8").write(s)
print("[ok] server.js NOTE")

# 2) route.ts
patch("src/app/api/version/route.ts", [
    ('const LATEST_VERSION = "1.0.5-beta";', 'const LATEST_VERSION = "1.0.6";'),
    ("const LATEST_CODE = 145;", "const LATEST_CODE = 146;"),
    ('"https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-vc144.apk";',
     '"https://github.com/apple01234/CERTZ/releases/download/v1.0.6/SERTZ-vc146.apk";'),
])
s = io.open(f"{ROOT}/src/app/api/version/route.ts", encoding="utf-8").read()
s = re.sub(r'const VERSION_NOTE =\n  "[^"]*";', f'const VERSION_NOTE =\n  "{NOTE}";', s, count=1)
io.open(f"{ROOT}/src/app/api/version/route.ts", "w", encoding="utf-8").write(s)
print("[ok] route.ts NOTE")

# 3) next.config.ts
patch("next.config.ts", [
    ('"https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-vc145.apk";',
     '"https://github.com/apple01234/CERTZ/releases/download/v1.0.6/SERTZ-vc146.apk";'),
])

# 4) apk-guide.html — 버전 표기·링크 전부 1.0.6/vc146
patch("public/apk-guide.html", [
    ("SERTZ v1.0.5-beta APK 다운로드 안내", "SERTZ v1.0.6 APK 다운로드 안내"),
    ("이번 버전(v1.0.5-beta · vc145) — \"피드백 16종 반영\"", "이번 버전(v1.0.6 · vc146) — \"첫 정식 릴리스 · 피드백 10종\""),
    ("releases/download/v1.0.5-beta/SERTZ-vc145.apk", "releases/download/v1.0.6/SERTZ-vc146.apk"),
    ("SERTZ v1.0.5-beta APK 바로 다운로드", "SERTZ v1.0.6 APK 바로 다운로드"),
    ("releases/tag/v1.0.5-beta", "releases/tag/v1.0.6"),
    ("SERTZ v1.0.5-beta 릴리스 페이지", "SERTZ v1.0.6 릴리스 페이지"),
    ("<code>SERTZ-vc145.apk</code>", "<code>SERTZ-vc146.apk</code>"),
])
print("done")
