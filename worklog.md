# SERTZ Worklog

---
Task ID: v2-sync
Agent: Super Z (main)
Task: git pull 요청 처리 + 원격 동기화

Work Log:
- git pull → Already up to date (원격 신규 없음)
- 로컬 미푸시 커밋 1개(02bc61e, v1.9 E2E 스크린샷 체크포인트) 확인 후 push (8ea1f20..02bc61e)
- .gh_token 저장 파일로 push 경로 유지

Stage Summary:
- 로컬 = origin/main 완전 동기화 (02bc61e)

---
Task ID: v2-recover
Agent: Super Z (main)
Task: 사용자 Google Drive 이전 프로젝트 복구 + 20개 지시사항 반영 준비

Work Log:
- Google Drive 파일(1_YWNXI1u7rWLgYfcwt7CpsxCbrBcPJiB, 463MB) 다운로드 완료
- prev-project/extracted/SERTZ-workspace-20260829 해제: 45커밋 git 히스토리 + 전체 소스 + 에셋팩 18종(221MB) + public/assets 236 PNG
- 이전 버전 = v1.5 (스토리 10장 55퀘스트, 보스 9종, 몬스터 12종, 복귀 차원문, 8 BGM, 외부 에셋 26종, 에필로그)
- 현재 버전(v1.9) 대비 손실 확인: 스토리 4장, 복귀 포탈, 스토리 대사, 8BGM, 외부 에셋, 강화 12단계
- 채팅 안됨 원인 발견: netJoin이 소켓 연결 전 호출 시 조용히 실패 + 서버가 미 join 플레이어 채팅 폐기
- 타입 정의 동일 조상 확인 → 안전 포워드 포팅 전략 확정

Stage Summary:
- 병합 전략: 현재 repo(v1.9)를 베이스로 이전 스토리 데이터 복구

---
Task ID: v2-impl
Agent: Super Z (main)
Task: v2.0 대규모 업데이트 — 사용자 20개 지시사항 구현

Work Log:
- 에셋 이관: 이전 public/assets 236 PNG + 8 BGM ogg 전부 복사 (CREDITS.md 포함)
- src/game/stages.ts 신규 생성: 9챕터 × 10구역 = 90필드 생성기 + 12몬스터 + 9보스 + PREV_STAGE/STAGE_SHORT/stageScale/stageIntro/STAGE_THEME (지시 #6, #19)
- data.ts 재구성: 스테이지 데이터 stages.ts 재수출 + v1.5 스토리 대사 전면 복원(아뜰란티스 7보석 라인 ~45건) + 구역 탐험/정예경고/보스접근 대사 자동 생성 + 강화 12단계(UPGRADE_MAX 12, rates, +9 실패 하락, 단계별 비용 곡선) + 골드 밸런스(GOLD_DROP_SCALE 0.62)
- 전직 스토리(지시 #13): JOBSTORY 3계열 × 2/3차 = 6체인 (토벌→수집→시험상대 소환전), 계열별 시조 캐릭터 대사 30건, 완료 보상 AP+5/10
- 스탯 자동 배분(지시 #18): AUTO_ALLOC 4:1 비율 + autoAllocPlan + 스탯 패널 "✨ 자동 배분" 버튼
- WorldScene: 복귀 차원문(청록 포탈+비컨+←라벨), 구역5 정예 몬스터(배너+포효), 프롤로그 보호(agroHoldUntil 2.6초), 마을 건물 기능(여관 20G 회복+저장 / 내 집 무료 휴식 / 전직관 간판), E 말풍선(이름 위 y-58, 지시 #14), 방향키 마지막 키 우선(dirOrder 스택, 지시 #16), 토벌 퀘스트 huntBaseline(시작 후 킬만 카운트 + 대상 몬스터만, 지시 #17), 보스 BGM 전환 수정(정지→테마BGM, 지시 #7), 보스 소환 시 챕터 배율 강화+파티 방송, BGM stageBgm 8트랙 매핑, 골드 드롭 스케일, 전직 스토리 훅(킬/수집/시험), 챕터 테마 placeDecor(마그마/무덤/유적/육한식물/모닥불 — 무료 에셋, 지시 #1 #10)
- Enemy.ts: 생성자 opts(hp/atk/exp/gold/scale/tint/displayName) + 프롤로그 보호 게이트 + BODY_CFG 5종 추가
- Boss.ts: 프롤로그 보호 게이트
- Player.ts: 공격 중 이동 허용(55% 속도 무빙샷, 지시 #4) + 공격 종료 후 이어 걷기 + 강화 upMax 12/비용곡선/하락
- audio.ts: BGMKind 8종 + stageBgm() + 자동재생 가드 유지
- BootScene/textures: 확장 타일/몬스터 5종/보스 6종/외부 장식 26종/BGM 5트랙 로드 + 애니 등록
- net.ts: join 대기열(connect 플러시 — 채팅 오류 수정, 지시 #14) + stage 필드 + 파티 API + 보스 방송
- server.js: 스테이지 AOI(같은 구역만 동기화, 지시 #9 #15) + 파티(창설/참여/탈퇴/파티채팅/보스공지, 지시 #5)
- UI: PartyWidget 신규(Y키), ChatBox 파티 메시지 배지, DialogueBox 홀드 고속 스킵(지시 #3), Overlays v2.0 배지/이어하기 라벨 구체인 대응, 구 캐릭터명(요정 아리→아부디토스) 교체
- config.ts: SaveData jobStory/jobStoryDone 필드 + 로드 폴백
- tsconfig/.gitignore: prev-project/upload 제외

Stage Summary:
- 20개 지시 중 17개 구현 완료 (#15 WebRTC 하이브리드는 파티 릴레이로 1차 대응, 후속 과제)
- tsc 0 에러, eslint 0 에러(서버 require 3건은 기존 유지)
- E2E 실측 통과: 타이틀 v2.0 배지 → 마을 인트로(아부디토스 안내) → forest3(퀘스트 0/4·복귀차원문 2-2·대사 치환) → 대화 스킵 → hel5(정예 구역·절벽 열기 0/12·무덤 데코) → niflheim10(펜리르 보스바 소환·퀘스트 체인 hunt→collect→boss→reach) → 전투(데미지 텍스트·피격) → 사망/부활 → 파티 창설(코드 P1 시스템 채팅) → 마을(E말풍선 위치·상점·강화 비용 65G/85%) → 채팅 전송 성공 → muspelheim2(화산 테마·불꽃늑대 0/6)

---
Task ID: v2-ship
Agent: Super Z (main)
Task: 최종 검증 + GitHub push

Work Log:
- tsc/eslint 재확인 통과
- 커밋 작성자 apple01234 <callas0729@gmail.com> 고정, .gh_token으로 push

Stage Summary:
- v2.0 push 완료 (원격 동기화)

---
Task ID: v2-apk
Agent: Super Z (main)
Task: 사용자 요청 "Apk로 줘" — SERTZ v2.0 Android APK 패키징

Work Log:
- 기존 Capacitor 8 안드로이드 프로젝트(android/) 활용, 최초 실빌드 완료
- Android SDK 설치 (cmdline-tools + platform 36 + build-tools 36.0.0 → /home/z/android-sdk)
- 루트/sudo 불가 환경 → 포터블 Temurin JDK 21 (/home/z/jdk) 다운로드 후 JAVA_HOME 지정 (javac 확보)
- net.ts v2.0 APK 대응: Capacitor 네이티브 판별 + localStorage 'sertz.server.url' 오버라이드
  (지정 시 해당 서버 멀티플레이, 미지정 시 연결 시도 생략 — 오프라인 재접속 루프 제거)
- src/app/api/route.ts: output:export 대응 force-static 추가
- capacitor.config.ts webDir: out → .next-apk (커스텀 distDir export 실제 출력 위치)
- APK export 빌드 성공 (APK_EXPORT=1 next build → .next-apk, 에셋 294종 포함)
- 런처 아이콘 교체: public/logo.svg → mipmap 전밀도 PNG (scripts/build_launcher_icons.js, sharp) + 적응형 배경 #05070D
- 릴리즈 서명: android/sertz-release.keystore 생성 (alias sertz / storepass sertz2020) + signingConfig 적용
- 버전 bump: versionCode 5 / versionName "2.0"
- 스모크 테스트(Playwright, 정적 서빙): 타이틀 렌더·canvas 부팅·404 0건·콘솔에러 0건 확인
- 원커맨드 재빌드 스크립트 추가 (scripts/build_apk.sh)

Stage Summary:
- 산출물: download/SERTZ-v2.0.apk (16MB, minSdk 24(Android 7.0)+, targetSdk 36, release 서명)
- APK는 완전 오프라인 실행(세이브 localStorage) + localStorage 'sertz.server.url' 설정 시 웹 서버와 멀티플레이 연동

---
Task ID: v2-apk-multi
Agent: Super Z (main)
Task: APK 멀티플레이 불가 원인 해소 — 서버 주소 설정 UI 추가

Work Log:
- 원인 정리: socket.io 서버(server.js, Node)는 APK 내부에 존재 불가 → 웹은 same-origin 자동 접속, APK는 origin=localhost라 접속 대상 없음
- ServerConnect.tsx 신규 (타이틀 우하단, 네이티브 전용): 서버 주소 입력 → localStorage 'sertz.server.url' 저장 & 새로고침 / 오프라인 전환 / 연결 상태 표시(서버 연결됨·연결 중…·오프라인 모드)
- GameRoot 타이틀 분기에 ServerConnect 마운트
- net.ts 오버라이드 정규식 wss:// 허용 확장
- tsc 0 에러, 스모크 테스트 재통과 (canvas 렌더·404 0건·콘솔에러 0건)
- scripts/build_apk.sh 로 APK 재빌드 → download/SERTZ-v2.0.apk 갱신

Stage Summary:
- APK에서 타이틀 화면 → 우하단 "오프라인 모드" 버튼 → 서버 주소 입력 시 웹 플레이어와 동일 서버 멀티 가능

---
Task ID: v2.1-fixes
Agent: Super Z (main)
Task: 사용자 5건 보고 수정 — ①NPC 상호작용 UI 위치 ②타일맵 부자연 ③친구 시스템 신규 ④파티 생성/가입 ⑤크로스플랫폼 상호 시야

Work Log:
- ⑤ 원인 실측 추적: 서버 소켓 대칭성 테스트(정상) → 클라이언트 프로브 → 2페이지 headless 동결 특성 확인
  + 결정적 구조 결함: 서버가 join/이동 시에만 브로드캐스트 → 나중 접속자 join 1건을 놓치면 영원히 안 보임
  → server.js 2초 하트비트 broadcastPlayers 도입으로 자가 복구
- ④ 파티 자체는 정상 실측(P1 생성→참여→멤버 2명 양쪽 확인). 문제는 미연결 상태에서 조용히 무시되는 UX
  → PartyWidget 생성/참여 버튼에 미연결 가드 + 안내 메시지 추가
- ③ 친구 시스템 신규: config fcode(6자리)/friends 필드 + makeFcode/getFcode/mutateFriends,
  net.ts netOnFriends(netStatus 포함), server.js join 코드 수신 + friendsPayload 2초 전파,
  FriendsWidget(내 코드 복사·추가·삭제·온라인 점·구역·이동), WorldScene friend:goto 핸들러(구역 이동)
- ① InteractPrompt 하단 고정 → NPC 월드좌표 수신 후 월드→화면 변환으로 NPC 머리 위 앵커링(rAF 카메라 추적)
- ② buildGroundBlend 재작성: 도로 경계 사인파 물결 + 지터 스캐터 + 프린지 밀도/반전 다양화,
  placeDecor 나무/바위 2~3 군집 의사-가우시안 배치
- ServerConnect 첫 실행 자동 오픈, APK 오프라인 진입 시 배너 안내
- E2E(script/e2e_v21.js, 서로 다른 브라우저 2개 + 자식 서버 :3105): 상호 시야·파티·친구 온라인·프롬프트 앵커 ALL PASS
- tsc/eslint 0 에러, 정적 export 스모크 통과, APK v2.1(versionCode 6) 재빌드
- 플랫폼이 세션 프로세스를 정리하는 관계로 :3000 서버는 수동 재기동 필요할 수 있음

Stage Summary:
- v2.1: 5건 전부 해소. 친구 시스템(친구코드·고유번호·온라인 표시·따라가기) 신규 탑재
- 다운로드: download/SERTZ-v2.1.apk

---
Task ID: v2.2-feel
Agent: Super Z (main)
Task: 사용자 2건 — ①기본 공격 타격감/스터터 ②여관·집 실내 맵 + 취침 연출

Work Log:
- ① 스터터 원인: 공격 러지(190px/s×170ms)가 입력 이동을 덮어써 방향을 꺾고, 러지 종료 시 velocity 0 → 매 스윑 멈춤
  → Player.ts: 이동 중 공격 시 러지 생략(정지 시만), 공격 중 이동 55→80%, 스윙 판정(65ms) 후 걷기 애니 복귀,
    종료 시 입력 없을 때만 정지, 쿨다운 330→300ms
- ① 타격감: Enemy 스쿼시(눌림 반동 tween), 타격 충격 링(shock_ring 확산), 히트스톱 65→55ms
- ② 실내 맵: stages.ts interior_inn/home(1152×648, 세이브 미기록), data.ts 로안 대사 3종,
  WorldScene buildInterior(나무바닥·벽·러그·침대·모닥불 애니·촛불·카운터·출구 문),
  건물 E→입장 / 로안 대화→취침 연출(암막+Zzz 2.6초)→풀회복+버프(atk/def 60초)+저장→마무리 대사,
  출구 문 E→건물 앞 복귀(entry 좌표 스폰), create() data.stage 우선 수정,
  수면 중 입력 봉인, cv_candle/sv_door 부팅 로드 추가
- E2E(scripts/e2e_v22.js): 이동 중 연타 속도 샘플 16개 전부 184~230(정지 0),
  여관 플로우 입장→대화→결제→버프(gold 100→80, buff_atk/def)→퇴장 복귀 ALL PASS
- tsc/eslint 0 에러, 스모크 통과, APK v2.2(versionCode 7) 빌드 → download/SERTZ-v2.2.apk

Stage Summary:
- v2.2 완성. 공격이 달리면서 나가고, 여관/집이 실제 공간으로 동작

---
Task ID: v2.3-qol
Agent: Super Z (main)
Task: 사용자 7건 — ①재입장 대사/퀘스트 재표시 버그 ②몬스터 수/리젠/성장속도 ③스탯 자동배분 버그 ④반복퀘스트 NPC 수주+밸런스 ⑤APK 빌드 없이 커밋만 ⑥여관/집 정사각 방 ⑦채팅 안됨

Work Log:
- ① seenSet(본 대사 기록) 세이브 영속화 — showDialogueOnce/markSeen 도입, 스테이지 인트로/체인 대사/보스 등장/victory 1회 재생.
  재입장·여관 왕복마다 villageIntro/구역 안내가 반복되던 버그 수정. reach 대사 미기록 엣지 보완(큐 시 markSeen)
- ② 몬스터 증원(count ×1.6+sub/2, 상한 11→20), 리젠 9~13초→3.2~4.8초, 스폰 재시도 2.5→1.2초,
  expNext 55×lv^1.72→50×lv^1.62 (성장 체감 1.5~2배+)
- ③ 자동 배분 버그 — 미전직 cls null에서 familyOf()=null → 조용히 return. warrior 비율 폴백 (힘4:민첩1)
- ④ 반복 토벌 의뢰가 체인 완료 후 자동 활성되던 것 차단 → 마을 상인 라고스 E 대화로 수주(repeatOn 세이브).
  퀘스트 트래커/로그에 "미수주" 안내. 자동 토벌 퀘스트 목표 상한 12(기존 최대 21), expReward 상향 — 스토리 진행 경험치 딱 맞게
- ⑤ APK 빌드 생략 — 커밋/푸시만 수행
- ⑥ 여관/집 실내 1152×648 → 832×832 정사각 방 + 실내 전용 줌 ×1.45(좁고 아늑하게),
  좌우 벽 패널+측벽 촛불+원형 러그, 실내 저장 시 세이브 스테이지가 village 유지되는 버그도 수정
- ⑦ 채팅 — socket.io 재접속 시 join 재발송 안 해 조용히 죽던 버그(lastJoin 자동 재참여),
  미연결 시 전송하면 로컬 안내 메시지(조용히 증발 방지), 모바일 전송 버튼+enterKeyHint, onBlur 즉닫기 제거(가상 키보드)
- EventBus window.__SERTZ_EB__ 디버그 훅 추가(E2E용)
- 검증: tsc 0 / eslint 0 / next build 성공 / e2e_v23 19 PASS 0 FAIL (스크린샷: v23-*.png)
- 버전 2.3.0 (APK versionName 업데이트는 다음 빌드 시)

Stage Summary:
- v2.3: 7건 전부 해소(⑤는 빌드 생략 확인). 사냥 밀도·성장속도 상향, 반복 의뢰는 NPC 수주제, 실내 정사각화, 채팅 자가 복구
- 다음 APK 빌드 시 versionCode 8 / versionName 2.3 필요

---
Task ID: v2.3-verify
Agent: Super Z (main)
Task: v2.3 7건 구현 스팟 검증 + 원격 동기화 확인 (사용자 언어 지적 → 한국어 전환)

Work Log:
- git ls-remote(token) 실측: 원격 main = 로컬 HEAD(4a8ac0a) 동일 — v2.3 커밋(7efb469) 포함 푸시 완료 상태 확인
- 로컬 stale origin/main 참조 갱신 (update-ref)
- 코드 스팟 체크: ①seenSet/markSeen 영속화(WorldScene 126/3251/3278) ②몬스터 ×1.6+sub/2 상한20(stages 491)·리젠 3.2~4.8초(1516)·재시도 1.2초(1594) ③자동배분 warrior 폴백(Panels 672) ④반복의뢰 라고스 수주제(3083/3333) ⑥실내 832×832(stages 592) ⑦채팅 lastJoin 재참여(net)+미연결 피드백(ChatBox 70-75) 전부 확인
- tsc --noEmit 0 에러, 작업트리 clean

Stage Summary:
- v2.3 품질 검증 완료 — 추가 수정 불필요. 원격=로컬 동기화 확인
- 커뮤니케이션 언어 한국어로 전환 (사용자 지적 반영)

---
Task ID: v2.3-apk
Agent: Super Z (main)
Task: 사용자 요청 "Apk만 줘" — v2.3 Android APK 재빌드

Work Log:
- android/app/build.gradle: versionCode 7→8, versionName 2.2→2.3
- scripts/build_apk.sh: 산출물명 SERTZ-v2.2.apk → SERTZ-v2.3.apk 갱신
- build_apk.sh 실행: APK_EXPORT=1 next build → cap sync android → gradlew assembleRelease (BUILD SUCCESSFUL 34s)
- 검증: aapt badging — versionCode 8 / versionName 2.3 / minSdk 24 / targetSdk 36, apksigner --print-certs — CN=SERTZ 릴리즈 서명 정상

Stage Summary:
- 산출물: download/SERTZ-v2.3.apk (16.7MB, v2.3 7건 전부 포함 — 몬스터 증원/리젠 단축, 자동배분 폴백, 라고스 반복의뢰, 정사각 실내, 채팅 자가복구, 재입장 대사 1회화)
- 다운로드 직링: https://github.com/apple01234/CERTZ/raw/main/download/SERTZ-v2.3.apk
- ⚠️ 원격 리포지토리가 private 확인 → 익명 raw 접근 404, 로그인(소유자/협업자) 상태에서는 정상 다운로드(206 확인).
  공유용 공개 직링이 필요하면 리포지토리 공개 전환 필요 (Settings → General → Danger Zone → Change visibility)
- 사용자가 리포지토리 공개 전환 완료 → visibility: public 실측. 익명 raw 직링 206 정상,
  전체 다운로드 무결성 검증(16,766,788B / versionCode 8, versionName 2.3) 통과 — 공개 직링 확정
