#!/usr/bin/env python3
"""ground_slate / ground_ash 재생성 — 회색 노이즈 → 진짜 돌바닥 (지시 #1·#3).

[문제]
`ground_slate`·`ground_ash` 는 96×96 이지만 **100% 순수 회색조**이고
색이 75~95단계로 흩어진 Perlin 노이즈를 3배 확대한 것이다. 돌의 경계·줄눈·하이라이트가
없어서, 맵에 깔면 "바닥"이 아니라 **회색 노이즈/정전기**로 보인다.
이 두 텍스처가 `tile_dark`·`tile_stone`·`tile_path_dark`·`tile_basalt`·`tile_ash` 의
기본값이라 어두운 스테이지(동굴·폐허·용암) 대부분이 노이즈 바닥이 된다.

[해결]
이미 품질이 검증된 `ground_violet` 의 **픽셀 구조(돌 모양·줄눈·하이라이트 위치)를 그대로**
쓰고 색 팔레트만 바꾼다. 구조를 새로 그리면 톤이 어긋나고 검증도 불가능하다.
- ground_slate  → 차가운 청회색 석재 (동굴·폐허·던전)
- ground_ash    → 따뜻한 잿빛 현무암 (용암 지대·잿빛 평원)

[왜 팔레트 매핑인가]
ground_violet 은 정확히 5색으로 양자화돼 있다(밝은 돌 / 중간 / 하이라이트 / 그늘 / 틈).
각 색의 **역할이 고정**이므로, 역할별로 목표 색을 지정하면 명암 규칙(좌상단 광원)이 보존된다.

사용: python3 scripts/make_stone_floors.py
"""
from PIL import Image
from collections import Counter
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public/assets/ground/ground_violet.png")
MANIFEST = os.path.join(ROOT, "public/assets/ground/manifest.json")

# ground_violet 팔레트의 **역할** (밝기 순 = 돌 상면 → 하이라이트 → 그늘 → 틈)
# 실제 색은 파일에서 읽어 밝기순으로 정렬해 매핑한다(팩이 바뀌어도 견고).
#   순서: [가장 밝은 돌면, 중간 돌면, 하이라이트, 그늘, 틈]
#
# [대비 주의] 처음엔 목표색을 너무 벌려 잡아 이웃픽셀 차이가 원본(7.62)보다 커졌다(11.9).
#  그러면 돌이 "조각조각 튀는" 인상이 되어 오히려 노이즈처럼 보인다.
#  원본의 명도 간격 비율을 유지하는 쪽이 자연스러우므로, 밝기 단계를 촘촘히 잡는다.
TARGETS = {
    # 차가운 청회색 석재 — 동굴/폐허/던전 바닥 (원본 명도 간격 유지)
    "ground_slate": ["#78828f", "#5f6775", "#9aa6b6", "#4a5260", "#3a414d"],
    # 따뜻한 잿빛 현무암 — 용암/잿빛 지대
    "ground_ash": ["#847a71", "#6a6059", "#a3988d", "#544c46", "#423b36"],
}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def main():
    src = Image.open(SRC).convert("RGB")
    counts = Counter(src.getdata())
    print(f"원본 {SRC}: {src.size}, {len(counts)}색")

    # 밝기 순 정렬 → 역할 배정 (밝은 것부터)
    palette = [c for c, _ in counts.most_common()]
    palette.sort(key=lambda c: -(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]))
    if len(palette) != 5:
        raise SystemExit(f"예상 5색인데 {len(palette)}색 — 팔레트 가정이 깨졌다. 매핑을 확인하라.")

    manifest = {}
    if os.path.exists(MANIFEST):
        manifest = json.load(open(MANIFEST, encoding="utf-8"))

    for name, targets in TARGETS.items():
        if len(targets) != len(palette):
            raise SystemExit(f"{name}: 목표색 {len(targets)}개 != 팔레트 {len(palette)}개")
        mapping = {palette[i]: hex_rgb(targets[i]) for i in range(len(palette))}

        out = Image.new("RGB", src.size)
        out.putdata([mapping.get(p, p) for p in src.getdata()])
        dst = os.path.join(ROOT, f"public/assets/ground/{name}.png")
        out.save(dst)

        # 검증: 순수 회색조가 아니어야 하고(색조 존재), 색 수가 5여야 한다
        oc = Counter(out.getdata())
        gray = sum(v for p, v in oc.items() if p[0] == p[1] == p[2])
        print(f"{name}: {len(oc)}색, 순수회색 {gray}px → {dst}")
        if len(oc) != 5:
            raise SystemExit(f"{name}: 색이 {len(oc)}개 — 매핑 실패")
        if gray == src.width * src.height:
            raise SystemExit(f"{name}: 여전히 회색조 — 목표색이 무채색이다")

        # vc252 — 반복 티 감소용 변형 3종 (회전·반전). 같은 팔레트를 그대로 써서 톤 일관성 유지.
        #  [왜] 96×96 단일 타일을 넓게 깔면 특징적인 돌 배치가 96px 주기로 반복돼 눈에 띈다.
        #   회전/반전만으로도 주기가 4배 늘고, 팔레트가 같아 이음새 톤이 변하지 않는다.
        #
        #  [포맷] Phaser 타일셋은 **한 이미지 안의 프레임**만 쓸 수 있다.
        #   → 4변형을 세로로 이어 붙인 아틀라스(96×384)를 만들고, 프레임 인덱스로 고른다.
        #   개별 PNG 도 남겨 두면 미리보기·디버깅에 쓸 수 있다.
        variants = [out,
                    out.transpose(Image.FLIP_LEFT_RIGHT),
                    out.transpose(Image.FLIP_TOP_BOTTOM),
                    out.transpose(Image.ROTATE_180)]
        for suffix, vimg in zip(["b", "c", "d"], variants[1:]):
            vimg.save(os.path.join(ROOT, f"public/assets/ground/{name}_{suffix}.png"))
        atlas = Image.new("RGB", (out.width, out.height * len(variants)))
        for i, vimg in enumerate(variants):
            atlas.paste(vimg, (0, i * out.height))
        atlas.save(os.path.join(ROOT, f"public/assets/ground/{name}_atlas.png"))
        print(f"  변형 아틀라스: {name}_atlas.png ({atlas.width}×{atlas.height}, 4프레임)")
        manifest[name] = {
            "source": f"public/assets/ground/ground_violet.png",
            "generatedBy": "scripts/make_stone_floors.py",
            "note": "ground_violet 의 돌 구조(줄눈·하이라이트)를 유지하고 팔레트만 석재로 변환",
            "width": out.width,
            "height": out.height,
            "pack": "SERTZ (generated)",
            "license": "CC0-1.0",
        }

    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"manifest 갱신: {MANIFEST}")


if __name__ == "__main__":
    main()
