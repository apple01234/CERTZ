"""월드 NPC 전신 스프라이트 생성기 — 96x96 **직접 드로잉**.

[vc264 수리 — 지시 "NPC 캐릭터 이상함(못생김)"]

문제였던 것
  ① 48x48 에 그린 뒤 `resize(96,96,NEAREST)` 로 2배 확대
     → 1px 선이 2px 덩어리가 되고 눈·장식선이 뭉쳐 형태가 깨졌다.
  ② 소품(자루·지팡이·창)을 **몸통보다 나중에** 그려 몸을 덮었다.
     그래서 villager_m 의 갈색 자루가 몸통 위에 얹혀 "덩어리"처럼 보였다.
  ③ 팔이 몸통과 같은 색·같은 높이라 경계가 사라져 팔이 없는 것처럼 보였다.

이 파일이 하는 일
  · 96x96 캔버스에 **처음부터** 그린다(확대 없음).
  · 그리기 순서: 소품(뒤) → 다리 → 몸통 → 팔 → 머리 → 얼굴 → 소품(앞)
  · 팔은 몸통보다 어두운 톤 + 1px 외곽선으로 경계를 만든다.

출력: public/assets/npcbody/npcbody_<kind>.png (96x96)
사용: python tools/gen_npc_bodies.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("public/assets/npcbody")
S = 96
INV = (11, 13, 22, 255)


def rgb(h: str) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255


def shade(c: tuple[int, int, int, int], f: float) -> tuple[int, int, int, int]:
    """색을 f 배로 밝게/어둡게 (1.0 = 원본, <1 어둡게)."""
    return (max(0, min(255, int(c[0] * f))), max(0, min(255, int(c[1] * f))),
            max(0, min(255, int(c[2] * f))), 255)


# 종류별 팔레트 + 소품. 기존 색을 유지한다.
KINDS = {
    "merchant":   dict(skin="#e8c59f", hair="#8a8078", cloth="#8b5a2b", cloth2="#5c3a1a", acc="#f0c060", prop="pack"),
    "knight":     dict(skin="#e8c59f", hair="#6b7280", cloth="#7d8ba1", cloth2="#4a545f", acc="#ffd98a", prop="spear"),
    "mage":       dict(skin="#f8e0c6", hair="#9a6fd0", cloth="#6a3fa0", cloth2="#452669", acc="#c4b5fd", prop="staff"),
    "elf":        dict(skin="#f8e0c6", hair="#d8ac54", cloth="#2f7a4f", cloth2="#1c4e31", acc="#a7f3d0", prop="bow"),
    "villager_m": dict(skin="#c1ac8f", hair="#573a23", cloth="#7a6a52", cloth2="#4d4132", acc="#fcd34d", prop="sack"),
    "villager_f": dict(skin="#f8e0c6", hair="#a83a3a", cloth="#c86a8a", cloth2="#8a4058", acc="#fcd34d", prop="none"),
    "smith":      dict(skin="#c1ac8f", hair="#4a4038", cloth="#4a4458", cloth2="#2e2a38", acc="#ffb080", prop="hammer"),
    "fisher":     dict(skin="#c1ac8f", hair="#5d554e", cloth="#3f6b8a", cloth2="#274a61", acc="#8fd8f0", prop="rod"),
    "miner":      dict(skin="#c1ac8f", hair="#3a322a", cloth="#6a5a3a", cloth2="#443a24", acc="#ffd76a", prop="pick"),
    "scout":      dict(skin="#f8e0c6", hair="#b9c2d4", cloth="#5a6f8a", cloth2="#37475a", acc="#a8e0ff", prop="bow"),
    "mystic":     dict(skin="#b8a8c8", hair="#e0d0ff", cloth="#2a3f5a", cloth2="#16243a", acc="#c9a0ff", prop="orb"),
    "devil":      dict(skin="#b48a9a", hair="#4a2a3a", cloth="#6a2a3a", cloth2="#401a24", acc="#ff8aa8", prop="none"),
    "priest":     dict(skin="#f8e0c6", hair="#d8ac54", cloth="#c8b06a", cloth2="#8f7c42", acc="#fff0b8", prop="staff"),
    "butler":     dict(skin="#f8e0c6", hair="#2a2b33", cloth="#22242e", cloth2="#3a3d4a", acc="#f0c060", prop="none"),
}

# 96x96 기준 비율 (2.4등신: 머리 34 / 몸통 30 / 다리 22)
CX = S // 2
HEAD_TOP, HEAD_BOT = 12, 46
HEAD_L, HEAD_R = CX - 17, CX + 16
BODY_TOP, BODY_BOT = 44, 72
BODY_L, BODY_R = CX - 14, CX + 13
LEG_TOP, LEG_BOT = 70, 88
FOOT_TOP, FOOT_BOT = 86, 91


def prop_behind(d: ImageDraw.ImageDraw, prop: str, p: dict, cb, cs, ac, iv) -> None:
    """몸통 **뒤에** 깔리는 소품. 먼저 그려야 몸을 가리지 않는다."""
    if prop == "sack":
        # 어깨에 멘 자루 — 몸 **왼쪽 뒤**에 두어 몸통을 덮지 않게 한다.
        d.ellipse([CX - 34, 34, CX - 16, 56], fill=rgb("#b09870"), outline=iv)
        d.line([(CX - 26, 34), (CX - 14, 44)], fill=iv)
    if prop == "pack":
        d.rectangle([CX - 30, 46, CX - 20, 66], fill=cs, outline=iv)
    if prop == "spear":
        d.line([(CX + 26, 10), (CX + 26, 84)], fill=rgb("#8a6a3a"))
        d.polygon([(CX + 26, 2), (CX + 21, 14), (CX + 31, 14)], fill=ac, outline=iv)
    if prop == "staff":
        d.line([(CX + 25, 26), (CX + 25, 80)], fill=rgb("#8a6a3a"))
        d.ellipse([CX + 20, 16, CX + 30, 26], fill=ac, outline=iv)
    if prop == "rod":
        d.line([(CX + 22, 20), (CX + 32, 70)], fill=rgb("#8a6a3a"))
        d.line([(CX + 32, 70), (CX + 32, 80)], fill=rgb("#cfe8f5"))
    if prop == "hammer":
        d.line([(CX + 24, 42), (CX + 24, 74)], fill=rgb("#8a6a3a"))
        d.rectangle([CX + 18, 34, CX + 30, 42], fill=rgb("#9aa4b0"), outline=iv)
    if prop == "pick":
        d.line([(CX + 24, 42), (CX + 24, 74)], fill=rgb("#8a6a3a"))
        d.arc([CX + 14, 30, CX + 34, 44], 200, 340, fill=rgb("#9aa4b0"))
    if prop == "bow":
        d.arc([CX + 18, 32, CX + 34, 70], 280, 80, fill=rgb("#7a5a2b"))
        d.line([(CX + 26, 34), (CX + 26, 68)], fill=rgb("#d8c8a8"))


def prop_front(d: ImageDraw.ImageDraw, prop: str, ac, iv) -> None:
    """몸 **앞**에 오는 소품(손에 든 것)."""
    if prop == "orb":
        d.ellipse([CX - 32, 56, CX - 22, 66], fill=ac, outline=iv)
        d.point((CX - 28, 59), fill=(255, 255, 255))


def draw_body(kind: str) -> Image.Image:
    p = KINDS[kind]
    sb = rgb(p["skin"])
    cb = rgb(p["cloth"])
    cs = rgb(p["cloth2"])
    hb = rgb(p["hair"])
    ac = rgb(p["acc"])
    iv = INV
    prop = p["prop"]

    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # ① 뒤쪽 소품 먼저
    prop_behind(d, prop, p, cb, cs, ac, iv)

    # ② 다리 + 신발
    for side in (-1, 1):
        lx = CX + side * 6 - 4
        d.rectangle([lx, LEG_TOP, lx + 8, LEG_BOT], fill=shade(cs, 0.9), outline=iv)
        d.rectangle([lx - 2, FOOT_TOP, lx + 10, FOOT_BOT], fill=shade(iv, 1.0))
    # 다리 사이 빈 공간은 투명하게 둔다(한 덩어리로 보이지 않게)

    # ③ 몸통
    d.rectangle([BODY_L, BODY_TOP, BODY_R, BODY_BOT], fill=cb, outline=iv)
    d.rectangle([BODY_L + 2, BODY_TOP + 2, BODY_L + 9, BODY_BOT - 2], fill=cs)  # 좌측 음영
    d.line([(BODY_L + 5, BODY_TOP + 10), (BODY_R - 5, BODY_TOP + 10)], fill=ac)  # 장식선

    # ④ 팔 — 몸통보다 어둡게 + 외곽선으로 경계를 만든다(종전엔 같은 색이라 팔이 사라졌다)
    arm = shade(cb, 0.78)
    for side, x0 in ((-1, BODY_L - 10), (1, BODY_R - 0)):
        d.rectangle([x0, BODY_TOP + 3, x0 + 10, BODY_BOT - 6], fill=arm, outline=iv)
        d.rectangle([x0 + 1, BODY_BOT - 6, x0 + 9, BODY_BOT + 2], fill=sb, outline=iv)  # 손

    # ⑤ 목
    d.rectangle([CX - 4, HEAD_BOT - 4, CX + 3, BODY_TOP + 2], fill=shade(sb, 0.88))

    # ⑥ 머리
    d.ellipse([HEAD_L, HEAD_TOP, HEAD_R, HEAD_BOT], fill=sb, outline=iv)
    # 눈 — 3x3 로 키워 96px 에서도 보이게
    for ex in (CX - 9, CX + 5):
        d.rectangle([ex, HEAD_TOP + 16, ex + 3, HEAD_TOP + 19], fill=iv)
        d.point((ex + 1, HEAD_TOP + 16), fill=(255, 255, 255))
    # 입
    d.line([(CX - 3, HEAD_TOP + 26), (CX + 2, HEAD_TOP + 26)], fill=rgb("#a8795a"))

    # ⑦ 머리카락 — 정수리 덮개 + 옆머리
    d.pieslice([HEAD_L - 2, HEAD_TOP - 3, HEAD_R + 2, HEAD_TOP + 22], 180, 360, fill=hb, outline=iv)
    d.rectangle([HEAD_L - 2, HEAD_TOP + 12, HEAD_L + 3, HEAD_TOP + 24], fill=hb, outline=iv)
    d.rectangle([HEAD_R - 3, HEAD_TOP + 12, HEAD_R + 2, HEAD_TOP + 24], fill=hb, outline=iv)

    # ⑧ 종류별 추가 장식
    if kind == "knight":
        d.rectangle([BODY_L - 4, BODY_TOP - 2, BODY_L + 6, BODY_TOP + 6], fill=ac, outline=iv)
        d.rectangle([BODY_R - 6, BODY_TOP - 2, BODY_R + 4, BODY_TOP + 6], fill=ac, outline=iv)
    if kind == "priest":
        d.ellipse([CX - 12, HEAD_TOP - 12, CX + 11, HEAD_TOP - 2], outline=ac)
    if kind == "elf":
        d.polygon([(HEAD_L - 1, HEAD_TOP + 16), (HEAD_L - 12, HEAD_TOP + 8), (HEAD_L - 1, HEAD_TOP + 22)],
                  fill=sb, outline=iv)
    if kind == "mage":
        d.polygon([(HEAD_L - 4, HEAD_TOP + 2), (HEAD_R + 4, HEAD_TOP + 2),
                   (CX + 6, HEAD_TOP - 14), (CX - 8, HEAD_TOP - 14)], fill=cs, outline=iv)
    if kind == "miner":
        d.rectangle([HEAD_L - 2, HEAD_TOP - 4, HEAD_R + 2, HEAD_TOP + 2], fill=ac, outline=iv)
    if kind == "devil":
        d.polygon([(HEAD_L + 2, HEAD_TOP + 2), (HEAD_L - 3, HEAD_TOP - 12), (HEAD_L + 9, HEAD_TOP - 2)], fill=cs)
        d.polygon([(HEAD_R - 2, HEAD_TOP + 2), (HEAD_R + 3, HEAD_TOP - 12), (HEAD_R - 9, HEAD_TOP - 2)], fill=cs)
    if kind == "villager_f":
        # 치마 — 몸통 아래로 퍼진다
        d.polygon([(BODY_L, BODY_BOT - 6), (BODY_R, BODY_BOT - 6),
                   (BODY_R + 8, BODY_BOT + 12), (BODY_L - 8, BODY_BOT + 12)], fill=cb, outline=iv)
    if kind == "priest":
        d.polygon([(BODY_L, BODY_BOT - 8), (BODY_R, BODY_BOT - 8),
                   (BODY_R + 10, BODY_BOT + 14), (BODY_L - 10, BODY_BOT + 14)], fill=cb, outline=iv)
    if kind == "butler":
        d.rectangle([CX - 6, BODY_TOP + 2, CX + 5, BODY_BOT - 2], fill=rgb("#f0f0f0"))
    if kind == "scout":
        d.rectangle([HEAD_L - 2, HEAD_TOP - 2, HEAD_R + 2, HEAD_TOP + 6], fill=cs, outline=iv)

    # ⑨ 앞쪽 소품 마지막
    prop_front(d, prop, ac, iv)
    return im


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for kind in KINDS:
        im = draw_body(kind)
        im.save(OUT / f"npcbody_{kind}.png")
        n += 1
    print(f"generated {n} NPC bodies at {S}x{S} -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
