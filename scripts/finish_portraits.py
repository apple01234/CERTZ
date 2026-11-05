#!/usr/bin/env python3
"""남은 초상화 마무리 — manifest 의 URL 을 파이프라인에 넣는다.

[상황] 서브에이전트가 배치 완료 기록 전에 종료됐다. 디스크에는
  · 9개 초상화(np_*.png) 완성
  · manifest.json 에 13개 URL(추가 5개는 생성만 되고 아직 pixelize 안 됨)
가 남아 있었다. 이 스크립트로 나머지를 마저 처리한다.

사용: python3 scripts/finish_portraits.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS = os.path.join(ROOT, "scripts/portrait_specs.json")
MANIFEST = "/root/.hermes/cache/scratch/portraits/manifest.json"
OUT = os.path.join(ROOT, "public/assets/npcportrait")


def main():
    specs = json.load(open(SPECS, encoding="utf-8"))["characters"]
    by_key = {c["key"]: c for c in specs}
    man = json.load(open(MANIFEST, encoding="utf-8"))

    # 이미 만들어진 것 제외
    todo = []
    for key, item in man.items():
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not url or url.startswith("local://"):
            continue
        if os.path.exists(os.path.join(OUT, f"npc_{key}.png")):
            continue
        if key not in by_key:
            continue
        todo.append((key, url, by_key[key].get("mapped_as", [])))

    print(f"처리 대상 {len(todo)}개: {[t[0] for t in todo]}")
    if not todo:
        return

    # build_portraits.py 형식의 임시 매니페스트
    tmp = "/tmp/portrait_todo.json"
    json.dump({k: {"url": u, "mapped_as": m} for k, u, m in todo},
              open(tmp, "w"), ensure_ascii=False, indent=2)

    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/build_portraits.py"),
                        "--manifest", tmp], cwd=ROOT, capture_output=True, text=True)
    print(r.stdout[-1500:])
    if r.returncode != 0:
        print("STDERR:", r.stderr[-800:])


if __name__ == "__main__":
    main()
