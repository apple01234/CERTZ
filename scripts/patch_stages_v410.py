#!/usr/bin/env python3
# v4.1.0 — stages.ts 일괄 패치
#  1) 스토리 hunt 퀘스트 목표 마릿수 ×2.5 (올림), desc 내 동일 수치 동기 갱신
#  2) 반복 의뢰 need ×2
#  3) 이세카이 게이트/옷장 던전 → 바르가 수비전/균열 던전 (저작권 안전화)
import re, sys

P = "src/game/stages.ts"
s = open(P, encoding="utf-8").read()
orig = s

def up_need(n: int) -> int:
    return int(-(-n * 5 // 12)) if False else int(-(-n * 25 // 10))  # ceil(n*2.5)

# ---------- 1) hunt 퀘스트 라인 ----------
def patch_hunt(m):
    line = m.group(0)
    nm = re.search(r"need: (\d+)", line)
    if not nm:
        return line
    old = int(nm.group(1))
    new = up_need(old)
    line = line.replace(f"need: {old}", f"need: {new}", 1)
    # desc/title 속 동일 수치(마리/기) 동기화
    line = re.sub(rf"(\b){old}(마리|기)", rf"\g<1>{new}\g<2>", line)
    return line

# hunt 퀘스트 객체 라인만 (type: "hunt" 포함 라인)
s = re.sub(r'^.*type: "hunt".*$', patch_hunt, s, flags=re.M)

# ---------- 2) repeat 의뢰 need ×2 ----------
def patch_repeat(m):
    line = m.group(0)
    nm = re.search(r"need: (\d+)", line)
    if not nm:
        return line
    old = int(nm.group(1))
    new = old * 2
    line = line.replace(f"need: {old}", f"need: {new}", 1)
    line = re.sub(rf"(\b){old}(마리|기)", rf"\g<1>{new}\g<2>", line)
    return line

s = re.sub(r"^.*repeat: \{ need: \d+.*$", patch_repeat, s, flags=re.M)

# ---------- 3) 이세카이 → 바르가 (표기 문자열) ----------
REN = [
    ("이세카이 게이트 = 웨이브 디펜스", "바르가 수비전 = 웨이브 디펜스"),
    ("ISEKAI GATE(이세카이 게이트) 오마주 — 옷장 게이트를 몰려오는 몬스터 웨이브에서 지킨다.",
     "세계수 뿌리의 균열(바르가)을 몰려오는 몬스터 웨이브에서 지킨다."),
    ("ISEKAI GATE의 옷장 던전 오마주 — 60초 동안 몬스터가 계속 쏟아지는 파밍 전용 구역.",
     "균열 속 60초 동안 몬스터가 계속 쏟아지는 파밍 전용 구역."),
    ('name: "이세카이 게이트",', 'name: "바르가 수비전",'),
    ('subtitle: "우리 집 옷장이 차원의 문이 되었다 — 웨이브를 막아라!",',
     'subtitle: "세계수 뿌리의 균열이 열렸다 — 웨이브를 막아라!",'),
    ('STAGE_SHORT.gate = "이세카이 게이트";', 'STAGE_SHORT.gate = "바르가 수비전";'),
    ('name: "옷장 던전",', 'name: "균열 던전",'),
    ('STAGE_SHORT.closet = "옷장 던전";', 'STAGE_SHORT.closet = "균열 던전";'),
    ("/* ================= v4.0.0 — 이세카이 게이트 (웨이브 디펜스 특별 구역) =================",
     "/* ================= v4.0.0 — 바르가 수비전 (웨이브 디펜스 특별 구역) ================="),
    ("/* ================= v4.0.0 — 옷장 던전 (골드/경험치책 파밍 던전) =================",
     "/* ================= v4.0.0 — 균열 던전 (골드/경험치책 파밍 던전) ================="),
    ("v4.0.0 — 이세카이 업데이트: 게이트 디펜스/옷장 던전/혜택 시스템",
     "v4.0.0 — 바르가 업데이트: 수비전/균열 던전/혜택 시스템"),
]
for a, b in REN:
    s = s.replace(a, b)

open(P, "w", encoding="utf-8").write(s)
print(f"patched {P}: {len(orig) - len(s)} bytes diff")
# 결과 요약 출력
import subprocess
print(subprocess.run(["grep", "-n", 'type: "hunt"', P], capture_output=True, text=True).stdout[:600])
