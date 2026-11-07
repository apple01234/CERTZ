# SERTZ (CERTZ) — 다음 세션 작업 지시서

> 이 문서는 **다음 AI 에이전트에게 그대로 붙여넣는 실행 지시서**다.
> 현재 HEAD: `b17e7254` (vc274) / `main` / 원격 동기화 완료.
> 작성 시점 검증: **tsc 0 · eslint 0 · tests 285/285 pass**

---

## 0. 절대 규칙 (위반 시 작업 무효)

### 0-1. 스토리 문서 열람 제한 — 최우선
**`docs/handoff/evernote-approved/1.txt` ~ `8.txt` 이 8개만 읽는다.**
그 외의 기획·스토리 문서는 **절대 읽지 마라.** 목차/섹션 경계 탐색만 허용.

| 순서 | 파일 | 정본 이름 |
|---|---|---|
| 1 | `1.txt` | 하루는 세 가지 사람이 있다-개정판 ← **최우선** |
| 2 | `2.txt` | 하루는 웨폰마스터가 되었다 스토리-1 |
| 3 | `3.txt` | 영프 웨폰마스터 능력 정리본 |
| 4 | `4.txt` | 영프 웨폰마스터 능력 정보서 |
| 5 | `5.txt` | 영프 1기 정리본 (본편 0~15화만) |
| 6 | `6.txt` | 눈의왕국 스노리카 |
| 7 | `7.txt` | 영준프린세스-가문 정리본 |
| 8 | `8.txt` | 영프 2기 정리본(그랜드플래닛) — **작성된 분량까지만** |

충돌 시 우선순위: 개정판 > 스토리-1 > 능력 정리본/정보서 > 1기 정리본 > 스노리카 > 가문 정리본 > 2기 정리본

- 9개의 바다 설정은 **복원하지 않는다.**
- 미작성된 후속 전개를 원작에 있는 것처럼 만들어내지 않는다.

### 0-2. 에셋 생성 금지
- **AI 이미지/픽셀아트/스프라이트/타일셋 생성 금지.**
- **절차적 그래픽 코드로 새 타일 이미지를 만드는 것도 금지.**
  (vc274에서 `scripts/make_stone_floors.py` 가 정확히 이 위반이었고, 5색 얼룩 타일의 근원이었다. 폐기됨.)
- 허용: ① 프로젝트에 이미 있는 사용 허가 확인 에셋 ② itch.io/OpenGameArt/Kenney 의 CC0
- 외부 에셋 도입 시 **라이선스 원문을 manifest 에 기록**한다.

### 0-3. 검증 없는 "고쳤다" 보고 금지
유저가 과장 보고로 여러 번 화를 냈다. 반드시:
- **수치**로 보고 (색 수 5→1330, seam 15.1→3.2 처럼)
- **테스트 실행 출력**을 실제로 붙인다
- 재현 못 한 것은 **"재현 불가"라고 정직하게** 쓴다

### 0-4. 세이브 호환
`src/game/config.ts` SaveData + 복원 + buildSave **3곳 싱크**.
식별자(`stage`/`questId`/`classKey`/`bossKey`)는 바꾸지 않는다. 표시 이름만.

---

## 1. 환경 / 빌드

### 작업 위치
```
C:\coding\CERTZ
```

### ⚠️ PowerShell 5.1 함정 (이번 세션에서 크게 당했다)
1. **`.ps1` 실행 차단** → node 로 직접 실행한다.
2. **`cd` 가 호출마다 초기화** → 같은 호출 안에서 `Set-Location` 할 것.
3. **`node -e "..."` 안에 한글·중괄호·따옴표를 넣으면 PowerShell 이 문자열을 깨뜨린다.**
   → 복잡한 스크립트는 `write` 도구로 `.mjs` 파일을 만들어 `node 파일.mjs` 로 실행하고, 끝나면 지운다.
4. `git push` 는 stderr 에 "To https://..." 를 뱉고 **exit 1** 을 반환하지만 **성공**한다.
   `old..new main -> main` 줄을 찾아 확인하라.

### 명령어
```powershell
Set-Location C:\coding\CERTZ

# 타입체크 (기준선 0)
node node_modules/typescript/lib/_tsc.js --noEmit

# 린트 (기준선 0 — BABEL 500KB 안내문은 stderr 노이즈, 무시)
node node_modules/eslint/bin/eslint.js src --max-warnings 0

# 전체 테스트 (기준선 285/285)
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/*.test.mjs

# 개별 테스트
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/quest-progress.test.mjs
```

### Python (PIL 필요)
`tests/python.mjs` 가 자동 탐색한다. 수동 지정 시:
```powershell
$env:REA_PYTHON = "C:\Users\apple\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
```
`PYTHONUTF8=1` 은 `tests/python.mjs` 가 자체적으로 넣는다.

### 스크린샷 / 렌더
```powershell
$py = "C:\Users\apple\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
& $py -c "from PIL import Image; ..."
```
**헤드리스 Chrome 은 게임을 렌더하지 못한다** (로딩 50% 정지, 콘솔 클린).
`node server.js` 로 띄우고 `/editor` 페이지를 쓰거나, Phaser 없이 **정적 렌더**로 검증하라.

---

## 2. vc274 에서 실제로 한 일 (중복 작업 방지)

| 영역 | 상태 | 핵심 파일 |
|---|---|---|
| P1 지면 교체 | **완료** | `tileThemes.ts`, `public/assets/ground/*.png` |
| P2 퀘스트 카운트 | **완료** | `src/game/questProgress.ts` (신규) |
| P4 요구량 곡선 | **완료** | `stages.ts` (`questNeedByLv`, `zoneSpawnCap`) |
| P5 스킬 진화 | **완료(12슬롯)** | `src/game/skillEvolution.ts` (신규), `Player.ts` |
| P6 궁극기 커버 | **완료 35/35** | `fx/ultFinale.ts` |
| 무음 사운드 | **완료 22건** | `fx/ultFinale.ts`, `Player.ts`, `Boss.ts` |
| P7a 정본 감사 | **1차 완료** | `data.ts`, `grandPlanetCanon.ts` |
| P7b 보스 개편 | **완료** | `entities/bossPhases.ts` (신규) |
| **P1b 렌더 잘림/경계** | **미완** | ← 아래 과제 1 |
| **P3 외부 에셋** | **미적용** | ← 아래 과제 2 |
| **P7c 스토리 본문** | **미완** | ← 아래 과제 3 |

### vc274 에서 밝혀낸 구조적 사실 (다시 조사하지 말 것)
- **`CHAPTERS` 배열은 DLC 10개뿐이다** (`dlcstargate`~`dlcsernium`, num 11~20).
  본편은 `HOWLRSTONE_CHAPTERS` 65스테이지(`howlrstoneNxM`)로 별도 존재한다.
  "본편 1~10장이 없다"고 오판하지 마라.
- STAGES 200개 구성: `howlrstone` 65 + DLC 100 + 챕터마을 11 + `village` + `youngprincessv` + interior 2 + dojang/gate/closet/praid/tower/park + `r` 15(재림).
- **마을은 `isVillage: true`** 라 `layout === null` → `renderAuthoredMapLayers` / `buildDungeonWalls` / `drawGroundEdges` 전부 스킵된다. 마을 렌더 경로는 별개다.
- `subEnemyMix()` 구역당 스폰은 `zoneSpawnCap(챕터)` 로 결정 (20/24/28/32).
- `SKILL5_INFO` = 35키, `SKILL5B_INFO` = 35키(동일 집합). `useSkill5b()` 는 `ULT_FINALE` 을 참조하지 않고 자체 switch 를 쓴다.
- `audio.ts` 의 `SKILL_SFX_FILES` 는 **33키**. `skill()` 은 없는 키를 **조용히 무음** 처리한다 → `tests/sfx-keys.test.mjs` 가 재발을 막는다.

---

## 3. 다음 과제 (우선순위 순)

### 🔴 과제 1 — P1b: 타일맵 렌더링 잘림/경계 틈 (최우선)

**유저 스크린샷 지적 (원문)**
> "건물 주변과 일부 맵 경계가 잘린 듯 보인다"
> "화면 경계에서 월드 일부가 끊겨 보인다"
> "갈색 바닥과 초록색 바닥이 부자연스럽게 맞닿는다"
> "건물과 지면의 그래픽 스타일이 일치하지 않는다"
> 그리고: **"타일 자체가 잘린 문제인지, 카메라가 잘못 렌더링하는 문제인지, 맵 경계가 잘못 생성된 문제인지 구분한다"**

**완료 조건 (유저 명시)**
- 정상 이동 중 타일이 사라지거나 잘리지 않는다
- 카메라 이동/줌 변경 시 타일 사이에 빈틈이 없다
- 지역 경계에서 불필요한 1픽셀 선이 없다
- PC/모바일 화면 비율 모두 정상
- 월드 경계를 넘어서도 예외가 없다

**미완 사유**: vc274 에서는 원인 후보 정리까지만 했다. 담당 에이전트가 실제 재현에 실패했다.

**조사 지점 (vc274 실측 좌표)**
```
src/game/scenes/WorldScene.ts:1695-1802  지면 렌더 (256px 블록 TileSprite + 위상 정렬 setTilePosition(bx % __tw, by % __th))
                          :1809-1810  physics.world / cameras.main setBounds
                          :1821       setupCameraClampFix()
                          :1834-1835  buildDungeonWalls / drawGroundEdges (:2918)
src/game/PhaserGame.ts                   pixelArt:true, roundPixels:true, antialias:false
                                         scale: RESIZE + autoCenter:NO_CENTER
                                         zoom: renderResolutionFor(innerWidth, innerHeight)  ← BACKBUF_MAX 1920
src/game/fx/AuthoredMapLayers.ts         prop(): setOrigin(0.5,1) + 배치 y=(r+0.5)*cellH → 세로 긴 프롭이 셀 넘침
                                         :196-198  propNoCollide 는 4면 밖이면 아예 안 그림("잘린 듯"의 원인 후보)
src/game/autotile.ts                     4비트 오토타일 구현됨 — 그러나 drawGroundEdges 에서만 쓰이고 authored 경로에서는 미사용
                                         → "갈색/초록 부자연스러운 접촉"의 유력 원인
```

**주의**
- `tileThemes.ts` 는 vc274 에서 갓 교체했으니 **다시 건드리지 마라.**
- `WorldScene.ts` 는 18,200줄이다. **함수 단위로 짧게 교체**하고 전체 재작성 금지.

---

### 🟠 과제 2 — P3: 외부 타일셋 도입 (CC0 확인 완료)

`public/assets/campaign/drive/` 에 **DCSS(Dungeon Crawl Stone Soup) CC0** 팩이 있다.
```
manifest: public/assets/campaign/drive/manifest.json
  pack:    Dungeon Crawl Stone Soup tiles, Oct-5-2010
  source:  https://opengameart.org/content/dungeon-crawl-32x32-tiles
  license: CC0-1.0   (상업·수정·재배포 허용, 표기 의무 없음)
LICENSE.txt 동봉, 파일별 sha256 기록됨.
```

**vc274 실측 — 어떤 것이 진짜 쓸만한가**
| 후보 | 색 수 | 4×4 판정 |
|---|---:|---|
| `floor-garden` | 691 | ✅ **격자 없음, 최고 품질** |
| `floor-forest` | 59 | ✅ 격자 없음, 자연스러운 풀숲 |
| `floor-snow` | 8 | △ 격자 없으나 회색조 |
| `floor-volcano` | 5 | △ 균열 있으나 32px 격자 |
| `floor-castle` / `floor-ruin` / `floor-astral` / `floor-desert` | 5~8 | ❌ **32px 격자 명확 — ground_violet 과 같은 실패 모드** |

**핵심 교훈**: DCSS 지면은 32×32 단일 타일이라 넓게 깔면 32px 주기가 드러난다.
**색 수 ≤ 10 이면 격자가 보인다.** 지면으로 쓰려면 색 수가 많은 것만 골라라.

**할 일**
1. `floor-garden` / `floor-forest` 를 **어느 지역에** 쓸지 결정 (현재 지면은 vc274 의 256px 재사용 중).
2. 새로 도입한다면 `AUTHORED_GROUND_SOURCES` 를 `{size:32, unit:32}` 로, `GROUND_TILE_MAP` 도 갱신.
3. `reports/ground-before/` · `reports/ground-after/` 와 같은 **전/후 4×4 렌더 PNG** 를 남겨라.
4. `tests/floor-tiles.test.mjs` · `tests/tilemap-editor.test.mjs` 의 규격 기대값을 함께 갱신 (검사 기준을 낮추지는 말 것).

---

### 🟡 과제 3 — P7c: 스토리 본문 확장

vc274 는 **정본 감사(실존 인물명/타작품 고유명 제거)만** 했다. 본문 재구성은 미완.

**정본 대조 실측 (vc274)**
```
에델리오나 4  에스테반 9  크렌렐브 1  이덴미르 0  에크레디트 1
그래스트 2    데스티니 6  페이트 1    카르리온 6  아리아노 2
플래임 5      오르페우스 7 셀리나 1    이그니션 6  질리언 0
리버스 14     페르티에스 0 에버포스 0  샌티널 0    카르테르 0
클로체스 2    라바이즈 0   유월 0      하나사키 0  스노리카 2
```
**14개 가문이 코드에 전혀 없다.** 특히 **제로세계 6가문**(에버포스·샌티널·카르테르·라바이즈·유월·하나사키)이 통째로 빠져 있다.

**할 일**
1. 1.txt(개정판) 중심으로 제1막(세 가지 사람) → 제2막(웨폰마스터의 길) → 제3막(그랜드플래닛) 재구성.
2. 중심 질문을 실제 게임플레이에 연결:
   > **"누군가를 죽이는 사람, 두려움에 도망치는 사람, 누군가를 살리는 사람. 너는 어떤 사람이 되고 싶은가?"**
3. 제로세계 가문 6개를 코드에 반영 (7.txt 기준).
4. 스토리 이벤트를 텍스트 대화만으로 처리하지 말고 게임플레이와 연결.

---

### 🟢 과제 4 — 남은 개선 (시간 되면)

1. **P5 확장**: vc274 는 12슬롯만 진화시켰다. `skillEvolution.ts` 에 `EVOLVED_SLOTS` 를 추가하고 `evoCount/evoRange` 를 재사용해 C/V/B 슬롯으로 확장. `ponytail:` 주석이 경로를 적어뒀다.
2. **P6 궁극기 연출 차별화**: 35개가 데이터상 구별되지만 실제 브라우저 시각 검증은 안 했다.
3. **시간제 퀘스트 검증**: "9분에 260마리" 같은 퀘스트는 현재 없다. 생기면 `tests/quest-balance.test.mjs` 의 `maxKillsIn` 으로 재검증.
4. **퀘스트 포기/재수락**: 현재 UI 자체가 없다. 검증 범위 밖.

---

## 4. 이번 세션에서 크게 당한 함정 (반복 금지)

### 4-1. 테스트가 Windows 경로 버그로 통째로 죽어 있었다
`tests/git-head-module.mjs` 의 ``import(`${tmp}?t=${Date.now()}`)`` 가
Windows 에서 `c:` 를 URL 스킴으로 오인 → `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
**스냅샷 테스트 2개가 아무 assert 도 실행하지 못하고 죽어 있었고, 그 뒤에 숨어 있던 실제 데이터 버그:**
> `stages.ts` 의 `PREV_STAGE` 첫 챕터 비대칭 —
> 전진은 `dlcstargatev → dlcstargate1` 인데 복귀는 `dlcstargate1 → village` 로 마을을 건너뛰었다.

**교훈**: 테스트가 "환경 문제"로 실패하면 **고치고 나서 다시 봐라.** 그 뒤에 진짜 버그가 숨어 있다.
vc274 에서 기존 실패 11개를 전부 고쳤더니 **실제 버그 3개가 추가로 나왔다.**

### 4-2. "조용히 실패하는" 코드
- `audio.sfx.skill()` 은 없는 키를 무음 처리 → 궁극기 22개가 소리 없이 나갔다.
- `startVx` 의 `default:` 가 미구현 패턴을 `mode="idle"` 로 조용히 넘김 → 보스 패턴 2개가 no-op.
- **새 기능을 넣을 때 "실패하면 조용히 넘어가는" 경로가 없는지 반드시 확인하라.**
- vc274 는 `tests/sfx-keys.test.mjs` 같은 **전수 스캔 테스트**로 재발을 막았다. 같은 패턴을 써라.

### 4-3. 내가 지시한 목표가 틀렸던 사례
"후반/초반 소요시간 비율을 30배 이내로" 라고 지시했는데, **유저 목표표 자체가 이미 50배 비율을 내포**하고 있었다(1000/20).
담당 에이전트가 "물리적으로 불가능하다"고 정직하게 반박해서 바로잡았다.
**지시를 받으면 목표 자체가 성립하는지 먼저 계산하라. 안 되면 "안 된다"고 말하라.**

---

## 5. 보고 형식

```markdown
## 원인 (파일:줄 + 수치)
## 수정 내용
## 검증
- tsc: 0
- eslint: 0
- tests: N/N pass (실제 출력 붙임)
## before/after 수치 또는 스크린샷 경로
## 못 한 것과 이유
```

형용사를 쓰지 말고 **숫자**로 써라. "자연스러워졌습니다" 대신 "색 수 5 → 1330".

---

## 6. 작업 시작 체크리스트

```
[ ] git status 로 미커밋 변경 없는지 확인
[ ] tsc / eslint / tests 기준선이 0 / 0 / 285 통과인지 확인
     (다르면 먼저 그 원인을 밝혀라 — 위 4-1 참조)
[ ] 스토리 문서는 1.txt~8.txt 만 읽기로 확인
[ ] 작업할 과제의 파일을 먼저 read 로 읽고 실제 흐름 추적
[ ] ponytail: 이게 정말 필요한가 → 이미 있나 → 한 줄로 되나
```
