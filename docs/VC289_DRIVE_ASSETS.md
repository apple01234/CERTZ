# vc289 — 2026-11-09 Drive 에셋 배급 적용 기록

- **배급분**: Google Drive `16Aq5W0LdE6ivfHg4ys1qRsKf-TJokPxY` (212 MB ZIP)
- **수량**: 9,048 파일 / 45개 팩 / 285 MB (압축 해제 후)
- **적용일**: 2026-11-09
- **적용 대상**: SERTZ (`/root/workspace/CERTZ`)

## 1. 왜 CERTZ에 적용했나

배급분은 **전부 2D 픽셀아트**다. 반면 분석 대상이던 ISEKAI GATE는:

- Unity 6.3 **IL2CPP + 134MB 암호화 블롭** (`libngedoned.so`)
- **XIGNCODE3 안티치트** — 무결성 검사가 에셋 변조를 탐지
- 에셋이 **Addressables 번들**(UnityFS, LZ4) 안에 있고, 교체하려면
  Unity 6.3 에디터 + 원본 프로젝트 + 리빌드가 필요 (이 환경에 Unity 없음)

→ 실제로 교체·검증 가능한 곳은 CERTZ다. ISEKAI GATE는 정적 분석 리포트만 남긴다.

## 2. 적용한 것 (2개 카테고리, 34 파일)

### 2.1 몬스터 2종 — `Monster Pack (Free)` 토끼

| 게임 키 | 이름 | 프레임 | 출처 |
|---|---|---|---|
| `dx_hornbunny` | 뿔없는 들토끼 | idle 4, run 6 | `Rabbit_Brown_*` |
| `dx_hornrabbit` | 뿔토끼 | idle 4, run 6, atk 6 | `Rabbit_Horned_*` |

**변환 함정 (실측으로 확인)**

원본은 **4방향 × N프레임 그리드 시트**다. 처음에 "정사각 프레임 = 시트높이"로
가정했더니 **1프레임으로 오판**해 64px 캔버스에 20×18px 캐릭터만 들어가
불투명 픽셀이 0.4%가 됐다(캐릭터가 거의 안 보임). 실제 구조는:

```
시트 512×512 = 4행(방향) × 4열(프레임), 셀 128×128
  행 0 = 아래, 행 1 = 왼쪽, 행 2 = 오른쪽, 행 3 = 위
```

CERTZ 몬스터는 **측면 1방향 + flipX** 만 쓰므로 **행 1(왼쪽)** 만 추출했다.
추가로 원본 캐릭터가 20px 급이라 `upscale=True`(정수배 NEAREST)로 64px를 채웠다.
결과: 불투명 픽셀 0.4% → **43%**, bbox가 캔버스를 채움.

`idle` 4프레임은 원본이 정지 자세라 실질적으로 정적이다(원본 제작 방식).

### 2.2 전투 FX 8종 — `FX Pack 1`

원본은 파일명에 메타가 내장된 24프레임 가로 스트립(`[size128] [frames24]`)이라
CERTZ `pixelfx` 스키마(`frames[] + meta.pixelfx`)로 기계적 변환이 가능했다.

| fx id | 원본 | fps | loop |
|---|---|---|---|
| `storm` | Storm | 24 | ✔ |
| `shockwave-big` | Shockwave | 26 | ✘ |
| `plasma` | Plasma | 22 | ✔ |
| `energy-crack` | EnergyCrack | 24 | ✔ |
| `pentagram` | Pentagram_Vicron | 20 | ✔ |
| `implosion-drive` | Implosion | 26 | ✘ |
| `orbit-rings` | OrbitRings_AcidTech | 22 | ✔ |
| `sparks-glow` | Sparks_DeepSeaGlow | 24 | ✘ |

빈 프레임(0.0% 불투명)은 **원본 설계**다 — 페이드 인/아웃 경계로 정상.
`loadFxSheet()` + `playFx()` 로 바로 재생된다.

## 3. 코드 등록 지점 (4+1곳)

에셋 파일만 넣으면 렌더되지 않는다. CERTZ 파이프라인은 4곳 등록을 요구한다:

| 파일 | 등록 내용 |
|---|---|
| `src/game/scenes/BootScene.ts` | `X3_MONSTERS`에 dx_ 2종 + **별도 로드 루프**(run 6프레임 대응) |
| `src/game/scenes/BootScene.ts` | `PIXELFX_SHEETS`에 신규 fx 8종 |
| `src/game/textures.ts` | `dx-*-idle`(4f) / `dx-*-run`(6f) / `dx-*-atk` 애니메이션 |
| `src/game/stages.ts` | `EnemyKey` 유니온 + `ENEMY_DEFS` 스탯 + 이름 라벨 |
| `src/game/entities/Enemy.ts` | `HITBOX` (bw/bh/hw/hh/burst) |

### 스탯 배치 의도

- `dx_hornbunny` — hp 54, atk 11, speed 196: **초반 잡몹**
- `dx_hornrabbit` — hp 86, atk 18, speed 214, `charge` 프로파일: **돌진형**

기존 `ll_*`(다크판타지, DLC/재림 구간)과 달리 **밝은 카툰 톤**이라 본편 초반에 맞춘다.

## 4. 사고와 복구 — `implosion` 덮어쓰기

초기 스크립트가 새 FX를 `implosion`이라는 이름으로 저장해 **기존 시트를 덮어썼다**.

- 기존: `explosions/implosion`, 51프레임, 208×184
- 덮어쓴 것: `drive2026/implosion`, 24프레임, 128×128

`git checkout -- public/assets/fx/implosion.{json,png}` 로 복구하고,
이름을 `implosion-drive`로 변경했다. 재발 방지를 위해 `import_fx()`에
**가드**를 추가했다 — 기존 JSON의 `meta.pixelfx.id`가 `drive2026/`로 시작하지 않으면
충돌로 판단하고 건너뛴다.

> 교훈: 에셋 이름은 기존 것과 **반드시 대조**한 뒤 쓴다(`ls public/assets/fx/`).

## 5. 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| HTTP 서빙 (36 URL) | **전부 200** |
| 몬스터 26프레임 생성 | ✔ (52 파일 = png+webp) |
| 픽셀 점유율 | 0.4% → **43.07%** (수정 후) |
| 육안 검증 (10프레임) | 픽셀 경계 선명, run 6포즈 상이, 하단 정렬 정상 |
| 기존 FX 무결성 | `implosion` 51f / `fireball` 36f / `portal` 72f / `smite` 85f 보존 |

### 런타임 검증 (프로덕션 빌드 + Playwright)

`next build` → `PORT=3100 node server.js` 로 실제 서버를 띄워 확인했다.

```
Phaser 4.2.1 · 애니메이션 총 794개
  dx_hornbunny-idle / dx_hornbunny-run          ✔ 생성
  dx_hornrabbit-idle / -run / -atk              ✔ 생성
  storm / pentagram / implosion-drive / sparks-glow
    → 24프레임 로드 + 애니 생성 + sprite.play() 성공
```

**Phaser 4 API 함정 2개** (검증 중 확인)

1. `TextureManager.exists()` 가 **없다** → `checkKey()` 를 쓴다.
   단 `checkKey()` 는 로드된 키에도 `false` 를 반환하는 경우가 있어,
   실제 확인은 `getTextureKeys()` 로 해야 한다.
2. `BootScene.create()` 가 `retryFailedLoads()` + `runTexGuardCycle()` 로
   **60~80초** 걸린다. 20초 대기로는 `buildAllAnims()` 이전이라
   애니메이션이 0개로 보인다 → 검증 시 충분히 대기해야 한다.

**FX 지연 등록 구조**: `registerFxSheet()` 는 부팅 시 호출되지 않는다.
`playFx()` 최초 호출 시 애니메이션을 만든다(기존 pixelfx 45종도 동일).
따라서 프리로드 후 `-play` 애니가 없는 것은 정상이며, 재생 시점에 생성된다.

### 재현 프로브 결과 (`scripts/probe_dx_assets.mjs`)

```
ok: true          totalTextures: 3461   totalAnims: 794
monsters  dx_hornbunny 10프레임 / dx_hornrabbit 10프레임  (64×64)
fx        8종 × 24프레임, 전부 play() 성공
anims     dx_*-idle 4f / dx_*-run 6f
missing   []                       http 36/36 → 200
```

`PROBE_URL=http://127.0.0.1:3100 PROBE_WAIT_MS=80000 node scripts/probe_dx_assets.mjs`
(프로덕션 빌드 + `PORT=3100 node server.js` 필요. 부팅 대기는 기본 80초)

**로컬 환경 오류 1건 (에셋과 무관)**: `/api/rank`·`/api/market` 이 500 을 낸다.
원인은 `SERTZ_BACKUP_KEY` 미설정(`[SERTZ-api] rank 실패`). 이 컨테이너의 환경변수 문제이며
`/api/version`·`/api/auth/sns`·`/api/party`·`/api/maps` 는 200 이다.

## 6. 사용하지 않은 것 (이유)

45개 팩 중 대부분은 이번에 쓰지 않았다. 선별 기준은 **규격 호환성 + 화풍 일치**:

| 제외 팩 | 이유 |
|---|---|
| `2D HD Character Knight` (15MB) | 640×512 HD **비픽셀아트** — CERTZ 96×64 스프라이트와 해상도 불일치 |
| `Free-Base 4-Direction-*` (48MB) | 원본이 `.aseprite` 중심, 시트 없음 → 별도 렌더 필요 |
| `Super Pixel Effects Gigapack` (6,206파일 30MB) | 개별 프레임 낱개 — 시트화 선행 필요 |
| `RPG Effect All Free` (273파일 66MB) | 동일 |
| `MetroCity 1/2/2.1`, `summer_village` | 현대/여름 도시 — 판타지 세계관 불일치 |
| `free-*-tower-defense` | 타워디펜스 전용(탑/필드) — 액션 RPG 불일치 |
| `BitFX FORGE` (Windows 앱) | 에셋이 아닌 도구 |

## 7. 재현

```bash
cd /root/workspace/CERTZ
/root/workspace/re_dump/.venv/bin/python tools/import_drive_20261109.py --dry  # 미리보기
/root/workspace/re_dump/.venv/bin/python tools/import_drive_20261109.py        # 생성
npx tsc --noEmit
node scripts/probe_dx_assets.mjs                                              # 런타임 검증
```

의존: `PIL`, `numpy` (스크립트는 `/root/workspace/re_dump/.venv` 사용)
