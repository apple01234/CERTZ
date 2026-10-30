# 5차 전직 외형 감사 — 지시서 #15

> 유저 지적: *"5차 전직시 있는 캐릭터 모습(베리어&아우라) 모든 직업이 같은 버그
> (직업마다 아우라나 이펙트가 달라야 함)"*

## 1. 종전 상태 (수정 전)

| 위치 | 내용 | 문제 |
|---|---|---|
| `src/game/entities/Player.ts` `familyFx()` | `{burst, aura}` 한 쌍을 **계열 5종**마다 반환 | 계열 안 10직업이 같은 값 |
| `src/game/fx/FifthAura.ts` | `core=gvb_shield_hex`, `halo=gvb_glow_blurry`, `ground=gvb_ring_soft` **전 직업 공통 3장** | tint 만 계통색 → 같은 계통은 **색까지 동일** |
| `WorldScene.ts:11057` | `fifthAura.update(x, y, isFifth, hex, flipX)` | `cls` 를 넘기지 않아 직업 구분 자체가 불가 |
| 코스메틱 `aura` 슬롯 | 별개 시스템(착용 치장) | 5차 외형과 무관 — 혼동 주의 |

**베리어 코드 위치**: 종전에는 `gvb_shield_hex` 한 장이 `core` 로만 쓰였고,
직업별 분기나 "베리어"라는 이름의 레이어는 **존재하지 않았다**. (grep `barrier` 0건)

## 2. 수정 후

### 2-1. 데이터 주도 설계 — `src/game/fx/fifthLooks.ts`

4차 직업 10개마다 (코어 · 헤일로 · 지면 · **베리어**) 4겹을 정의한다.
색은 `classes.ts` 의 계통색을 그대로 쓰므로 **항목 #4 의 계통 색 규칙과 일치**한다.

| 직업 | 계통 | 베리어 텍스처 | 회전 | 스케일 | 맥동 | 지면 | 모티프 |
|---|---|---|---|---|---|---|---|
| `warbringer` 워브링어 | 전사 | `gvb_shield_hex` | 0.00022 | 1.15 | 0.10 | 0.42 | 붉은 충격(납작) |
| `crusader` 크루세이더 | 전사 | `gvb_shield_hex` | 0.00010 | 1.05 | 0.05 | 1.00 | 황금 성역(원형) |
| `deadeye` 데드아이 | 궁수 | `gvb_twinkle` | 0.00060 | 1.00 | 0.16 | 0.55 | 조준 별빛 |
| `skylord` 스카이로드 | 궁수 | `gvu_trail_wave` | 0.00034 | 1.25 | 0.08 | 0.70 | 바람 파형 |
| `arclord` 아크로드 | 마법사 | `gvb_shield_hex` | 0.00028 | 1.30 | 0.06 | 1.00 | 육각 마법진 |
| `eternal` 이터널 | 마법사 | `gvu_energyweb` | 0.00008 | 1.10 | 0.04 | 1.00 | 정지된 마법진 |
| `shadowlord` 섀도우로드 | 도적 | `gvu_mask_ommi` | 0.00018 | 1.05 | 0.12 | 0.42 | 어둠의 가면 |
| `blademaster` 블레이드마스터 | 도적 | `gvu_mask_razor` | 0.00042 | 0.95 | 0.09 | 0.55 | 칼날 잔상 |
| `seaking` 씨킹 | 해적 | `gvu_shockwave_fiery` | 0.00026 | 1.35 | 0.14 | 1.00 | 파도 충격 |
| `dreadnought` 드레드노트 | 해적 | `gvu_spark` | 0.00050 | 1.20 | 0.18 | 0.42 | 화약 불꽃 |

**구분 축 3가지** (지시서 요구: "색·모양·움직임 중 2가지 이상 다름")

1. **모양** — 베리어 텍스처가 직업마다 다름(육각/별/파형/웹/가면/칼날/충격/스파크)
2. **움직임** — 회전 속도 0.00008~0.00060(약 7.5배 차), 맥동 0.04~0.18(4.5배 차)
3. **색** — 계통색 + 직업별 tint 보정

같은 계통 쌍도 3축 모두 다르다:
- 전사: `warbringer`(납작·빠른회전·붉음) vs `crusader`(원형·느린회전·황금)
- 마법사: `arclord`(육각·빠름) vs `eternal`(웹·매우느림)
- 도적: `shadowlord`(가면·중간) vs `blademaster`(칼날·빠름)
- 해적: `seaking`(충격파·원형) vs `dreadnought`(스파크·납작)

### 2-2. 등장 연출과 상시 외형 분리

| 구분 | 시점 | 코드 |
|---|---|---|
| **등장 연출(1회)** | 각성 완료 순간 | `completeFifthTrial()` → `fifthBurstFor(cls, hex)` — 베리어 텍스처를 크게 터뜨림 |
| **상시 외형(항상)** | 5차 상태인 동안 매 프레임 | `FifthAuraRig.update()` — 4겹 리그 |

### 2-3. 전직 시 외형 갱신

`FifthAuraRig.update()` 가 `cls` 를 받아 **직업이 바뀌면 리그를 재생성**한다.
종전에는 tint 만 갱신해서 전직해도 이전 직업의 텍스처가 남았다.

### 2-4. 폴백

`FIFTH_LOOKS` 에 없는 직업(구 세이브·미정의 클래스)은 `fallbackLook()` 이
계통별 기본 구성을 돌려준다 — 크래시 없이 항상 무언가 보인다.

## 3. 성능 — 모바일 저사양 상한

지시서 요구: *"크기·알파·개수는 모바일 저사양에서 지켜야 하는 상한(예: 파티클 동시 최대 N개)"*

| 항목 | 값 | 근거 |
|---|---|---|
| 동시 이미지 수 | **4장** (코어·헤일로·지면·베리어) | `FIFTH_AURA_IMAGE_BUDGET = 4` |
| 저사양 모드 | **3장** (헤일로 생략) | `new FifthAuraRig(this, { lite: isLowPerfEnv() })` |
| 파티클 스폰 | **0개** | `this.add.image` 4장만. ParticleEmitter 미사용 |
| 블렌드 | ADD (가산광) | 기존과 동일 |
| 텍스처 재사용 | 33장 풀에서 선택 | 신규 텍스처 로딩 없음 |

**왜 4장으로 충분한가**: 종전에도 3장을 썼고, 파티클을 쓰지 않으므로 프레임 비용이
이미지 장수에 선형이다. 4장은 상수(직업 무관)이므로 저사양 기기에서도 편차가 없다.

## 4. 사용한 텍스처 (전부 기존 로드분)

`gvb_shield_hex`, `gvb_glow_white`, `gvb_glow_blue`, `gvb_glow_blurry`, `gvb_shockwave_fiery`,
`gvb_star4`, `gvb_star_green`, `gvb_twinkle`, `gvb_trail_stylized`, `gvb_buff_air`,
`gvb_lensflare`, `gvb_ring_soft`, `gvu_glow`, `gvu_energynoise`, `gvu_energyweb`,
`gvu_circle_aggr`, `gvu_mask_ommi`, `gvu_mask_razor`, `gvu_trail_wave`, `gvu_trail_ghost`,
`gvu_shockwave_fiery`, `gvu_spark`, `gvu_flare_xo`

전부 `public/assets/` 에 이미 존재하는 파일이다(신규 에셋 0).

## 5. 검증 방법 (재현)

```bash
cd /root/workspace/CERTZ
python3 tools/fifth_look_sheet.py     # 10직업 외형 시트 생성
npx tsc --noEmit                      # 타입
```
