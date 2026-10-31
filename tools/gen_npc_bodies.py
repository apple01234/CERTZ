"""SERTZ 월드 NPC 전신 스프라이트 생성기 — 절차 생성, 외부 이미지 0장.

왜 필요한가
  월드 NPC 는 `spum_*.webp`(96×96, 유료 SPUM 에셋)를 scale 0.62 로 표시한다.
  이 에셋은 반입 경로가 외부(Unity 에셋스토어)라 재배포·교체 시 문제가 된다.
  같은 자리에 **자체 제작** 전신 스프라이트를 놓아 의존을 끊는다.

규격 (기존 렌더 코드와 호환)
  · 96×96 캔버스 — WorldScene 이 `add.image(x, y, tex).setScale(0.62)` 로 쓰므로 동일 규격이면 무수정 교체.
  · 1px 외곽선, SD 3~4등신, 발밑이 y≈92 (지면 접지점).
  · 발바닥 그림자 포함 → 지면에 붙어 보인다.

저작권: 입력은 수치(팔레트)뿐. 색은 SERTZ 자체 에셋에서 실측했다.

출력: public/assets/npcbody/npcbody_<kind>.png (96×96, BootScene 키와 동일)
사용: python3 tools/gen_npc_bodies.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("public/assets/npcbody")
S = 48          # 논리 해상도 (48×48 → 2배 96×96)
SCALE = 2       # 96×96
INV = "#0b0d16"


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# 종류별 팔레트 + 소품
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


def draw_body(kind: str) -> Image.Image:
    p = KINDS[kind]
    sb, cb, cs = rgb(p["skin"]), rgb(p["cloth"]), rgb(p["cloth2"])
    hb = rgb(p["hair"])
    ac = rgb(p["acc"])
    iv = rgb(INV)

    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = S // 2

    # ── 발밑 그림자 (지면 접지) — vc212: 알파 90→150, 폭 확대.
    #  월드에 세웠을 때 공중에 뜬 느낌이 든다는 지적 반영.
    # vc212c — 그림자는 **스프라이트에 굽지 않는다**.
    #  scale 0.62 + nearest 샘플링에서 반투명 픽셀이 뭉개져 지면에 안 보였다.
    #  WorldScene 이 `add.ellipse()` 로 별도 오브젝트를 깔아 해결한다.

    # ── 다리 + 신발 ──
    for side in (-1, 1):
        lx = cx + side * 4 - 2
        d.rectangle([lx, 32, lx + 4, 41], fill=cs, outline=iv)
        d.rectangle([lx - 1, 40, lx + 5, 43], fill=iv)          # 신발

    # ── 몸통 ──
    d.rectangle([cx - 7, 20, cx + 6, 33], fill=cb, outline=iv)
    d.rectangle([cx - 6, 21, cx - 3, 32], fill=cs)              # 좌측 음영
    d.line([(cx - 5, 24), (cx + 4, 24)], fill=ac)               # 장식선

    # ── 팔 (몸통보다 밝게 → 경계 분리) ──
    d.rectangle([cx - 10, 21, cx - 7, 30], fill=cb, outline=iv)
    d.rectangle([cx + 7, 21, cx + 10, 30], fill=cb, outline=iv)
    d.rectangle([cx - 10, 30, cx - 7, 33], fill=sb, outline=iv) # 손
    d.rectangle([cx + 7, 30, cx + 10, 33], fill=sb, outline=iv)

    # ── 목 ──
    d.rectangle([cx - 2, 17, cx + 2, 20], fill=rgb("#c9a882"))

    # ── 머리 (SD 4등신: 머리 지름 ≈ 몸 높이의 1/3) ──
    d.ellipse([cx - 8, 6, cx + 7, 20], fill=sb, outline=iv)
    # 눈 — 2px, 항상 노출
    for ex in (cx - 4, cx + 3):
        d.rectangle([ex, 13, ex + 1, 14], fill=iv)
    d.line([(cx - 1, 17), (cx, 17)], fill=rgb("#a8795a"))

    # ── 머리카락 ──
    d.pieslice([cx - 9, 4, cx + 8, 18], 180, 360, fill=hb, outline=iv)
    d.rectangle([cx - 9, 10, cx - 7, 16], fill=hb, outline=iv)
    d.rectangle([cx + 6, 10, cx + 8, 16], fill=hb, outline=iv)

    # ── 종류별 소품 (실루엣 차별화) ──
    prop = p["prop"]
    if prop == "spear":
        # 창 — 머리 위까지 솟아 실루엣이 확실히 달라진다
        d.line([(cx + 12, 6), (cx + 12, 40)], fill=rgb("#8a6a3a"), width=1)
        d.polygon([(cx + 12, 2), (cx + 10, 7), (cx + 14, 7)], fill=ac, outline=iv)
    if prop == "staff":
        d.line([(cx + 12, 14), (cx + 12, 38)], fill=rgb("#8a6a3a"), width=1)
        d.ellipse([cx + 10, 10, cx + 14, 14], fill=ac, outline=iv)
    if prop == "orb":
        # 손 위에 떠 있는 구체 (지팡이 없음 → mage 와 실루엣 분리)
        d.ellipse([cx - 13, 26, cx - 9, 30], fill=ac, outline=iv)
        d.point((cx - 11, 27), fill=(255, 255, 255))
    if prop == "bow":
        d.arc([cx + 9, 16, cx + 17, 34], 280, 80, fill=rgb("#7a5a2b"), width=1)
        d.line([(cx + 13, 17), (cx + 13, 33)], fill=rgb("#d8c8a8"))
    if prop == "hammer":
        d.line([(cx + 12, 20), (cx + 12, 36)], fill=rgb("#8a6a3a"), width=1)
        d.rectangle([cx + 9, 16, cx + 15, 20], fill=rgb("#9aa4b0"), outline=iv)
    if prop == "pick":
        d.line([(cx + 12, 20), (cx + 12, 36)], fill=rgb("#8a6a3a"), width=1)
        d.arc([cx + 8, 15, cx + 17, 22], 200, 340, fill=rgb("#9aa4b0"))
    if prop == "rod":
        d.line([(cx + 11, 12), (cx + 15, 34)], fill=rgb("#8a6a3a"), width=1)
        d.line([(cx + 15, 34), (cx + 15, 38)], fill=rgb("#cfe8f5"))
    if prop == "pack":
        d.rectangle([cx - 11, 20, cx - 8, 28], fill=cs, outline=iv)
    if prop == "sack":
        # 어깨에 멘 자루 — 실루엣 상단이 비대칭이 된다
        d.ellipse([cx + 7, 14, cx + 14, 21], fill=rgb("#b09870"), outline=iv)
        d.line([(cx + 10, 20), (cx + 6, 26)], fill=iv)

    # ── 어두운 복장은 좌우 림라이트로 실루엣 유지 (숲·동굴·밤 배경 대응) ──
    if kind in ("butler", "devil", "smith", "miner"):
        d.line([(cx - 7, 20), (cx - 7, 32)], fill=rgb("#7a8296"))
        d.line([(cx + 6, 20), (cx + 6, 32)], fill=rgb("#5a6276"))

    # ── 종류별 추가 장식 ──
    if kind == "knight":
        d.rectangle([cx - 9, 19, cx - 6, 22], fill=ac, outline=iv)   # 견갑
        d.rectangle([cx + 5, 19, cx + 8, 22], fill=ac, outline=iv)
    if kind == "priest":
        d.ellipse([cx - 6, 1, cx + 5, 5], outline=ac)                # 후광
    if kind == "elf":
        d.polygon([(cx - 8, 12), (cx - 12, 8), (cx - 8, 15)], fill=sb, outline=iv)  # 귀
    if kind == "mage":
        d.polygon([(cx - 9, 8), (cx + 8, 8), (cx + 2, 1), (cx - 3, 1)], fill=cs, outline=iv)
    if kind == "miner":
        d.rectangle([cx - 8, 5, cx + 7, 8], fill=ac, outline=iv)      # 헬멧 램프
    if kind == "devil":
        d.polygon([(cx - 7, 6), (cx - 9, 1), (cx - 4, 4)], fill=cs)
        d.polygon([(cx + 6, 6), (cx + 8, 1), (cx + 3, 4)], fill=cs)
    if kind == "villager_f":
        d.polygon([(cx - 8, 30), (cx + 7, 30), (cx + 9, 38), (cx - 10, 38)], fill=cb, outline=iv)  # 치마
    if kind == "priest":
        # 로브 폭 확대 (실루엣 차별)
        d.polygon([(cx - 9, 30), (cx + 8, 30), (cx + 11, 40), (cx - 12, 40)], fill=cb, outline=iv)
    if kind == "butler":
        d.rectangle([cx - 3, 20, cx + 2, 32], fill=rgb("#f0f0f0"))   # 앞치마
    if kind == "scout":
        d.rectangle([cx - 9, 6, cx + 8, 9], fill=cs, outline=iv)      # 두건

    return im


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    prev = None
    for kind in KINDS:
        im = draw_body(kind)
        big = im.resize((S * SCALE, S * SCALE), Image.NEAREST)
        p = OUT / f"npcbody_{kind}.png"  # BootScene 로드 키와 일치
        big.save(p)
        a = im.getchannel("A")
        opaque = sum(1 for v in a.get_flattened_data() if v > 0)
        flag = ""
        if prev is not None and opaque == prev:
            flag = "  <-- 이전과 동일(차별화 실패)"
        prev = opaque
        print(f"  {kind:11s} 불투명 {opaque:>5}px  {big.size}{flag}")
        n += 1
    print(f"\n생성 {n}장 → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
