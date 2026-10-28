#!/usr/bin/env python3
"""문제 BGM(고BPM·화이트노이즈)을 배급된 Fantasy Adventure Pack BGM 으로 교체한다.

배경
----
사용자 지시: "BPM이 엄청 빠르고 보스전 음악 같은 것들이 화이트 노이즈가 많이
들린다. 그런 곡들이랑 화이트 노이즈가 많은 AI 노래들은 고급 에셋 BGM으로 바꿔."

실측(tools/analyze_bgm.py):
  현재 보스 9곡 중 6곡이 스펙트럼 평탄도 0.35~0.46 (화이트노이즈 과다)
  bgm_abyss_2 / abyss_boss / muspelheim_boss 는 178 BPM
  배급팩 FAP BGM 은 0.089~0.260 으로 전 구간 깨끗

처리
----
- 원본 `- Loop.wav` 를 쓰고, 게임이 ogg 를 로드하므로 고품질 ogg 로 변환한다
  (libvorbis q6). 기존 파일명을 그대로 덮어써 코드/플레이리스트를 건드리지 않는다.
- 교체 전 원본은 `public/assets/audio/.orig_vc202/` 에 보존한다.

사용
----
  python3 tools/replace_bgm.py --dry-run
  python3 tools/replace_bgm.py --apply
"""
import argparse
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "assets", "audio")
SONGS = "/root/workspace/_assets_in/x2/Fantasy Adventure Pack/Sound/Songs"
BACKUP = os.path.join(AUDIO, ".orig_vc202")

# 기존 게임 파일 → FAP 곡
MAP = {
    "bgm_abyss_2.ogg":        "Scene Theme 5",
    "bgm_abyss_boss.ogg":     "Boss Theme 2",
    "bgm_muspelheim_boss.ogg": "Boss Theme 2",
    "bgm_cave_water.ogg":     "Scene Theme 6",
    "bgm_niflheim_boss.ogg":  "Boss Theme 1",
    "bgm_alfheim_boss.ogg":   "Boss Theme 1",
    "bgm_forest_1.ogg":       "Scene Theme 2",
    "bgm_forest_boss.ogg":    "Boss Theme 1",
    "bgm_muspelheim_1.ogg":   "Scene Theme 3",
    "bgm_nidavellir_boss.ogg": "Boss Theme 1",
    "bgm_nidavellir_3.ogg":   "Scene Theme 5",
    "bgm_muspelheim_3.ogg":   "Scene Theme 5",
    "bgm_hel_2.ogg":          "Scene Theme 3",
}


def src_path(song: str) -> str:
    return os.path.join(SONGS, song, f"{song} - Loop.wav")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--quality", type=int, default=6)
    args = ap.parse_args()

    missing = [s for s in MAP.values() if not os.path.exists(src_path(s))]
    if missing:
        raise SystemExit(f"소스 곡 없음: {missing}")

    if args.apply:
        os.makedirs(BACKUP, exist_ok=True)

    print(f"{'게임 파일':26s} {'← FAP 곡':22s} {'전':>7s} {'후':>7s}")
    print("-" * 68)
    ok = 0
    for dst, song in MAP.items():
        src = src_path(song)
        dpath = os.path.join(AUDIO, dst)
        before = os.path.getsize(dpath) / 1024 if os.path.exists(dpath) else 0
        if args.apply:
            if os.path.exists(dpath):
                shutil.copy2(dpath, os.path.join(BACKUP, dst))
            tmp = dpath + ".tmp.ogg"
            p = subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", src,
                 "-c:a", "libvorbis", "-q:a", str(args.quality), tmp],
                capture_output=True,
            )
            if p.returncode != 0:
                print(f"  ✕ 변환 실패 {dst}: {p.stderr.decode()[:80]}")
                continue
            os.replace(tmp, dpath)
        after = os.path.getsize(dpath) / 1024 if args.apply else 0
        print(f"{dst:26s} {song:22s} {before:6.0f}K {after:6.0f}K")
        ok += 1
    print("-" * 68)
    print(f"{'교체' if args.apply else '(--apply 로 실행)'} {ok}곡")
    if args.apply:
        print(f"원본 보존: {BACKUP}")


if __name__ == "__main__":
    sys.exit(main())
