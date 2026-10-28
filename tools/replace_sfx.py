#!/usr/bin/env python3
"""게임 SFX 52종을 배급된 Fantasy Adventure Pack SFX 로 교체한다.

배경
----
vc202 에서 BGM 은 화이트노이즈 기준으로 교체했지만 SFX 는 그대로였다.
기존 SFX 상당수는 합성/AI 생성음이라 BGM 과 톤이 다르고, 특히 스킬 사운드
(skl_*)의 스펙트럼 평탄도가 0.55~0.66 으로 치찰음이 강했다.

FAP SFX 는 실제 녹음/전문 제작 팩으로 Player·Enemy·UI·Environmental·VFX
하위에 정리되어 있다. 파일명을 유지한 채 덮어써 코드 변경 없이 반영한다.

매핑 원칙
---------
- 같은 의미의 소리를 우선 연결한다(공격→Attack, 피격→Hit, 사망→Dead).
- 게임에 없는 카테고리(VFX)는 가장 가까운 의미로 대체한다.
- 루프 파일(Loop)은 SFX 에 쓰지 않는다(끝이 이어지지 않아 어색).

사용
----
  python3 tools/replace_sfx.py --dry-run
  python3 tools/replace_sfx.py --apply
"""
import argparse
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "assets", "audio")
SFX = "/root/workspace/_assets_in/x2/Fantasy Adventure Pack/Sound/SFX"
BACKUP = os.path.join(AUDIO, ".orig_vc203")

PLAYER = os.path.join(SFX, "Player")
ENEMY = os.path.join(SFX, "Enemy")
UI = os.path.join(SFX, "UI")
VFX = os.path.join(SFX, "VFXSounds")

# 게임 파일 → (FAP 폴더, 파일명)
MAP = {
    # ── 전투 기본
    "sfx_swing.ogg":      (PLAYER, "PS_Attack1.wav"),
    "sfx_hit.ogg":        (PLAYER, "PS_Hit.wav"),
    "sfx_hurt.ogg":       (PLAYER, "PS_Hit.wav"),
    "sfx_die.ogg":        (PLAYER, "PS_Dead.wav"),
    "sfx_dash.ogg":       (PLAYER, "PS_Dash.wav"),
    "sfx_bossdie.ogg":    (ENEMY, "Boss_Dead.wav"),
    "sfx_roar.ogg":       (ENEMY, "Boss_Roar.wav"),
    # ── UI
    "sfx_click.ogg":      (UI, "Menu_Confirm.wav"),
    "sfx_open.ogg":       (UI, "Menu_NewGame.wav"),
    "sfx_close.ogg":      (UI, "Menu_Back.wav"),
    "sfx_equip.ogg":      (UI, "Menu_Confirm.wav"),
    "sfx_quest.ogg":      (UI, "Menu_NewGame.wav"),
    "sfx_coin.ogg":       (UI, "UI_Coins1.wav"),
    "sfx_pickup.ogg":     (UI, "UI_Coins2.wav"),
    "sfx_upgrade.ogg":    (UI, "Menu_Confirm.wav"),
    "sfx_ach.ogg":        (UI, "Menu_Confirm.wav"),
    "sfx_levelup.ogg":    (UI, "Menu_NewGame.wav"),
    # ── 소모품/환경
    "sfx_potion.ogg":     (UI, "Menu_UpDown.wav"),
    "sfx_portal.ogg":     (VFX, "VFX_Sparks6.wav"),   # 순간이동 = 스파크
    "sfx_spin.ogg":       (PLAYER, "PS_Attack2.wav"),
    # ── 스킬
    "skl_sword1.ogg":     (PLAYER, "P1_Attack3 & AttackDown.wav"),
    "skl_sword2.ogg":     (PLAYER, "P1_Attack4.wav"),
    "skl_sword3.ogg":     (PLAYER, "P1_AttackUp.wav"),
    "skl_bigsword1.ogg":  (PLAYER, "P2_Attack3.wav"),
    "skl_knife1.ogg":     (PLAYER, "PS_Attack2.wav"),
    "skl_superhit1.ogg":  (PLAYER, "PS_Attack1.wav"),
    "skl_iainuki1.ogg":   (PLAYER, "PS_Attack2.wav"),
    "skl_heavydash1.ogg": (PLAYER, "PS_Dash.wav"),
    "skl_ambush1.ogg":    (PLAYER, "PS_Dash.wav"),
    "skl_arrow1.ogg":     (PLAYER, "PS_Attack1.wav"),
    "skl_arrowpierce1.ogg": (PLAYER, "PS_Attack2.wav"),
    "skl_rage1.ogg":      (ENEMY, "Boss_Grunt1.wav"),
    "skl_warcry1.ogg":    (ENEMY, "Boss_Grunt2.wav"),
    "skl_skyflight1.ogg": (PLAYER, "PS_Jump.wav"),
    "skl_slowmo1.ogg":    (VFX, "VFX_Liquid11.wav"),  # 시간왜곡 = 저음 액체
    "skl_timestop1.ogg":  (VFX, "VFX_Dust7.wav"),     # 정지 = 먼지 정착
}


def find(folder: str, name: str) -> str | None:
    """하위 폴더까지 재귀 탐색.

    팩 구조가 `Player/Player -Shared/PS_Attack1.wav`,
    `UI/Menu/Menu_Confirm.wav`, `Enemy/Boss/Boss_Roar.wav` 처럼 한 단계 더
    들어가 있어서 평면 경로로는 못 찾는다. 루프 파일은 SFX 로 쓰지 않는다.
    """
    direct = os.path.join(folder, name)
    if os.path.exists(direct):
        return direct
    for root, _dirs, files in os.walk(folder):
        if name in files:
            return os.path.join(root, name)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--quality", type=int, default=5)
    args = ap.parse_args()

    if args.apply:
        os.makedirs(BACKUP, exist_ok=True)

    print(f"{'게임 파일':24s} {'← 소스':30s} {'전':>7s} {'후':>7s}")
    print("-" * 74)
    ok = miss = 0
    for dst, (folder, name) in MAP.items():
        src = find(folder, name)
        dpath = os.path.join(AUDIO, dst)
        before = os.path.getsize(dpath) / 1024 if os.path.exists(dpath) else 0
        if not src:
            print(f"{dst:24s}  ✕ {name} 없음")
            miss += 1
            continue
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
                print(f"{dst:24s}  ✕ 변환실패")
                miss += 1
                continue
            os.replace(tmp, dpath)
        after = os.path.getsize(dpath) / 1024 if args.apply else 0
        print(f"{dst:24s} {name[:30]:30s} {before:6.0f}K {after:6.0f}K")
        ok += 1
    print("-" * 74)
    print(f"{'교체' if args.apply else '(--apply 로 실행)'} {ok}개 / 누락 {miss}개")
    if args.apply:
        print(f"원본 보존: {BACKUP}")


if __name__ == "__main__":
    sys.exit(main())
