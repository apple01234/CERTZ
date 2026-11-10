# 다음 AI 작업 지시서 — CrossCode Deep 조사 및 기존 게임 개선

## 작업 대상과 권한

- 유일한 저장소: https://github.com/apple01234/CERTZ, main. 시작 시 `git status`와 최신 원격 HEAD를 확인하고 기존 변경을 보존한다.
- 사용자는 공식 CrossCode 페이지/무료 웹 데모의 격리 브라우저 실행을 `ㅇ`으로 승인했고, 이어 `아니 딥모드 사용 ㄱㄱ`라고 Deep 모드도 명시 승인했다. 같은 범위의 실행/Deep 사용에 재확인을 요구하지 않는다.
- 참고 URL: https://www.cross-code.com/en/start
- 기존 GameRoot → WorldScene → Player, 기능·세이브·장비·직업·멀티·픽셀아트 유지. 새 게임 엔진으로 교체하지 않는다.
- 스토리 변경이 필요하면 AGENTS.md 및 지정 정본 `docs/handoff/evernote-approved/1.txt`~`8.txt`만 순서대로 읽는다. 다른 스토리 문서를 정본으로 혼합하지 않는다.
- 기존/다운로드 에셋 우선. CrossCode 코드·그림·음악을 게임 런타임으로 복사하지 않는다. 분석 결과와 설계 원칙만 현재 게임에 맞게 적용한다.

## 현재 완료 상태

게임 기반 커밋: `828c205`. 직전 QA 커밋: `357721b`.

- vc265/2.2.9: 단계별 로딩, 세이브 v2 보호, 숙련 추가 요구 5/8/12/16/20/35/55/80/110/150(누적491, 10단계/+20%), 상승 알림, 도로 2→6 미세 타일.
- 운영 튜토리얼 신규 캐릭터 전체+실제 연습 중 새로고침: 약64초, 브라우저 예외0.
- 정상 키 입력으로 1x2→1x3→1x4→2x1→2x2→2x3, Lv20 디오 진입. **처치 실패**: 기본장비/AP미배분 봇이 실제 HP178,200 보스를 HP175,622 남기고 사망. 클리어 검증으로 표시하지 않는다.
- 실제 가입/로그인/클라우드 v2 왕복, 비활성 캐릭터 보존, 구버전409, QA계정 삭제는 vc265 릴리스 기록에 있다. 운영 DB/암호화키를 초기화하지 않는다.
- 기존 자동 검사606개 통과. `Verify production matches main` 워크플로는 main/API SHA 일치를 대기하고 미일치면 실패한다. 357721b에서 실제 성공 확인.
- 기존 서명 vc265 APK/EXE 빌드 성공. APK는 기존 인증서와 동일하고 런타임 에셋7,910개 경로/CRC 동일. 실기기 플레이 미검증.
- 이번 CrossCode 조사에서는 **게임 런타임 변경이나 적용을 하지 않았다.**

## Craft Anything 설치와 조사 재개

- 스킬: `/home/agent/.agents/skills/craft-anything/SKILL.md`
- CLI: `/workspace/tools/craft-anything/craft-anything-cli` v0.6.0. doctor 정상, setup dry-run already_current. 전역 설정 변경 없음.
- 기존 조사: `/workspace/tools/craft-anything/crosscode-study.cany`
- 먼저 `core-investigation-show`, `core-session-show`를 읽고 brief/plan/hypothesis/finding/handoff를 이어간다.
- 권한 범위 내 명령: `craft-anything-cli mcp --deep --allow-run --all-tools --project <프로젝트>` (실제 절대경로 사용). Deep에서322개 도구, Clean에서108개였다.
- **CLI 개별 호출은 종료 시 브라우저를 닫는다.** `web_site_open` 다음 관찰/캡처는 같은 MCP stdio 세션에서 실행해야 한다.
- 이전 세션의 CDP 포트/페이지ID를 재사용하지 말고 새 세션의 `web_pages_list`로 얻는다.
- 큰 결과는 `core_evidence_browse`로 필요한 부분만 읽는다. 동일 분석을 반복하지 않는다.
- 이 환경이 달라 기존 프로젝트가 없으면 `docs/qa/2026-11-11/crosscode/craft-evidence.json.gz`를 해제한 뒤 `core-evidence-import`로 근거를 가져온다. `investigation.json`에 brief/plan/findings/handoff도 보존돼 있다.

## CrossCode에서 실제로 확인한 것

- 공식 URL 자체가 **v0.7.1 BETA DEMO**를 실행한다. 상용판 전체를 분석했다고 주장하면 안 된다.
- 타이틀, German language 안내, New Game/Continue/Options/Get Early Access 메뉴까지만 확인했다.
- 로드된 스크립트14개를 정적으로 분석해 모듈12개·엔드포인트50개를 기록했다. `js/game.compiled.js`는 약1.77MB 난독화 번들이다. 현재 로드 집합/정적 분석 한정이다.
- 실제 전투·맵·스킬·보스·컷씬은 아직 플레이 관찰하지 못했다. 이를 이미 분석/적용했다고 보고하지 않는다.
- 근거ID와 타이틀 캡처·압축된 전체 근거9건은 `docs/qa/2026-11-11/crosscode/summary.json` 및 같은 폴더 참조.

## 막힌 부분과 다음 작업

1. 데모의 New Game 진입을 해결한다. `web_walkthrough_record`의 body+Enter는 `DOM.focus: Element is not focusable`로 실패했으며 **0/2단계**였다. 성공 증거가 아니다.
2. 같은 Craft CDP에 Playwright로 연결해 실제 키/마우스 입력도 시도했다. Enter/Space/C/X, 마우스 클릭(지연 포함) 뒤에도 New Game 이후 진입을 확인하지 못했다. 읽기 전용 확인에서는 document.hasFocus=true, canvas 하나, window.ig.input/system이 있었다. Deep으로 실제 키바인딩, 버튼 입력 처리, 캔버스/CSS 좌표와 포커스를 확인한다. 동일 실패 입력을 무작정 반복하지 않는다.
3. 진입 후 이동/회피/근접·원거리/차지/적 공격 예고·후딜/고저차 경로/대화 카메라를 실제 조작·화면·시간 기록으로 관찰한다. 관찰·계산·추론을 분리하고 근거ID로 finding을 기록한다.
4. 확인한 설계와 현재 CERTZ 코드를 비교해 작은 개선부터 구현한다. 문서만 작성하고 적용 완료라 보고하지 않는다. 외형·기능·기획서와 무관한 대규모 교체를 하지 않는다.
5. 첫 디오 전투는 정상 UI의 AP·장비·전직 성장 및 올바른 회피를 포함해 재검증한다. 봇 사망만으로 모든 이용자가 막힌다고 단정하거나, 테스트 통과 목적으로 HP/무적/레벨/시간/진행을 주입하지 않는다. 런타임 배율은 WorldScene.spawnBoss와 stageScale을 추적한다.
6. 구 세이브 복원·숙련 상승·4차 전직 문구·보스바 정리·직업/터치 돌진도 실제 화면으로 검증한다. 자연 진행과 조정된 QA fixture를 명확히 구분한다.
7. 변경에 맞는 검사, npm test, tsc, strict lint, build:next 및 PC/터치 실제 조작·스크린샷을 남긴다. worklog.md에 기록한다.
8. CERTZ/main에만 커밋·푸시한다. 런타임을 바꾸면 버전 동기화 후 기존 GitHub Actions 서명키 방식으로 APK를 빌드한다. main/운영/API/산출물 SHA를 확인하고 최신 정상 sertz 배포만 남긴다. 인증 토큰을 문서·커밋에 기록하지 않는다.

기존 재현: `scripts/playtest-tutorial.mjs`, `scripts/playtest-live-progression.mjs`, `scripts/playtest-reference-combat.mjs`, `scripts/playtest-cloud-save-v2.mjs`. 운영 결과는 `docs/qa/2026-11-11/live-progression`에 있다.
