#!/usr/bin/env python3
# v4.1.0 — 표기 문자열 전체 변경 (유저 지시 #15 독창적 이름 + #7 저작권 안전화)
#  이세카이(게이트) → 바르가(수비전), 옷장 던전 → 균열 던전
import re

FILES = [
    "src/game/isekai.ts",
    "src/components/game/Panels.tsx",
    "src/components/game/Overlays.tsx",
    "src/game/scenes/WorldScene.ts",
    "multiplayer/index.js",
    "src/components/game/EventBus.ts",
]

# 순서 중요 — 긴 문장 먼저
REN = [
    # 헤더 주석 — 참조 게임 언급 제거 (저작권 안전화)
    (' * v4.0.0 "이세카이 업데이트" — ISEKAI GATE(이세카이 게이트) 오마주 시스템',
     ' * v4.0.0 "바르가 업데이트" — 균열 수비전 + 수집형 성장 시스템'),
    (' *  - 어썸피스의 인기 모바일 게임 "이세카이 게이트"(옷장이 이세카이로 통하는 문,',
     ' *  - 세계수 뿌리에서 열리는 균열(바르가)을 방어하는 웨이브 디펜스,'),
    (' *    피규어 가챠·배지·룬·성좌 등을 한곳에 모은 통합 시스템 */',
     ' *    피규어 가챠·배지·룬·성좌 등을 한곳에 모은 통합 시스템 */'),
    (' *  ISEKAI GATE(이세카이 게이트) 오마주 수집형 성장 시스템 통합 패널 */',
     ' *  바르가 수집형 성장 시스템 통합 패널 */'),
    (' *  ISEKAI GATE 오마주: 웨이브 클리어마다 3성 카드 선택 + 실버 상점 + 상단 게이트 HUD */',
     ' *  웨이브 클리어마다 3성 카드 선택 + 실버 상점 + 상단 수비전 HUD */'),
    # 본문 표기
    ("이세카이 게이트", "바르가 수비전"),
    ("이세카이 허브", "바르가 원정대"),
    ("이세카이 콘텐츠", "바르가 콘텐츠"),
    ("이세카이 업데이트", "바르가 업데이트"),
    ("이세카이 수호자", "바르가 수호자"),
    ("이세카이의 축복", "바르가의 축복"),
    ("이세카이 스킨", "차원 여행자 스킨"),
    ("옷장 게이트", "균열 문"),
    ("옷장 던전", "균열 던전"),
    ("옷장 탐험가", "균열 탐험가"),
    ("옷장 파밍꾼", "균열 파밍꾼"),
    ("옷장 게이트 방어", "균열 문 방어"),
]

for f in FILES:
    s = open(f, encoding="utf-8").read()
    o = s
    for a, b in REN:
        s = s.replace(a, b)
    if s != o:
        open(f, "w", encoding="utf-8").write(s)
        print(f"patched: {f}")
    else:
        print(f"no change: {f}")

# 잔여 표기 확인
import subprocess
r = subprocess.run(["grep", "-rn", "이세카이\\|옷장"] + FILES[:-1], capture_output=True, text=True)
print("--- 잔여 ---")
print(r.stdout or "(없음)")
