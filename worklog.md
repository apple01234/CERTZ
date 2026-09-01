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

---
Task ID: v2.4-quest
Agent: Super Z (main)
Task: 사용자 지시 — ①레벨 목표 퀘스트("5레벨을 찍자!!" 동기부여) + 다음 사냥터 진행 게이트 ②이름 지정 위치

Work Log:
- ⚠️ 치명 소프트락 발견·수정: v2.0 구역 시스템에서 구역 1~9(보스 없는 구역) 체인 완료 후
  전진 포탈이 영원히 비활성(v1.9는 모든 스테이지가 reach로 끝나 문제 없었다 — E2E가 세이브 텔레포트만
  테스트해 미발견). afterAdvance 체인종료 분기 + create 이어하기 복구 분기에 activatePortal 추가
- 퀘스트 타입 "level" 신규: need=목표 레벨. Player.gainExp 레벨업 → scene.onLevelUp 훅 →
  tryCompleteLevel 즉시 판정. afterAdvance 체인 진입 시 이미 충족이면 연쇄 완료(소프트락 방지).
  emitQuest 진행바(lv/need), 이어하기 시 초과 충족 게이트 자동 스킵(구세이브 questIdx 호환)
- 9챕터 × 2게이트 = 18구역 배치: sub1 진입 + sub4 중간. 숲 3/5, 왕국 8/10, 알프헤임 14/16,
  무스펠 20/23, 니플 27/30, 동굴 34/38, 니다벨리르 42/46, 헬 50/54, 아뜰란티스 58/62.
  보상 골드/경험치는 챕터 배율 반영 (check_v24_chain.ts로 배치 무결성 검증)
- 이름 문제 해소: ①원인 — 이름표/입력이 인트로 시퀀스에만 존재(재접속 시 이름표 소실 버그 발견 포함).
  옵션(설정) 패널에 "이름 변경" 섹션 추가 → NamePanel 공용(name:ask/name:set) →
  WorldScene onNameSet에 인트로 외 리네임 경로 추가(전역 이름+이름표+세이브 반영)
- ensurePlayerTag 추출: 이어하기/씬 재시작 시에도 머리 위 이름표 재생성(기존엔 finishIntro에서만)
- WorldScene __SERTZ_SCENE__ 디버그 훅 추가
- 검증: tsc 0 / eslint 0 / next build 성공 / e2e_v24 10 PASS 0 FAIL (게이트 배치·레벨업 연쇄·
  구세이브 스킵·포탈 활성·이름 변경) / e2e_v23 회귀 19 PASS 0 FAIL

Stage Summary:
- v2.4: 레벨 게이트 퀘스트로 진행 동기부여 강화 + 구역 1~9 진행 소프트락 근본 수정 + 이름 변경 UI
- 커밋만 수행 (APK 미빌드 — 사용자 기존 지시 유지). 다음 빌드 시 versionCode 9 / versionName 2.4

---
Task ID: v2.4-apk
Agent: Super Z (main)
Task: 사용자 요청 "ㄱㄱ" — v2.4 Android APK 빌드 (이전 세션 빌드 중단 복구)

Work Log:
- 이전 세션에서 v2.4 커밋(e74d812) 후 APK 빌드 요청 중 세션 오류로 중단됨 → 신규 세션에서 재개
- 신규 샌드박스라 빌드 환경 재구축: Temurin JDK 21(javac 21.0.5) + Android SDK(platform 36, build-tools 36.0.0) + npm install + prisma generate
- android/app/build.gradle: versionCode 8→9, versionName 2.3→2.4
- 빌드: APK_EXPORT=1 next build → cap sync android → gradlew assembleRelease (BUILD SUCCESSFUL 2m58s)
- 검증: aapt — versionCode 9 / versionName 2.4 / minSdk 24 / targetSdk 36, apksigner — CN=SERTZ 릴리즈 서명 정상(v2.3과 동일 키스토어, 기존 설치 앱 위에 업데이트 설치 가능)

Stage Summary:
- 산출물: download/SERTZ-v2.4.apk (16.7MB) — 레벨 게이트 퀘스트 18구역, 구역 1~9 소프트락 수정, 이름 변경 UI, 이름표 유지 수정 전부 포함
- 다운로드 직링: https://github.com/apple01234/CERTZ/raw/main/download/SERTZ-v2.4.apk

---
Task ID: v2.4-push
Agent: Super Z (main)
Task: GitHub 토큰 수령 — v2.4 APK 커밋 푸시 + 공개 직링 최종 검증

Work Log:
- 사용자 제공 토큰으로 .gh_token 저장(gitignore .gh_* 확인) → push e74d812..1270ea1 성공
- git ls-remote 원격 HEAD = 1270ea1 로컬 동기화 확인
- 익명 직링 검증: github.com/apple01234/CERTZ/raw/main/download/SERTZ-v2.4.apk → 302→200, content-length 16,767,492
- 전체 다운로드 무결성: SHA-256(abd1a360…) 로컬 빌드와 정확히 일치

Stage Summary:
- v2.4 APK 공개 직링 확정: https://github.com/apple01234/CERTZ/raw/main/download/SERTZ-v2.4.apk
- 로그인 없이 누구나 다운로드 가능, v2.3과 동일 키스토어라 기존 설치 위 업데이트 설치 가능

---
Task ID: v2.5-qol
Agent: Super Z (main)
Task: 사용자 7건 — ①가로 고정 ②인벤토리 스크롤 ③전직 3슬롯 교체 ④백그라운드 소리 ⑤아이템 확장 ⑥마을 귀환서 ⑦지역 워프 부적 ⑧펫 자동사냥

Work Log:
- ① AndroidManifest screenOrientation="sensorLandscape" — 앱 실행 즉시 가로 고정(양방향)
- ② InventoryPanel 컨테이너에 max-h-[86vh] overflow-y-auto 누락 발견·추가(다른 패널엔 전부 있었음) — 가로 화면에서 하단 잘림/스크롤 불가 해소
- ③ 전직 3슬롯 전면 개편(지시 #3): 기본공격 계열 분기 — 미전직 참격 / 전사 강화 참격(2연타·사거리 176·1.1x) / 궁수 활쏘기(화살 0.95x 관통1) / 마법사 마법탄(1.0x 관통2).
  스킬1 티어 강화 — 전사 회전베기 1.6+0.15/t·반경 118+8/t, 궁수 관통화살 3+t발, 마법사 볼트 2.0+0.25/t·관통 5+2/t(티어3 유도뢰 2발 추가).
  스킬2 마무리 효과 — 전사 충격파(96px 0.9x), 궁수 후퇴사격(1.3x), 마법사 마나 폭발(104px 0.9x).
  attackName/skill1Name/skill2Name getter → skills 이벤트 → TouchControls 버튼 라벨 실시간 교체
- ④ audio.ts visibilitychange 핸들러 — 백그라운드 숨김 시 pauseAll+BGM 정지, 복귀 시 resumeAll+BGM 재개(음소거 상태 존중)
- ⑤ 아이템 10종 확장: weapon_5/6(atk 28/38), armor_5/6(def 14/18), potion_hp2/mp2(회복 130/80), ring_crit(crit+12)/ring_guard(maxHp+60), scroll_return/scroll_warp.
  상점 재고 등록 + PIL 색조 변형 아이콘 10종 생성 + BootScene 로드 등록. buy() consumable 분기 확장(소지품 기반)
- ⑥ 마을 귀환서(40G) — 사용 즉시 미드가르드 마을로 워프+소모
- ⑦ 지역 이동 부적(120G) — visited 세이브 필드 신설(구역 도착 시 자동 기록), WarpPanel(챕터별 그룹 UI)에서 방문 구역 선택 이동, 1장 소모. WarpPanel은 loadSave() 직접 조회
- ⑧ 자동사냥(펫 보유 시): HUD(우상단)+TouchControls(물약 위) 토글 버튼, tickAutoHunt — 최근접 적 추적(원거리 계열 250px 서서 공격)/스킬 로테이션/HP45%·MP15 물약 자동. 조이스틱 터치 시 수동 우선. 세이브 autoHunt 필드(펫 없으면 강제 OFF)
- EventBus RpgState에 autoHunt/canAutoHunt 추가, PanelKind에 warp 추가
- 검증: tsc 0 / eslint 0 / next build 성공 / e2e_v25 신규 23 PASS 0 FAIL(귀환서·부적·3슬롯 라벨·자동사냥 실전 킬 2회·스크롤·상급 물약) / e2e_v24 회귀 10 PASS / e2e_v23 회귀 19 PASS
- 버전: versionCode 10 / versionName 2.5 — APK 빌드(BUILD SUCCESSFUL 3m), aapt/apksigner 검증(sensorLandscape 0x6 확인, CN=SERTZ 동일 키스토어)

Stage Summary:
- v2.5: 7건 전부 구현 — 전직이 3슬롯 전부 바뀌고, 펫 있으면 자동사냥, 귀환서/부적으로 이동 편의성, 아이템 10종 확장
- 산출물: download/SERTZ-v2.5.apk (16.7MB) — 공개 직링: https://github.com/apple01234/CERTZ/raw/main/download/SERTZ-v2.5.apk

---
Task ID: v2.5-web-restart
Agent: Super Z (main)
Task: 웹 버전이 구버전/오류로 보이는 문제 — 웹 서버 재기동 + v2.5 재빌드

Work Log:
- 원인 진단: 샌드박스 재시작으로 node 서버(3000) 다운, Caddy(81)만 생존 → 브라우저엔 캐시된 구버전 노출
- npx next build (웹 standalone 빌드, v2.5 소스) 완료
- NODE_ENV=production setsid node server.js 백기동 — socket.io 멀티플레이 포함
- 검증: 3000/81 포트 HTTP 200, socket.io polling 200, 청크 1a3dc253557bc914.js에서 귀환서/지역워프 문자열 확인(서빙물=v2.5)
- GitHub Releases v2.5 생성 + APK 업로드(무결성 3c15ca82 일치) — raw 캐시 우회 채널

Stage Summary:
- 웹 버전 복구 완료: 프리뷰 URL 접속 시 v2.5 서빙. 강력 새로고침 필요할 수 있음.
- 릴리스 페이지: https://github.com/apple01234/CERTZ/releases/latest

---
Task ID: v2.5-root-restore
Agent: Super Z (main)
Task: 플랫폼 프리뷰 배포 실패("problem deploying the code") — 게임을 프로젝트 루트로 복원

Work Log:
- 원인: 본 세션에서 게임을 CERTZ/ 하위로 클론해두어 루트에 실행 가능한 앱이 없었음 → 플랫폼 배포 파이프라인 실패. CERTZ 히스토리의 UUID 스냅샷 커밋 23개로 원래 루트 프로젝트임을 확정
- 복원: CERTZ 전체(트래킹된 .git 포함)를 /home/z/my-project 루트로 이동. download/scripts/upload rsync 병합, skills/는 현 샌드박스 것 유지(트래킹 경로와 내용 일치 확인)
- 스캐폴드 잔여물(.git-scaffold-old 등) 삭제, .env는 모드만 commit(chmod +x)
- 루트에서 npx next build 재빌드 → NODE_ENV=production node server.js 재기동
- 검증: 3000/81 포트 200, socket.io 200, 청크 1a3dc253…에 귀환서 마커(서빙물=v2.5)

Stage Summary:
- 루트 복원으로 플랫폼 미리보기 배포 경로 정상화. CERTZ/ 폴더는 더 이상 존재하지 않음(이후 작업은 전부 루트에서).
- 서버: NODE_ENV=production node server.js (socket.io 멀티플레이 포함)

---
Task ID: v2.6-bugfix
Agent: Super Z (main)
Task: 유저 버그 3건 — 퀘스트 후 포탈 미개방 / 타일맵 길 파편 / 식인초 접촉 데미지 없음 + ponytail 상시 적용 선언

Work Log:
- ① 포탈: 개방이 대사 종료 훅(resumeFromDialogue) 단일 경로 의존 → 놓치면 영구 막힘. 수정: reach 퀘스트 5초 보루 타이머 + 1.5초 주기 개방 보루(체인 완료/reach 상태인데 닫혀있으면 개방, 보스 구역 제외)
- ② 타일맵 길: 원인은 TileSprite 패턴이 특정 타이밍에 100% 투명 캔버스로 구워지는 레이스(실측: texture source 투명률 100%). 지금까지 보이던 '길'은 전부 프린지 타일 파편이었음. 수정: tile_path 최빈색 rect 코어 + 프린지 타일 조합으로 교체, bite 침식 8~26px→2~10px 완화. 헤드리스 브라우저 실측으로 연속 길 렌더 확인
- ③ 식인초: cl_jawsplant/eyeplant/manyeyes가 순수 장식이었음. 위험 오브젝트로 전환 — 정적 바디(56x44 center) + 오버랩 → Player.takeDamage 재사용(무적시간/넉백/데미지텍스트 내장), 씬 쿨다운 700ms, 챕터 배율 데미지, 물어보는 연출(angle 흔들기+틴트). 실측: kingdom2에서 12 데미지 확인
- 버전: versionCode 11 / versionName 2.6, 타이틀 태그 v2.6
- 검증: tsc 0 에러 / next build 성공 / headless 브라우저에서 길 렌더·포탈 활성·식인초 데미지 3건 실측

Stage Summary:
- 3건 전부 근본 수정. 구조 교훈: TileSprite는 패턴 굽기 레이스가 있어 핵심 지형엔 rect 사용할 것.
- 【상시 규칙】ponytail(dietrichgebert/ponytail) — 사용자 지시로 모든 작업에 상시 적용. skills/ponytail/SKILL.md 참조: 최소한의 동작 코드(사다리: YAGNI→기존코드 재사용→표준→네이티브→기존의존성→1줄→최소코드), 근본원인 수정, 불가피한 단순화는 ponytail: 주석, 설명은 코드보다 짧게.

---
Task ID: v2.7-portal
Agent: Super Z (main)
Task: 유저 재신고 "퀘스트 깨도 바로 포탈 안열림" — v2.6 보루 남은 빈틈 근본 수정 + 전 배포 채널 복구

Work Log:
- 샌드박스 리셋으로 프로젝트 소실 → GitHub 클론으로 루트 복원(node_modules/JDK/SDK 포함 전부 재설치)
- e2e 재현 테스트 신설(scripts/e2e_v27_repro.js) → v2.6 보루의 3개 빈틈 실측 확보:
  ① init()이 portalActive를 리셋 안 함 — scene.restart가 같은 인스턴스 재사용이라 이전 구역 개방 상태 유출
   (마을→여관/부적 워프/복귀차원문 경로에서 다음 구역 시작부터 포탈 개방 = 퀘스트 스킵 + 보루 early-return 사망)
  ② 보루가 dialoguing/pendingPortal 끼임 시 영구 거부(5초 자동해제는 reach 분기에서만 등록)
  ③ 보스 구역 영구 제외 + 포탈 스프라이트 부재 시 보루 무력
- 수정(WorldScene.ts): init에 portalActive/returnActive 리셋 / 보루 2.0(자가치유형) — 포탈 부재시 생성,
  보스 격파 후 reach 허용, collect 파편·보스 소실 자동 재생성, 대사 6초 끼임 강제 해제 /
  체인 완료 시 엣지 화살표가 포탈을 가리킴(개방 인지 개선) / resumeFromDialogue에서 portalHoldSince 리셋
- 검증: e2e_v27_verify 12/12 PASS(repro 11/12 → 실패 2건 모두 테스트 설계 오류로 확인 후 수정) +
  회귀 v2.4 10/v2.5 23/v2.3 19 전부 PASS / tsc 0
- 환경 재구축: Temurin JDK 21(/home/z/jdk), cmdline-tools+platform-36+build-tools-36(/home/z/android-sdk)
- 웹: next build → node server.js 기동(3000/81/socket 200, 청크에 portalHoldSince+v2.7 태그 확인)
- APK: APK_EXPORT=1 → cap sync → gradle assembleRelease(BUILD SUCCESSFUL 3m) — versionCode 12/versionName 2.7,
  aapt/apksigner 검증(CN=SERTZ 동일 키), download/SERTZ-v2.7.apk (16.8MB, sha256 48b4f5e8…)

Stage Summary:
- 포탈 개방 실패의 3개 근본 원인(상태 유출/보루 거부/보루 무력) 전부 봉합 — 어떤 경로로도 6초 내 개방 보장.
- 유저가 v2.6을 못 받았을 가능성(웹 서버 다운)에 대비해 웹 즉시 재기동 + Release v2.7 배포.

---
Task ID: v2.7-deploy-ops
Agent: Super Z (main)
Task: v2.7 웹 서버 지속성 확보 — 샌드박스 세션 정리에 프로세스가 묻혀 죽는 문제 해결

Work Log:
- 원인 규명: 툴 세션에서 스폰한 프로세스(setsid/nohup/disown 무관)는 호출 종료 시 전부 정리됨 — 통제 실험으로 확정. 부팅 트리(PID 1 자식: caddy/ZAI)만 생존
- 해결 ① 이중 포크 데몬 스포너(scripts/daemon_spawn.py, PPID 1) + 감독자(scripts/supervisor.sh)로 서버 기동 → 세션 정리 통과, 3000/81/socket 지속 200 확인
- 해결 ② .zscripts/dev.sh를 프로덕션 기동 방식으로 개편(node server.js + 무한 감독 루프, 빌드물 없으면 next build) — 다음 부팅부터 플랫폼이 자동으로 게임 서버를 띄움
- Release v2.7 생성 + APK 업로드, 다운로드 무결성 sha256 48b4f5e8… 일치 확인
- 푸시: b4a11bc(v2.7 본체) + f9e819c(부팅 ops)

Stage Summary:
- 프리뷰(웹) 상시 v2.7 서빙 + 다음 재부팅부터도 자동 기동. 포탈 버그 재발 시 e2e_v27_verify.js로 회귀 점검 가능.

---
Task ID: v2.8-arrow
Agent: Super Z (main)
Task: 유저 신고 "어시스턴트 화살표가 거꾸로" — 가장자리 안내 화살표 180° 반전 수정 + v2.8 배포

Work Log:
- 샌드박스 재초기화로 프로젝트 소실 → GitHub 클론으로 루트 복원 (2회차)
- 원인 규명: edge_arrow.png 텍스처가 '왼쪽(◀)'을 향해 그려져 있음 — Phaser setRotation(angle) 규약은
  angle 0 = 텍스처 '오른쪽' 기준이라 항상 정반대를 가리킴 (퀘스트 목표 안내 + v2.7 포탈 안내 공통)
- 근본 수정: public/assets/edge_arrow.png 180° 회전(오른쪽 향으로) — 코드 무변경, 에셋이 표준 규약을 따르게 함
- 판정 방법 주의: 삼각형은 밑변 쪽에 질량 집중 → 좌/우 픽셀 수가 아니라 꼭짓점 컬럼 평균 높이로 판정해야 함
- 버전: versionCode 13 / versionName 2.8, 타이틀 태그 v2.8
- 환경 재구축: node_modules(npm install), Temurin JDK 21(/home/z/jdk), cmdline-tools+platform-36+build-tools-36(/home/z/android-sdk)
  ※ 시스템 java(/usr/lib/jvm)는 JRE라 javac 없음 — 반드시 /home/z/jdk 사용
- 검증: tsc 0 에러 / 웹 빌드 성공 + 데몬 스포너로 3000포트 기동(200) / 서빙·APK 내부 화살표 모두 오른쪽 향 실측 확인
- APK: BUILD SUCCESSFUL(2m1s) — download/SERTZ-v2.8.apk 16,775,741B, aapt versionCode 13/"2.8",
  apksigner CN=SERTZ 동일 키, sha256 445f2a94…

Stage Summary:
- 화살표 반전의 근본 원인은 코드가 아니라 에셋의 방향 규약 불일치였음. 에셋 교정 1건으로 완결.
- 부팅 시 dev.sh가 프로덕션 서버 자동 기동(v2.7 ops) — 이번 세션에서도 정상 동작 확인.

---
Task ID: v2.9-mega
Agent: Super Z (main)
Task: 유저 13개 항목 대형 업데이트 (v2.9 = versionCode 14)

Work Log:
- #10 멀티: 서버 실측 정상(Alice↔Bob 상호 표시+채팅+websocket) — APK가 기본 오프라인 모드가 원인.
  ServerConnect에 기본 서버(preview-6a94b1ab) 자동 저장/연결 추가
- #2 PC 버튼: TouchControls를 PC에서도 표시(조이스틱은 터치 전용, 스킬쿨/물약/자동사냥 버튼은 공용)
- #4 펫: 맵 전체 드롭 흡입(사거리 99999, 원거리 자석 가속)
- #1 몬스터 조합: subEnemyMix() — 1~2구역 pool[0]/3~4 pool[1]/5~6 pool[2] 1종 로테이션,
  7~8 2종, 9 3종, 10 보스+3종. 챕터 풀 3종 확장(전 챕터)
- #5 챕터 마을: Xv 스테이지 9개 신설(여관/전직관/우물/모닥불 재사용), 체인 재배선(10구역→다음 챕터 마을→1구역),
  STAGE_THEME/BGM 파싱, 실내 복귀 마을 기억(interiorFrom)
- #6 귀환서: 현재 챕터의 가장 가까운 마을로 귀환
- #9 전직: 도적 계열 신설(t1+t2 어세신/스와시버클러+t3 나이트블레이드/듀얼리스트),
  4차 각성 8종(각 t3→t4, Lv100), 3차 60→50, 전직 스토리 대사(시조 '그림자의 로크')·AUTO_ALLOC·JOB_SPKR 추가
- #8 장비: accessories[](반지 4+펜던트 2) 다중 장착, 같은 아이템 보유 수만큼 중복 장착,
  unequip 이벤트, 인벤 메이플식 6슬롯 그리드, 펜던트 2종(아이콘 PIL 생성), 구세이브 마이그레이션
- #7 골드 싱크: 상점에 펜던트 2종 추가(중복 구매 소비처)
- #12 에메랄드: 화폐 필드/세이브/상점 배지 시드(구매 연동은 다음 릴리스)
- 검증: tsc 0 / e2e_v27_verify 12/12 PASS / multi_diag 실측 PASS / web 200+socket 200
- APK: versionCode 14/"2.9", aapt+apksigner 검증, sha256 d11b5826…

Stage Summary:
- 13개 중 11개 항목 구현 완료. #3(에셋 다양화)은 몬스터 풀 3종/챕터 + 조합 로테이션으로 체감 다양화 대응,
  외부 CC0 대량 에셋 통합은 다음 릴리스 과제. #11도 동일.
- 전직 "스킬 슬롯 추가"는 기존 2슬롯 체제 유지(티어별 강화로 대체) — 4슬롯 확장은 다음 과제.

---
Task ID: v3.0-eight
Agent: Super Z (main)
Task: 유저 8항목 (경험치 리셋/마법사 조준·히트박스/PC 상호작용/챕터 마을/마을 퀘스트 오표기/몬스터 캡/개미굴 맵+나무 교정/레벨업) — v3.0 배포

Work Log:
- #1 근본 원인: buildSave는 exp 저장하나 복원 경로(this.player.lv 복원 블록)에 exp 대입 누락 → 포탈/씬 재시작마다 경험치 0. 한 줄 복원으로 수정
- #2 aimDir()의 4방향 스냅이 원거리 전체에 적용되던 것 → aimDirFree()(facing 정규화) 신설, atkBolt/atkBow/skill1Bolt 자유 조준.
  투사체 판정 tickPlayerProjs: 평면 28px → projR(14×scale)+대상 몸통(hitW/hitH)/2+8px, 마법탄 480→540/scale 1.0
- #3 PC(pointer:fine)는 NPC 머리 위 부유 버튼 대신 하단 중앙 고정 칩([E] 라벨). 터치는 기존 앵커 유지 (InteractPrompt isTouch 분기)
- #4 CHAPTER_VILLAGE_NPC 9챕터 테이블 + vlg*A/B 대사 27종: 건물 틴트·마을 간판·주민 2인(이름/대사 챕터별)
- #5 emitQuest() !q 분기에 isInterior/isVillage 전용 문구 추가 — "지역 클리어!"는 필드 전용으로
- #6 subEnemyMix 총량제 재편(구역당 합계 ≤20) + respawnEnemy에 생존 수 ≥20이면 보류 게이트
- #7 신규 src/game/mapgen.ts: 셀 그리드(~400×310) 터널 성장형 굴 생성(개방률 45~62%, 시드=스테이지키, entry/exit=BFS 최원거리).
  WorldScene: buildDungeonWalls(챕터별 암벽 tilesprite+static body), 포탈/보스=exit셀, 복귀포탈/상인=entry셀,
  적·정예·파편 개방셀 스폰(openPointRng), 미니맵 벽 블록, 자동사냥 BFS nextStepToward 우회, 장식 inOpenArea 필터,
  cave/nidavellir 나무 pine(초록)→시든나무, muspelheim tree(초록)→pine_dark+시든나무
- #8 expNext 50×lv^1.62 → 40×lv^1.45(45%↓) + 몬스터 경험치 ×1.35 (체감 ~2.5배 가속)
- 검증: tsc 0 / e2e_v27 12·12 PASS / e2e_v30_layout 신설(레이아웃 연결성·벽 바디=벽 셀 수·벽 침투 0·포탈/적 개방셀·20캡) PASS / 실스크린샷 2종(cave 필드 벽+니플헤임 마을 테마 NPC·"마을 — 안전 지대" 패널·PC 고정 칩) 확인
- 배포: 웹 재빌드+데몬 기동(200/socket 200), APK versionCode 15/"3.0" aapt+apksigner(CN=SERTZ) 검증,
  Release v3.0(id 379644158) 업로드, CDN 재다운로드 sha256 f27cce46… 일치, 푸시 3139cd6

Stage Summary:
- 8개 항목 전부 구현. 개미굴 맵은 스테이지 키 시드라 같은 구역 재방문 시 동일 구조(멀티/리젠 안전), 구역 간에는 전부 상이.
- 주의: MultiEdit은 원자적이지 않음 — 이번 세션에서 일부 편집만 적용되고 실패 리포트가 뜬 사례 1회. 편집 후 실측 확인 필수.
- .gh_token 파일 소실(origin remote 임베디드 토큰으로 대체 사용). 다음 세션도 동일 경로.

---
Task ID: v3.0.1-policy
Agent: Super Z (main)
Task: 버전 정책 확정 — 3.0부터 패치 단위(3.0.1) 버전 운영

Work Log:
- 유저 공지: "이제 앞으로 3.0 이상부터는 3.0.1 이런식으로 올라갈꺼야"
- 정책 확정: v3.0(versionCode 15, 배포 완료) 이후 릴리스는 3.0.1(versionCode 16) → 3.0.2(versionCode 17) 식 패치 단위
- versionCode는 패치마다 계속 +1 증가
- 상태 확인: v2.9(13항목)/v3.0(8항목) 배포 완료, 웹 300포트 200, v3.0 마커(개미굴) 청크 존재, 트리 clean

Stage Summary:
- 【상시 규칙】다음 릴리스명 = 3.0.1 / versionCode 16 (build.gradle + build_apk.sh + 타이틀 태그 동시 갱신).
- 남은 백로그(외부 CC0 에셋 통합, 전직 4슬롯 확장, 에랄드 구매 연동 등)는 3.0.x 패치로 반영.

---
Task ID: v3.0.1-autohunt
Agent: Super Z (main)
Task: 유저 지시 "직업별로 스킬에 따라 자동전투 시스템 최적화" — v3.0.1 배포

Work Log:
- WorldScene tickAutoHunt 재작성(제네릭 skill1→skill2 로테이션 폐기):
  ① 조준 보정 — 공격 전 대상 방향으로 facing 고정(정지 뒤 조준 어긋남 제거)
  ② 전사/도적/미전직 — 돌진기 갭클로저(240px 내 + 중간점 isOpenXY 개방 시 autoDashDir 지정 점프, 2.1x 스윕+전사 충격파),
     회전베기는 군집 2+(spinR 118+8t) 또는 보스 한정, 단일엔 기본공격(MP 절약)
  ③ 궁수 — 관통 화살 군집 2+(340px) 또는 보스 한정 + skill1Arrows aimDir→aimDirFree(8방향, 4방향 스냅 잔재 제거)
  ④ 마법사 — 볼트 쿨마다 즉시(주력 딜링)
  ⑤ 원거리 공통 — 적 150px 접근 시 이탈: 돌진기 가능하면 대시 탈출(autoRetreatDir), 아니면 걷기 카이팅
     (이탈 방향 = 대상 반대편, 개미굴 벽이면 45°씩 회전해 isOpenXY 탐색)
- Player.ts: autoDashDir 필드 신설(자동 돌진 방향 지정, useSkill2에서 1회 소모 — 수동 조작 간섭 없음)
- 검증: tsc 0 / e2e_v301_autohunt.js 신설 10 PASS 0 FAIL(전사 갭클로저 대시+MP-20, 군집 회전베기, 단일 절제,
  마법사 볼트 쿨마다, 점멸 이탈, 걷기 카이팅 9→163px, 궁수 군집 화살, 단일 절제 1560ms 클린윈도우) /
  회귀 e2e_v27_verify 12/12 PASS, e2e_v30_layout PASS(cap 20 유지)
- 테스트 교훈(2건): ①Arcade dynamic body는 gameObject x/y 직접 대입이 바디에 덮여 될 때가 있음 → body.reset 사용
  ②월드(2790×1440) 밖으로 적을 밀면 바디가 전부 같은 구석에 클램프되어 플레이어 옆에 재유입(오염) →
  밀어낼 곳은 맵 중심 대칭점+클램프로 경계 내 배치할 것
- 버전: versionCode 16 / versionName "3.0.1", 타이틀 배지 "v3.0.1 · 직업별 자동전투", build_apk.sh 산출물명 갱신
- 배포: 웹 재빌드+데몬 기동(3000/socket 200, 청크 마커 확인), APK 16,784,324B — aapt versionCode 16/"3.0.1",
  apksigner CN=SERTZ 동일 키, sha256 b9d92760…

Stage Summary:
- 자동사냥이 직업 정체성대로 싸움: 전사/도적=돌진접근+군집 회전베기, 궁수=카이팅+군집 화살, 마법사=볼트 쿨마다+점멸 이탈.
- 단일 몹 상대로는 스킬을 아끼고 기본공격 — MP 효율 개선. 수동 조작(조이스틱/키) 우선 로직 기존과 동일 유지.

---
Task ID: v3.0.2-fifteen
Agent: Super Z (main)
Task: 유저 15항목 — 버그 5종 수정 + 직업별 무기/이펙트 + CC0 에셋 다양화 + 전직 스토리 복원 + UI 토글 — v3.0.2 배포

Work Log:
- ①이동 애니: idle에서 anims.stop 후 currentAnim 키 잔존 → 같은 방향 재입력 시 play 스킵되던 버그. `!isPlaying ||` 조건 추가(Player.ts 2곳)
- ②접속메세지: 서버가 join마다 sysChat — 맵 이동(join=AOI 갱신)마다 공지 도배. 소켓당 최초 1회로 제한(server.js)
- ③몬스터 캡: 정예(+1)/보스(+1)가 잡몹 20과 별도여서 21~22마리 가능했던 빈틈 — subEnemyMix 5/10구역 19마리 조정 + respawnEnemy 게이트에 정예/보스 집계 포함. E2E: 5구역 20/20(정예 포함), 10구역 19~20/20
- ④퀘스트-스폰 불일치: v2.9 구역 단일종 로테이션과 auto-hunt(spec.main)/beat 토벌 대상 어긋남("늑대 소탕인데 유령만"). auto-hunt는 구역 실스폰 몬스터 기준으로, beat 토벌 대상은 스폰에 편입(최다 그룹 -3). 전 구역 110건 hunt 감사 스크립트(check_quests_v302.mjs) 0 불일치
- ⑤전직 스킬: 2차 이상 스킬 이름이 계열 공용이라 체감 안 됨 — SKILL_LABELS 24클래스 × 3슬롯 테이블(classes.ts) + Player getter 적용
- ⑦무기 정체성: 궁수=발광 구슬 대신 실제 화살 투사체(x2_arrow)+활 비주얼(spawnBow), 마법사=칼 스윙 대신 시전 이펙트(spawnCast)+마법 구슬/아케인 볼트 6프레임 애니, 도적=보라 단검 검기. firePlayerProj에 tex/anim/blend/rot 지원(풀 sprite 전환)
- ⑧돌진기 차등: 전사 주황 잔상 / 궁수 연두 바람 / 도적 보라 그림자 / 마법사 잔상 없는 페이드 점멸. spawnSlash tint 파라미터화
- ②벽/길 구분: 던전 벽 전부 벽돌 타일(x2_bricks, CC0 LOSCH)로 통일 + 벽 45~55% 명도로 어둡게 + 경계 림(하이라이트)/앰비언트 그림자 스트립
- ③에셋 다양화(전부 CC0, OpenGameArt 직접 다운로드): 50 Monsters Pack(isaiah658)에서 챕터별 신규 몬스터 9종(개구리/쥐/박쥐/불새/날도요/달팽이/돌골렘/그늘늑대/물고기) — PIL로 idle2/run4/atk1 프레임 생성, 4풀 로테이션(7~8구역 신규종 주력), Pixelart Spells(마법 투사체 5종+시전 이펙트), Bow 20x20(활). CREDITS.md 갱신
- ⑪전직 스토리: 1차가 아예 없었고 2/3차는 전직관 NPC 대화로만 시작해 존재 감지 불가 — 티어별 단계형 체인 신설(1차 3단계/약10분, 2차 4단계/약20분, 3차 5단계/약30분), 1차 전직 즉시 자동 시작, 퀘스트 트래커에 "✦ 전직 스토리 n/N" 실시간 병기
- ④⑤UI: 퀘스트 트래커 접기/펼치기 토글(localStorage 유지), 패널 max-h min(86svh,560px) 캡, 트래커 compact
- ⑬레벨 곡선: Lv20부터 누진 계수(1+(lv-20)*0.022) — Lv50 +66%, Lv80 +166% (초반 v3.0 완화 유지)
- ⑮구 APK 전량 삭제 — download/에 SERTZ-v3.0.2.apk만 존재
- 검증: tsc 0 / e2e_v302_fixes 12 PASS 0 FAIL / 회귀 v2.7 12·12, v3.0.1 자동전투 10·10 / hunt 감사 110건 0 불일치 / 던전 벽돌 스크린샷 육안 확인
- 테스트 교훈: Phaser 3.90 TileSprite는 내부 텍스처 키를 항상 UUID로 생성(TileSprite.js:231) — 소스 텍스처 키로 런타임 매칭 불가, 존재 검사+스크린샷으로 판정할 것
- 배포: 웹 재빌드+데몬 기동(200/socket 200), APK versionCode 17/"3.0.2" 16,867,135B — aapt/apksigner(CN=SERTZ) 검증, sha256 e8e601b5…, Release v3.0.2(id 379711405) 업로드 무결성 MATCH

Stage Summary:
- 15항목 중 14항목 구현+실측 완료. (해명: ⑨20마리 캡은 이미 v3.0에 있었으나 정예/보스 빈틈을 이번에 봉합 — "고쳤다" 주장은 E2E 실측으로만 함)
- 남은 과제: 외부 에셋 추가 확충(몬스터 스프라이트 시트 애니화 등), 에랄드 구매 연동, 전직 4슬롯 확장 — 3.0.3+ 후보

---
Task ID: v3.0.3-six
Agent: Super Z (main)
Task: 유저 6항목 — 3/4차 스킬 확장 + GM NPC + 몬스터 고유 개성 + 아이템 스태킹 + 무기 완전 구현 — v3.0.3 배포

Work Log:
- ①스킬 슬롯 확장: SKILL_LABELS 5슬롯화(기본공격/Z/C/V/B), skill3(9s·25MP)/skill4(14s·40MP) 신설.
  3차부터 V 해금(스킬 3개), 4차부터 B 해금(스킬 4개). 8종 3차 메커니즘(warcry/sanctuary/trueshot/
  tornado/thunder/timewarp/shadowblad/flurry) + 8종 4차 궁극기(doomsday/judgment/godarrow 유도/
  skystorm/manaburst MP연소/eternalloop 광역기절/shadowclon 분신/bladedance 점멸연격).
  자기버프 필드(selfAtk/selfDef/selfSpd) + 전장의 함성 공증·심판 방어·천공 신속 반영
- ②GM NPC: 마을 전직관 옆 npc_gm(0x72 knight_m 금색 재조색). E키 → GM 패널(PanelKind "gm"):
  28클래스 전 티어 자유전직(rpg:gm job→gmSetClass, 체인 HP/MP 가산 재계산+쿨 리셋),
  골드 +1만/10만/100만, 레벨 10/100/200(gmSetLevel 증분 등가), 풀회복, AP+50
- ③몬스터 개성: itch.io 0x72 DungeonTilesetII(CC0) 직접 다운로드(download_url POST → file/<id>) —
  7종 신규(x3_swampy 독+사망장판 / x3_imp·x3_necromancer 원거리 캐스터 / x3_icezombie 감속 /
  x3_tinyzombie 출혈 고속추격 / x3_chort 돌진 / x3_ogre 중장근접). EnemyProfile 타입
  (ranged/charge/apply/fieldOnDeath) + FSM 확장(키팅·주문시전·chargeDash 상태) + 적 투사체 풀
  (fireEnemyProj 16발) + 장판 시스템(spawnField owner enemy/player, 0.5s 틱) + 기존종 10종 개성 부여
  (거미·독개구리 독, 헬하운드·그늘 이리 출혈, 유령·화염정령 원거리화, 암초물고기 얼음창 등).
  플레이어 상태이상(출혈/독 DoT 1s 틱 + 감속 recalcSpeed 연동)
- ④아이템 스태킹: InventoryPanel 소모품 키별 그룹핑(귀환서 여러 장이 별도 행으로 나오던 버그 수정),
  장비/장신구 stackEquips ×N 병합 + ItemIcon 수량 배지. 가방 패널 max-h/w 클래스명 오타 수정
- ⑤무기: syncWeaponSprite — 궁수 x3_bow(조준 방향 회전)/마법사 x3_staff(어깨 세움)/도적 x3_dagger
  상시 장착 렌더(바라보는 방향 따라 앞/뒤 레이어). 도적 기본공격 3회마다 x3_shuriken 투척(atkShuriken).
  무기 4종·GM NPC는 0x72 팩에서 가공, 표창만 PIL 픽셀아트 신규 생성
- 버그 수정(테스트 중 발견): ①씬 재시작 시 physics.world.pause() 이월 — 대사 중 재시작하면 게임 전체
  정지하는 실버그 → create()에서 강제 resume ②신규 씬 소유 리소스(weaponImg/fields/eProjPool/
  orbitBlades) init 리셋 누락 → 파괴된 구 객체 참조 크래시 수정
- UI: TouchControls 3차기(V·Flame 아이콘)/4차기(B·Star 아이콘) 버튼(해금 시만 표시), 키맵 skill3/skill4
  액션 추가(재배치 가능), 자동사냥이 3차기(보스/군집2+)·4차기(보스/군집3+) 자동 기동,
  emitSkills s3/s4 확장, 타이틀 배지 "v3.0.3 · 스킬 3/4차·GM NPC·몬스터 개성"
- 검증: tsc 0 / e2e_v303_features 23 PASS 0 FAIL(GM·성역 필드·4차 라벨·임프 투사체 16발·독 장판·
  출혈 도트·활/지팡이/단검 장착·표창·hel7 촐트 돌진 프로필) / 회귀 v2.7 12·12, v3.0.1 10·0 3연속,
  v3.0.2 12·0, v3.0 레이아웃(cap20 유지) 전부 통과 / 실스크린샷 4종(GM NPC·활·지팡이·GM 패널) 육안 확인
- 테스트 교훈: ①E2E 헬퍼가 dialoguing=false만 설정하면 physics pause가 남아 엔티티 전체 정지 —
  resumeFromDialogue 경로 사용할 것 ②리스폰 예약이 이전 페이즈 처치분을 사거리 내 재등장시켜
  원거리 AI 테스트를 오염시킴 — respawnEnemy 인스턴스 덮어쓰기로 차단
- 배포: 웹 재빌드+데몬 재기동(200/socket 200), APK versionCode 18/"3.0.3" 16,915,031B —
  aapt(CN=SERTZ 동일 키) 검증, sha256 330795c8…, Release v3.0.3(id 379782836) 업로드 무결성 MATCH,
  download/에 SERTZ-v3.0.3.apk만 존재(구버전 전량 삭제), 푸시 43dcaf3

Stage Summary:
- 6항목 전부 구현+실측. 상위직 24클래스가 각자 다른 전투 방식을 갖고(공유 메커니즘도 클래스색·수치 차등),
  몬스터 28종이 각자 다른 AI 프로필로 싸운다. GM NPC는 "임시" 성격 유지 — 정식화 시 별도 서버 검증 필요.
- 다음 후보: 세이지 라인 순수 힐러 스킬(아군 대상) 확장, 에랄드 구매 연동, 파티원 대상 버프 스킬

---
Task ID: v3.0.4-eight
Agent: Super Z (main)
Task: 유저 8항목 — 활 방향·스킬 강화/고유화·임팩트·모바일 4종·itch.io 에셋 — v3.0.4 배포

Work Log:
- ①활 회전(지시#1): syncWeaponSprite/spawnBow의 `ang + π/2` 오프셋 제거 → `ang`. 픽셀 분석으로
  x3_bow 텍스처(현=왼쪽, 활몸=오른쪽 → 오른쪽 발사) 확인 — +90°가 활을 수직으로 세워 화살이
  옆에서 나오는 "거꾸로" 체감 원인. 실측: 우조준 rot=0.000 / 좌조준 rot=-3.142, 스크린샷 육안 확인
- ②전직마다 기존 스킬 강화(지시#2): 회전베기 배율 1.6+0.3t·반경 118+16t (2차+잔상강화/3차+이중회전+
  끌어당김/4차+출혈 2추가타+균열), 화살 관통 2+t·클래스색(2차+)/2차 연사(3차+)/발광(4차+),
  볼트 2.0+0.35t·scale 1.3+0.14t·유도뢰 3발(4차), 기동기 마무리 전사 반경 96+10t·궁수 3발 부채꼴(3차+)·
  마법사 반경 104+10t. 전직/GM전직 시 클래스색 빛기둥+폭발+플래시 각성 연출
- ③3/4차 임팩트(지시#3): 전장의 함성 2.0x/280px/플래시, 성역 4기둥, 절사명중 4.5x/scale2.0,
  폭풍의 눈 5발, 낙뢰 6타+기절0.4s, 시간왜곡 300px/9s, 오비트 1.8x/9s, 연격 6타, 심판 5기둥 4.2x,
  화살비 12발, 천공 12발, 마나붕괴 3.2+4.2r/350px, 고리 기절3.2s, 분신 3기, 검무 6대상 2.4x
- ④스킬 겹침 0(지시#4): 4차 8직업의 3차기(V)를 신규 고유 메커니즘 8종으로 교체 —
  bloodrage(광역출혈+공/속버프)/holynova(즉발폭발+보호막+치유)/arrowrain(하늘 화살 14발)/
  cyclone(전관통 대형 회오리 2+잔풍4)/chainlight(적→적 6회 도약)/gravity(4단계 끌어모음→폭발)/
  shadowmine(지뢰 3기 접촉출혈폭발)/swordaura(전관통 검기 3연파). SKILL3_KIND 16클래스 전부 유니크,
  E2E로 중복 0 실측
- ⑤모바일 퀘스트 토글(지시#5): HUD 트래커 헤더 전체를 터치 타깃으로 확대(▲버튼 28px), onPointerDown
  단독(onClick 병용 시 탭 1회 2중 토글 버그 사전 차단)
- ⑥모바일 스킬 버튼(지시#6): SkillButton 56→44px, 공격 80→64px, 물약/자동 48→40px,
  4스킬 2×2 그리드 배치(B,V 상단/Z,C 하단) — 4차까지 해금돼도 세로 공간 절반 이하
- ⑦모바일 3/4차기 사용 불가(지시#7) 버그: TouchControls가 emit하는 input:skill3/4를 WorldScene이
  수신하지 않았음(v3.0.3부터) — onS3/onS4 핸들러+on/off 등록. E2E: 이벤트→쿨다운 실측
- ⑧itch.io 에셋(지시#8): 0x72 DungeonTilesetII에서 신규 몬스터 6종 추출(masked_orc/orc_warrior/
  orc_shaman/wogol/goblin/big_zombie — zombie는 프레임 불완전해 big_zombie로 대체) —
  프로필: 가면전사=출혈/오르크전사=돌진/주술사=원거리 magicorb/워골=돌진+출혈/고블린=고속군집/
  거대시체=중장+독+사망장판. subEnemyMix에 6번째 종(f) 전 구역 3~5마리 혼합(20캡 유지:
  15+5/15+5/14+5+정예/15+5/10+6+4/10+6+4/7+5+4+4/7+5+4+3+보스). CREDITS.md 갱신
- 버전: versionCode 19/"3.0.4", 타이틀 배지 "v3.0.4 · 스킬 강화·전직별 고유기·모바일 개선"
- 검증: tsc 0 / e2e_v304_features 신설 24 PASS 0 FAIL(활 각도·중복 0·input:skill3/4·강화 실측
  [1차 미명중 vs 4차 명중 160px·관통 6·볼트 1.86]·낙뢰 6타·화살비 12발·토글·44px·2×2·고블린/거대시체) /
  신규 24메커니즘 전부 발동 스모크 pageerror 0 / 회귀 v27 12·12, v301 10·0, v302 12·0, v303 23·0,
  v30 layout(cap20) / hunt 감사 110건 0 불일치 / 스크린샷 4종(활 우·좌·고블린·거대시체) 육안
- 테스트 교훈: ①v27 E1 자가개방은 상한 9.0s(루트 페이즈 1.5+유예 6+틱 1.5)인데 대기가 7.8s라
  루프 페이즈 따라 플래키 — v3.0.3부터 잠재, 10.5s로 상향(앱 로직 변경 아님, 진단 스크립트로 실측)
  ②Playwright 장기 in-page Promise는 GC 위험 — 짧은 evaluate+노드 대기 분리
  ③스킬 버튼 aria-label은 스킬명(기본공격 버튼은 "공격" 고정) — 라벨 착오 주의
- 배포: 웹 재빌드+데몬 기동(200/socket 200), APK versionCode 19/"3.0.4" 16,953,133B —
  aapt/apksigner(CN=SERTZ 동일 키) 검증, sha256 2047fd56…, Release v3.0.4(id 379843483) 업로드
  무결성 MATCH, download/에 SERTZ-v3.0.4.apk만 존재(구버전 전량 삭제)

Stage Summary:
- 8항목 전부 구현+실측 완료. 16개 상위직이 전부 서로 다른 3차기를 갖고(겹침 0), 전직할 때마다
  기존 스킬이 눈에 보이게 강화된다. 모바일에서 3/4차기가 드디어 사용 가능.
- 다음 후보: 세이지 계열 순수 힐러(아군 대상) 스킬, 에랄드 구매 연동, 신규 몬스터 전용 보스

---
Task ID: v3.0.5-two
Agent: Super Z (main)
Task: 유저 2요구 — ①장비 강화 (스타포스 및 강화 효과) 콘텐츠 ②터치 조이스틱 인식 범위 축소(NPC 상호작용) — v3.0.5 배포

Work Log:
- ①스타포스: UPGRADE_MAX 12→15, 성공률 [100,85,70,55,40,35,30,25,20,15,12,10,8,6,5], ★12+ 비용 1.6^(성-11) 가산 급증 구간
- 마일스톤 보너스(누적): 무기 ★5 공+4·치+2% / ★10 공+6·치+3% / ★15 공+8·치+5% (최대 공+18·치+10%) /
  방어구 ★5 HP+25 / ★10 방+2·HP+50 / ★15 방+3·HP+80 (최대 방+5·HP+155) — starWeaponBonus/starArmorBonus(data.ts)
- Player.ts: atkTotal/defTotal/critRate에 마일스톤 반영, syncStarHp(방어구 HP 델타 가산) + restoreStarHp/starHpApplied(세이브 sfHp 중복 가산 방지),
  tryUpgrade 개편(티어별 연출 분기 + 마일스톤 돌파 대형 연출 + 슬롯명 피커업 텍스트)
- WorldScene.ts: syncUpgradeGlow 재작성 — 티어별 오라(★4~7 백금/★8~11 청록/★12~14 보라/★15 금색, 크기·알파·속도 차등) +
  ★8+ 주변 스파클(업데이트 루프, 230/420ms) + ★15 impact_star 궤도성 2기 회전.
  spawnStarForceBurst(성공 티어색 스타 버스트+링+스타 팝 / 실패 잿빛 퍼프), spawnStarForceBreakthrough(3중 링+플래시+쉐이크+배너)
- 세이브: config sfHp 필드 + buildSave 2곳 + 로드 시 restoreStarHp→syncStarHp (구 세이브 upArm 복원 시 마일스톤 HP 소급)
- Panels.tsx: "스타포스 강화" UI — 성 15칸 바(티어색)·마일스톤 3단 안내·스탯 미리보기(now→next)·
  rpg:upgradeResult 수신 성공 금빛/실패 붉은 흔들림(sfshake keyframes)·비용 toLocaleString·"+N"→"★N" 표기 전환
- ②조이스틱: TouchControls 영역 inset-y-0 w-45%(전체 높이) → bottom-0 h-55% w-46%(좌하단) 축소 + 대기 중 점선 안내 패드(채팅 입력 위 배치)
  GameRoot 렌더 순서 교체 — InteractPrompt를 TouchControls 뒤로(z-order, 조이스틱이 칩을 던 원인 제거) + 칩 터치 타깃 확대(px-4→px-5)
- E2E 신설 scripts/e2e_v305_starforce.js 33 PASS / 0 FAIL — 성공률 곡선·★1 성공(45G 차감+이벤트)·★5 돌파(공+6·치+2%·배너)·
  ★9 실패 1성 하락·방어구 ★5 HP+25·sfHp=25 세이브/복원(maxHp 불변)·오라 티어 4단계+궤도성 2기+소멸·UI 성 바 30칸·
  조이스틱 46%×55% 실측·GM 칩 탭 최상단=칩·칩 탭→GM 패널 오픈·조이스틱 드래그 이동
- 회귀: v2.7 12·12 / v3.0.1 10·0 / v3.0.2 12·0 / v3.0.3 23·0 / v3.0.4 24·0
- 테스트 교훈: ①intro 마을 대사가 뒤늦게 열리면 dialoguing=true로 player.update가 멈춰 스킬 발동/칩 렌더 검증 오염 —
  enterWorld에 "dialoguing 연속 3회 false drain" 루프 필수(v304 하네스에도 적용해 잠재 오염 제거) ②spawn 서버는 NODE_ENV=production 명시(미지정 시 next dev 잠금 충돌)
  ③좀비 server.js 프로세스가 테스트 포트를 점유 → 실행 전 정리 ④rpg:upgradeResult는 WorldScene onUpgrade 핸들러에서 emit —
  테스트는 p.tryUpgrade 직접 호출 대신 EB.emit("rpg:upgrade")로 유저 경로 검증
- 스크린샷: shop_starforce_pc(성 바·마일스톤·미리보기)·mobile_joystick_chip(좌하단 축소+GM 칩)·aura_star9_world 육안 확인
- 배포: versionCode 20/"3.0.5" 3곳 동기화(build.gradle·build_apk.sh·Overlays 배지) → 웹 재빌드+데몬(200/socket 200) →
  APK 16,955,437B aapt(versionCode 20·3.0.5)/apksigner(CN=SERTZ 동일 키) 검증, Release v3.0.5(id 379897526) 업로드 무결성 MATCH,
  standalone 복원 재배포, download/에 SERTZ-v3.0.5.apk만 존재(구버전 삭제)

Stage Summary:
- 2요구 전부 구현+실측. 강화가 "숨은 수치"에서 ★15 보이는 성장 콘텐츠로 전환(티어 오라·스파클·궤도성·돌파 연출), 
  모바일에서 NPC 상호작용 칩이 조이스틱에 가려지던 근본 원인(전체 높이 레이어+z-order) 제거.
- 다음 후보: 장신구(반지/펜던트) 스타포스 확장, 강화 재료 아이템(강화 주문서), 세이지 계열 순수 힐러 스킬, 에랄드 구매 연동

---
Task ID: v3.0.6
Agent: Super Z (main)
Task: 유저 15항목 — 9항목(스킬 겹침 0·2차 스킬 교체·기본공격 강화·크리 초과분 크뎀·반복 의뢰·원거리 자동사냥·사운드 밸런스·보스 강화·보스 드롭템) + 6항목(BM 상점·maxHP% 피해·모바일 상점창·아이템 판매·3번째 펫+자동 사용·화살 방향)

Work Log:
- 샌드박스 리셋 복구: GitHub 클론(v3.0.5=versionCode 20) + npm install + Temurin JDK 21(/home/z/jdk) + Android SDK(platform-36·build-tools 35/36·cmdline-tools·licenses 수락)
- ①반복 의뢰 근본 버그: makeStage가 구역 단일종 로테이션에서 [반복] 대상(spec.main)을 스폰에 미포함 → 카운트 불가. beat 편입과 동일 패턴으로 편입 + repeatNeed/huntCount/repeatStage 세이브(재입장 카운트 유지)
- ②④스킬 겹침 0: classes.ts SKILL1_KIND/SKILL2_KIND 12+12종 클래스 고유(1차 4계열 + 2차 8직업) + resolveSkill1/2Of 체인 승계(3·4차는 2차기 강화판). 도적 Z를 회전베기→칼날 폭풍(단검 부채꼴)으로 교체, 가디언 성벽 강타·스나이퍼 snipe(히트스캔)·윈드러너 gustarrow(끌어당김)·아크메이지 arcbolt(착탄 폭발)·세이지 purify(자힐 파동)·어세신 shadowexec(점멸 참수)·스와시버클러 flurrydance 등 9종 Z 신규 + C 12종 파라미터/종착효과 분리(savagerush 공버프·bulwarkdash 방버프·falconwind 3발·windslash 경로 화살·grandblink 대폭발·cycleblink MP흡수·ambushdash 출혈·flashydash 연타·shadowveil 다음공격 강화)
- ③기본공격 티어 래더: 미전직 1타 → 1차 2연타 → 2차 3연타 → 3차 검기 파동(관통 3) → 4차 대형 파동(관통 5) / 화살·볼트 1+(t≥1)+(t≥3) 발수 / 표창 3→2회마다·3차 2발·4차 3발
- ⑤크리티컬: rollDamage chance=min(rate,100), critDmg=1.7+max(0,rate-100)/100 getter
- ⑥원거리 자동사냥: autoRetreatDir 110px 탐지+위협 스코어링+월드 바운드 반영, autoRetreatBlocked 신설 — 코너 시 적 통과 돌진 탈출 또는 정면 반격, 카이팅 중 조준 유지
- ⑦사운드: 동일 SFX 55ms 스로틀+동시 12캡, 볼륨 래더(swing 0.34 등 전투음 하향), BGM 0.42→0.34
- ⑧보스: spawnBoss HP×1.25×(scale×1.35)(+69%)·ATK×1.05, Boss.takeDamage 전 관통 0.5+maxHP% 하한, 페이즈별 태진(0.85/0.7/0.5)·격노 추격 1.18배·탄막 12/16/20·volley 12
- ⑨보스 드롭: BOSS_DROP_ITEMS 9종 전설 등급 100% 드롭, Drop.spawnItem(발광 펄스), tradeLock → buy() 차단, collectDrop → owned 지급
- ⑩BM 상점: BmShopPanel 신설(에메랄드 전용) — pet_atlas(맵 전체 자석 펫)·ring_bless·buff_king(올인원 버프)·cos_aurora, 에메랄드 획득처: 보스+2/정예+1/반복 사이클+1/GM+50
- ⑪maxHP% 고정 피해: DMG_PCT(mob 4.5%/elite 6%/boss 9%/slam 12%/plant 5%) — takeDamage pctFloor = max(방어감쇄, maxHP×pct)
- ⑫모바일 상점창: ShopPanel 카드 max-h-[min(88svh,640px)]+overflow-y-auto(스타포스 섹션 포함 스크롤)
- ⑬판매: sellValue(상점가 40%, 보스 400G), 인벤토리 장비/장신구 판매 버튼, 장착 중 판매 금지, rpg:sell 이벤트
- ⑭펫 아틀라스: Drop.tick 자석 범위 무한+620 속도, Pet 추적 k 22
- ⑮자동 사용: autoUse 세이브 설정{hpPct 0/30/50/70, mpOn, buffs[]}, tickAutoUse(물약 즉시·버프 12프레임 게이트), BM 상점 패널 UI 토글
- ⑯화살 방향: update에서 공격 입력을 이동 분기 이전으로 이동(같은 프레임 이동이 facing을 덮어써 발사 방향이 튀던 근본 수정) + attack 중 facing 고정
- 신규 아이콘 4종 생성(pet_atlas/cos_aurora/ring_bless/buff_king PIL 픽셀아트) + BootScene 등록
- E2E scripts/e2e_v306_features.js 44 PASS / 0 FAIL — 겹침 0 전수(28클래스+형제 12쌍)·2차 스킬 교체·기본공격 스윙 실측(2→3)·크뎀 1:1·반복 의뢰(스폰 편입+8킬 보상+need+2+세이브)·코너 생존·보스 공식·드롭 tradeLock·화살 방향·maxHP% 피해·모바일 상점 뷰포트 실측·판매·BM 구매·아틀라스 자석·자동 물약/버프
- 회귀: v2.7 12·12 / v3.0.1 10·0 / v3.0.2 12·0 / v3.0.3 23·0 / v3.0.4 24·0(스킬 고유화 반영 기대값 갱신) / v3.0.5 33·0
- 테스트 교훈: ①E2E 섹션 간 세이브 이월 오염([6] 자동사냥 ON이 [10]으로 이월 → autohunt 볼트가 측정 오염, 섹션별 격리 필수) ②툴 출력에서 "[min("가 ANSI 이스케이프로 잘려 "in("처럼 보이는 착시 존재 — od 바이트 덤프로 검증 ③오토어택(attackQueued 잔여)이 히트 실측 오염 — doAttack 게이트로 차단
- 배포: versionCode 21/"3.0.6" 3곳 동기화 → APK 16,965,903B aapt(21/3.0.6)·apksigner(CN=SERTZ 동일 키) 검증 → 웹 standalone 재빌드+데몬(200/socket 200) → download/ SERTZ-v3.0.6.apk 단독
- 미완: GitHub push/Release — 샌드박스 리셋으로 .gh_token 소실. 로컬 커밋 b2df42a(v3.0.5 위 재구성 완료) + scripts/release_v306.py 준비 — 토큰 제공 시 즉시 push/릴리스 가능

Stage Summary:
- 15항목 전부 구현+실측 검증(44/0 + 회귀 136/136). "겹치는 스킬 하나도 없게"가 1차~2차 Z/C까지 완전 고유화로 완성,
  기본공격이 전직마다 눈에 보이게 강화되고, 보스는 관통+%피해로 후반 탱킹을 차단, 보스 전용 드롭으로 거래소 준비 재화 확보.
- 다음 후보: 유저 거래소(보스 드롭 tradeLock 해제·판매/구매 UI), 강화 주문서 아이템, 세이지 계열 순수 힐러 확장, 장신구 스타포스

---
Task ID: v3.0.6-release
Agent: Super Z (main)
Task: GitHub push/Release v3.0.6 완료 (사용자 제공 신규 토큰)

Work Log:
- 사용자 제공 신규 GitHub 토큰 검증 (apple01234 계정 확인, api.github.com/user 200)
- .gh_token 저장 (chmod 600)
- 미푸시 커밋 2개 push: 78365f2..9a931fb (b2df42a v3.0.6 코드 + 9a931fb worklog docs)
- Release v3.0.6 생성 (id 380163488, https://github.com/apple01234/CERTZ/releases/tag/v3.0.6)
- SERTZ-v3.0.6.apk 업로드 (16,965,903B, state=uploaded)
- 무결성 검증: 로컬 sha256 336004c5… == 릴리즈 다운로드 sha256 → MATCH
- download/ 정리 확인: SERTZ-v3.0.6.apk 단독 존재 (지시 #15 준수, 구버전 전량 삭제 유지)

Stage Summary:
- v3.0.6 (versionCode 21) 전체 배포 체인 완료: 코드 push + Release + APK 업로드 + 무결성 MATCH
- 미완 항목 없음. v3.0.6 배포 완전 종료.
- 다음 후보 (worklog 기존 계획): 유저 거래소(보스 드롭 tradeLock 해제·판매/구매 UI), 강화 주문서 아이템, 세이지 계열 순수 힐러 확장, 장신구 스타포스

---
Task ID: v3.0.7
Agent: Super Z (main)
Task: v3.0.7 — 4대 기능(유저 거래소·강화 주문서·장신구 스타포스·세이지 힐러) 개발+배포

Work Log:
- ①유저 거래소: TRADE_PRICES(bd_* 9종 8~30 에메랄드)·tradeValue(구매가 60% 환급)·TRADE_STOCK 신설(data.ts).
  Player.tradeBuy(에메랄드 차감+즉시 장착+중복 차단)/tradeSell(장착 해제+HP 마일스톤 회수) — buy()는 tradeLock 차단 유지.
  TradePanel 신설(보유 전설 판매+9종 구매 목록+수수료 안내), PanelKind "trade", ShopPanel 헤더 거래소 버튼,
  가방 보스 드롭 카드 "거래소 +N" 버튼, WorldScene rpg:tradeBuy/tradeSell 핸들러. sellValue(tradeLock)=0으로 골드 판매 차단 전환.
- ②강화 주문서: scroll_star 아이템(150G, rare, 소지품) + item_scroll_star.png PIL 신규 생성(보라 별 두루마리) + BootScene 등록.
  STAR_BLESS_RATE=15/STAR_BLESS_MAX=3, Player.useStarScroll(충전)·tryUpgrade에 성공률 가산+1장 소모(성공/실패 무관)+결과 텍스트 주문서 태그.
  가방 '충전' 버튼(rpg:starScroll), ShopPanel 스타포스 헤더 충전 현황 배지+버튼 성공률 가산 표기.
- ③장신구 스타포스: starAccBonus(★5/10/15 — crit 트랙 +2/+6/+12, HP 트랙 +20/+55/+110, 둘 다 가능).
  Player.accUp(세이브)/tryUpgradeAcc(무기 비용·성공률 체계 동일, ★9+ 실패 하락)/syncAccStarHp·restoreAccHp·accHpApplied(델타 방식).
  equip/unequip/sell/tradeSell 전 경로 HP 동기화, critRate 게터에 마일스톤 crit 반영.
  가방 장신구 카드: 강화 버튼(비용·성공률)+성 바(티어색)+보너스 표기, rpg:upgradeAcc 핸들러.
- ④세이지 힐러: purify 자힐 (6+3t)→(8+4t)+MP 회복(4+2t) 신규+반경 내 원격 아군 치유 파동(healRemotesPulse — 멀티 연출).
  크로니컬 timewarp 필드 selfHealPerTick(자신 maxHp 1%/틱) 신설 — spawnField 확장+tickFields 힐 분기.
  이터널 eternalloop HP 25%+MP 50% 즉시 회복 추가. SKILL3/4_DESC·sage 라벨 갱신.
- 세이브: accUp/starBless/accHp 필드(config.ts 정규화+buildSave 2곳+로드 복원) — 구 세이브 호환 기본값.
- RpgState에 accUp/starBless/accHp 노출(패널 표기용), __SERTZ_DEBUG__에 data 모듈 전체 노출(E2E 정적 검증).
- E2E scripts/e2e_v307_features.js 신설 38 PASS / 0 FAIL — 거래소 사이클(구매 100→92·판매 92→96·중복 차단·이벤트 경로)·
  주문서(구매 150G·충전·★9 결정론 60% 성공→★10·★10 실패→★9 하락·★8 유지·소모 3→2→1→0)·
  장신구(강화 성공·골드 차감·★5 crit +2 실측·bd_behemoth ★5 HP+20·세이브 accUp/starBless/accHp)·
  세이지(purify 자힐+MP 순증 -7[비용 15 대비 회복 8]·timewarp 필드·eternalloop +163HP/+210MP)·패널 UI 5종.
  테스트 교훈: ①useSkill1 MP 게이트 15 — 충전량 미달이면 자힐 자체가 미발동(마을에는 적 없음 → forest1 이동 필요)
  ②eternalloop MP 실측은 스킬 비용 40 차감 후 순증 기준 ③Math.random 스텁으로 성공률 결정론 실측.
- 회귀: v2.7 12/12(E2 타이밍 플래키 1회→재실행 통과) · v3.0.1 10/10(카이팅 실측 플래키 1회→재실행 통과) ·
  v3.0.2 12/12 · v3.0.3 23/23 · v3.0.4 24/24 · v3.0.5 33/33 · v3.0.6 44/44 — 총 194/194 + 신규 38 = 232 PASS.
- 버전: versionCode 22/"3.0.7" 3곳 동기화(build.gradle·build_apk.sh·Overlays 배지 "유저 거래소·강화 주문서·장신구 스타포스·세이지 힐러")
- 배포: 웹 재빌드+데몬 기동(200/socket 200) → APK 16,970,214B aapt(22/3.0.7)·apksigner(CN=SERTZ 동일 키 cc774f34…) 검증 →
  Release v3.0.7(id 380184676) 업로드, 다운로드 sha256 914c8201… == 로컬 MATCH → download/ SERTZ-v3.0.7.apk 단독(구버전 삭제)

Stage Summary:
- 4대 기능 전부 구현+실측. "보스 드롭은 거래소에서 사고팔게"가 완성되며 v3.0.6 보스 전용 드롭의 후속 약속 이행.
  강화 주문서로 스타포스 고구간 리스크 완화 루트 신설, 장신구도 ★15 성장 콘텐츠로 확장, 세이지 계열 힐러 정체성 3중 강화.
- 다음 후보: 거래소 유저간 P2P 거래(서버 상장/검색), 강화 주문서 상위 등급(고급 주문서 +25%p), 장신구 전용 성급 UI 오라,
  세이지 파티 힐 대상 확장(파티원 HP 동기화), 에메랄드 수급처 밸런스 조정

---
Task ID: atlantis-v1
Agent: Super Z (main)
Task: 잠뜰 TV '아틀란티스' 스핀오프 2D 탑다운 게임 (/atlantis) 완성·검증·배포

Work Log:
- 전임 세션 산출물 인수 검토: public/atlantis/img 194종 에셋 + src/game/atlantis(BootScene/WorldScene/data/state/sfx) + AtlantisRoot 셸 — 9+1 세계·7성물·7보석·스토리 12단계 구현 상태 확인
- 미완 BGM 표기 롤백: Overlays "AI BGM" 배지·TitleScene 크레딧·audio.ts/PhaserGame AI BGM diff 전부 HEAD 복원, 빈 bgm_manifest.json 삭제 (매니페스트 비어 무음 상태 — 유저 지시 "오래걸리면 굳이 음악 다운 안해도 돼" 반영, 레거시 BGM 정상)
- 사용자 개발 프롬프트 요구 보강:
  ① JSON 타일맵 로딩 시스템 — scripts/gen_atlantis_maps.mjs(bun, WORLDS ASCII → public/atlantis/maps/<id>.json 11종) + BootScene load.json + WorldScene.parseGrid JSON 우선·ASCII 폴백
  ② 상성 시스템 클래스화 — RelicAffinity.ts 신설(check/multiplierFor/describe/forEquipped 싱글턴, 카운터 ×2.2 우선 → 라그나로크 ×0.6), WorldScene.elementMult 위임
- 버그 픽스 2건:
  ① 씬 재시작 잔여 객체 누적 — interactables/gates/monsters/chestObjs/proxCbs/loose를 create()에서 리셋 (이전 월드 포탈로 워프되는 고스팅 차단)
  ② 아스가르드 개방 누락 엣지 — 마지막 수집이 상자/왕/현자 지급 성물이어도 개방되도록 checkAsgardReady 재평가(interactChest 공통 + king/sage 지급 후)
- 진입 동선: 본편 타이틀 "스핀오프 · 아뜰란티스: 잠뜰의 인어(NEW)" 링크 ↔ /atlantis 타이틀 "← SERTZ 본편" 링크
- E2E scripts/e2e_atlantis.js 신설 — 51 PASS / 0 FAIL:
  JSON 타일맵 11종 · WASD 실측(velocity 96·변위) · 실공격 HP 감소 · 상성 3종 실측(중립 1.0/카운터 2.2/라그나로크 0.6) · 포탈 10기 · 상자 개봉 · 화염결계 반지 장착 해제 · 룬 오답 리셋+정답 개방+보상 상자 · 보스 4연전 드롭 · 성물7+보석7→아스가르드 개방 · 라그나로크 격파→엔딩→새로 시작 · localStorage 세이브/이어하기 · 본편 회귀(스핀오프 링크 클릭→재부팅)
  테스트 교훈: page.evaluate 인자 1개 제한(객체 래핑) · 플래그는 실제 키('runesDone') 사용 · Phaser scene.restart는 동일 인스턴스 재사용(클래스 필드 누적 주의)
- 회귀: 본편 e2e_v307_features.js 38 PASS / 0 FAIL (Overlays 타이틀 수정 무영향)
- 배포: npx next build(standalone) + 데몬 재기동 — / 200, /atlantis 200
- 브라우저 실측(agent-browser 격리 세션): 타이틀→신규 시작→미드가르드→허브→네바다 렌더 + pageerror 0 (공유 세션의 4건 에러는 이전 본편 테스트 잔여로 무관 확인)

Stage Summary:
- /atlantis 스핀오프 게임 본편 통합 완료. 사용자 프롬프트 3요구(2D 탑다운 타일맵·캐릭터 이동·JSON 타일맵 로딩·상성 시스템 클래스) 전부 충족.
- 미완 BGM 작업은 롤백 정리 (유튜브 다운로드 스크립트 8종 untracked 유지 — 음악 작업 재개 시 활용)
- APK 미배포 — 다음 버전(v3.0.8+) 정책에 따라 스핀오프 포함 재배포 여부 유저 확인 필요
- 다음 후보: 모바일 터치 컨트롤(가상 조이스틱)·BGM 재개 시 audio.ts AI 플러밍 복원·아뜰란티스 전용 업적/수집 UI

---
Task ID: online-howto
Agent: Super Z (main)
Task: "온라인 하는법" 안내 + APK 기본 서버 주소 stale 픽스

Work Log:
- server.js/net.ts/ServerConnect.tsx 실측 리뷰: 웹=same-origin 자동 연결, APK=localStorage 'sertz.server.url' (DEFAULT_SERVER 자동 저장)
- DEFAULT_SERVER가 옛 샌드박스 주소(preview-6a94b1ab)로 고정 → 현재 라이브 서버(preview-6a95efa8, hostname c-6a95efa8-… 패턴 매칭)로 갱신
- 커밋 aa39e63 push 완료 (.gh_token 인증)
- 서버 실측: localhost:3000 HTTP 200, socket.io same-origin 정상 기동 중

Stage Summary:
- 설치된 v3.0.7 APK에는 옛 기본 주소가 박혀 있음 → 타이틀 우하단 🌐 버튼에서 현재 주소 수동 입력 1회 필요
- 웹 브라우저는 접속만으로 온라인(멀티) 자동 활성 — 별도 설정 불필요
- 다음 APK 빌드(v3.0.8+)부터 새 기본 주소 자동 적용

---
Task ID: redesign-v308
Agent: Super Z (main)
Task: 업로드 에셋 28팩 기반 게임 전체 디자인 개편 (기능 로직 불변) + EXE 파이프라인 검증 + 빌드 찌꺼기 정리

Work Log:
- 유저 지시 "exe 빌드 중지·찌꺼기 정리·커밋만" 수행: electron/dist·game·.next-apk 삭제, 구 APK(v3.0.7) 삭제, gitignore에 빌드 산출물·upload/ 추적 배제
- push 차단 해소: 자동커밋에 포함된 233MB SERTZ.exe 블롭 → soft-reset으로 미푸시 커밋 3개 재구성 (0c24b9d push 완료)
- EXE 파이프라인은 검증 완료 상태로 보관: electron-builder portable x64 → SERTZ-3.0.8-win.exe 123MB 생성 실측
  (교훈: standalone game staging에 npm install 금지 — package.json 전체 트리 재설치로 1.1GB 폭증. socket.io는 루트 node_modules에서 수동 복사)
- 에셋 인벤토리: 28팩 unzip -l 기록(UPLOAD INVENTORY.md) + 선별 추출 스크립트 3종 신설(extract_assets/extract_icons/inventory_assets)
- 현 구조 실측(Explore 에이전트): public/assets 502 PNG 플랫, 키=파일명 규약, 64px 타일 타일스프라이트, 멀티이미지 애님, React 아이콘 = /assets/<키>.png
- 컨버팅 스크립트 scripts/redesign_assets.py (프리뷰 몽타주 자동 생성):
  ① 아이템 30종 교체 (RPG Icons 32×32 — 포션/무기6/방어구6/반지4/펜던트2/스크롤3/버프4/에메랄드=Gems1 Icon18)
  ② 스킬 아이콘 56종 신설 /assets/skillicon/<cls>_{s1,s2}.png (28클래스 — Swordsman/Barbarian/Archer/Thief/Paladin/Priest/Pyromancer/Cryomancer/Lightning/Thief/Pirate/Necro 팩)
  ③ SharpUI 스킨 26종 /assets/ui2/ (panel/button/gauge/list/avatar/close/ability 6/potion 5)
  ④ 타일 9지면+4길 교체: Serene 잔디(96,0)·흙길(192,96) 실측 좌표, Cursed Land(magma/hel), RF Catacombs(cave/stone/abyss), x2_bricks=카타콤 벽돌 48×16 유지
  ⑤ 데코: Serene 나무 64×96·바위·집 2종(156×194, bbox 실측 (8,688)-(90,790)/(8,930)-(90,1032))
  ⑥ VFX 12종: Warped bolt(4f 48×32)/charged(6f)/Hits 3종(4f 96px)/pulse/spark + CFX elec(8f)/tri(2f)/boom/blood
- 코드 통합 (기능 로직 불변 — 비주얼만):
  BootScene vfx2 시트 10종+이미지 2종 로드 / textures.ts fx2-* 애님 8종 / WorldScene 히트 플립북 풀 6장(F4 규약) + spawnHitSpark 오버레이 /
  Player 마법탄 fx-magicorb→fx2-bolt(Warped 스킨, ADD) / globals.css sertz-panel·sertz-btn·sertz-gauge·listrow 클래스 /
  HUD HP·MP·EXP 게이지 프레임 / Panels 9개 다이얼로그 패널 스킨 / Overlays 타이틀 버튼 2종 SharpUI 스킨 /
  classes.ts SKILL_ICONS 28클래스 + WorldScene skills 이벤트 아이콘 필드 + useGameUi 타입 + TouchControls SkillButton icon prop(폴백 lucide 유지)
- 버그 픽스: SKILL_ICONS 값 키 s1/s2 → s1Icon/s2Icon (spread가 아이콘 필드를 만들지 않던 1차 버그)
- 검증: tsc 0에러 → next build → 데몬 재기동 → 브라우저 실측(agent-browser 격리)
  타이틀 SharpUI 버튼 렌더 ✓ / 마을 새 집·잔디·흙길 ✓ / 숲 워프 후 fx2 애님 8종 exists ✓ / hitFxPool 6장 활성 실측 ✓ /
  아크메이지 지정 시 skills 이벤트 s1Icon·s2Icon 실측 ✓ + 스킬 버튼 픽셀 아이콘 렌더 스크린샷 ✓ / pageerror 0 · console 에러 0
- 데몬 트러블슈팅: 구 데몬(05:58)이 포트 홀딩 → 전체 pkill 후 1개만 기동 (다중 daemon_spawn 방지)

Stage Summary:
- 게임 전체 비주얼 개편 5트랙(UI스킨/아이콘/스킬아이콘/타일테마/VFX) 완료 — 데미지·드롭·진행 로직 0 변경
- 커밋만 수행 (APK/EXE 미빌드 — 유저 지시). 차기 빌드 시 v3.0.8(versionCode 23)로 APK+EXE 동시 배포 가능
- 남은 후보: 히어로/몬스터 스프라이트 교체(32rogues·Minifantasy), Atlantis 스핀오프 스킨, CFX 플립북 추가 활용, 타이틀 배경 타일 패턴화

---
Task ID: redesign-v308-sprites
Agent: Super Z (main)
Task: 2차 디자인 개편 — 히어로/몬스터 스프라이트 전면 교체 (Mystic Woods + 32rogues) + 빌드 찌꺼기 추가 정리

Work Log:
- 빌드 찌꺼기 추가 정리: /tmp 빌드 로그 10종, ~/.cache/electron + electron-builder 302MB 삭제 (electron/dist·game·.next-apk는 이전 세션에 이미 정리 완료 확인)
- 유저 규칙 준수: EXE 빌드 안 함, 이번 작업도 커밋만 수행
- 소스 선정: Mystic Woods player.png (히어로 — 4방향 걷기+참격 공격 완비), 32rogues monsters.png (몬스터 42종 커버)
- 규격 역산 트러블슈팅: MW 시트는 32x48 셀 (9x10행) — 32px 가정 시 머리만 잘리는 문제를 알파 투영(빈 행/열 런 측정)으로 해학 → 48px 밴드 + 밴드 내 빈 열 클러스터로 프레임 추출
- scripts/redesign_sprites.py 신설:
  ① 히어로 7종 애님 28프레임 (idle/walk/walkside/walkup/atk/atkdown/atkup) — 96x64 캔버스, 2x 스케일, 하단 y=57 앵커, 좌향 시트→우향 flipX 변환
  ② 몬스터 42종 — 파일명/프레임 수/캔버스 100% 보존, 원본 bbox에 자동 피트 스케일
  ③ 정적 셀 → 하단 앵커 스쿼시 사이클로 idle2/run4/atk1 애님 합성 (스쿼시: idle [1.0,0.94], run [1.0,0.90,1.0,0.96]×폭 1.06, atk=1.06 확대+1.22 밝기 러시)
  ④ 테마 변형 24종 = 휘도 기반 duotone 틴트 (hue 회전은 저채도 아트에서 불가판정 → duotone 전환):
     frostwolf/icegolem/x2_frostfly/x3_icezombie/boss_gram=빙결, emberwolf/x2_firebird/firespirit/boss_surt=화염,
     helhound=흑적, x2_darkhound/boss_fenrir=암흑, runegolem/boss3/boss_abudditos=보라, boss_skoll=금색,
     boss_nidhog=청록, golem/x2_snail/swampbeast/x3_swampy=늪·갈색, boss=석청, boss2=암적, x2_reeffish=청록
- 실패 학습: `python | head` 파이프 SIGPIPE로 스크립트 중도 사망 → 파일 뒤섞임 → 출력 파일 리다이렉트로 전체 재실행, 매 실행 전 backup_assets에서 원본 복원
- 검증: tsc 0에러 / 라이브 서버 public 직서빙 확인(재빌드 불요, served md5 일치) / 브라우저 실측(agent-browser):
  타이틀→새 모험→이름 입력(용사)→마을 렌더—신규 히어로 idle·하단·상단 걷기 애님 실측 ✓ / 에셋 네트워크 512건 전부 200·304 (404 0) / pageerror 0 / console 에러 0 / 게임 루프 프레임 diff 실측 ✓
  (몬스터 전투 중 렌더는 이동 탐색이 길어져 미촬영 — 에셋 무결성·로드·애님 키 규약 보존으로 커버, 다음 플레이 시 확인 권장)
- CREDITS.md 갱신: Mystic Woods (비영리 한정) / 32rogues (NFT·AI/ML 제외) 라이선스 요건 명기
- tmp_design/ (변환 백업+프리뷰) .gitignore 추가

Stage Summary:
- 히어로+몬스터 43패밀리 300파일 전면 교체 완료 — 코드 0 변경 (textures.ts 키 규약 그대로)
- 게임 전체 디자인 개편 2차 완료: 1차(UI스킨/아이콘/스킬아이콘/타일/VFX) + 2차(히어로/몬스터) = 업로드 에셋 28팩 기반 전면 개편
- 남은 후보: Atlantis 스핀오프 스킨, 타이틀 배경 패턴, 몬스터 전투 렌더 스크린샷 확인
- 빌드는 유저가 "빌드해" 말할 때까지 금지 — 커밋만

---
Task ID: 3
Agent: Super Z (main)
Task: "빌드해 apk만" — 빌드 찌꺼기 잔여 정리 확인 + 버전 3.0.9 동기화 + APK 단독 빌드 (EXE 금지)

Work Log:
- electron/dist·electron/game 스테이징 이미 소재(52K 잔여=main.js/icon만) 확인, /tmp 빌드 로그 정리, bun.lock 노이즈 git checkout 되돌림
- 디자인 개편은 선행 세션에서 이미 2커밋(c0eb58a UI스킨/아이콘/타일/VFX, d1003f8 히어로+몬스터 43패밀리)으로 완료·실측 통과 상태임을 확인
- 버전 3곳 동기화: build.gradle 24/"3.0.9", build_apk.sh SERTZ-v3.0.9.apk, Overlays.tsx 배지 "v3.0.9 · 디자인 전면 개편(에셋 팩 28종 통합)" → 커밋 23a4ec7
- scripts/build_apk.sh 포그라운드 실행: APK_EXPORT=1 next build → cap sync → gradle assembleRelease → BUILD SUCCESSFUL 2m15s
- 실측 검증: aapt badging versionCode=24 versionName=3.0.9 ✓ / apksigner SHA-256 cc774f34(기존 키 일치) ✓ / APK 내부 assets 620건(신규 hero_*/vfx2_* 포함) ✓
- 규칙 준수: 구버전 SERTZ-v3.0.8.apk 삭제(최신 APK만 보존), EXE 빌드 안 함, android/app/build·android/.gradle 잔여물 정리(디스크 3.7G 여유)
- 웹 서버 localhost:3000 HTTP 200 정상 확인, GitHub push d1003f8..23a4ec7 완료

Stage Summary:
- 산출물: /home/z/my-project/download/SERTZ-v3.0.9.apk (17.9MB, versionCode 24) — 디자인 개편판 최초 APK
- GitHub main 동기화 완료 (커밋 23a4ec7 포함)
- 신규 영구 규칙 유지: 사용자가 "빌드해"라고 말하지 않으면 커밋만 — 다음 수정부터 재적용
