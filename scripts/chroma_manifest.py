#!/usr/bin/env python3
"""초상화 재생성 매니페스트 — 크로마키(마젠타) 배경용.

[방식 확정]
  남색 그라데이션 배경 + 남색 옷 → 색 분리 불가(3회 실패).
  생성 단계에서 **순수 마젠타 #FF00FF** 배경을 요구하고, 그 색만 지운다.
  검증: lilac 1장에서 마젠타 44.9% 제거 · 잔여 0픽셀 · 모서리 알파 0/0/0/0.

  프롬프트 = portrait_style.STYLE_CORE + 캐릭터 묘사 + CHROMA_TAIL

사용:
  python3 scripts/chroma_manifest.py            # 사람이 읽는 목록
  python3 scripts/chroma_manifest.py --json     # 기계용(순차 생성에 사용)
  python3 scripts/chroma_manifest.py --sheet    # 캐릭터 묘사만 나열
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from portrait_style import STYLE_CORE  # noqa: E402

SPECS = os.path.join(ROOT, "scripts/portrait_specs.json")

# 크로마키 꼬리 — 마젠타를 강하게 요구하고 배경 디테일을 금지한다
CHROMA_TAIL = (
    "pure solid magenta #FF00FF chroma key background, "
    "flat pure magenta background filling every pixel behind the character, "
    "no background details, no gradient background, no vignette, "
    "no text, no watermark, no signature"
)


def build(subject: str) -> str:
    return f"{STYLE_CORE}, {subject}, bust shot, three-quarter view, centered composition, {CHROMA_TAIL}"


def main():
    d = json.load(open(SPECS, encoding="utf-8"))
    chars = sorted(d["characters"], key=lambda c: c.get("priority", 9))

    if "--json" in sys.argv:
        print(json.dumps(
            [{"key": c["key"], "name": c.get("name"), "prompt": build(c["prompt"]),
              "mapped_as": c.get("mapped_as", [])} for c in chars],
            ensure_ascii=False, indent=2))
        return

    if "--sheet" in sys.argv:
        for c in chars:
            print(f"{c['key']}\t{c.get('name')}\t{c['prompt']}")
        return

    print(f"초상화 {len(chars)}명 — 크로마키(마젠타) 배경\n")
    for c in chars:
        print(f"[{c['key']}] {c.get('name')} (priority {c.get('priority')})")
        print(f"  {c['prompt']}\n")


if __name__ == "__main__":
    main()
