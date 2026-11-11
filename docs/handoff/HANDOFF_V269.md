# vc269 즉시 인계 — 2026-11-11

사용자가 토큰 부족으로 **현재 완료분 즉시 커밋·푸시 + 다음 AI 지시서**를 요청해 중간 마감한다. 요청 12건 전체 완료가 아니다. 저장소는 apple01234/CERTZ main만 사용한다. 기준 HEAD는 bb37a7f이며 푸시 직전 원격 a87d4a9(대시 무적)를 보존해 통합했다. 보존 WIP Player.ts는 대시 무적 수정 전이므로 통째 덮어쓰면 안 된다. 이번 버전은 2.2.13/vc269이다.

## 이번 체크포인트에 실제 포함한 수정

1. NPC 초상화: cutscene-cast 원본의 투명 여백과 잘못된 셀 중심 크롭 때문에 오른쪽으로 치우쳤다. 기존 아틀라스의 실제 alpha 영역 기준 CSS crop 메타를 만들고 DialogueBox에서 사용한다. 새 그림 생성 없음.
2. 남녀 기본피부: a437b5e에서 검은 매트가 포함된 단일 작은 그림을 확대하고 모션을 복제한 회귀였다. 검증된 08f70fb의 chm2/chf2 투명 28동작 세트 PNG/WebP 112개를 복원했다. prefix/피부 선택값/세이브는 유지한다. 잘못된 기존 생성본은 docs/qa/2026-11-11/asset-recovery/pre-recovery-default-skins.zip에 보존하고 recovery.json에 before/restored SHA256·commit을 남겼다. 미리보기도 실제 몸체 alpha 높이를 기준으로 맞춘다.
3. 로딩: stagedAssets가 현재 맵 일부만 기다린 뒤 나머지를 background로 등록하던 동작을 전체 actual catalog 완료 후 진입으로 바꿨다. 실패한 요청만 재시도하며 캐시/진행 중 요청을 재사용한다. 30초 전체 시간제한을 30초 무진척으로 바꿔 느린 정상 전체로딩을 허용했다. 진행률/개수/실패 키/재시도 UI가 있다.
4. 최적화: 전체 애니메이션 스캔을 매 50ms가 아닌 로딩 phase 완료 시 한 번만 수행. 같은 JSON URL 60개의 중복 동시 fetch를 Promise 캐시로 제거(실패 시 캐시 해제). 기존 actual catalog 3675정의/고유3716 URL/약59.6MB, 파일 미존재0 audit. 전 맵 BGM을 동시 PCM 디코딩하는 방식은 메모리 비용이 매우 커서 도입하지 않았으며 audio.ts LRU는 유지한다.
5. 파티/멀티: 소켓 연결대기 중 HTTP fallback이 응답을 구독하지 못하던 경로, hidden 탭 복귀 후 폴링 영구 중단, localStorage 공유 cid로 같은 브라우저 2탭 MQTT가 서로 끊던 문제를 수정했다. per-tab session identity와 복구, 서버 오류 표시, host 승계/맵 정보 갱신 보완이 포함된다. 계정 키와 기존 서버 방식 유지.

검증: 외형/로딩/파티 선택 검사 17개 통과. 외형 에이전트 별도 appearance 체크 2191개 및 기존 portrait 관련 검사 통과, 로딩 전용 lint 및 tsc 통과 보고. **이번 체크포인트의 전체 회귀·프로덕션 빌드·두 브라우저/실기기·운영 배포 재검증은 마감 시점에 수행하지 않았다.** 긴급 체크포인트 전체 tsc도 통과했다. 최종 tsc 로그는 /tmp/certz-v268-checkpoint-tsc.log. 이전 vc267의 609 전체검사·실제 플레이 성공을 이번 수정의 결과로 잘못 인용하지 않는다.

## 다음 AI에게 그대로 줄 프롬프트

너는 /workspace/CERTZ의 main에서 이어 작업한다. 먼저 AGENTS.md, skills/ponytail/SKILL.md, docs/handoff/DEEPSEEK_HANDOFF.md, 이 문서를 읽어라. 기존 GameRoot→WorldScene→Player, 기능·저장·직업·픽셀아트·에셋을 유지한다. 새 엔진/독립 축소 게임으로 만들지 말고 새 의존성도 추가하지 마라. 스토리를 바꿀 때만 docs/handoff/evernote-approved/1.txt..8.txt를 순서대로 읽고 그 외 스토리 문서는 읽지 마라. 아뜰란티스/이그드라실/9개의 바다 서사를 되살리지 마라.

우선 현재 체크포인트를 tsc/lint/전체 tests/build 및 실제 PC·터치로 검증한다. 외형은 로비 남녀 기본·피부 프리뷰 크기/투명도/실제 걷기·공격 및 NPC 초상 얼굴의 시각적 중앙을 캡처한다. scripts/playtest-cutscene-cast.mjs는 새 atlas/data-portrait-src 메타에 맞춰 갱신했다. 로딩은 느린 네트워크에서 전체 큐가 끝나기 전에 월드 입력·AI·타이머가 실행되지 않는지, 실패 에셋 재시도가 성공 캐시를 다시 받지 않는지 검증한다. WorldScene.create에는 기존 ensureWorldAssets 대기는 있지만 부모가 추가하려던 input/clock/physics 강제 gate와 로딩 후 runStart 재설정은 아직 넣지 않았다. 성공 시 createInner가 시작하는 컷씬의 pause 상태를 잘못 풀지 마라. 파티는 실제 2탭 생성→코드참여→맵이동→탭 숨김/복귀→재연결→host leave를 검사한다. multiplayer/index.js도 수정됐으니 Node/socket 경로도 확인하라.

사용자 잔여 요청은 다음과 같다.
- 보스 모션 및 실제 프레임 수 증가, NPC 연출 강화.
- 한번 본 컷씬은 맵 이동 후 다시 뜨지 않게 한다. WorldScene의 cutsceneSeen/seenSet은 저장되지만 playLilacOpeningCutscene 완료 기록과 stage intro fallback, 시청 키, skip/shutdown/전환 직전 saveSoon flush, seen.slice(-160) 손실 등을 실제 왕복/재접속으로 재현해 고친다. 기존 save 필드를 우선 재사용한다. 새 필드면 config/복원/buildSave를 모두 맞춘다.
- GM 패널 버튼을 가방 왼쪽에 배치하고 admin 서버 로그인 시에만 보이게 한다. HUD.tsx 가방 버튼 위치를 사용한다. 권한은 game/account.ts authMe와 auth:changed로 확인하며, UI 숨김뿐 아니라 패널 진입/GM 액션 가드도 검증한다. 부모는 HUD/GameRoot를 아직 수정하지 않았다.
- 실제 간식/경품용 경쟁은 **사용자가 '보스 기록전: 처치 기록으로 순위'를 선택 확정했다.** 퀴즈로 바꾸지 마라. 서버 시간·단발 attempt·계정 바인딩·보스/난이도 고정·중복/불가능한 기록 검증을 하고 GM 검토 승인/거절/지급표시까지 구현한다. 클라이언트 보고를 완전한 서버 처치인증으로 과장하지 말고 승인대기와 공식기록을 분리한다. 기존 클래스룸 6종을 삭제하지 않는다.
- 몬스터 죽음 때 타일맵/전체 아틀라스가 튀는 일부 효과를 고친다.
- 궁극기 중심으로 스킬 전반의 준비→실타격→마무리 연출을 정합성 있게 개편한다. 기존 직업·MP/CD·피해계수·타격수·지속필드를 무작정 없애지 마라.

## 보존한 미완성 소스: 자동 적용하지 말고 검토 후 재개

`docs/handoff/v268-WIP-source.tar.gz`에 전투/경쟁전 작업 파일의 **전체 소스**를 보존했다. 이 파일들은 현재 런타임에서 제외했고 원래 HEAD 버전으로 되돌렸으므로 미검증 UI가 운영에 노출되지 않는다. 먼저 `/dev/shm/v268-wip` 같은 별도 폴더로 압축을 풀고 현재 소스와 비교해 필요한 부분만 적용한다. 향후 변경된 현재 파일에 통째로 덮어쓰지 마라.

전투 보존 파일: entities/Boss.ts, Enemy.ts, Player.ts, fx/DissolveFX.ts, storyBossAssets.ts, combat/ultimateSequence.ts, tests/combat-presentation.test.mjs.
- 실제 원인: Enemy가 전달한 frame을 DissolveFX가 무시하고 spritesheet 전체 UV0..1을 샘플링했다. Phaser4 sampler 바인딩도 texture 객체가 아닌 textures 배열+index여야 했다. WIP는 frame UV/native size/trim/flip 및 중단 정리를 고쳤으며 전용4 tests/타입/lint 통과 보고. 아직 실제 GPU/canvas 캡처 미확인.
- 궁극기 원인: useSkill5의 runUltFinale가 예약 직후 동기 실행돼 첫타보다 먼저 나가며, useSkill5b는 실제 딜이2~9초에 끝나도 44~60초 뒤에 뒤늦은 마무리가 나온다. WIP ultimateSequence가 중첩 delayedCall을 추적해 마지막 실제 타격에 마무리를 연결하고 공통 암전/카메라는1~2초로 제한한다. 기존 궁극기 전체회귀/PCtouch 취소·사망·맵이동 정리는 미검증.
- Boss storyCast windup→release 분리, storyBossAssets의 실제 attack-* 전체 frame 인식이 WIP에 있다. 실제 신규 애니메이션 생성은 아직 안 했다. 추천: scarlet 혈검 발도/베기/납도, feron 중검 사선베기/회수, kraken 촉수강타 각12~16실제 프레임. public/assets/story-bosses/{scarlet,feron,kraken}.png/json의 attack-0은256x256이다.

경쟁전 보존 파일: ClassroomPanel.tsx, game/bossContest.ts, lib/bossContestStore.ts, api/contest/route.ts, tests/boss-contest.test.mjs. 코드 작성 중 중단돼 완성/검증으로 취급하지 마라.
- 제안 계약: prepareBossContest(contestId)→EventBus contest:start {attemptId,contestId,boss:'guardian',difficulty:'normal',limitMs:180000,bossHp:120000}. startBossContest(attemptId) 서버 시작시각 후 WorldScene에서 실제 경기. finishBossContest('defeated'|'failed'|'abandoned', {bossHp,damage,hits,combatMs}). activeBossContest(). 부모 WorldScene 연결은 아직 전혀 없음.
- 기존 db.rank['bossContestsV1']에 별도 typed store를 두려 했고 공용DB 수정은 하지 않았다. 저장 schema·인증·admin 가드·충돌/중복·부분 파일 유효성을 모두 검토해야 한다. 경기용 기존 arena/stage 재사용과 경기 전후 본편 세이브 보존/정상귀환도 미구현이다. startTransition 단일 통로를 준수한다.

## 도구·환경

Pixel Engine 잔액100 확인만 했고 유료 생성/애니메이션 작업은0건. 사용자 해당 플러그인 명시, 기존 원본 우선. GameRelay list_instances 빈배열이라 기존 서비스 통째 교체는 하지 않았다. Context7 Phaser4.2.1 Loader complete/loaderror와 animation frame 공식 문서를 조회했다. game-dev CLI는 /workspace/tools/game-dev-cli/bin/game-dev 1.5.1, capabilities만 확인했다(측정·GPU capture 실행 증거 아님). gamecollecting은 게임 가격 조회용이라 코드 수정에 사용하지 않았다.

디스크 root 약345MB, /dev/shm 약3GB 여유. 공유 .next를 여러 프로세스가 동시에 빌드하지 마라. Vercel/GitHub 자격증명은 채팅/문서/커밋에 넣지 마라. 기존 운영 GITHUB_TOKEN/SERTZ_BACKUP_KEY를 교체하지 마라. 사용자 기존 배포/서명 APK 권한은 유지되나 새 외부 서비스/키를 임의 도입하지 마라. 빌드/배포 진행은 GitHub Actions에서 확인하고 READY+운영 검증 뒤 sertz 최신 정상배포만 남겨라. 이번 긴급 마감은 전체 배포 검증 완료를 주장하지 않는다.
