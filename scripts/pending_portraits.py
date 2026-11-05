#!/usr/bin/env python3
"""남은 초상화 생성 — portrait_specs.json 의 아직 없는 항목을 Higgsfield 로 만든다.

[호출 방식]
  Higgsfield MCP 는 에이전트 도구라 스크립트에서 직접 못 부른다. 대신 이 스크립트가
  **프롬프트 목록**을 출력하고, 에이전트가 생성한 URL 을 manifest.json 에 채우면
  `finish_portraits.py` 가 픽셀화·저장·매핑을 처리한다. (역할 분리)

사용:
  python3 scripts/pending_portraits.py            # 남은 목록 + 완성 프롬프트 출력
  python3 scripts/pending_portraits.py --json     # 기계용 JSON
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS = os.path.join(ROOT, "scripts/portrait_specs.json")
OUT = os.path.join(ROOT, "public/assets/npcportrait")
MANIFEST = "/root/.hermes/cache/scratch/portraits/manifest.json"

# [vc259 — 유저 지시 "Npc들이 너무 서양 그림체임 (일본 애니 그림체(동양풍) ㄱㄱ)"]
# 종전 프롬프트는 "anime style" 한 단어뿐이라 모델이 서양풍 반실사로 갔다.
# 일본 작화의 **구체적 특징**을 나열해야 그쪽으로 붙는다(얼굴 비율·눈·코·입).
# negative 는 soul_2 가 지원하지 않으므로 프롬프트 안에서 강하게 배제한다.
STYLE_PREFIX = (
    "16-bit SNES JRPG pixel art character portrait, bust shot, "
    "JAPANESE ANIME manga illustration style, Japanese cel-shaded anime face, "
    "large expressive anime eyes with white highlight, thin small nose line, tiny mouth, "
    "pointed chin, soft anime facial proportions, Japanese RPG character design "
    "like Fire Emblem and Tales of series, NOT western realistic, NOT oil painting, "
    "NOT photorealistic, NOT 3d render,"
)
STYLE_SUFFIX = "clean pixel edges, limited palette, dark navy background, centered, no text, no watermark"


def full_prompt(p):
    return f"{STYLE_PREFIX} {p}, {STYLE_SUFFIX}"


def main():
    specs = json.load(open(SPECS, encoding="utf-8"))["characters"]
    man = {}
    try:
        man = json.load(open(MANIFEST, encoding="utf-8"))
    except Exception:
        pass

    pending = []
    for c in sorted(specs, key=lambda x: x.get("priority", 9)):
        key = c["key"]
        if os.path.exists(os.path.join(OUT, f"npc_{key}.png")):
            continue
        item = man.get(key)
        has_url = isinstance(item, dict) and item.get("url") and not str(item["url"]).startswith("local://")
        if has_url:
            continue          # URL 은 있으나 PNG 없음 → finish_portraits.py 담당
        pending.append({
            "key": key, "name": c.get("name"), "priority": c.get("priority", 9),
            "prompt": full_prompt(c["prompt"]), "mapped_as": c.get("mapped_as", []),
        })

    if "--json" in sys.argv:
        print(json.dumps(pending, ensure_ascii=False, indent=2))
        return

    print(f"남은 인물 {len(pending)}명\n")
    for p in pending:
        print(f"[{p['key']}] {p['name']} (priority {p['priority']})")
        print(f"  {p['prompt']}\n")


if __name__ == "__main__":
    main()
