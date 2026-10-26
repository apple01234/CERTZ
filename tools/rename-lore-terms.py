#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc191 (Phase 2 — 세계관 전면 개편) — 대사/문구의 세계관 용어를 기획서 기준으로 일괄 치환.

[원칙]
  · 사용자 지시: "저작권에 걸리는 명칭 빼고는 기획서대로 사용"
  · 기획서 라일락 월드 용어로 통일한다. 기존 북유럽 신화 고유명은 기획서의 왕국/가문명으로,
    시스템 개념(세계수→인피니트보석, 결정→보석의 조각)으로 옮긴다.
  · 대사 문장 구조는 건드리지 않고 **고유명사만** 바꾼다(호흡·말투 보존).
  · 실제 파일을 고치기 전에 남은 잔재를 보고하고, --apply 로만 기록한다.

사용: python3 tools/rename-lore-terms.py [--apply]
"""
import os
import re
import sys

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
APPLY = "--apply" in sys.argv

# 대상 파일 (게임 텍스트를 담는 곳)
TARGETS = [
    "src/game/data.ts",
    "src/game/stages.ts",
    "src/game/classes.ts",
    "src/game/villageThemes.ts",
    "src/game/isekai.ts",
    "src/game/fishing.ts",
    "src/game/gathering.ts",
    "src/components/game/Overlays.tsx",
    "src/components/game/Lobby.tsx",
    "src/components/game/Panels.tsx",
    "src/components/game/HUD.tsx",
    "src/components/game/DialogueBox.tsx",
]

# 순서 중요 — 긴 표현을 먼저 바꾼다(부분 치환 사고 방지)
#   vc191: '이그니'→'라일락' 이 '이그니션'(가문명)·'이그니스' 같은 단어까지 훼손하지 않도록
#   단어 경계 기반 치환을 쓴다. 아래 EXCLUDE 는 그 경우 보호할 토큰이다.
RULES: list[tuple[str, str]] = [
    # ── 시스템 개념 ──
    ("세계수 이그드라실", "인피니트보석"),
    ("이그드라실", "인피니트보석"),
    ("세계수의 뿌리", "무한의 탑 최심부"),
    ("세계수의 가호", "인피니트보석의 가호"),
    ("세계수의 숨결", "보석의 숨결"),
    ("세계수의 열매", "빛과 어둠의 마도서"),
    ("세계수", "인피니트보석"),
    ("룬 정령 이그니", "라일락"),
    ("이그니", "라일락"),
    ("아홉 왕국", "다섯 왕국"),
    ("9왕국", "5왕국"),
    # ── 지역/왕국 ──
    ("쿠소디아", "에스테반"),
    ("알프헤임", "에델리오나"),
    ("니플헤임", "클로체스"),
    ("무스펠헤임", "라바이즈"),
    ("스바르트알프헤임", "이안페우스"),
    ("니다벨리르", "크렌렐브"),
    ("미드가르드", "라일락 변경"),
    # ── 보스/존재 ──
    ("니드호그", "라시온"),
    ("아부디토스", "스칼렛"),
    ("종언의 마룡", "어둠의 군주"),
    ("사념체", "어둠의 피조물"),
    # ── 아이템/개념 ──
    ("결정의 조각", "보석의 조각"),
    ("결정의 흔적", "보석의 흔적"),
    ("빛의 결정", "빛의 조각"),
    # vc191 (Phase 2 마무리) - 기획서의 유물은 '인피니트보석' 하나다.
    #  '결정'은 이전 세계관의 잔재이므로 보석으로 통일한다.
    ("룬 펜던트", "펜던트"),
    ("일곱 결정", "빛과 어둠의 조각"),
    ("결정의 힘", "보석의 힘"),
    ("결정을", "보석을"),
    ("결정이", "보석이"),
    ("결정은", "보석은"),
    ("결정의", "보석의"),
    ("결정과", "보석과"),
    ("결정도", "보석도"),
    ("결정하게", "선택하게"),   # 동사 용례 — 명사 치환에서 보호
    ("결정해", "선택해"),
    ("결정한", "선택한"),
    ("결정", "보석"),
]

# 치환하면 안 되는 토큰 - 이게 붙어 있으면 건너뛴다
PROTECT = ["이그니션", "이그니스", "이그니카"]


def safe_replace(text: str, a: str, b: str) -> tuple[str, int]:
    """a 를 b 로 바꾸되, PROTECT 토큰의 일부는 건드리지 않는다.
    예: '이그니'→'라일락' 에서 '이그니션'은 보존."""
    if not any(p.startswith(a) or a in p for p in PROTECT):
        n = text.count(a)
        return text.replace(a, b), n
    # 보호 토큰을 임시 자리표시자로 빼두고 치환 → 복원
    tmp = text
    holders = []
    for i, p in enumerate(PROTECT):
        if a in p:
            token = f"\x00PROT{i}\x00"
            holders.append((token, p))
            tmp = tmp.replace(p, token)
    n = tmp.count(a)
    tmp = tmp.replace(a, b)
    for token, p in holders:
        tmp = tmp.replace(token, p)
    return tmp, n


def main():
    total = {}
    per_file = {}
    for rel in TARGETS:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        src = open(p, encoding="utf-8").read()
        out = src
        hits = {}
        for a, b in RULES:
            out, n = safe_replace(out, a, b)
            if n:
                hits[a] = n
        if hits:
            per_file[rel] = hits
            for k, v in hits.items():
                total[k] = total.get(k, 0) + v
            if APPLY and out != src:
                open(p, "w", encoding="utf-8").write(out)

    print(("적용" if APPLY else "예정") + f" — 파일 {len(per_file)}개")
    for rel, hits in per_file.items():
        print(f"  {rel}")
        for k, v in sorted(hits.items(), key=lambda x: -x[1]):
            print(f"     {k} → {dict(RULES)[k]}  ×{v}")
    print(f"총 치환 {sum(total.values())}건 / 규칙 {len(total)}종")
    if not APPLY:
        print("\n(미적용 — --apply 로 기록)")


if __name__ == "__main__":
    main()
