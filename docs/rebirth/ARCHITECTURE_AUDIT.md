# REBIRTH 아키텍처 진단 — 1차 / 2026-11-10

기준 HEAD 및 origin/main: `3908f63d1b5fce7514a1cc8a40b1e8ecc2613c71`. 기능 변경 전 작성.
이 문서는 전체 정밀 분석 완료 보고가 아니다. 화면 검증은 아직 없다.

## 확인한 실행 경로
- `/`: src/app/page.tsx → GameRoot → 기존 Phaser WorldScene → Player/Boss.
- WorldScene은 키보드 및 EventBus input:skill1~5b를 Player.useSkill*에 연결한다.
- 별도 CampaignRoot/CampaignScene과 campaign/battle.ts가 공존한다. multiplayer/campaign/server.mjs는 stepBattle을 사용한다. 이 공유 전투만 바꾸면 `/`의 Player가 바뀌지 않는다.
- Player는 body 20×44, world bounds 충돌과 WorldScene.solidGroup collider를 사용한다.
- 기존 S2는 MP 20과 skill2Cd를 사용한다. 독립 무료 이동으로 재활용할 수 없다.
- campaign/battle.ts dodge는 1350ms 재사용 간격과 420ms 무적이다. 돌진과 별개로 보존한다.
- Boss는 def.faceLeft와 플레이어 상대 위치를 사용한다. twin은 !본체.flipX를 사용한다. 실제 원본 방향은 미확인이다. Gram 포함 전역 반전 금지.
- GameRoot는 cinematic:state 구독으로 HUD를 숨긴다. 스킵/종료 후 복구 화면은 미확인이다.
- WorldScene은 화살표/WASD 선택을 지원한다. 화살표 기본 배치의 A/S/D는 스킬·물약 키이므로 강제 WASD 추가 금지.

## 지침 충돌과 적용
AGENTS.md/정본의 ‘하루 혼합 금지’, ‘필요시 에셋 생성 허용’은 최신 사용자 지시로 대체한다. 하루 중심 재각색을 허용하되 기존 주요 인물의 사건과 역할을 보존한다. 신규 그림/오디오 생성은 전면 금지한다. 전체 원문 1~8의 순차 정독과 34장 대조는 아직 미완료이므로 이번 변경에 서사 개작을 넣지 않는다.

## 이번 최소 변경 범위
독립 돌진만 별도 이동 상태로 추가한다. 기존 S2/ID/저장 필드/MP/쿨타임/무적/계정/서버 전투는 변경하지 않는다. Shift와 모바일 이벤트를 동일 진입 메서드에 연결한다. 연출 에셋 확보 전 새 도형/FX를 추가하지 않는다. 게임패드 및 멀티 서버 동작은 미완료이다.

## 요구→파일→회귀
- 34/35/36: combat/freeDash.ts, Player.ts, WorldScene.ts, keyRegistration.ts, TouchControls.tsx → pure geometry 및 Player 메서드 실행 테스트, 입력 배선 계약, tsc/lint.
- 01/02: Boss.ts/stages.ts/원본 시트 → 양방향/Gram/쌍둥이 화면 재현 전 보류.
- 23: Drive 템플릿 확인→로더/방향/장비/멀티 연계. 파일/라이선스 확인 전 보류.
- 47/73/74: catalog/progress/config/buildSave/서버 검토가 추가로 필요. 이번에 데이터 스키마를 바꾸지 않는다.

## 미완료 진단
스킬 전체 ID/실사용 추적, 애니메이션 프레임별 검증, 저장 복원·서버 신뢰 경계 전수, 원본 라이선스 전수, 34장 원문 대조, 참고 영상 직접 관찰, 80항목 화면 검증은 아직 미완료다. 과거 조사 문서는 현재 실행 증거로 간주하지 않는다.

## 2026-11-10 추가: 실제 시작 흐름 및 REBIRTH 범위

최신 사용자 지정 기준으로 main을 `2f6f8dd0dd1ffab09be88c2501cd9c38d409d54a`까지 fast-forward했고, 그 커밋의 독립 돌진을 진행 중인 온보딩 변경에 통합했다. 작업 중 변경은 별도 패치와 이번 작업용 stash에 보존했으며 원격 기록을 reset/force-push하지 않았다.

새 온보딩은 기존 Tutorial/WorldScene/공용 대화·연출·NPC 의뢰를 확장한다. `tutorialVersion=2`와 `introSeen` 복원/저장을 같이 처리하고 구세이브는 강제로 재시작하지 않는다. 자세한 사건/실습/파일별 근거는 INTERACTIVE_TUTORIAL.md 및 QA_EVIDENCE.md의 후속 기록에 있다.

PROJECT REBIRTH는 실제 `/`의 WorldScene과 별도 CampaignRoot의 34장 데이터를 함께 언급한다. 34장 선물 표를 현재 기본 게임에 연결하기 전에 두 실행 경로와 정본 사건을 다시 매핑해야 한다. 이번에 사용하지 않는 캠페인에 새 전투 코드를 넣고 적용 완료라고 표시하지 않는다. 본 단계는 시작 경험과 공용 컷씬 결함 수정이며 10검식·34장 원소 선물·Drive 남녀 캐릭터·전 보스 방향·전체 서버 전투 교체는 완료 범위가 아니다.

사용자의 최신 도구 지시에 따라 Craft Anything 0.6.0 CLI/MCP를 설치·실행했다. 조사용 엔진이므로 게임의 런타임/의존성으로 넣지 않는다. 기존 REA 자료와 원장을 삭제하지 않고 향후 분석 도구 선택을 교체한다.
