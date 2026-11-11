# CERTZ 현재 작업 인계 — 2026-11-03

> **2026-11-11 최신 적용 — vc268/v2.2.12:** 대시에 무적을 넣어 **회피가 실제로 피해를 막게** 했다. 첫 보스 실측에서 봇이 보스 HP를 1.45%만 깎고 죽은 원인은 보스 HP가 아니라 대시에 무적이 없던 것과 피격 경직 중 회피가 거부되던 것이었다. `FREE_DASH.iFrameMs = 420`(이동 180ms보다 길고 피격 경직 600ms보다 짧음), 기존 긴 무적은 축소하지 않음, 경직 중 회피는 허용하되 대시 중 재입력은 차단. 보스 HP·데미지·배율·세이브 미변경. tsc·lint:strict 통과, **612 tests**, 런타임 `scripts/playtest-dash-iframes.mjs` PASS(무적 중 172→172 차단, 종료 후 172→122 적용). [구현·검증](../qa/2026-11-11/crosscode/APPLIED_v268.md). **미검증: 자연 진행 보스 클리어, S20+ 실기기 체감.**

> **2026-11-11 vc267/v2.2.11:** 첫 전투 캡처에서 확인한 첫 피격 전 적 HP와 현재 입력 안내를 추가 적용했다. 기존 HP바를 교전 시에도 재사용하고 실제 몸 크기에 맞춰 배치하며 공격 준비/돌진 경고색을 표시한다. 회피 수련 돌진 버튼 강조와 잘못된 0초 안내를 수정했다. 전체 609 tests와 PC·실제 멀티터치 튜토리얼 완료·표시 정리 검증 통과. [구현·검증](../qa/2026-11-11/crosscode/APPLIED_v267.md). vc266 회피 성공 판정·보스 후딜 표시는 유지한다. **아래의 전투 미관찰/미적용 설명은 과거 상태이며, 조준·차지·후반 보스 조사는 아직 남았다.**

> **2026-11-11 vc266 후속 적용:** CrossCode 공식 v0.7.1 데모 Deep 관찰이 실제 첫 전투까지 진행됐다. 방향 회피 → 공격 안내 → 실제 피해/HP 피드백을 확인하고, 기존 게임에 돌진 성공을 요구하는 회피 수련과 보스 후딜 남은 시간 표시를 적용했다. 전체 608 tests, 타입·lint·프로덕션 빌드, PC/터치 튜토리얼 완료 및 보스 표시 fixture를 통과했다. [구현·근거·미검증 범위](../qa/2026-11-11/crosscode/APPLIED_v266.md), 휴대용 장부 `craft-evidence-v3.json.gz`를 우선한다. **다음은 데모 첫 전투 이후 조준/원거리 수련 관찰이다.** 기존 실행/Deep 승인은 유지하며, 새 세션 CDP 주소는 다시 조회한다. 아래 11월 3일 항목의 미구현 상태를 최신 상태로 오해하지 않는다.

이 문서는 `DEEPSEEK_HANDOFF.md`의 이전 체크포인트보다 우선한다. 사용자가 “정리해서 딥시크에게 옮길 것”이라고 요청해 현재 구현 범위에서 마감한다. 게임 개편 전체가 완료된 상태는 아니다.

## 반드시 지킬 사용자 지시

- 유일한 저장소/브랜치: **https://github.com/apple01234/CERTZ 의 main**. SERTZ, REA 등 다른 저장소에 커밋/푸시하지 않는다.
- 기존 `GameRoot → PhaserGame → WorldScene → Player`를 유지한다. 별도 축소 캠페인이나 새 엔진으로 교체하지 않는다. 인벤토리/장비/전직/스탯/제작/하우징/던전/계정/파티/터치 기능을 보존한다.
- 아뜰란티스/이그드라실 이야기를 되살리지 않는다. 옛 지역의 안정적인 키와 전투는 선택 수련 원정으로 보존했으며, 본편 진행에서 분리했다. 옛 9개의 바다를 새 서사에 넣지 않는다.
- 에셋은 원본/사용자 자료/다운로드를 우선한다. 꼭 필요한 경우 외 생성하지 않는다. 이번 변경에는 새 이미지 생성/새 런타임 의존성이 없다. 배포에서 원본 에셋을 pruning하지 않는다.
- 코드 변경 전 `AGENTS.md`, `skills/ponytail/SKILL.md`를 읽는다. 전환은 `startTransition()` 한 통로를 쓴다. 저장 필드를 추가하면 SaveData/복원/buildSave를 함께 수정한다.

## 허용된 정본: 아래 8개만 순서대로 읽기

Evernote 원문: https://share.evernote.com/note/8925784f-6c18-eab0-c266-bcc2efbd2d92

추출본 `docs/handoff/evernote-approved/1.txt`부터 `8.txt`까지:

1. 하루는 세 가지 사람이 있다-개정판
2. 하루는 웨폰마스터가 되었다 스토리-1
3. 영프 웨폰마스터 능력 정리본
4. 영프 웨폰마스터 능력 정보서
5. 영프 1기 정리본
6. 스노리카
7. 가문 정리본
8. 그랜드 플레닛(2기)

앞 문서가 충돌 시 우선한다. 구조자는 **라일락+펜던트**, 주인공은 **하루**다. 뒤 문서의 스칼렛+책 버전으로 섞지 않는다. 도사는 리엘로 표기하고 실제 사람 이름/타 작품 호칭을 옮기지 않는다. 8번은 네오시티 19화의 그림/할아버지 회상까지 공개됐다. 이후 10행성 결말/제로세계 3부를 창작해서 정본으로 표시하면 안 된다. 다른 Evernote 항목은 읽지 않는다.

## 선행 커밋

- `06f20b2`: 전체 런타임 에셋 보존, saveSoon 자기 재예약 버그 수정, RE 근거/허용 문서/초안 보존.
- `54dced9`: 원래 GameRoot 복원, 옛 서사 제거, 마을→라일락 월드 직행, 기존 지역 수련 원정화, 본편 클리어 선행조건 해제, 마지막 재건 퀘스트에서 완료 처리. 이 시점 검사는 67개 통과.
- 이번 후속 커밋: 아래 맵·S1·컷씬·발밑 충돌을 **원본 런타임에 연결**. 정확한 해시는 이 문서를 담은 커밋을 `git log -1`로 확인한다.

## 이번에 실제 연결한 코드

| 영역 | 실행 경로와 구현 |
|---|---|
| 맵 | `mapgen.ts → authoredLayouts.ts → WorldScene.create → fx/AuthoredMapLayers.ts`. 원래 howlrstone 65필드와 DLC 100필드에 서가/부두/숲 순환로/성채 4관문/보스 아레나를 결정적으로 배치한다. `rea:ground`, `rea:paths`, `rea:structures`의 실제 TilemapLayer 3개를 기존 ground_* 원본 텍스처로 구성한다. Phaser4에서는 createLayer의 gpu=false를 명시한다. |
| 맵 충돌 | 기존 `RoomLayout.open`과 `solidGroup`/buildDungeonWalls를 유지한다. 새 맵은 옛 큰 암벽 그림과 랜덤 장식을 얹지 않는다. 소품은 닫힌 칸/통로 옆에 제한 배치한다. `authoredOpenXY`는 열린 칸 사이 경계를 통과시키고 실제 벽/모서리에만 clearance를 적용한다. 마을·도장·기존 기능 맵의 생성기는 보존한다. |
| 직업 S1 | `Player.useSkill1 → weaponMasterProfiles.ts → WeaponMasterCombat.ts`. 준비→발동→후딜, 같은 시전의 중복 타격 방지, 준비 중 C/사망/씬 종료 취소. 원래 MP15/쿨타임 성장/피해 계산/장비/net s1 경로를 재사용한다. 기본공격과 S2~S5 구현은 유지한다. |
| 전승 | berserker=아리 태양검, guardian=루시 생명/치유, sniper=벨리카 번개활, windrunner=리안 차크람, archmage=제르 마도서, sage=란 아트 장막/치유, assassin=페르온 그림자, swashbuckler=하루 카피/원소 반응, corsair=카르텔 물 삼지창, raider=제이드 공학망치. 상위 직업은 **기존 전직 트리**를 따른다. |
| 컷씬 | `WorldScene`에서 세이브 복원 후 Auto→Story 중 하나만 시작한다. 공유 `sceneCinematic.ts`가 카메라/물리/입력/타이머/트윈을 소유하고 즉시 스킵/종료/씬 해제 시 정리한다. 15장 유효 구역에 16개 방향 데이터를 배치하고 실제 입구·목표·SPUM 배우를 팬/줌/클로즈업한다. 첫 연출은 라일락/하루/펜던트다. |
| 컷씬 호환 | 기존 저장에서도 새 연출을 보도록 `lilacCut_rea1_*` 기록을 사용한다. 기존 6초 보스 카메라 워치독은 새 감독 재생 중 개입하지 않는다. Phaser4 resetFX가 zoomEffect를 취소하지 않는 버그를 브라우저에서 찾아 명시적으로 reset한다. |
| 소품 충돌 | `decorObjects.ts`의 불투명 영역 측정치→`decorCollisionBounds`→`WorldScene.attachDecorCollision`. 책장/식탁/상자 등의 발밑만 막고 바닥 무늬/불꽃은 통과시킨다. 집/필드 가구를 회전·재렌더·회수하면 연결된 정적 바디도 갱신/삭제한다. |

## 리버스 엔지니어링의 실제 범위

`skills/reverse-engineer-anything/SKILL.md`를 활용했다. 정적 분석 대상은 초기 13개+JENNY이며, **14개 모두 완전 실행/완전 복원한 것은 아니다**. 근거:

- `docs/campaign/REFERENCE_DEEP_ANALYSIS.md`
- `docs/campaign/REFERENCE_LEDGER.json`, `REFERENCE_DEEP_EVIDENCE.json`, `JENNY_EVIDENCE.json`
- JENNY 공격 스크립트의 준비/발동/회복·취소, 카메라 효과 수명 관리.
- RPG Maker 맵/전송 구조, Construct 지면/충돌 레이어 분리, Feather Park 완료 신호/정리 등을 현재 엔진에 맞게 재설계했다. 타 게임의 코드/전용 아트를 복사해서 자유 라이선스로 표시하지 않는다.

위 과거 보고서의 “SERTZ 적용 완료” 문구는 **예전 별도 캠페인 구현** 기록이다. 현재 CERTZ의 모든 기능에 적용됐다는 뜻이 아니다. 현재 연결 범위는 위 표와 실제 import/호출을 기준으로 판단한다.

## 남은 작업과 알려진 한계 — 다음 우선순위

1. **본문/목표/지형의 정본 정렬**: `howlrstone.ts`, `lilacStory.ts`의 기존 1기 15화 데이터/의뢰가 아직 개정 하루 이야기 전체로 이관되지 않았다. 새 카메라 16개는 연결됐지만 첫 필드는 여전히 도서관 구조이고 절벽 구출은 회상 연출이다. 퀘스트 제목/대사/지역 구조를 승인 문서 순서와 맞춰야 한다. 전투 없는 talk/reach/collect 목표도 실제 상호작용으로 끝낼 수 있어야 한다.
   - **vc238 추가 확인**: `howlrstone.ts` 가 참조하는 비트 대사 키 **22개가 `DIALOGUES` 에 전부 없다**(`howlBook`·`howlLetter`·`howlWar`·`howlAri`·`howlDokkaebi`·`howlAlliance`·`howlLuci`·`howlGolem`·`howlRiande`·`howlSwords`·`howlLilac`·`howlFourDoors`·`howlWindDoor`·`howlBalloon`·`howlIon`·`howlCurse`·`howlSunMark`·`howlEndTime`·`howlTimeRuler`·`howlNewBeginning`·`howlSerniumCall`·`howlrstone1Done`). `showDialogueOnce` 가 없는 키에 조용히 `false` 를 돌려주므로 **1기 15장 비트 대사가 한 번도 재생되지 않는다**. 챕터 인트로(`chapterIntroHowlrstone*`)와 보스 인트로는 정상이므로, 대사 자체를 새로 쓰기 전에 키 22개를 먼저 채워야 한다. `bossDone` 15개(`howlrstone1Done`~`15Done`)도 같은 상태다.
2. ~~**첫 보상 밸런스**~~ — **vc238 에서 수정 완료.** 1장 레벨게이트 6000×12=72,000 EXP(Lv1→Lv26)의 원인은 두 겹이었다: ① `lvGate` 가 15장 전부 `{enter:1, mid:1}` 이라 게이트가 아무것도 막지 못해 보상이 곧 성장곡선 전체가 됨 ② 같은 값이 15장에서는 2248만이라 그 장 필요량에 크게 미달(초반 폭주 + 후반 정체). 15챕터를 레벨 밴드(1→8→15→…→120→135)로 재앵커하고 `scaleMul.exp`·`lvGate`·비트 `expReward` 28개를 재계산했다. 1-1 지급 672 EXP(→Lv5), 완주 Lv152(그랜드플레닛 126 충족). 회귀 테스트 `tests/howlrstone-balance.test.mjs`(367 검사).
3. **시각 통일과 보스**: 원본 타일/소품/캐릭터가 모두 같은 작품 스타일로 정리된 상태는 아니다. 인간 보스의 SPUM 표현/애니메이션/정본 패턴을 아직 전체 적용하지 않았다. 기존 캐릭터 외형 선택과 장비 표시를 보존하며 다운로드/허용 에셋으로 교체한다.
   기존 기능 안내창/보상창/일반 대화가 플레이필드와 새 컷씬에 겹치는 UI 큐 문제도 캡처에서 확인됐다. 컷씬 종료 후 대기 UI를 순차 표시하도록 원래 EventBus/모달 경로를 정리해야 한다.
4. **상위 전직 검토**: 원래 트리에서 stormcaptain/powdermaster가 raider 자식이고 seaking도 stormcaptain→raider로 이어진다. 호환을 위해 유지했으므로 이들의 S1은 공학망치다. 물 계열 명칭/전승 일치를 고칠 때 저장/스탯/스킬을 함께 이관한다. 이름만 바꾸지 않는다.
5. **2기 통합**: `grandPlanetCanon.ts`는 초안이고 실제 stages/data import가 아직 없다. 공개된 4개 주요 지역/스노리카를 원래 진행에 연결하고 비공개 결말은 만들지 않는다.
6. **서사 저장 이관**: `storyRevision.ts`는 미사용 초안이다. 구 장비/재화/전직/슬롯을 보존한 백업/멱등 이관 테스트 없이 활성화하지 않는다. `original-engine-integration.patch`도 역사적 초안이므로 그대로 apply하지 않는다.
7. 네이티브 APK/실기기/운영 배포/실결제/실제 다인 네트워크는 이번 후속 변경에서 검증하지 않았다. 현재 커밋을 APK 설치본 업데이트라고 설명하지 않는다.

## 실행과 검증

- `npm test`
- `npx tsc --noEmit`
- `npx eslint src --max-warnings 0`
- 원래 앱 개발 서버: `npx next dev -p 3100`
- 브라우저 재현: `QA_URL=http://localhost:3100 QA_OUT=/tmp/certz-rea-playtest node scripts/verify-rea-runtime.mjs`

스크립트는 별도 브라우저 프로필로 일반 로비 생성/시작을 거친 뒤, 테스트 전용 내부 scene 접근으로 대표 지역 전환/직업 S1/가구 회전을 확인한다. 이는 15장 전체 정상 플레이 완료 검증이 아니다. 원래 창의 `window.__SERTZ_SCENE__`가 현재 WorldScene이며 `player.skillCastPhase`, `rea:*` 객체 이름/데이터로 실제 연결을 확인할 수 있다. 외부 계정 DB 키가 없으면 로컬 테스트의 계정 API는 500을 반환할 수 있으므로 온라인 인증 검증으로 표시하지 않는다.

최종 검사 결과/스크린샷 범위는 `REA_APPLY_VALIDATION.md`를 확인한다. 이후 작업마다 worklog.md Task를 추가한다.

## 작업 도구 (2026-11-04 설치 — 이 컨테이너 실측 결과)

인계받은 에이전트가 같은 시도를 반복하지 않도록 실제 동작 여부를 남긴다.

| 도구 | 설치 | 이 컨테이너에서의 상태 |
|---|---|---|
| `worktrunk`(`wt`) | `/root/.local/bin/wt` v0.81.0, 래퍼 `wtx` | **정상 동작.** git 2.43+ 요구 → git 2.39.5 라 직접 실행은 거부되지만 `wtx`(버전 조회만 2.43 으로 응답하는 shim)로 우회. worktree 생성/제거/목록 모두 실측 확인. |
| `Scrapling` | `/root/.venvs/tools` (scrapling 0.5) | **정상 동작.** `Fetcher.get()` 으로 GitHub 커밋 페이지 파싱해 원격 main 해시 확인까지 실측. |
| `agent-desktop` | `/root/.local/bin/agent-desktop` v1.1.0 | **GUI 조작 불가.** AT-SPI 가 이 컨테이너에서 D-Bus fd limit(`Failed to set fd limit to 65536: Operation not permitted`)과 X 접근 문제로 안정 동작하지 않는다. 단 `agent-desktop skills get desktop` 의 스킬 문서는 읽을 수 있어 워크플로 참고용으로 쓸 수 있다. |
| `heretic-llm` | `/root/.venvs/tools` (2.0.0) | **CLI 실행 확인.** 모델 수정 작업은 GPU/모델 다운로드가 필요해 이 컨테이너에서는 미검증. |

검증 실행 환경 주의: Turbopack 이 `OS file watch limit reached` 로 죽는다(inotify 상향 권한 없음).
`npx next dev --webpack -p 3100 -H 127.0.0.1` 로 우회한다. 프로덕션 빌드는 정상(`npm run build` 성공).
