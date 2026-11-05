#!/usr/bin/env python3
"""초상화 일괄 파이프라인 — 생성 결과 URL → 게임 규격 초상화.

[단계]
  1) 다운로드(2K 원본 보관)
  2) 배경 제거(가장자리 플러드필)
  3) 픽셀화(다운스케일 → 팔레트 양자화 → NEAREST 확대)
  4) public/assets/npcportrait/<key>.png 저장
  5) _map.json 항목 생성(기존 규격: src/source/crop/sha256)
  6) crop 에 얼굴 중심 좌표 기록

[왜 crop 이 필요한가]
  기존 `_map.json` 은 `crop: [x, y, w, h]` 를 갖는다. `npcportrait` 파일은
  이미 얼굴 크롭이지만(84×84), 대화창이 원본 좌표계를 참조하는 경로가 있어
  메타를 맞춰 둬야 기존 렌더 경로가 깨지지 않는다.

사용:
  python3 scripts/build_portraits.py --manifest portraits.json
  portraits.json: {"lilac": {"url": "...", "mapped_as": ["라일락"]}, ...}
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/assets/npcportrait")
RAW_DIR = os.path.join(ROOT, "public/assets/npcportrait/_raw")
SIZE = 84          # 게임 초상화 규격(기존 npcbody_*.png 와 동일)
DOTS = 84          # 양자화 목표 도트 (84 로 두면 1:1 = 도트 밀도 유지)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dst, "wb") as f:
        f.write(r.read())
    return dst


def face_crop_box(path, size):
    """알파 기준 바운딩박스를 얼굴 중심으로 잡는다.
    머리는 상단 60% 안에 있으므로, 상단부의 가로 중심을 얼굴 x 로 본다."""
    from PIL import Image
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    # 상단 10~55% 구간에서 불투명 픽셀의 가로 범위 → 얼굴 폭 추정
    xs = []
    for y in range(int(h * 0.10), int(h * 0.55)):
        for x in range(w):
            if px[x, y][3] > 128:
                xs.append(x)
    if not xs:
        return [0, 0, size, size]
    cx = (min(xs) + max(xs)) // 2
    fw = max(24, min(size, (max(xs) - min(xs)) + 8))
    x0 = max(0, min(w - fw, cx - fw // 2))
    y0 = max(0, min(h - fw, int(h * 0.08)))
    return [x0, y0, fw, fw]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True, help='{"key":{"url":..,"mapped_as":[..]}}')
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--no-local-diff", action="store_true",
                    help="국소 색차 플러드필을 끄고 기존 고정 허용오차 배경 제거를 쓴다")
    ap.add_argument("--keys", default=None,
                    help="쉼표로 구분한 key 목록만 처리(부분 재생성용)")
    ap.add_argument("--reuse-raw", action="store_true",
                    help="이미 받아둔 _raw 파일이 있으면 재다운로드하지 않는다")
    args = ap.parse_args()

    man = json.load(open(args.manifest, encoding="utf-8"))
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    # 기존 매핑 로드
    map_path = os.path.join(OUT_DIR, "_map.json")
    mapping = json.load(open(map_path, encoding="utf-8")) if os.path.exists(map_path) else {}

    results = []
    only = set(args.keys.split(",")) if args.keys else None
    for key, item in man.items():
        if key.startswith("_"):
            continue
        if only and key not in only:
            continue
        if not isinstance(item, dict) or not item.get("url"):
            continue
        dst = os.path.join(OUT_DIR, f"npc_{key}.png")
        if args.skip_existing and os.path.exists(dst):
            print(f"skip {key}")
            continue

        raw = os.path.join(RAW_DIR, f"npc_{key}_raw.png")
        if args.reuse_raw and os.path.exists(raw):
            print(f"reuse raw {key}")
        else:
            try:
                download(item["url"], raw)
            except Exception as e:
                print(f"FAIL download {key}: {e}")
                continue

        # 픽셀화 — 배경 제거 + 양자화
        # local-diff: 어두운 캐릭터(검은 갑옷)가 남색 배경과 붙는 경우 고정 허용오차로는
        # 갑옷에 구멍이 뚫린다. 국소 색차 플러드필이 그라데이션 배경을 안전하게 따라간다.
        try:
            cmd = [sys.executable, os.path.join(ROOT, "scripts/pixelize_portrait.py"),
                   raw, dst, "--size", str(SIZE), "--dots", str(DOTS), "--colors", "40",
                   "--min-speck", "10"]
            if not args.no_local_diff:
                cmd.append("--local-diff")
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print(f"FAIL pixelize {key}: {e.stderr[:200]}")
            continue

        crop = face_crop_box(dst, SIZE)
        entry = {
            "src": f"/assets/npcportrait/npc_{key}.png",
            "source": f"/assets/npcportrait/_raw/npc_{key}_raw.png",
            "crop": crop,
            "sha256": sha256(dst),
            "generated": "higgsfield/soul_2",
        }
        for alias in item.get("mapped_as", []):
            mapping[alias] = entry
        results.append((key, crop))

    json.dump(mapping, open(map_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n초상화 {len(results)}개 생성 · _map.json 항목 {len(mapping)}개")
    for k, c in results:
        print(f"  npc_{k}.png  crop={c}")


if __name__ == "__main__":
    main()
