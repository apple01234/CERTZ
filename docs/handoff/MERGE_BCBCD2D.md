# 기존 작업 복원 병합 — bcbcd2d 기준

대상은 apple01234/CERTZ main이다. `bcbcd2d0c8a4f607cbaea46c54223f59321fd7d8` 위에서 버전 2.2.24 / vc280으로 필요한 변경만 이식했다. 이전 파일을 통째로 덮어쓰거나 최신 지역 로딩·카메라·파츠 레이어를 되돌리지 않았다.

## 확인한 복구 원천

- `de1bb83`(vc269)은 bcbcd2d의 조상이다. 기존 커밋을 별도 cherry-pick할 필요가 없다.
- `docs/handoff/v268-WIP-source.tar.gz`의 UltimateSequence/DissolveFX/Boss/대회 route·client·ClassroomPanel은 이미 본체에 포함돼 있다. 최신 버전과 다른 Player/Enemy/storyBossAssets는 최신 구현을 보존했다.
- vc270~279에서 추가된 GM 버튼, 시청 기록 보존, 보스 windup/release, 보스 기록전, 스킬 FX 3단 시점, CreepZone, 방 맞춤 카메라, 파츠 레이어, 기본공격 회피 취소, 지역별 준비, 시작·설치 안내를 유지했다.

## 이번에 복원한 누락 변경

- 마을 주민·필드 NPC·전직 교관·퇴장 관리인은 기존 `spum_*` 원본을 먼저 선택한다. 기존 대체 이미지 매핑은 원본 누락 시에만 쓴다. 원본이 없는 priest/merchant 등은 기존 폴백을 유지한다.
- SPUM 초상화 14종은 원본 WebP의 지정 영역을 그대로 잘랐다. 새 이미지 생성·색 변경 없음. 교관/여관/퇴장 별칭도 같은 인물로 연결하고, 이전 초상화는 legacy 메타로 보존했다. `tools/crop_npc_portraits.py`도 이 우선순위와 픽셀 검사를 지원한다.
- 최신 지역별 `ensureWorldAssets` 선택 로딩을 유지하면서 준비 중 입력·물리·씬 시간을 잠근다. 성공하면 createInner 전에 풀어 새 컷씬의 pause를 덮어쓰지 않는다. 실패·중복 비동기 진입을 차단하고 새 실행의 시간 통계는 로딩 후부터 센다.
- 한 구역에서 맞춤 연출을 봤으면 챕터 연출과 옛 타이틀 카드가 재방문에 연달아 뜨지 않게 한다. 기존 cutsceneSeen/seen 저장 항목을 재사용하고 튜토리얼은 별도 진행을 유지한다.
- 일반 NPC 대화의 짧은 카메라 팬·줌은 기존 sceneCinematic 소유권과 정리를 재사용한다. 대화 종료·스킵·씬 종료로 원래 카메라에 복귀한다.
- 서버 인증이 필요한 GM 버튼·패널·로비 GM 외형·명령은 오래된 오프라인 admin 캐시를 권한으로 사용하지 않는다. 일반 계정의 오프라인 캐시 지원은 유지한다.
- 420ms 회피 무적과 최신 기본공격 취소를 유지한다. 무적이라는 이유로 이미 발동한 스킬/S2까지 취소되는 잘못된 경로만 막는다. 실제 Player에는 hurt 상태가 없으므로 기존 잘못된 fixture도 수정했다.
- 고정 동쪽 문구 대신 다음 구역 차원문으로 안내한다.
- 공개 보스 기록에서는 다른 계정의 ID·실명 전체·운영자 식별 정보를 숨긴다. 본인·관리자의 기록 검토는 유지한다.

## 복구되지 않은 미커밋 산출물

이 환경에는 이전 `/workspace`와 `/dev/shm` 내용이 없었다. 다음 파일들은 Git 이력과 WIP 압축본에서도 찾을 수 없어 포함됐다고 보고하지 않는다.

- `public/assets/spum-isekai/{lightning,circle-burst,slash}.{png,json}` 및 `IsekaiFX.ts` 연결.
- 원본 리그 60Hz 곡선을 구운 `hero-10400`, `hero-10000` 아틀라스·manifest·portrait와 추출 스크립트.
- 이전 에이전트가 보고한 보스 기록전 재전송/멱등 처리 확장과 추가 궁극기 수명 정리 전체 소스.
- Claude 공유 대화의 미커밋 타이틀 버튼 배치·아이콘 수정 파일.

재추출 원천: https://drive.google.com/file/d/1gncanoW4fHu6kCv9cjrFmRK1sHyvlQOf/view
당시 XAPK SHA256: 9f13113d4381bb5bf7447a7c8cdc6925c997cd5f303c6464b8d6ec850c392d3c.
당시 보고는 한 방향 원본 리그이며 방향별 시트를 확보했다는 뜻이 아니다. 이 추출본을 새로 복구할 때 원본 구매 SPUM과 함께 사용하라는 사용자 지시를 따른다.

## 남은 기존 기록전 연결 문제

현재 본체는 `startBossContest`를 정의하지만 호출하지 않는다. 준비 상태에서 경기 결과를 제출할 수 없고, 월드의 현재 보스를 그대로 쓰는 경로도 고정 guardian 계약과 맞지 않는다. 과거 에이전트의 준비 gate/독립 경기장 작업은 이력에 없다. 이 병합을 기록전 전체 완성 또는 실물 경품 지급 검증으로 취급하면 안 된다. 후속 작업은 기존 startTransition·경기 전 저장 보존·서버 시작시각·실패 재전송을 함께 연결해야 한다.

## 검증

검증 결과는 이번 worklog Task를 따른다. 기존 커밋의 테스트 수나 이전 임시 환경의 성공 기록을 이번 실행 결과로 재사용하지 않는다. 운영 계정·실제 서버 기록 제출·APK 실기기·이세카이 추출본은 이번 병합의 검증 범위가 아니다.

실행 결과: 전체 726/726, tsc, lint:strict, `next build --webpack` 통과. `CHROMIUM_PATH=/usr/bin/chromium E2E_URL=http://127.0.0.1:3100 node scripts/playtest-v275-e2e.mjs` PASS. 실제 신규 생성→월드 진입·페이지 예외 0·비관리자 GM 숨김·관리자 가방 왼쪽 GM 버튼·보스 6종 windup/release 등록을 확인했다. 관리자 응답은 fixture이며 운영 로그인/권한 인증 검증이 아니다. NPC 카메라 연결은 실행 가능한 계약 검사와 기존 공유 세션 스킵/종료 검사로 확인했으며, 맵 왕복과 NPC 대화를 실제 브라우저에서 전수 검사한 것은 아니다. PNG 원본 바이트 보존 보완 후 관련 검사도 다시 통과했다.

## 다음 AI에게 전달할 프롬프트

```text
/workspace/CERTZ main에서 이어 작업해. AGENTS.md와 docs/handoff/MERGE_BCBCD2D.md를 먼저 읽어.
bcbcd2d 위에 복원한 vc280(2.2.24)의 원본 SPUM NPC·로딩 보호·시청 기록·서버 GM 확인·대시 취소를 유지해.
이미 합쳐진 기존 커밋이나 v268 WIP 파일을 통째로 다시 덮어쓰지 마.
미커밋 이세카이 추출본은 이번 환경에 없어 복구되지 않았다. 위 문서의 Drive 원본과 SHA를 이용해 구매 SPUM과 이세카이 SPUM 캐릭터/효과를 재추출해 연결해.
원본 방향·실제 프레임·출처를 정직하게 기록하고, CrossCode는 기존 관찰 증거를 재사용해.
보스 기록전은 startBossContest 미호출, 현재 지역 보스 사용 문제가 남았다. 고정 guardian/정상 난이도 경기장, 기존 저장 보존, countdown 후 서버 시작, 단발 계정/멱등 요청/실패 재전송, 정상 귀환을 함께 연결해. 클라이언트 처치 보고는 승인 대기로만 처리해.
궁극기 예약 정리 및 실제 서버·터치 검증은 현재 문서의 한계를 따라 이어가.
GameRoot/WorldScene/Player와 모든 기존 기능·픽셀아트를 유지하고, 서사를 바꾸면 승인된 evernote-approved/1.txt..8.txt만 순서대로 읽어.
커밋·푸시는 apple01234/CERTZ main에만 해. 자격증명이나 계정 데이터를 문서/커밋에 넣지 마.
```
