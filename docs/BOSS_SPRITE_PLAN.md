# vc235 — 보스 스프라이트 교체 배분표

## 문제 (실측 근거)

기존 보스 13종 중 **11종이 하단이 평평하게 잘려 있었다.** 프레임 격자 자체는
정확했지만(하단 여백 12px, 격자상 잘림 0건), 아트가 y=188 같은 **일정 높이에서
수평으로 끊긴** 상태로 시트에 구워져 있었다. 프레임 하단 2px 안에서 불투명 폭이
프레임의 40%를 넘는 프레임을 "평평하게 잘림"으로 집계한 결과:

| 보스 | 프레임 | 잘린 프레임 | 비율 | 판정 |
|---|---|---|---|---|
| 유령선 (boss2) | 128x171 | 66/84 | **79%** | 심각 |
| 하티 (boss_hati) | 191x146 | 43/56 | **77%** | 심각 |
| 아부디토스 | 256x147 | 27/40 | **68%** | 심각 |
| 요르문간드 | 256x147 | 24/41 | 59% | 일부 |
| 얼음골렘 (nagr) | 192x146 | 27/56 | 48% | 일부 |
| 가름 | 256x147 | 18/40 | 45% | 일부 |
| 펜리르 | 220x200 | 18/42 | 43% | 일부 |
| 스콜 | 204x184 | 18/42 | 43% | 일부 |
| 수정 왕 (boss) | 191x146 | 15/56 | 27% | 일부 |
| 니드호그 | 246x232 | 17/73 | 23% | 일부 |
| 악령 여왕 (boss3) | 192x171 | 12/56 | 21% | 양호 |
| 수르트 | 256x171 | 6/42 | 14% | 양호 |
| 베오르드 | 256x147 | 6/40 | 15% | 양호 |

원본이 AI 생성이라 격자에 그림이 안 맞는다. 격자를 고쳐도 해결되지 않으므로
**실제로 애니메이션 제작된 팩으로 교체**한다.

## 교체 팩 (모두 무료 · 상업 이용 허용)

| 파일 | 원본 | 라이선스 | 프레임 | 애니메이션 |
|---|---|---|---|---|
| `boss_frost.png` | [Boss: Frost Guardian](https://chierit.itch.io/boss-frost-guardian) | 무료(itch) | 192x128 | idle6/walk10/atk14/hit7/death16 |
| `boss_slime.png` | [Boss: Demon Slime](https://chierit.itch.io/boss-demon-slime) | 무료(itch) | 288x160 | idle6/walk12/atk15/hit5/death22 |
| `boss_mino.png` | [Boss: Minotaur](https://chierit.itch.io/boss-minotaur) | 무료(itch) | 288x160 | idle16/walk12/atk16 |
| `boss_golem.png` | [Boss: Mecha-Stone Golem](https://darkpixel-kronovi.itch.io/mecha-golem-free) | 무료(itch) | 100x100 | 9행 66프레임 |
| `boss_skeleton.png` | [Boss: Undead Executioner](https://darkpixel-kronovi.itch.io/undead-executioner) | 무료(itch) | 100x100 | 6애니 |
| `boss_dragon.png` | [Dragon - Fully Animated](https://opengameart.org/content/dragon-fully-animated) | **CC0** | 가변 | 7애니 60fps |

## 배분 — 스토리 정합성 기준

보스 정체를 유지하고 **그림만** 바꾼다. 이름·수치·패턴은 건드리지 않는다.

| 보스 키 | 이름 | 새 스프라이트 | 근거 |
|---|---|---|---|
| `guardian` | 심연의 수호자 | `boss_golem` | 심연 바위 골렘. 가슴 크리스탈이 심연 결정과 맞는다 |
| `behemoth` | 침몰의 선장 | `boss_skeleton` | 언데드 집행자 = 침몰한 배의 망령 선장 |
| `abysslord` | 심연의 군주 | `boss_frost` | 얼음 결정 골렘 → 심연의 냉기 군주 |
| `nidhog` | 탐식의 드래곤 니드호그 | `boss_dragon` | **드래곤** |
| `surt` | 화염의 거인 수르트 | `boss_slime` | 화염 악마(머리에 불꽃) → 용암 거인 |
| `fenrir` | 탐욕의 늑대 펜리르 | `boss_mino` | 늑대 없음 → 미노타우르스(야수형 거수)로 대체 |
| `skoll` | 교만의 쌍랑 스콜&하티 | `boss_mino` | 쌍랑도 야수형. 본체+트윈 같은 시트 사용 |
| `gram` | 혈안의 문지기 가름 | `boss_skeleton` | 사신형 문지기 |
| `abudditos` | 종언의 마룡 아부디토스 | `boss_dragon` | **마룡** |
| `vord` | 재림의 파수꾼 베오르드 | `boss_golem` | 파수꾼 골렘 |
| `jorm` | 세계수를 먹는 뱀 요르문간드 | `boss_dragon` | 뱀/드래곤 |
| `nagr` | 재림의 종언 나그라파르 | `boss_frost` | 종언의 얼음 거수 |
| `boss`(수정 왕) | 심연 수호자 | `boss_golem` | 수정 골렘 |
| `boss2`(유령선) | 침몰의 선장 | `boss_skeleton` | 79% 잘림 — 교체 우선순위 1 |
| `boss3`(악령 여왕) | 심연의 군주 | `boss_slime` | 화염 악마 |

## 제작 방식

`tools/pack_bosses.py` 가 각 팩을 읽어 **행 순서를 게임 규약으로 재배열**한다:

```
0 idle  1 walk  2 atk  3 sp1  4 sp2  5 sp3  6 die
```

- 팩에 없는 클립은 가까운 동작으로 채운다(sp3←atk, sp2←sp1, die←idle).
  빈 행을 두면 그 기술을 쓸 때 보스가 굳어 보이기 때문.
- 프레임 크기는 **팩 원본 그대로** 보존한다(확대 금지 → 화질 손실 없음).
  게임은 `Boss.ts` 에서 320px 높이로 정규화하므로 체급은 자동으로 맞는다.
- 행마다 프레임 수가 달라도 된다 — `BOSS_ATLAS_ROWS` 가 행별 개수를 따로 받는다.

## 용량

기존 13장 **17.2MB** → 교체 4장 **0.57MB**. 부팅 전송량이 크게 줄고 화질은 올라간다
(원본이 192~288px 프레임의 실제 제작 애니메이션이라 잘림이 없다).
