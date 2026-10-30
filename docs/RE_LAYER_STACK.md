# RE 분석 — 맵 구조·레이어·오브젝트 배치·카메라·컷씬 연출

지시 #13 "리버스 엔지니어링으로 맵의 오브젝트 배치나 레이어 구조&맵 구조, 카메라 및
스토리 컷씬연출 등을 잘 분석해서 적용해" 의 실측 기록.

대상: `COBB CAN MOVE v1.7` (CTF/Clickteam Fusion, `www/data.json` 413KB)
보조: GameMaker 3종(`data.win`), Holo Dungeon(Unity 2019.4)

---

## 1. 맵 레이어 스택 — SERTZ는 depth가 무작위, CTF는 명시적

### CTF 실측 (game 맵, 12레이어)

| order | 레이어 | tint | 역할 |
|---|---|---|---|
| 0 | `bg` | **rgb(0,0,0)** | 배경 — 순수 어둠 |
| 1 | `tilemap` | rgb(64,81,91) | 지형 타일 |
| 2 | `floor` | rgb(64,81,91) | 바닥 장식 |
| 3 | `gm` | rgb(64,81,91) | 게임 오브젝트 |
| 4 | `monster` | rgb(64,81,91) | 적 |
| 5 | `particles` | rgb(64,81,91) | 파티클 |
| 6 | `lighting` | **rgb(0,0,0)** | 광원 |
| 7 | `glyphs` | rgb(64,81,91) | 문자 이펙트 |
| 8 | `hud` | rgb(64,81,91) | HUD |
| 9 | `invis` | — | 숨김 (visible=false) |
| 10 | `pause` | rgb(64,81,91) | 일시정지 |
| 11 | `global` | rgb(64,81,91) | 전역 — **bloom + tarp** |

`game finale` 맵은 여기에 `flames` 레이어가 추가된 13레이어.

### tint 집계 (14맵 × 12~13레이어 = 69개)

| tint | 횟수 | 용도 |
|---|---|---|
| `#40515b` rgb(64,81,91) | **53** | 지형·오브젝트 기본 톤 (청회색) |
| `#000000` rgb(0,0,0) | **15** | `bg` · `lighting` 전용 |

**관례**: 지형은 청회색, **배경과 광원은 검정**. 즉 "어둠 위에 광원을 얹는" 구조.

### 이펙트 분포

| 이펙트 | 횟수 | 위치 |
|---|---|---|
| `bloom` | **13/14맵** | 항상 `global` 레이어 |
| `tarp` | 13 | `global` (배경 타일링) |
| `tilemap` / `floor` / `gm` / `particles` / `lighting` | 각 3 | 해당 레이어 |

### SERTZ 현재 상태

`setDepth()` 호출이 **depth 0~26에 흩어져** 있고, 어떤 것이 무엇 위인지 코드에서
추적해야 알 수 있었다. depth 0만 해도 7곳, depth 3이 21곳, depth 11이 11곳.

### 적용 (`src/game/layers.ts` 신규)

`LAYER` 상수로 실측 순서를 SERTZ 스케일로 정의:

```
BG 0 · TILEMAP 1 · FLOOR 3 · MONSTER 11 · GM 12 · PARTICLES 20
LIGHTING 100 · GLYPHS 22 · HUD 200 · INVIS 900 · PAUSE 1000 · GLOBAL 3000
```

**기존 depth 값은 바꾸지 않았다.** 0~26을 쓰는 코드가 100곳이 넘어 일괄 치환이
회귀 위험이 크다. 대신 새로 추가하는 오브젝트와 경계가 모호한 곳에만 이 상수를 쓴다.

`LAYER_TINT`로 `bg·lighting = 검정`, `floor 폴백 = #40515b` 도 함께 정의.

---

## 2. 오브젝트 배치 — "같은 좌표에 두 레이어" 기법

### CTF 실측 (`level select` 맵 `content` 레이어)

```
[440, 100, 0, 78, 18, ..., tint[0.6,0.6,0.6,1], origin(0.5,0.5), ...]  ← 그림자층
[440, 100, 0, 48, 12, ..., tint[1.0,0.77,0.12,1], origin(0.5,0.5), ...] ← 본체층
```

- **동일 좌표(440,100)** 에 두 오브젝트를 겹친다
- 아래층: 어두운 tint(0.6) + 큰 크기(78×18)
- 위층: 원색 tint(1.0) + 작은 크기(48×12)
- 둘 다 `origin(0.5, 0.5)` **중앙 정렬**

이게 **그림자 + 본체를 레이어 2장으로 만드는** 기법이다. 블러 없이 선명한 이중 테두리.

### SERTZ 현재 상태

네임태그는 `setStroke()` 한 겹뿐이다. 밝은 지형(눈·모래) 위에서 획이 묻힌다.

### 적용 (`refreshPlayerTag`)

```ts
this.playerNameTag.setStroke(gm ? "#3a2400" : "#0a2030", 4);
this.playerNameTag.setShadow(0, 2, gm ? "#1a0d00" : "#04121c", 5, true, true);
```

Phaser에는 레이어 2장 대신 `setShadow`가 있으므로, stroke 바깥에 shadow를 한 겹 더
얹어 **동일한 이중 테두리** 결과를 만든다 (오브젝트 2배 생성 없음).

---

## 3. 카메라 — CTF는 추적 + 페이드, SERTZ는 팬 + 줌

### CTF 실측

이벤트시트(`project[6]`, 15그룹) 전체를 훑어 카메라 관련 액션을 수집한 결과:

| 액션 | 횟수 |
|---|---|
| `ScrollTo` | 1 |
| `fadeIn` | 2 |
| `fadeOut` | 2 |

- 별도 줌·회전·셰이크 액션이 **없다**
- 카메라는 `ScrollTo`(플레이어 추적) + 씬 전환은 `fadeIn`/`fadeOut` 뿐
- 화면 640×360, `origin(0.5,0.5)` — 작은 해상도에 중앙 고정

### SERTZ 현재 상태

훨씬 정교하다: `cam.pan()` 보간, `cam.zoomTo()`, 셰이크, `camFxUntil` 워치독,
`StoryCutscene`의 샷 배열(panMs/holdMs/dialogue/zoom).

### 결론 — 카메라는 **이식하지 않는다**

CTF는 640×360 소형 화면의 단순 추적이고, SERTZ는 대형 맵 + 연출 카메라다.
SERTZ가 이미 상위 구현이므로 CTF를 참고할 것이 없다.

---

## 4. 스토리 컷씬 연출 — SERTZ가 더 정교함

### CTF

`fadeIn` / `fadeOut` 만 사용. 샷 전환 개념 없음(단일 맵 전환).

### SERTZ `showChapterCard` 실측

```ts
veil  : alpha 0→0.78, 420ms Sine.easeOut      (어둠 깔기)
rule  : width 0→300,  560ms Sine.easeOut      (구분선 확장)
tCh/tTitle : alpha 0→1, y +10, 560ms          (텍스트 부상)
tSub  : alpha 0→1, delay 160ms, 460ms         (부제 지연)
2050ms 후 전체 alpha 0, 420ms easeIn → cleanup
```

4단계 시차 연출 + 총 2.05초 홀드. CTF의 단순 fade보다 명확히 정교하다.

### 적용 — 없음 (SERTZ 유지)

---

## 5. 결과 요약

| 분석 항목 | CTF 실측 | SERTZ | 조치 |
|---|---|---|---|
| 레이어 스택 | 12레이어 명시적 순서 | depth 0~26 무작위 | **`layers.ts` 상수 도입** |
| 레이어 tint | 지형 #40515b / 배경·광원 #000 | 스테이지별 `groundTint` | **`LAYER_TINT` 정의** |
| 블룸 | 13/14맵 `global` 레이어 | `addAmbientBloom` (조건부) | 유지 (이미 있음) |
| 배경 타일링 | `tarp` 13회 | `TileSprite` 반복 | 유지 (동등) |
| 오브젝트 그림자 | 2레이어 겹침 | stroke 1겹 | **`setShadow` 이중 테두리** |
| 카메라 | `ScrollTo` + fade | pan/zoom/셰이크/워치독 | 이식 안 함 (SERTZ 우위) |
| 컷씬 | `fadeIn/Out` | 4단계 시차 + 2.05초 | 이식 안 함 (SERTZ 우위) |

---

## 6. 재현 방법

```bash
# CTF 레이어·오브젝트·이펙트 분석
python3 /root/.hermes/cache/scratch/ctf_layers.py
# → ctf_layers.json (37,537 B)

# GameMaker 맵 구조
python3 /root/.hermes/cache/scratch/gm_extract.py <data.win> ...
# → gm_final.json (맵 261개)

# Holo Dungeon Move 추출
python3 /root/.hermes/cache/scratch/holo_moves.py
# → holo_moves.json (76개)
```

CTF `data.json` 구조:
```
project[5]  = 맵 리스트
map         = [name, w, h, ?, ?, originX, originY, bgEffect, id, layers, [], []]
layer       = [name, order, id, visible, tint[r,g,b], ..., [14]=objects, ..., [20]=effects]
object      = [x, y, ?, w, h, ?, ?, tint[r,g,b,a], originX, originY, ...]
```
