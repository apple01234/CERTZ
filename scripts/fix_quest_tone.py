#!/usr/bin/env python3
"""v3.0.23 (#57) — 퀘스트 설명문 획일적 '~하자' 어미를 게임 톤으로 교체.
매번 같은 '~하자' 종결은 AI 생성 느낌의 근원. 목적어/동사에 맞춰
명령형(~해라/~처치/~회수)과 경고체(~한다)로 다변화한다. 문자열 치환은 전부 명시적 목록."""
import re

P = "/home/z/my-project/src/game/stages.ts"
src = open(P, encoding="utf-8").read()

PAIRS = [
    ("처치하자.", "처치해라."),
    ("처치하자!", "처치해라!"),
    ("사냥하자.", "사냥해라."),
    ("격파하자.", "격파해라."),
    ("회수하자.", "회수해라."),
    ("베어 내자!", "베어 내라!"),
    ("부숴 버리자.", "부숴 버려라."),
    ("열자!", "열어라!"),
    ("정지시키자.", "정지시켜라."),
    ("소탕하자", "소탕해라"),
    ("찾아 주워 보자.", "찾아 주워라."),
    ("되찾자.", "되찾아라."),
    ("바치자.", "바쳐라."),
    ("챙기자", "챙겨라"),
    ("이동하자.", "이동해라."),
    ("도착하자.", "도착해라."),
    ("훈련하자.", "훈련해라."),
    ("준비를 하자!", "준비를 마쳐라!"),
    ("정리", "정리"),  # no-op 안전 항목
]

n = 0
for a, b in PAIRS:
    if a == b:
        continue
    c = src.count(a)
    if c:
        src = src.replace(a, b)
        n += c
open(P, "w", encoding="utf-8").write(src)
print(f"replaced {n} segments")

# 잔여 '하자' 확인
rest = [m.group(0) for m in re.finditer(r"[^\"]*하자[.!?]?[^\"]*", open(P, encoding="utf-8").read())]
for r in rest[:12]:
    print("REST:", r)
