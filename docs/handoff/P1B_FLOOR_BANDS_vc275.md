# vc275 — P1b 타일맵 렌더 잘림/경계 틈 수정

> 지시서 `docs/handoff/NEXT_SESSION_2026-11-07.md` 과제 1 (최우선)
> 유저 지적: "건물 주변과 일부 맵 경계가 잘린 듯 보인다", "갈색 바닥과 초록색 바닥이
> 부자연스럽게 맞닿는다", **"타일 자체가 잘린 문제인지, 카메라가 잘못 렌더링하는
> 문제인지, 맵 경계가 잘못 생성된 문제인지 구분하라"**

## 원인 (파일:줄 + 수치)

### 먼저 유저가 요구한 3분기 판정

| 가설 | 판정 | 근거 |
|---|---|---|
| 카메라가 잘못 렌더링 | **아님** | `viewZoom()` 반영 후 월드가 뷰보다 작은 스테이지는 `interior_inn`/`interior_home`(832×832) 뿐이고 이는 의도된 실내 확대 연출. 필드·던전 198개는 전부 뷰보다 크다. 카메라 클램프는 `WorldScene.ts:2681-2692` 에서 수동 계산되며 정상. |
| 맵 경계 생성 오류 | **아님** | `lay.open` 그리드는 `tests/authored-layouts.test.mjs` 의 연결성 테스트(65 스토리방 + 100 행성필드)가 이미 보장. 이번에 손대지 않았다. |
| **타일 배치 문제** | **맞음** | 아래. |

### 실제 원인

`src/game/fx/AuthoredMapLayers.ts:87-91` (수정 전)

```ts
const x = Math.min(lay.cols - 1, Math.floor((c + 0.5) * unit / lay.cellW));
const y = Math.min(lay.rows - 1, Math.floor((r + 0.5) * unit / lay.cellH));
```

지면/경로/구조물 3개 레이어를 **unit(28·32px) 격자 Tilemap** 으로 그리면서,
그릴지 말지를 **타일 중심점이 속한 셀 하나**로 판정했다.

- 셀 크기: `cellW` 145.6~153.8px · `cellH` 131.1~143.75px (스테이지마다 다르고 **비정수**)
- 타일 조각: 28px 또는 32px
- 145.6 / 32 = 4.55 … **정수배가 아니다.**

따라서 중심이 열린 셀에 있어도 타일의 왼쪽 절반이 벽을 침범하고, 중심이 벽 셀에
있으면 오른쪽 절반이 통로를 비워 **1~16px 틈**이 생긴다. 이것이 "칼로 자른 듯한
직선 경계"와 "부자연스러운 접촉"의 정체다.

**실측 (게임과 동일 계산으로 픽셀 재구성, `tools/verify_floor_bands.py`)**

| 스테이지 | role | before bleed | before miss |
|---|---|---:|---:|
| howlrstone1x2 | paths | 61,469px² | 12,447px² |
| howlrstone1x2 | structures | 14,337px² | 54,019px² |
| dlcstargate1 | paths | 34,271px² | 34,205px² |
| dlcocean1 | paths | 8,550px² | 50,364px² |
| dlcneocity1 | paths | 15,621px² | 28,593px² |
| dlcprisma1 | paths | 36,901px² | 12,081px² |

*bleed = 통로/벽 밖으로 넘친 픽셀, miss = 칠해야 하는데 빈 픽셀*

## 수정 내용

`src/game/fx/AuthoredMapLayers.ts` — 3개 레이어를 **셀 크기로 클리핑한 TileSprite 밴드**로 교체.

1. 행마다 연속한 대상 셀을 **하나의 밴드로 병합**하고, 그 밴드를 `Math.round(c*cellW)` 경계에
   정확히 맞춘다. TileSprite 는 주어진 폭/높이로 잘리므로 **셀 경계를 넘을 수 없다** → bleed 0.
2. 칠해야 하는 셀은 빠짐없이 칠한다 → **miss 0**.
3. `setTilePosition(x % size, y % size)` 로 **전역 위상**을 맞춰 인접 밴드의 무늬가
   한 장처럼 이어진다(위상 리셋 없음 → 이음선 없음).
4. **타일을 확대/축소하지 않는다** (`setTileScale` 미사용). 256px 원본을 1:1 반복하므로
   픽셀아트 화질 저하가 없다 — 유저 제약 "최적화하되 퀄리티는 떨어뜨리지 말기" 준수.

### 시도했지만 폐기한 접근 (같은 함정 반복 방지)

**"타일이 걸친 셀이 전부 같은 상태일 때만 칠한다"** → bleed 는 0 이 됐지만 경계에 걸친
타일이 통째로 빠져 **miss 가 최대 +118,747px² 증가**했다. 유저가 지적한 "잘린 듯"이
오히려 심해지므로 폐기. 한 가지 규칙으로 bleed·miss 를 동시에 없앨 수는 없고,
**클리핑**만이 두 오차를 함께 0으로 만든다.

## 검증

### 테스트 (실제 출력)

```
1..286
# tests 286
# suites 0
# pass 286
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

기존 285 + 신규 1(`tests/floor-band-coverage.test.mjs`). 신규 테스트는 **165개 authored
스테이지 전부**에서 밴드가 ①무늬 위상이 전역 좌표의 나머지인지 ②셀 격자에 정렬됐는지
③경로/구조물이 요구 셀을 **정확히**(빠짐·침범 0) 덮는지 검사한다.

- `tsc --noEmit` → **0**
- `eslint src --max-warnings 0` → **0**
- `next build` → 성공

### before/after 수치 (전수, `tools/verify_floor_bands.py`)

| 스테이지 | role | before bleed | before miss | **after bleed** | **after miss** |
|---|---|---:|---:|---:|---:|
| dlcstargate1 | paths | 34,271 | 34,205 | **0** | **0** |
| dlcstargate1 | structures | 34,069 | 25,015 | **0** | **0** |
| dlcprisma1 | paths | 36,901 | 12,081 | **0** | **0** |
| dlcprisma1 | structures | 18,649 | 33,982 | **0** | **0** |
| dlcocean1 | paths | 8,550 | 50,364 | **0** | **0** |
| dlcocean1 | structures | 17,610 | 36,980 | **0** | **0** |
| dlcneocity1 | paths | 15,621 | 28,593 | **0** | **0** |
| dlcneocity1 | structures | 18,649 | 33,982 | **0** | **0** |
| howlrstone1x2 | paths | 61,469 | 12,447 | **0** | **0** |
| howlrstone1x2 | structures | 14,337 | 54,019 | **0** | **0** |

**after 총계 — bleed 0 / miss 0.** 지면(ground)은 양쪽 모두 0 이었다(전면을 덮으므로).

### 성능 (오브젝트 수)

| 항목 | 값 |
|---|---|
| 스테이지당 밴드 수 | 평균 **41.1** · 최대 **68** (`dlcsernium6`, 21×11 셀) |
| 셀 1개당 오브젝트 1개 대비 | **88.3% 감소** (평균 셀 352.4개) |
| 이전 Tilemap 방식 | 스테이지당 3개(레이어 수) |

Tilemap 3개 → TileSprite 41개로 오브젝트 수는 늘지만, 165개 스테이지 어디서도 68개를
넘지 않는다. 지면 렌더는 스테이지 진입 시 1회 생성이고 프레임마다 갱신되지 않으므로
런타임 비용은 사실상 0 이다.

### 증거 PNG

`reports/p1b/` (gitignore 대상, 로컬 산출물)

- `before_{stage}_view.png` / `after_{stage}_view.png` — 카메라 배율(viewZoom 2.0,
  1920×1080)로 벽에 접한 통로 지점을 같은 좌표에서 잘라 비교
- `{stage}_{role}.png` — 레이어별 렌더
- `summary.json` — 수치 요약

## 못 한 것과 이유

**브라우저 실기기 렌더 확인 불가.** `node server.js`(production)로 서버를 띄워
HTTP 200 을 확인했으나, 헤드리스 Chromium 에 **GPU 가 없어 `webgl: false`** 로
WebGL 컨텍스트가 생성되지 않았다. 그 결과 Phaser 부팅이 로딩 1~5%에서 멈춘다
(지시서 `NEXT_SESSION_2026-11-07.md` §1 에 이미 기록된 알려진 제약과 동일:
"헤드리스 Chrome 은 게임을 렌더하지 못한다").

대신 게임과 **동일한 계산**으로 픽셀을 재구성하는 정적 렌더러
(`tools/verify_floor_bands.py` + `tools/dump_authored_layouts.mjs`)를 만들어
165개 스테이지 전수 수치 검증과 before/after PNG 를 남겼다. 실기기(Galaxy S20+)
확인은 유저 측에서 필요하다.

## 재현 방법

```bash
# 1) 레이아웃 덤프 (게임과 동일 코드 경로)
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
     tools/dump_authored_layouts.mjs > /tmp/layouts.json

# 2) 전수 측정 + before/after PNG
python3 tools/verify_floor_bands.py /tmp/layouts.json
```
