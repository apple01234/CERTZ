# vc288 실플레이 검증 기록

> 보스 카운트다운 · 방어막 게이지 · 침묵 상태이상 · 보스 절대 HP 를 실제 브라우저에서 확인한 기록.
> 스크린샷은 `reports/play/vc288boss/` 에 있으며 `/reports/` 는 `.gitignore` 대상이라
> 저장소에 커밋되지 않는다. 이 문서가 그 사실관계를 남기는 역할을 한다.

## 실행 환경

| 항목 | 값 |
|---|---|
| 빌드 | `npm run build:next` (Turbopack) → `node server.js`, `NODE_ENV=production` |
| 브라우저 | 헤드리스 Chrome (`--headless=new`, SwiftShader, 640×360) |
| 조작 | CDP(Chrome DevTools Protocol) 로 DOM 클릭 · 키 이벤트 주입 |
| 진입 | 로비 → 캐릭터 생성(`검증`, Lv120) → 세이브 `stage` 를 `howlrstone3x5` 로 패치 → 새로고침 |

## 확인된 것

### ① 보스 절대 HP — 확인

보스 바가 퍼센트만 표시하던 것을 `73,245 / 100,000  73%` 형태로 바꿨다.
실제 화면에서 `952,200 / 952,200  100%` 로 표시되는 것을 확인했다.

- 증거: `2_boss_loading.png` (126KB), `3_boss_enter.png` (125KB), `5_silence.png`

### ② 침묵 상태이상 HUD — 확인

`EventBus.emit('hud', { dots: [{kind:'silence', remain:2500, total:2500}] })` 로
HUD 렌더 경로를 직접 검증했다. DOM 조회 결과 **`침묵 3초`** 라벨이 반환됐고,
화면 좌측 LV 배지 아래에 붉은 테두리 상태이상 아이콘(🔇)이 실제로 그려졌다.

- 런타임 반환값: `{eb:true, injected:true}` → `침묵 표시: 침묵 3초`
- 증거: `5_silence.png` (184KB) — 좌측 상단 아이콘

### ③ 보스 스테이지 진입 자체 — 확인

보스 조우 컷씬에 배경으로 드래곤 보스가 실제 렌더되고, 대사창이 정상 동작했다.
`[노림] 비다의 군단장 해롤드` 보스 바가 상단에 표시됐다.

- 증거: `2_boss_loading.png`, `3_after_cutscene.png` (185KB)

### ④ 보스 카운트다운 — 코드로만 확인, 화면 캡처는 실패

`Boss.startCountdown()` 이 낙하 착지 콜백에서 호출되고, `tick()` 이
`if (this.countdown > 0) return` 으로 행동을 멈추는 것은 테스트 5개로 고정했다
(`tests/boss-countdown.test.mjs`).

**화면 캡처는 실패했다.** 카운트다운은 3초뿐인데, 컷씬을 넘기는 도중에 시작되어
스크린샷 320ms 간격으로도 잡히지 않았다. 컷씬 대사 → 전투 화면으로 넘어가는
프레임 사이에 통째로 지나갔다.

첫 시도에서 `3` 이 표시된 프레임을 한 번 얻었으나, 그 뒤 캡처 폴더를 지우면서
함께 사라졌다(복구 불가 — `reports/` 는 gitignore).

ponytail: 카운트다운 화면 증거가 꼭 필요하면 컷씬을 건너뛰는 경로를 만들거나
`startCountdown` 의 STEPS 를 일시적으로 늘려 캡처하면 된다. 지금은 테스트로
계약이 고정돼 있어 굳이 그렇게 하지 않았다.

## 이번 검증에서 배운 것 (같은 실수 방지)

1. **`reports/` 는 gitignore 다.** 캡처 폴더를 `Remove-Item -Recurse` 로 지우면
   증거가 영구 소실된다. 지우기 전에 남길 것만 옮겨야 한다.
2. **DialogueBox 는 `e.code === "Space"` 를 본다.** `key: ' '` 만 넣으면 무시되어
   컷씬이 그대로 멈춘다. 실제로 이 때문에 두 번 막혔다.
3. **HUD 이벤트 이름은 `"hud"` 다.** `"hud:update"` 가 아니다.
   (`useGameUi.ts` 의 `EventBus.on("hud", onHud)`)
4. **게임은 SPA다.** `/game` 같은 라우트가 없다. `/` 하나뿐이며 로비 → 게임 전환이
   React 상태로 이뤄진다.
