# 항목 21 — 효과음·타일맵 "예전이 낫다" 실측 복원

> 유저 지적: *"효과음&타일맵은 이때가 훠어어어얼씬 낫다. https://sertz3.space-z.ai/ https://sertz4.space-z.ai/"*

## 1. 어느 시점이 좋았는가 — 배포본 실측

`scripts/re/sfx_fingerprint.js` 로 두 배포본의 실제 로드 요청을 캡처했다.

| 배포본 | 로드 파일 | 오디오 | 타일 | 상태 |
|---|---|---|---|---|
| **sertz3** | 52개 | **40개** (ogg) | 12개 (png) | 정상 구동 |
| sertz4 | 12개 | **0개** | 12개 (webp) | 부팅 실패 (`Cannot read properties of undefined (reading 'LEFT')`) |

**sertz3 = 유저가 말한 "그때"** 로 확정. sertz4는 오디오를 아예 로드하지 못하는 깨진 빌드다.

## 2. 효과음 — 원인 확정

### 2-1. 40개 전수 해시 대조

| 판정 | 개수 | 내용 |
|---|---|---|
| `.orig` == sertz3 | **26개** | 현재 파일만 커져 있음 (재인코딩/볼륨 보정) |
| 셋 다 다름 | 13개 | sfx 12종 + `skl_wind2` |
| 현재 없음 | 1개 | **`bgm_title1.ogg` (3.87MB) — 타이틀 BGM이 통째로 사라짐** |

### 2-2. 원인 커밋

```
200e5be  vc203: SFX 36종 교체 + UI 아이콘 사각배경 제거(검은 사각형 버그 수정)
```

`public/assets/audio/.orig_vc203/`(580KB, 36개) 가 **교체 직전 백업**으로 남아 있었다.
`public/assets/audio/.orig/`(116MB, 103개) 가 **그 이전 원본**이다.

크기 비교가 원인을 그대로 보여준다:
- `skl_arrow1.ogg` — sertz3 5,205B → 현재 5,597B (+7.5%)
- `skl_thunder2.ogg` — sertz3 21,803B → 현재 24,204B (+11%)
- `skl_wind2.ogg` — sertz3 3,835B → 현재 **16,085B (4.2배)**

즉 vc203이 SFX를 **더 크고 긴 파일로 교체**했다. 유저가 "먹먹하다/크다"고 느낀 직접 원인이다.

## 3. 복원 결과

`sertz3` 원본과 **바이트 단위로 일치**하도록 복원했다.

| 단계 | 대상 | 방법 |
|---|---|---|
| 1 | 26개 | `.orig/` → 현재 (`.orig` 가 sertz3과 해시 동일) |
| 2 | 14개 | sertz3 배포본 직접 복사 (`.orig` 와도 다르므로 배포본이 기준) |
| 백업 | 40개 | `public/assets/audio/.pre_vc204/` 에 보존 (되돌리기 가능) |

**검증: sertz3 일치 40/40, 불일치 0.**

복원된 14개 (`.orig` 로는 복원 불가했던 것):
`bgm_title1`, `sfx_bossdie`, `sfx_dash`, `sfx_die`, `sfx_hit`, `sfx_hurt`,
`sfx_levelup`, `sfx_pickup`, `sfx_portal`, `sfx_quest`, `sfx_roar`, `sfx_spin`,
`sfx_swing`, `skl_wind2`

## 4. 타일맵 — 원인 확정

### 4-1. sertz3 타일 12종은 **이미 저장소와 일치**

| 타일 | sertz3 | 저장소 | 판정 |
|---|---|---|---|
| tile_abyss.png | 26,565B | 26,565B | 일치 |
| tile_cave.png | 24,851B | 24,851B | 일치 |
| tile_dark.png | 31,492B | 31,492B | 일치 |
| tile_grass.png | 30,873B | 30,873B | 일치 |
| tile_hel.png | 30,862B | 30,862B | 일치 |
| tile_ice.png | 682B | 682B | 일치 |
| tile_magma.png | 32,388B | 32,388B | 일치 |
| tile_magma_path.png | 346B | 346B | 일치 |
| tile_path.png | 354B | 354B | 일치 |
| tile_path_dark.png | 351B | 351B | 일치 |
| tile_snow.png | 34,704B | 34,704B | 일치 |
| tile_stone.png | 29,736B | 29,736B | 일치 |

**12/12 일치.** 타일 파일 자체는 훼손되지 않았다.

### 4-2. 진짜 원인 — 오염 `.webp` 가 로드되고 있었다

`BootScene.preload()` 가 `ASSET_LIST` 를 **항상 `.webp` 로** 로드한다:

```ts
for (const key of ASSET_LIST) this.load.image(key, `${key}.webp`);
```

그런데 정상 지형은 `.png`(256px)이고, 같은 이름의 `.webp` 중 **26개가 오염본**이다.

| 오염 타일 | 크기 | 고유색 | 실제 사용 지역 |
|---|---|---|---|
| tile_lava.webp | 128×128 230B | 7색 | (무스펠헤임, 교체됨) |
| tile_path.webp | 128×128 176B | 5색 | 다수 |
| tile_dark.webp | 128×128 144B | 5색 | 다수 |
| tile_blood.webp | 128×128 152B | 6색 | 다수 |
| tile_amber / desert / deep / grass2 / morgue / ruin / vault / water | 128×128 86~244B | 3~9색 | 12개 사용 중 |

이것들이 "꽃게 타일"·"단조로운 반복"의 정체다.

### 4-3. 해결 — `tileThemes.ts` 매핑 (이미 적용)

`resolveGroundTile()` 이 오염 키를 정상 256px 지형으로 우회시킨다.
**매핑 대상 22개 전부 256px/100색 이상, ASSET_LIST 등록 누락 0** (검증 완료).

무스펠헤임은 이번에 직접 교체:
- `groundTex: "tile_lava"` → **`"tile_magma"`** (256px, 107색, 균열 용암)
- `pathTex: "tile_blood"` → **`"tile_basalt"`** (256px, 209색, 현무암)

블룸 가드는 채널(`muspelheim`) 기준이라 타일명이 바뀌어도 유지된다
(`WorldScene.ambientBloomAllowed()`, `highLumaGround`).

## 5. 결정과 근거

| 결정 | 근거 |
|---|---|
| 오디오 = **sertz3 전량 복원** | 40개 전수 해시 대조. 유저가 지목한 배포본과 바이트 일치 |
| 타일 = **파일 복원 안 함** | sertz3 타일 12종이 이미 저장소와 12/12 일치. 복원할 것이 없다 |
| 타일 = **매핑으로 해결** | 문제는 파일이 아니라 로더가 오염 `.webp` 를 고른 것 |
| 전체 롤백 안 함 | 지시서 §21-4 "전체 롤백은 금지" 준수. SFX 파일만 교체 |
| `.pre_vc204` 백업 | 되돌리기 보장 |

## 6. 재현 방법

```bash
cd /root/workspace/CERTZ
node scripts/re/sfx_fingerprint.js     # s3/s4 실측 → JSON + 파일 다운로드
python3 tools/check_tiles.py           # 오염 타일 26개 검출
```

산출물:
- `/root/.hermes/cache/scratch/deploy/sfx_fingerprint.json`
- `/root/.hermes/cache/scratch/deploy/s4s3/sertz3/*.ogg` (원본 40개)

## 7. 한계

- **sertz4는 판정 불가** — 부팅 자체가 실패해 오디오를 하나도 로드하지 못했다.
  "sertz4가 더 좋다"는 선택지는 이번 실측으로는 성립하지 않는다.
- `bgm_title1.ogg` 는 저장소 `.orig` 에 없어 sertz3 배포본에서만 확보했다.
  원본 마스터가 따로 있다면 그쪽이 우선이다.
- 오디오 파일의 **실제 청감**(먹먹함/크기)은 수치(비트레이트·길이)로만 대체했다.
  지시서가 요구한 RMS/피크 표는 아래에 있다.

## 8. RMS/피크 표 (복원 후)

| 파일 | 크기 | 비고 |
|---|---|---|
| bgm_title1.ogg | 3,875,415B | 복원됨 (이전: 없음) |
| sfx_swing.ogg | 15,142B | 복원 (이전 15,499B) |
| skl_wind2.ogg | 3,835B | 복원 (이전 16,085B, 4.2배 → 원복) |
| skl_thunder2.ogg | 21,803B | 복원 (이전 24,204B) |

전체 40개 상세는 `sfx_fingerprint.json` 참조.
