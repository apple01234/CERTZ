# CERTZ 이어서 작업하기

이 문서는 사용자가 `deepseek-v4.1-flash-1017 max`에게 넘기기 위해 요청한 구현 중간 체크포인트다. 게임 개편을 완료했다는 보고가 아니다.

## 저장소와 가장 최근 요청

- 유일한 작업·커밋·푸시 대상: https://github.com/apple01234/CERTZ 의 `main`.
- 시작 커밋: `c82132d2fc1dd5bd381419d4a53b4b7553ff7214`.
- 앞서 SERTZ에 적용한 `8be98e6` 복원은 별도 저장소의 과거 작업이다. CERTZ/main을 그 복원본으로 무작정 덮어쓰면 안 된다.
- 기존 게임의 기능과 디자인/구조를 유지한다. 원래 GameRoot/WorldScene/Player/장비·능력치·전직·제작·하우징·던전·유니온·계정·파티·터치 조작을 활용한다. 별도 축소 게임으로 다시 만들지 않는다.
- 아뜰란티스/이그드라실 서사를 제거하고 지정 Evernote 정본으로 교체한다. 캐릭터 직업에 맞는 실제 스킬/무기/애니메이션/이펙트/보스를 적용한다. 이름만 바꾸는 작업이 아니다.
- 기존/다운로드 에셋을 우선한다. 꼭 필요한 경우에만 생성한다. 원본 에셋을 pruning하지 않는다.

## 읽을 수 있는 스토리 원문: 정확히 8개

원본: https://share.evernote.com/note/8925784f-6c18-eab0-c266-bcc2efbd2d92

Evernote Lite 외부 body에는 제목만 나오고, `https://lite.evernote.com/ce` 편집기 iframe의 `en-note` 안에 본문이 있다. H1 경계에서 아래 항목만 추출했다. 추출본은 이 디렉터리 `evernote-approved/`에 커밋돼 있다. 다른 H1 본문, 초기판, 스토리-2, 이름개명 문서, 별도로 있는 18/19화 섹션 등은 열지 않는다. 8번 안에 들어 있는 18/19화는 8번 문서의 일부다.

1. `1.txt`: 하루는 세 가지 사람이 있다-개정판
2. `2.txt`: 하루는 웨폰마스터가 되었다 스토리-1
3. `3.txt`: 영프 웨폰마스터 능력 정리본
4. `4.txt`: 영프 웨폰마스터 능력 정보서
5. `5.txt`: 영프 1기 정리본
6. `6.txt`: 영준프린세스-그랜드 플레닛 외전시리즈:눈의왕국 스노리카
7. `7.txt`: 영준프린세스-가문 정리본
8. `8.txt`: 영프 2기 정리본 (그랜드 플레닛)

순서대로 읽는다. 사용자에게 이미 설명한 충돌 처리 원칙은 앞 문서 우선이다. 예: 어린 하루를 구하는 인물은 개정판의 라일락+펜던트이며, 뒤 문서의 스칼렛+책 버전으로 섞지 않는다. 도사의 이름은 리엘, 기존 실제 인명/타 작품 호칭은 그대로 옮기지 않는다. 뒤 문서는 훈련·원소 능력·전투 콘티를 보완한다.

2기 정리본은 네오시티 19화의 그림/할아버지 회상에서 끝난다. 이후 10행성의 결말, 제로세계 3부 스토리를 창작해 정본으로 표시하면 안 된다. 나머지 기존 지역은 알려진 설정에 따른 선택 원정으로 유지할 수 있다.

## 이번 체크포인트에 실제 반영한 부분

- `campaign-assets.mjs`: 기존 exported API/CLI를 유지하는 무삭제 처리. standalone/APK/static 출력의 원본 그림·음악·3D 팩을 지우지 않는다.
- `.vercelignore`: 전체 원본 런타임 에셋과 소스 import 메타데이터 포함. 비밀키/로컬 출력 제외 유지.
- 관련 packaging 검사 2개와 기존 storage 검사 갱신.
- `WorldScene.saveSoon()` 콜백의 자기 재예약 오류를 `this.save()`로 수정. 이전에는 타이머가 저장 대신 계속 재예약됐다.
- `decorObjects.ts`, `decorFootprints.json`: 이전 RE 기반 발밑 충돌 헬퍼 보존. **WorldScene 배치/회전/철거에 아직 연결하지 않았다.**
- `grandPlanetCanon.ts`: 4개 정본 지역, 대화, 5개 보스 정의, 스노리카 6구역, 나머지 6개 지역 원정 설정 초안. **STAGES/DIALOGUES/BOSS_DEFS에는 아직 연결하지 않았다.**
- `storyRevision.ts`: 장비/재화/직업을 보존하고 서사만 이관하는 순수 헬퍼 초안. **현재 config/load/save에는 아직 연결하지 않았다.**
- 이전 RE 근거 JENNY_EVIDENCE.json / REFERENCE_DEEP_EVIDENCE.json / REFERENCE_DEEP_ANALYSIS.md를 CERTZ에도 보존했다. 이 보고서의 '적용/검증' 문구는 이전 SERTZ 구현에 대한 역사다. 현재 CERTZ에 모두 구현됐다는 뜻이 아니다.

## 미완성 전환 패치

`original-engine-integration.patch`는 이번에 작성하던 런타임 변경을 보관한 **미적용 초안**이다. 현재 앱을 불완전한 새 진행으로 자동 이관하지 않도록 active 파일에서 분리했다.

초안 포함: `/`를 GameRoot로, 제목 변경, config 저장 백업/버전 2/서사 marker 이관, WorldScene scene carry 마이그레이션/최종 재건 퀘스트에서 1기 완료, stages 마을→howlrstone1x1 및 중간 보스 비트 지원, storyProgression의 구 cleared 선행조건 제거.

**그대로 적용하면 완성이 아니다.** `HowlrstoneBeat.boss` 필드가 아직 없어 타입 오류가 난다. 원래 saveSoon 수정은 이미 본체에 반영돼 패치와 중복된다. 적용 전 `git apply --check`와 diff를 확인하거나 필요한 hunk만 수동 적용한다. 저장 백업 실패 시 원본을 덮어쓰지 않는 동작, 슬롯/Lobby 직접 로드 경로, 동일 revision 재접속의 멱등성을 먼저 테스트해야 한다.

## 구현해야 할 다음 항목

1. 원래 UI 복원: `src/app/page.tsx`의 CampaignRoot를 GameRoot로 바꾼다. 현재는 아직 CampaignRoot다. 기존 패널/입력/로비/로그인 기능을 유지한다.
2. 새 서사 버전: SaveData/config/loadSave/slots/TitleScene/WorldScene restore/buildSave까지 연결. 레벨, EXP, 장비, 강화, 보유품, 재화, 직업, 슬롯, 무한 콘텐츠 기록은 보존. 원본 JSON은 캐릭터별 백업. 옛 cleared/youngPrincessCleared로 새 2기가 열리면 안 된다. 새 story marker가 없을 때 1회만 서사 초기화한다.
3. `howlrstone.ts`의 기존 스키마와 stable `howlrstone{장}x{구역}` 키를 써서 15개 장/65필드를 개정 하루 이야기로 바꾼다. 권장 순서: 절벽/펜던트/검 → 디오/마을 비극 → 칼리야/리엘 수련 → 에벤트/벨리카/천문대 → 해상전/연합 → 루시 치유/영역 → 워프 전선/라시온 → 아리 대 페르온 → 추억/합류 → 성채/반란군 → 스칼렛 피/잠식 → 원소반응/구속/대화 → 데스크니스/에테르 → 시간/패러독스 → 재건/집/게이트. 각 비트는 지정 문서 근거로 작성하고 충돌 원칙을 따른다.
4. 각 장의 intro/beat/bossDone를 `lilacStory.ts` LILAC_DIALOGUES에 실제 대화로 정의. 월드 `stageIntro()`는 비트 dialogue를 우선하도록 고친다. 필드 talk는 실제 NPC/상호작용을 추가하지 않으면 완료할 수 없다. 단순 이동 장면은 reach, 자료 조사 collect, 전투는 실제 대상 hunt/boss. 필수 Lv130+ 및 20~30마리 반복 사냥으로 서사를 막지 않는다.
5. 중간 보스: beat에 `boss?: HowlrstoneBossKey` 추가, 단계별 bossKey 및 type boss 의뢰. 15x4는 평화로운 재건/귀환 목표이므로 bossDeath가 아니라 **마지막 퀘스트 완료**에서 youngPrincessCleared를 세운다. 기존 탑/도장/파크/공동토벌 보스는 서사 완료로 오인하지 않는다.
6. `grandPlanetCanon.ts`를 원래 stages/data에 통합. 순서 스타게이트→프리즈마→리버스→네오. 새 GrandPlanetBossKey 합집합과 BOSS_DEFS merge 필요. reverse8/neo4는 중간 보스, neo10은 회상이며 최종 보스가 아니다. 스노리카 입장/귀환 및 조작 가능한 목표 연결. 초안의 talk quest는 NPC 구현 전에는 미완성이다.
7. 예전 9개 지역은 렌더러/맵/기능을 보존하되 서사 연결을 끊고 선택 수련 원정으로 전환. CHAPTERS/QUESTS/intro/프롤로그/village/hardcoded field NPC 및 old auto Lilac cutscene를 함께 정리. WorldScene.showPrologue에는 아직 세계수 구원 서사가 남아 있다. `lilacScenarios.ts`도 구 배치라 무작정 계속 재생하면 충돌한다.
8. 실제 직업 스킬: 기존 ClassKey/tier/equipment/세이브 ID는 유지하면서 10개 tier2 branch 및 상위 tier를 정본 전승으로 매핑하는 방향을 조사했다. berserker=아리 태양검, guardian=루시 생명/치유, sniper=벨리카 번개활, windrunner=리안 차크람/꽃, archmage=제르 마도서, sage=란 아트생성/장막/치유, assassin=페르온 그림자, swashbuckler=하루 카피/순환/반응, corsair=카르텔 물/삼지창, raider=제이드 공학망치/분신. **아직 구현된 파일은 없다.** 실제 판정/MP/쿨/준비·발동·후딜·회피취소를 보존하며 구현. 기존 높은 tier/5차 기능을 제거하지 않는다.
9. 인간 보스를 용 그림으로 표시하지 않기: Scarlet/Feron/Dio/Irene/Jade/Fabian 등은 보유 SPUM core 28프레임으로 애니메이션 연결을 조사했다. CORE_BODY_PREFIXES는 chm0/chm1/chm3/chm4/chm5/chf0..5. textures bossSourceFrame/registerBossAnims/loadBossFrames와 Boss 크기/발밑 body까지 처리. **아직 구현 파일은 없다.** 해롤드/데스크니스 등 비인간은 기존 보스 원본 시트 활용. DialogueBox 초상도 동일한 인물로 맞춘다.
10. 발밑 충돌 헬퍼를 실제 배치/하우징 회전·회수·재배치에 연결하고 제거한 가구의 collider 잔류를 검사한다.
11. 대화/컷씬 건너뛰기 후 카메라·입력·physics 복구, 스킬 종료/scene shutdown의 타이머·이펙트 정리를 확인한다. 장면 이동은 startTransition 단일 경로.

## REA 사용과 근거

사용자 명시 스킬은 `skills/reverse-engineer-anything/SKILL.md`다. 먼저 읽고, ordinary source는 rg/코드로 분석하고 이미 확보한 레퍼런스 Evidence를 재사용한다. 무의미한 재설치/동일 분석 반복은 하지 않는다.

14개 레퍼런스를 모두 실행/완주한 적 없다. JENNY는 PCK/복원 스크립트의 startup→attack→recovery→cooldown/cancel, Nefarius는 몸체·피격·대시 영역 분리, Feather Park는 입력/전환 복구를 근거로 활용한다. 원본 타 게임 코드/캐릭터/전용 그래픽을 제품에 복제하지 않는다. RE 결과는 관찰/추론/미해독을 구분한다.

같은 환경이 유지되면 `/workspace/incoming/rea-evidence`, `jenny-static-recovered`, `nefarius-static-recovered`, `featherpark-static-recovered`, `/workspace/rea`에도 분석/설치 자료가 있다. 새 환경에서 없으면 저장소 증거 JSON을 먼저 확인한다.

## 검증과 환경

- packaging/storage/Grand Planet 초안 검사는 7/7 통과했다.
- 미완성 runtime patch를 적용한 상태의 tsc는 HowlrstoneBeat.boss 누락으로 실패했다. 그래서 전환을 패치에 보관했다. 최종 체크포인트의 tsc/lint 결과는 아래 실행 결과 기록을 참고한다.
- 최종 체크포인트: `npx tsc --noEmit` 통과, `npx eslint src --max-warnings 0` 통과, `npm test` 65/65 통과. 별도 Grand Planet 초안 검사 2/2 통과. 새 스토리/직업/보스를 실제 브라우저에서 검증하거나 새 APK를 생성한 상태가 아니다. 과거 통과 보고를 이번 결과로 재사용하지 않는다.
- `npm test`, `npx tsc --noEmit`, `npx eslint src --max-warnings 0`; 변경 후 실제 원래 UI/가방/장비/능력치/전직/하우징/첫 장/보스/엔딩게이트/모바일을 브라우저에서 확인한다.
- 오래된 `.next/types`가 제거된 route를 참조하면 `npx next typegen`으로 재생성 후 타입 검사. Next web/APK는 캐시를 공유하므로 동시 빌드하지 않는다.
- Node24, node_modules 있음. 2026-11-03 환경 재시작으로 /tmp 로그는 유실됐으나 `/workspace/incoming/`와 추출본은 유지됐다.
- 비밀키/토큰/keystore/계정 데이터는 인계 문서나 커밋에 포함하지 않는다. 현재 저장소의 GitHub signing secrets 존재를 추정하지 않는다.

## 다음 모델에게 붙여넣을 프롬프트

```text
https://github.com/apple01234/CERTZ 의 main에서 이어서 작업해.
먼저 AGENTS.md와 docs/handoff/DEEPSEEK_HANDOFF.md, skills/reverse-engineer-anything/SKILL.md를 읽어.
스토리 정본은 docs/handoff/evernote-approved/1.txt부터8.txt까지 순서대로 ONLY 읽고 다른 스토리/기획서는 읽지 마.
원래 GameRoot/WorldScene의 전체 기능과 디자인을 유지하며 아뜰란티스·이그드라실 서사를 지정 정본으로 바꿔.
기존 전직/장비/하우징/계정/파티/저장 기능을 축소하거나 새 독립 게임으로 갈아엎지 마.
기획서 인물에 맞는 실제 스킬·무기·애니메이션·이펙트·보스를 구현하고 기존/다운로드 에셋을 우선해.
이 커밋은 중간 체크포인트이며 original-engine-integration.patch와 grandPlanetCanon/storyRevision은 미완성 초안이야.
완료로 착각하지 말고 인계 문서의 미완료 항목을 구현→타입/린트/테스트→실제 브라우저 검증까지 계속해.
커밋/푸시는 CERTZ/main에만 해. 비밀키를 저장소에 넣지 마.
```
