"""미전직 스킬 아이콘 후보 프리뷰 + 최종 2종 선정 생성 스크립트"""
from PIL import Image
import os

BASE = "upload/extracted/icons"
OUT_DIR = "public/assets/skillicon"

CANDS = [f"Barbarian_skills/Icon{i}.png" for i in range(1, 9)] + [
    f"Demon_Skills_Group {i}.png" for i in range(1, 5)]


def load32(path: str) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    if im.size != (32, 32):
        im = im.resize((32, 32))
    canvas = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    canvas.alpha_composite(im)
    return canvas


def main() -> None:
    tiles = []
    for n in CANDS:
        p = os.path.join(BASE, n)
        if not os.path.exists(p):
            print("없음", n)
            continue
        try:
            tiles.append((n, load32(p)))
        except Exception as e:  # noqa: BLE001
            print("로드실패", n, e)
    if not tiles:
        print("후보 없음")
        return
    W = len(tiles) * 130
    sheet = Image.new("RGB", (W, 150), (20, 20, 25))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, (n, t) in enumerate(tiles):
        big = t.resize((128, 128), Image.NEAREST).convert("RGB")
        sheet.paste(big, (i * 130 + 1, 0))
        d.text((i * 130 + 4, 132), f"{i}:{n.split('/')[0][:14]}", fill=(200, 200, 200))
    sheet.save("/tmp/icon_cands.png")
    print("ok", len(tiles), [n for n, _ in tiles])


if __name__ == "__main__":
    main()
