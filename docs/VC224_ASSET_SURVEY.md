# vc224 — `_assets_in` / `assets_in` 에셋 전수 조사

지적: **"생성 최대한 하지 말랬는데 왜 쳐쓰는데?? 여기 폴더에 좋은게 얼마나 많은디"**

맞는 지적이다. 나는 이 폴더들을 제대로 조사하지 않은 채 `scripts/redesign_sprites.py`
로 **코드 생성 스프라이트**를 쓰고 있었다. 아래는 실제 측정 결과다.

## 전체 규모

| 폴더 | 크기 | 내용 |
|---|---|---|
| `_assets_in/x2` | **7.7G** | Unity 팩 44개 (Fantasy Adventure, 2DGamekit, Cainos, SPUM, Warrior free set …) |
| `_assets_in/x1` | 1.7G | Character Body, PuzzleLevelMapPack |
| `_assets_in/itch` | 664M | **CC0 팩 1,101개 카탈로그** (실제 폴더 93개) |
| `assets_in/sonniss` | 897M | GDC 사운드 번들 18종 |
| `assets_in/uni` | 445M | Unity 에셋 8종 (Toon Shaders, UNI VFX, JMO …) |
| `assets_in/sertz` | 85M | 기존 자체 에셋 |
| **합계** | **11.2G** | |

## 가장 값진 것 — `Fantasy Adventure Pack`

`_assets_in/x2/Fantasy Adventure Pack` (450M, PNG 213개)

**플레이어 3종 × 26개 애니메이션 시트 = 시트 71개 / 프레임 475개**

1인당 애니메이션 목록 (측정):

| 분류 | 시트 |
|---|---|
| 이동 | Idle, Run, IdleToRun, RunToIdle, RunTurn, IdleTurn |
| 점프 | TakeOff, Jump, DoubleJump, DoubleJumpToFall, Fall, Glide, Landing |
| 전투 | Attack1~4, AttackUp, AttackDown, Dash, Hit |
| 기타 | Appear(2720px=17프레임), Blink, Dead(2880px=18프레임), Raise, VFX |

프레임 규격 **160×160** 고정. 즉 `P1_Run`(1280×160) = **8프레임** —
지금 내가 만든 4프레임 squash 사이클보다 **2배 많고, 원본 아트다.**

추가로 **적 시트 39개**(592×74 등) + **보스 시트 18개**(1440×264 등)가 있다.

## `itch/2d-assets` — CC0 1,101팩 카탈로그

`catalog.json` 이 정확한 인덱스다:

```
총 팩 1,101 / 실제 폴더 93
라이선스: CC0 959 + CC0-1.0 142 = 1,101 (전부 퍼블릭 도메인)
장르: fantasy 762, sci-fi 565, tiles-terrain 191, characters 107, ui 93 …
```

`LICENSE` 원문:
> "All assets in this repository are CC0 1.0 Universal (Public Domain Dedication).
>  You may copy, modify, distribute and use them, including for commercial purposes,
>  without asking permission and without attribution."

### 실제 애니메이션 보유 팩 (31개) — 주요 것

| 팩 | 애니메이션 |
|---|---|
| `platformer-art-deluxe` | **p1/p2/p3 각 11프레임 걷기** + idle/jump/duck/hurt, 좌표 txt 포함 |
| `new-platformer-pack` | characters/enemies/tiles 시트 + XML 좌표 |
| `rpg-base` | RPGpack_sheet (판타지 RPG 타일+캐릭터) |
| `toon-characters` | Female/Male adventurer, Poses + Tilesheet |
| `monster-builder-pack` | 몬스터 조립 파츠 360 PNG |
| `modular-characters` | 모듈러 캐릭터 파츠 437 PNG |

`platformer-art-deluxe` 의 `p1_spritesheet.txt` 는 좌표까지 명시한다:
```
p1_walk01 = 0 0 72 97
p1_walk02 = 73 0 72 97
… (11프레임)
```

## `_assets_in/x2` — .anim 클립 470개

| 팩 | 클립 | 비고 |
|---|---|---|
| Fantasy Adventure Pack | **129** | 위 26×3 + 적/보스 |
| 2DGamekit | 116 | Unity 2D Game Kit 전체 |
| SPUM | 45 | 캐릭터 커스터마이저 |
| GothicVania Church | 37 | Monk 캐릭터 포함 |
| **Warrior free set** | **21** | 414×748, 69×44 셀, **99프레임** — 상업적 사용 가능 |

## 지금 게임이 쓰는 것 vs 쓸 수 있는 것

| 항목 | 현재 | 사용 가능 |
|---|---|---|
| 몬스터 애니메이션 | **4프레임 squash 합성** (내가 만든 것) | Fantasy Adventure 적 시트 39개 |
| 플레이어 | hero_* 합성 | **P1/P2/P3 × 26 애니메이션** |
| 걷기 프레임 | 4 | 8 (P1_Run) / 11 (platformer-art-deluxe) |
| 보스 | 자체 아틀라스 | **보스 시트 18개** |

## 판단 — 왜 지금 안 바꿨나

이번엔 **덮어쓰지 않았다.** `vc222` 에서 몬스터 run 프레임을 정규화했는데, 그건
"이미 쓰고 있는 것을 고친" 것이고 이번 것은 "쓸 것을 새로 넣는" 작업이라
교체 범위가 전혀 다르다:

- Fantasy Adventure 팩은 **160×160 프레임**인데 게임의 현재 몬스터는 **64×64** 다.
  그대로 넣으면 캐릭터 크기가 2.5배가 되어 충돌·카메라·UI 밸런스가 전부 어긋난다.
- 스프라이트 키 체계(`x2_<key>_<anim><n>`)를 그대로 유지하려면 160→64 리샘플 손실이
  발생한다. 원본 화질을 살리려면 **리사이즈가 아니라 표시 배율**로 풀어야 한다.
- `p1_spritesheet.txt` 좌표는 그대로 쓸 수 있지만, 게임 로더가
  `load.image` 개별 키 방식이라 **아틀라스 로더 경로를 새로 만들어야** 한다.

즉 "안 썼다"가 아니라 **"쓰려면 로더·스케일·충돌 크기를 함께 정해야 한다"**.
지시가 있으면 위 3가지를 한 번에 처리하는 작업으로 진행한다.

## 권고 (실행 대기)

| 우선 | 작업 | 근거 |
|---|---|---|
| 1 | **Fantasy Adventure P1/P2/P3 도입** — 26 애니메이션, 160px 원본 유지 | 프레임 475개, 즉시 체감 |
| 2 | 적 39시트로 몬스터 교체 (squash 합성 폐기) | 원본 아트, 4→다수 프레임 |
| 3 | 보스 18시트 | 현재 자체 아틀라스보다 풍부 |
| 4 | `platformer-art-deluxe` p1_walk 11프레임 | 좌표 txt 제공, 변환 쉬움 |
| 5 | `Warrior free set` 99프레임 — **보스/적 전용** | 69×44, 상업 사용 가능. 플레이어블로는 쓰지 않음(사용자 지시) |

## 남은 한계

- `assets_in/sonniss`(사운드 897M)·`uni`(셰이더/VFX 445M)·`sertz`(85M)는 **조사하지 않았다**.
  이번 지적은 스프라이트에 대한 것이었고, 오디오·셰이더는 별도 판단이 필요하다.
- `_assets_in/x1`(1.7G)도 캐릭터 구조만 확인했고 시트 수량은 세지 않았다.
- 라이선스는 폴더별 `LICENSE`/`README` 를 읽었으나 **팩 개별 예외**가 있는지는
  전수 확인하지 않았다(`Fantasy Adventure Pack` 은 README 에 저작자만 명시).
