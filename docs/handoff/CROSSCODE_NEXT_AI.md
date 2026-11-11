# 다음 AI 작업 지시서 — CrossCode Deep 조사(2차) 및 기존 게임 개선

> **2026-11-11 최신 적용 — vc267/v2.2.11:** 첫 전투 캡처에서 확인한 첫 피격 전 적 HP와 현재 입력 안내를 추가 적용했다. 기존 HP바를 교전 시에도 재사용하고 실제 몸 크기에 맞춰 배치하며 공격 준비/돌진 경고색을 표시한다. 회피 수련 돌진 버튼 강조와 잘못된 0초 안내를 수정했다. 전체 609 tests와 PC·실제 멀티터치 튜토리얼 완료·표시 정리 검증 통과. [구현·검증](../qa/2026-11-11/crosscode/APPLIED_v267.md). vc266 회피 성공 판정·보스 후딜 표시는 유지한다. **아래의 전투 미관찰/미적용 설명은 과거 상태이며, 조준·차지·후반 보스 조사는 아직 남았다.**

> 이 문서는 이전 인계서를 **대체**한다. 이전 문서의 "New Game 진입 막힘" 항목은 이번 세션에서 해결됐다.

---

## 0. 한 줄 요약

CrossCode 데모 **진입 막힘은 해결됐다**. 원인은 로딩 정지가 아니라 첫 실행 안내 모달이 입력을 먹고 있었던 것이다. 이제 타이틀 → New Game → 컷신 → **WASD로 실제 이동 가능한 플레이어블 상태**까지 재현된다. 남은 일은 **전투·스킬·보스 관찰 → CERTZ에 작은 개선 적용 → 회귀 검증 → 배포**다.

---

## 1. 작업 대상과 권한

- 유일한 저장소: `https://github.com/apple01234/CERTZ`, 브랜치 `main`. 로컬 경로 `/root/workspace/CERTZ`. 시작 시 `git status`와 최신 원격 HEAD를 확인하고 기존 변경을 보존한다.
- 사용자는 공식 CrossCode 페이지/무료 웹 데모의 **격리 브라우저 실행**을 `ㅇ`으로, 이어 **Deep 모드**를 `아니 딥모드 사용 ㄱㄱ`로 명시 승인했다. 같은 범위의 실행·Deep 사용에 **재확인을 요구하지 않는다**.
- 참고 URL: `https://www.cross-code.com/en/start`
- 기존 `GameRoot → WorldScene → Player` 구조, 기능·세이브·장비·직업·멀티·픽셀아트를 **유지**한다. 새 게임 엔진으로 교체하지 않는다.
- 스토리 변경이 필요하면 `AGENTS.md` 및 정본 `docs/handoff/evernote-approved/1.txt`~`8.txt`만 **순서대로** 읽는다. 다른 스토리 문서를 정본으로 혼합하지 않는다.
- 기존/다운로드 에셋 우선. **CrossCode의 코드·그림·음악을 게임 런타임으로 복사하지 않는다.** 분석 결과와 설계 원칙만 현재 게임에 맞게 적용한다.

---

## 2. ✅ 해결된 것 — New Game 진입 (이번 세션 성과)

### 증상
이전 세션에서 New Game 이후 진입이 안 됐고, 로딩 진행률이 `0.99997`에서 멈춘 것처럼 보였다. `web_walkthrough_record`의 `press(body, Enter)`는 `DOM.focus: Element is not focusable`로 **0/2단계 실패**했다.

### 실제 원인 (관찰 확정)
로딩 정지가 아니었다. **첫 실행 시 1회 표시되는 `German Language option added!` 안내 모달이 모든 입력을 흡수**하고 있었다. 그래서 어떤 키/클릭도 메뉴에 도달하지 못했다. 로딩률 `0.99997`은 "타이틀 대기" 상태의 정상값이다.

### 해결 절차 (그대로 재현 가능)
1. `web_site_open` 으로 `https://www.cross-code.com/en/start` 연다 (width 1280, height 800, settle_ms 7000).
2. **캔버스 중앙을 클릭**한다 → 모달이 닫힌다. 화면이 밝아지고 `New Game`이 주황 테두리로 선택된다.
3. `Enter` 를 누르거나 `New Game`을 클릭한다 → `Initializing avatar` 인트로가 나온다.
4. `Enter` 를 10~40회 연타해 컷신 대화를 넘긴다 → **`Press W A S D to move around`** 프롬프트가 뜨는 플레이어블 상태가 된다.

### 검증된 근거 ID
| 내용 | evidence id |
|---|---|
| 클릭→New Game 선택→진입 (`web_walkthrough_record` 4/4 성공) | `ev_95381b88f96eedabc889f09e739864fb79864d66781a9d062dd91dd99dc0d1f8` |
| 인게임 상태 (`web_page_show`) | `ev_1aa98e2f0d95544215ce92a142862059e6ff19fc2cf18f9697336a465710c869` |
| 해상도·엔티티 수 | `ev_5287d0da08b0192f3cf04424d7ac4074e6a521327313e309d27ed14f4e4c0eac` |

Craft finding: `fnd_3`(진입 원인), `fnd_4`(난독화 구조), `fnd_5`(해상도), `fnd_6`(대화 잠금), `fnd_7`(도구 한계).
가설 `hyp_1` = supported.

---

## 3. 도구 운용 — 반드시 지킬 것

### 3-1. Chromium 준비 (이 환경 필수)
`craft-anything-cli doctor`가 Chromium을 못 찾고, Playwright 크로미움은 root에서 샌드박스 없이 죽는다. 아래 래퍼를 **먼저** 만든다.

```sh
cat > /usr/local/bin/chromium <<'EOF'
#!/bin/sh
exec /root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome --no-sandbox --disable-dev-shm-usage "$@"
EOF
chmod +x /usr/local/bin/chromium
/root/workspace/tools/craft-anything/craft-anything-cli capabilities --deep   # chromium found:true 확인
```

### 3-2. CLI 개별 호출은 브라우저를 닫는다 → 지속 MCP 세션 필요
`craft-anything-cli mcp --deep --allow-run --all-tools --project <abs>`. 명령마다 프로세스가 끝나면 브라우저도 닫힌다. 준비된 큐 데몬을 쓰면 **한 세션 유지 + 모든 관찰이 근거로 기록**된다.

- 데몬: `/root/.hermes/cache/scratch/cai/daemon.py` — `queue/in` 에 JSON을 넣으면 `queue/out` 에 결과를 쓴다.
- 호출기: `python3 /root/.hermes/cache/scratch/cai/q.py <tool_name> '<json args>' <wait_sec>`
- 기동: `terminal(background=true, persist_on_release=true)` 로 `python3 daemon.py`. 기동 후 `queue/ready.json`의 `tools:322` 확인.
- ⚠️ 데몬은 세션 정리 시 죽는다. 죽었으면 **다시 띄우고 새 CDP 포트를 `web_pages_list`로 다시 얻는다.** 이전 포트/페이지 ID를 재사용하지 말 것.

### 3-3. `web_walkthrough_record`의 `press`는 게임에 쓸 수 없다 (한계 확정)
`press`는 대상이 focusable해야 한다. `#canvas`, `body`, `html`, `#game` **모두** `DOM.focus: Element is not focusable`로 실패한다(4회 재현). CrossCode는 `window` 수준 `keydown`으로 입력을 받기 때문이다.
→ **`click`/`screenshot`은 Craft로**, **키 입력은 같은 CDP 엔드포인트에 Playwright를 붙여** 수행한다. 단계 결과는 `web_page_show`로 교차 기록한다.

```js
// /root/workspace/CERTZ/node_modules/playwright/index.mjs 사용
const b = await chromium.connectOverCDP(process.env.EP);   // EP = web_pages_list가 준 endpoint
const page = b.contexts()[0].pages().find(p => p.url().includes('cross-code'));
await page.keyboard.press('Enter');
```

### 3-4. 인게임 상태 읽기 (난독화 대응)
`ig.game` / `ig.game.currentState`는 **존재하지 않는다**. 실제 경로는:

| 무엇 | 경로 |
|---|---|
| 게임 셸 | `ig.t` |
| 로딩 컨테이너 | `ig.t.dJ` (`.Ho` = 에셋 배열, 346개) |
| 카메라 오프셋 | `ig.t.screen.x`, `ig.t.screen.y` |
| 엔티티 배열 | `ig.t.entities` (타이틀 0 → 인게임 203~209) |
| 키맵 | `sc.options.Sb`, 키 이름 `keys-<action>` |
| 해상도 | 논리 `568x320`, 백킹 `1136x640`, CSS는 뷰포트 확대 |

**키맵(실측)**: `confirm=Enter(13)`, `back=Backspace(8)`, `menu=Tab(9)`, `pause=Esc(27)`, `up=W(87)/↑(38)`, `left=A(65)/←(37)`, `down=S(83)/↓(40)`, `right=D(68)/→(39)`, `special=Space(32)`, `dash=Alt(18)`, `quick=Shift(16)`, `skip-cutscene=G(71)`.

### 3-5. 관찰 판정 방법
- 이동/카메라: `ig.t.screen` 좌표 변화로 수치 판정 (픽셀 해시만 쓰면 배경 애니메이션 때문에 오판한다).
- 화면 의미 판독: **`vision_analyze`는 현재 `gemini-3.8-flash`가 400 `Invalid Model Name`으로 실패**한다. 로컬 9router(`http://127.0.0.1:20127/v1`, key `pwd`)의 **`oc/glm-5-free` 또는 `alicode-intl/glm-4.7`** 이 이미지 입력을 정상 처리한다. 이걸로 읽고, 판독은 "추론"으로 분류한다.
- 대화/컷신 중에는 이동이 잠긴다. `Enter` 연타로 넘긴 뒤 이동을 측정한다 (`fnd_6`).

---

## 4. 조사 프로젝트 재개

- 프로젝트: `/root/workspace/tools/craft-anything/crosscode-study.cany` (이 환경에는 이식됨)
- 먼저 `core-investigation-show`, `core-session-show`를 읽고 brief/plan/hypothesis/finding을 이어간다.
- 프로젝트가 없으면 `docs/qa/2026-11-11/crosscode/craft-evidence-v2.json.gz`를 해제한 뒤 `core-evidence-import --path`로 가져온다(21건). 이전 9건은 `craft-evidence.json.gz`(해제 후 import).
- 큰 결과는 `core_evidence_browse`로 필요한 행만 본다. **동일 분석을 반복하지 않는다.**
- 이번 세션 finding: `fnd_1`~`fnd_7`. unknown: 입력 도구 한계(`unk_66ec…`), 전투 관찰(`unk_97c0…`).

---

## 5. 아직 관찰하지 못한 것 (이걸 채우는 게 다음 일)

이전 문서/이번 문서 어디에도 **전투를 봤다고 쓰지 말 것.** 실제로 못 봤다.

1. 근접 공격과 원거리 사격의 판정·탄속·데미지 수치
2. 차지(hold) 사격의 단계와 발동 조건
3. 적 공격 **예고(telegraph)** 표시와 경고 시간
4. 공격 **후딜**과 그 사이 회피(대시) 가능 여부 — 무적 프레임 유무
5. 고저차 경로에서 원거리 사격의 판정 차이
6. 보스전 패턴·HP·클리어 시간
7. 대화 카메라 연출(줌/팬)의 실제 파라미터

**관찰 방법**: 첫 맵에서 컷신을 넘긴 뒤 적/이벤트 트리거를 찾아 이동. 맵 경계에 막히면 다른 방향으로 우회한다. 카메라 좌표가 고정되면 (a) 컷신 잠금, (b) 맵 경계, (c) 튜토리얼 대기 중 하나이므로 **화면 판독으로 구분**한 뒤 진행한다.

---

## 6. CERTZ 적용 원칙 (조사 후)

- 확인한 설계와 현재 CERTZ 코드를 비교해 **작은 개선부터** 구현한다. 문서만 쓰고 "적용 완료"라 보고하지 않는다.
- 외형·기능·기획서와 무관한 **대규모 교체 금지**.
- 사용자 기준: **"최적화를 하되 퀄리티는 떨어뜨리지 말기"**. 낭비 제거(불필요 로딩·중복·재귀·과다 요청)로 달성하고, 그래픽·연출·UX를 깎아서 달성하지 않는다. 저사양 양보는 기기 감지 게이트로만(PC는 원본 유지).
- 성능 판단은 **Galaxy S20+ 실측** 기준. PC 헤드리스 수치로 대체하지 않는다.

---

## 7. 첫 디오 전투 재검증

- 정상 UI의 **AP·장비·전직 성장**과 **올바른 회피**를 포함해 재검증한다.
- 봇 사망만으로 모든 이용자가 막힌다고 단정하지 않는다.
- **테스트 통과 목적으로 HP/무적/레벨/시간/진행을 주입하지 않는다.** 런타임 배율은 `WorldScene.spawnBoss`와 `stageScale`을 추적한다.
- 함께 검증: 구 세이브 복원, 숙련 상승, 4차 전직 문구, 보스바 정리, 직업/터치 돌진. 자연 진행과 조정된 QA fixture를 명확히 구분해 기록한다.

---

## 8. 검증과 배포

1. 변경에 맞는 검사 → `npm test`(현재 606개 통과 기준) → `npx tsc --noEmit` → `npm run lint:strict` → `npm run build:next`.
2. PC/터치 실제 조작 스크린샷을 남긴다. `worklog.md`에 기록한다.
3. `CERTZ/main`에만 커밋·푸시한다.
4. 런타임을 바꾸면 **versionCode+1, versionName+0.0.1** 필수. GitHub Actions(`.github/workflows/android-build.yml`)가 `android/**` 푸시로 트리거되고 서명키 4종 Secret을 쓴다. 버전을 안 올리면 기존 릴리스 자산을 clobber로 덮어쓴다.
5. `main`/운영/API/산출물 SHA를 확인하고 **최신 정상 sertz 배포만** 남긴다. 운영 DB·암호화키를 초기화하지 않는다.
6. **인증 토큰을 문서·커밋에 기록하지 않는다.**

---

## 9. 기존 재현 스크립트

`scripts/playtest-tutorial.mjs`, `scripts/playtest-live-progression.mjs`, `scripts/playtest-reference-combat.mjs`, `scripts/playtest-cloud-save-v2.mjs`.
운영 결과: `docs/qa/2026-11-11/live-progression`.

이번 세션 산출물: `docs/qa/2026-11-11/crosscode/` (summary.json, craft-evidence-v2.json, ingame/ 스크린샷 6장).

---

## 10. 하지 말 것 (체크리스트)

- [ ] CrossCode 코드/이미지/음악을 런타임에 복사
- [ ] 베타 데모 관찰을 상용판 전체 분석으로 확대
- [ ] 전투를 못 봤는데 봤다고 기록
- [ ] 실패한 입력을 같은 방식으로 반복
- [ ] 테스트 통과용 HP/무적/시간/진행 주입
- [ ] 문서만 쓰고 적용 완료로 보고
- [ ] 토큰을 커밋/문서에 남김
- [ ] 버전 안 올리고 APK 재빌드 (기존 릴리스 덮어쓰기)
