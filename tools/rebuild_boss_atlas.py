#!/usr/bin/env python3
"""
보스 아틀라스 재구성 — 개별 프레임(240x180) 42장을 정확한 격자로 합친다.

왜 이 도구가 필요한가:
  배포본 atl_boss_*.webp 는 assets_src/boss_sheets/bsw_*.webp 를 잘라 만든다.
  그런데 bsw_abudditos / bsw_nagr / bsw_nidhog / bsw_vord / bsw_jorm 은
  git 에 커밋된 시점부터 픽셀 단위로 완전히 동일한 파일이다(중복).
  그래서 아틀라스를 아무리 다시 잘라도 같은 그림이 나온다.

  진짜 원본은 public/assets/boss_<name>_<row><i>.webp 42장이다.
  이 스크립트는 그 42장을 행 순서대로 이어붙여 아틀라스를 만든다.

행 순서(게임 규약): idle, walk, atk, sp1, sp2, sp3, die  — 각 6프레임.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"

ROWS = [("idle", "idle"), ("walk", "walk"), ("atk", "atk"),
        ("sp1", "sp1_"), ("sp2", "sp2_"), ("sp3", "sp3_"), ("die", "die")]
COLS = 6


def frame_path(name: str, prefix: str, i: int) -> Path:
    # sp1/sp2/sp3 는 boss_<name>_sp1_0.webp, 나머지는 boss_<name>_idle0.webp
    return ASSETS / f"boss_{name}_{prefix}{i}.webp"


def build(name: str, apply: bool) -> dict:
    missing = []
    frames = []
    for row_name, prefix in ROWS:
        for i in range(COLS):
            p = frame_path(name, prefix, i)
            if not p.exists():
                missing.append(p.name)
                continue
            frames.append(Image.open(p).convert("RGBA"))

    if missing:
        return {"name": name, "ok": False, "missing": missing}

    fw, fh = frames[0].size
    # die 프레임은 크기가 다를 수 있다(축소 연출본). 기준 크기로 맞춘다.
    resized = []
    for f in frames:
        if f.size != (fw, fh):
            f = f.resize((fw, fh), Image.LANCZOS)
        resized.append(f)
    frames = resized

    sheet = Image.new("RGBA", (fw * COLS, fh * len(ROWS)), (0, 0, 0, 0))
    for idx, f in enumerate(frames):
        r, c = divmod(idx, COLS)
        sheet.paste(f, (c * fw, r * fh))

    out = ASSETS / f"atl_boss_{name}.webp"
    if apply:
        sheet.save(out, "WEBP", lossless=True, quality=100, method=4)

    return {"name": name, "ok": True, "size": sheet.size, "fw": fw, "fh": fh,
            "frames": len(frames), "out": out.name, "written": apply}


def main():
    apply = "--apply" in sys.argv
    targets = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not targets:
        # 개별 프레임이 있는 보스만 자동 탐지
        targets = []
        for p in ASSETS.glob("boss_*_idle0.webp"):
            targets.append(p.name[len("boss_"):-len("_idle0.webp")])
        targets.sort()

    print(f"{'name':12s} {'결과':6s} 상세")
    print("-" * 70)
    ok = 0
    for n in targets:
        r = build(n, apply)
        if r["ok"]:
            ok += 1
            print(f"{r['name']:12s} OK     {r['size'][0]}x{r['size'][1]} "
                  f"({r['fw']}x{r['fh']} x {COLS}열 {r['frames']}프레임)"
                  f"{' → ' + r['out'] if r['written'] else '  (미기록)'}")
        else:
            print(f"{r['name']:12s} FAIL   {r.get('missing') or r.get('size_mismatch')}")
    print("-" * 70)
    print(f"성공 {ok}/{len(targets)}")
    if not apply:
        print("\n(--apply 로 실제 기록)")


if __name__ == "__main__":
    main()
