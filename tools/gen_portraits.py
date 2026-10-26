#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc187 (지시 #21) — NPC/화자 초상화를 FantasyHeroes 파츠 조합으로 생성.

진단(실측):
  NPC_PORTRAITS 39명이 전부 게임 스프라이트(spum_*/npc_*)를 그대로 확대해 쓰고 있었다.
  스프라이트는 48×64 도트라 56~80px 초상화 박스에 넣으면 뭉개지고 표정이 없다.
  사용자 요구: "대사창 네모 박스에 AI 이미지를 생성해서 넣어줘 (여캐는 모에화)".

  이 환경에는 이미지 생성 API 가 없다. 대신 제공 에셋
  assets_in/uni/HeroEditor4D/Common/Sprites/BodyParts 에
  얼굴 파츠(Body/Eyes/Eyebrows/Mouth/Hair/Beard/Ears)가 개별 PNG 로 1,837장 있다.
  이것을 **얼굴 영역만** 합성하면 초상화가 만들어진다 — 생성형 AI 없이도
  'AI 느낌의 일러스트'에 가까운 결과를 얻는다.

시트 규격(실측):
  Body 1440x800  → 3프레임(정면/측면/후면) x 480x800
  Hair 1440x640  → 3프레임 x 480x640 (얼굴 위에 얹힘)
  Eyes 384x128   → 3프레임 x 128x128
  Mouth 160x64   → 3프레임 x 53x64
  Eyebrows 도 동일 계열
좌표 정렬은 파츠마다 기준점이 달라 **시트 전체를 프레임 단위로 합성한 뒤
얼굴 bbox 만 잘라** 확대한다. 이렇게 하면 파츠별 오프셋을 몰라도 정렬이 맞는다.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
PARTS = "/root/workspace/assets_in/uni/HeroEditor4D/Common/Sprites/BodyParts"
OUT = os.path.join(ROOT, "public", "assets", "portrait")

# 시트 프레임 규격 (실측) — 정면 프레임만 쓴다
BODY_FRAME = (480, 800)
HAIR_FRAME = (480, 640)
EYES_FRAME = (128, 128)
MOUTH_FRAME = (53, 64)
BROW_FRAME = (128, 128)


def load(part: str, name: str, sub: str = "Basic") -> Image.Image | None:
    p = os.path.join(PARTS, part, sub, f"{name}.png")
    if not os.path.exists(p):
        return None
    return Image.open(p).convert("RGBA")


def front(sheet: Image.Image, fw: int, fh: int) -> Image.Image:
    """시트에서 정면(0번) 프레임을 잘라낸다."""
    return sheet.crop((0, 0, fw, fh))


def tint_skin(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Body 시트의 피부톤을 교체한다 — 밝은 살색 영역만 골라 곱연산."""
    a = np.array(im).astype(np.float32)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    # 피부 판정: 밝고 따뜻한 톤
    skin = (al > 30) & (r > 150) & (r > b + 12) & (g > b - 4)
    if skin.any():
        # 원본 평균 밝기 기준으로 목표색에 비례 배율 적용 (명암 유지)
        base = float(np.mean(r[skin])) or 1.0
        for c, v in enumerate(rgb):
            a[:, :, c][skin] = np.clip(a[:, :, c][skin] / base * v, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def build_face(spec: dict) -> Image.Image | None:
    """파츠를 합성해 정면 전신 → 얼굴 bbox 크롭."""
    body = load("Body", spec.get("body", "Human"))
    if body is None:
        return None
    canvas = front(body, *BODY_FRAME)
    if spec.get("skin"):
        canvas = tint_skin(canvas, spec["skin"])

    # 레이어 순서 — 헤어가 눈을 덮지 않도록 **Hair 를 먼저**, 눈·입을 나중에 얹는다.
    #  (종전엔 Hair 가 마지막이라 눈 픽셀이 0px 이 됐다. 실측으로 확인.)
    for part, fsize, key in (
        ("Hair", HAIR_FRAME, "hair"),
        ("Beard", HAIR_FRAME, "beard"),
        ("Eyebrows", BROW_FRAME, "brows"),
        ("Eyes", EYES_FRAME, "eyes"),
        ("Mouth", MOUTH_FRAME, "mouth"),
    ):
        name = spec.get(key)
        if not name:
            continue
        sh = load(part, name)
        if sh is None:
            continue
        f = front(sh, *fsize)
        # 파츠 시트는 얼굴 기준으로 그려져 있다 — 전신 캔버스의 얼굴 위치에 얹는다
        #  실측: Body 정면 프레임에서 얼굴은 x 160~330, y 170~300 근처
        # 오프셋은 추정하지 않고 실측했다 — 8개 후보를 렌더해 육안 판정:
        #   Hair oy=0, Eyes ox=150(중앙 176 아님)·oy=190 이 정확했다.
        #   파츠 시트는 프레임 좌상단이 아니라 얼굴 기준으로 그려져 있어
        #   단순 중앙정렬하면 눈이 오른쪽·아래로 밀린다.
        # 두상 실측: x129~349(중심 239) · y165~390(얼굴 중심 275)
        #  종전 oy=190 은 두상 상단에 눈을 붙여 "이마에 눈" 비율이 됐다(4.5/10).
        #  파츠 타일 내부 콘텐츠 위치까지 계산해 중앙에 맞춘다.
        #   Eyes   콘텐츠 y38~92(x9~127) → 중심 y275 → oy = 275-38-40 = 197
        #   Mouth  콘텐츠 y30~37(x36~52) → 입 높이 y312 → oy = 312-30 = 282
        if part == "Hair":
            ox, oy = 0, 0            # 헤어 시트는 프레임과 1:1 (중심 241 = 프레임 중심 240)
        elif part == "Beard":
            ox, oy = 0, 150
        elif part == "Eyes":
            # 눈 콘텐츠 bbox x4~127(중심65) y38~92(중심65)
            #  → 두상 중심 x239, 눈높이 y285 에 오도록 역산
            ox, oy = 174, 220
        elif part == "Eyebrows":
            # 눈썹 콘텐츠 y17~55(중심36). 눈 상단(258) 바로 위에 오도록
            ox, oy = 176, 200
        elif part == "Mouth":
            # 입 콘텐츠 bbox x36~52(중심44) y28~34(중심31)
            #  → 입높이 y325 에 오도록 역산
            ox, oy = 195, 294
        else:
            ox, oy = (BODY_FRAME[0] - fsize[0]) // 2, 220
        canvas.alpha_composite(f, (ox, oy))
    return canvas


def crop_face(full: Image.Image, zoom: float = 2.4) -> Image.Image:
    """전신에서 얼굴(머리+어깨)만 잘라 256x256 초상화로 만든다."""
    a = np.array(full)[:, :, 3]
    ys, xs = np.where(a > 20)
    if len(ys) == 0:
        return Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    # 크롭도 실측 기반 — 이전엔 side 를 너무 작게 잡아 이마만 남고 입·턱이 잘렸다.
    #   캐릭터 높이 599px(163~762)에서 얼굴+어깨는 상단 약 300px 이다.
    #   그 범위를 정사각으로 잡아야 초상화가 성립한다.
    # 크롭 창을 기하학적으로 확정했다 — 이전엔 side 를 작게 잡아 턱이 잘렸다.
    #  실측: 두상+머리 y158~390(높이 232px), x129~349(중심 239).
    #  200 창으로는 232px 머리를 담을 수 없어 **구조적으로** 턱이 잘린다.
    #  250 이면 두상 전체 + 상하 여백 9px 씩이 들어온다.
    side = 250
    cx, cy = 239, 274           # 두상 중심 ( (158+390)/2 = 274 )
    x0 = cx - side // 2
    y0 = cy - side // 2
    x0 = max(0, min(x0, full.width - side))
    y0 = max(0, min(y0, full.height - side))
    box = (x0, y0, min(full.width, x0 + side), min(full.height, y0 + side))
    crop = full.crop(box).resize((256, 256), Image.LANCZOS)
    return crop


# 화자 39명 → 파츠 조합 (여캐는 모에화: 큰 눈·부드러운 턱·리본 계열 헤어)
SPECS: dict[str, dict] = {
    "룬 정령 이그니":      {"hair": "SideBangs", "eyes": "Girl", "mouth": "Smile", "skin": (196, 232, 255)},
    "여관 주인 로안":      {"hair": "Pigtail", "eyes": "Girl", "mouth": "Smile", "skin": (255, 214, 190)},
    "마을 주민":           {"hair": "BuzzCut", "eyes": "Boy", "mouth": "Default"},
    "마을 아이":           {"hair": "Twintales", "eyes": "Girl", "mouth": "Smile", "skin": (255, 222, 200)},
    "호족 소녀 엘렌":      {"hair": "Twintales", "eyes": "Girl", "mouth": "Smile", "skin": (255, 210, 186)},
    "상인 라고스":         {"hair": "ShortHair", "eyes": "Boy", "mouth": "Smile", "beard": "Type3"},
    "직업 교관 카이엔":    {"hair": "CasualMessy", "eyes": "Boy", "mouth": "Default", "brows": "Default"},
    "쿠소디아 기사단장":   {"hair": "BroFlow", "eyes": "Boy", "mouth": "Default", "beard": "Type8"},
    "라이언 드 쿠소디아 국왕": {"hair": "SlickBack", "eyes": "Boy", "mouth": "Default", "beard": "Type10"},
    "알프헤임의 여왕 요정": {"hair": "SideBangs", "eyes": "Girl", "mouth": "Smile", "skin": (255, 226, 210)},
    "땅의 요정 여왕":      {"hair": "FringeUp", "eyes": "Girl", "mouth": "Smile", "skin": (232, 255, 220)},
    "난쟁이 광산 조합장":  {"hair": "BuzzCut", "eyes": "Boy", "mouth": "Default", "beard": "Type12"},
    "마법사 흐레스":       {"hair": "MessyMedium", "eyes": "Boy", "mouth": "Default", "beard": "Type6"},
    "세계수 이그드라실":   {"hair": "Shaggy", "eyes": "Girl", "mouth": "Smile", "skin": (200, 240, 190)},
    "허브 채집가 베르":    {"hair": "CasualMessy", "eyes": "Girl", "mouth": "Smile"},
    "신전 관리인 노아":    {"hair": "Pigtail", "eyes": "Girl", "mouth": "Default"},
    "선원 롤프":           {"hair": "BuzzCut", "eyes": "Boy", "mouth": "Smile", "beard": "Type1"},
    "늪지 어부 팰":        {"hair": "ShortTail", "eyes": "Boy", "mouth": "Default", "beard": "Type5"},
    "요정 사절 리안":      {"hair": "SideBangs", "eyes": "Girl", "mouth": "Smile", "skin": (255, 232, 214)},
    "성전 견습 기사":      {"hair": "FringeUp", "eyes": "Boy", "mouth": "Default"},
}


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    made, miss = 0, []
    report = {}
    for name, spec in SPECS.items():
        full = build_face(spec)
        if full is None:
            miss.append(name)
            continue
        face = crop_face(full)
        # 파일명은 안전한 슬러그로
        slug = "p_" + "".join(ch if ch.isalnum() else "_" for ch in name)[:40]
        fp = os.path.join(OUT, f"{slug}.webp")
        face.save(fp, "WEBP", quality=92)
        report[name] = f"portrait/{slug}.webp"
        made += 1
    print(f"초상화 {made}개 생성 → {OUT}")
    if miss:
        print(f"실패 {len(miss)}: {miss[:6]}")
    with open(os.path.join(OUT, "_map.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
