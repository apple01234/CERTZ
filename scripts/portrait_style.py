#!/usr/bin/env python3
"""초상화 스타일 정본 — `aden` 이 사용자 승인 기준("이런게 ㄹㅇ 잘만든듯").

[왜 이 파일을 따로 두는가]
  스타일 문구가 스크립트마다 흩어지면 반드시 갈라진다. 사용자가 승인한 기준
  이미지(`npc_aden_raw.png`)의 특징을 여기 한 곳에 고정하고, 모든 생성이 이걸 쓴다.

[aden 실측 분석 — 승인 기준]
  · 1980~90년대 일본 셀 애니 문법 (은하영웅전설 / 야스히코 요시카즈 계열)
  · 셀 채색 2단 명암, 그라데이션 없음, 저채도·저명도 팔레트
  · 저해상도 픽셀 블록 + 계단 윤곽
  · **캐릭터 실루엣에 흰색 아웃라인** ← 이 그림의 결정적 개성
  · 단색 짙은 남색 배경(캐릭터보다 한 단계 밝게 → 검은 옷이 묻히지 않음)

[중요 — 서양풍 교정]
  종전 프롬프트는 "anime style" 한 단어뿐이라 모델이 서양 반실사로 갔다
  (유저 지시 "Npc들이 너무 서양 그림체임"). 일본 작화의 **구체적 특징**을
  나열하고 서양풍을 명시적으로 배제해야 그쪽으로 붙는다.
"""

# ── 스타일 코어 (모든 프롬프트 앞에 붙는다) ────────────────────────────────
STYLE_CORE = (
    "1980s-1990s retro JAPANESE anime cel animation style, "
    "Japanese anime face with anime facial proportions, "
    "cel shading with hard-edged two-tone shadows and no gradient, "
    "flat muted desaturated color palette, "
    "low resolution pixel art with visible pixel blocks and stepped outlines, "
    "clean white outline around the character silhouette, "
    "classic Japanese RPG character portrait like Fire Emblem and Legend of the Galactic Heroes, "
    "NOT western realistic, NOT oil painting, NOT photorealistic, NOT 3d render, NOT disney style"
)

# ── 마무리 (구도·배경) ────────────────────────────────────────────────────
STYLE_TAIL = (
    "bust shot, three-quarter view, centered composition, "
    "solid dark navy background with no background details, "
    "no text, no watermark, no signature"
)


def build_prompt(subject: str) -> str:
    """캐릭터 묘사(subject)를 승인된 스타일로 감싼다."""
    return f"{STYLE_CORE}, {subject}, {STYLE_TAIL}"


if __name__ == "__main__":
    print(build_prompt("beautiful gentle woman with pale lavender hair and lavender eyes, lavender robe"))
