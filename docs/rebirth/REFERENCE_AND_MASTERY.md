# 참고 게임 적용·전수 숙련·온라인 복구

2026-11-10 KST. 작업 도중 main에 추가된 `f76054271650a0a8dc397165d2c9675d3eb17832`(vc264)를 fast-forward로 통합했다. 전직·캐릭터 PNG·월드·디오·대시 변경을 보존한다. 변경은 `/` → GameRoot → WorldScene → Player 경로에 적용했다.

## 전투와 전수 기술

- PC Shift·터치 돌진으로 S1 **준비 중에만** 취소한다. MP·S1 쿨타임은 유지하고 예약 타격·경고 FX를 정리한다. 발동·후딜·일반 공격 중에는 불가하다. JENNY의 준비/취소/해제 수명 원칙을 현재 기본 입력에 연결했다.
- 실제 판정 범위의 기존 Graphics가 준비 시간 동안 밝아진다. 발동·취소 시 경고 tween까지 제거한다. 새 이미지·파티클은 없다.
- vc264의 대시 종료 후 1초 쿨타임을 유지한다. 대시가 쿨타임 중이면 S1 준비도 취소하지 않는다. 충돌 스윕·이동 거리·자원 규칙을 유지하며 터치 안내도 1초로 맞췄다.
- 사용자 후속 요구에 따라 **현재 전수 프로필 10종의 S1**을 기술별로 기록한다. **20회 발동마다 1단계**, 최대 **10단계·200회**다. 단계당 피해·치유량 +2%, 상한 +20%이며 상승 배율은 다음 시전부터 적용한다.

발동 첫 pulse에 한 번만 누적한다. 다중 타격·귀환 공격도 시전당 1회이며 준비 취소·MP 부족·쿨타임 중 입력은 누적하지 않는다. 발동한 빗나간 공격은 사용으로 인정한다. 기본 회전베기는 전수 프로필이 아니므로 제외한다. 숙련도 규칙은 사용자 요청으로 설계했으며 참고 게임의 관찰 사실이 아니다.

전직 창에 전수자·기술명·숙련 단계·위력/치유 보너스·다음 단계까지 횟수를 표시한다. 다른 계열 전직·상위 차수 승격에도 기록을 보존한다. 기존 전수 프로필과 전직 해금 경로를 사용하며 새로운 전수 사건을 창작하지 않았다. 기획서의 실제 장신구·책 등의 선물은 기술 아이템으로 바꾸지 않았다.

`SaveData.skillMastery` → `restoreFromSave()` 정규화 → `buildSave()`를 연결했다. 구 세이브는 빈 기록으로 시작하고 기존 재화·진행을 유지한다. 알 수 없는 키·음수·비정상 수치는 제거하고 과도한 횟수는 200회로 제한한다.

## Craft Anything 근거와 한계

[기존 14개 참고 자료 분석](../campaign/REFERENCE_DEEP_ANALYSIS.md)을 재사용하고 JENNY 공격 수명, Nefarius 대시 종료, Feather Park 전환 신호의 복원 소스를 다시 읽었다. 모든 게임을 실행·완주하거나 새 도구로 전부 재해독한 것은 아니다. 기존 맵·카메라·컷씬 기능을 이번에 새로 만들었다고 보고하지 않는다.

Craft Anything0.6.0은 이번 `FeatherPark.pck`를 `unknown`으로 식별했다. GDScript import도 의미 분석이 아닌 파일 해시를 제공했다. 복원 출처가 기록된 소스를 직접 읽었으며 이 한계를 조사 원장에 남겼다. 최종 묶음은 TS 4개·GDScript 3개·별도 Playwright 결과 JSON 1개다.

- 조사 프로젝트: `/workspace/tools/craft-anything/certz-reference-apply.cany`
- 최종 증거: `ev_c8c6d5e2b18d3594c24bb7661cb7a432499a05f94f32cdab5a9858b86807619d`
- [Craft 증거 export](../qa/2026-11-10/reference-mastery/craft-evidence.json)
- 원본 게임 실행·전용 에셋/코드 복제·새 에셋 생성·새 의존성 추가 없음.

## 검증

- `npm test`: **577 통과 / 0 실패**. 실제 Player의 10개 프로필, 취소·다중 pulse·숙련 상한·피해/치유 배율·상위 차수/계열 전환을 포함한다.
- `npx tsc --noEmit`, `npx eslint src --max-warnings 0`, `npm run build:next`: 통과. build:next는 운영 Vercel과 같은 빌드 명령이다.
- [브라우저 결과](../qa/2026-11-10/reference-mastery/results.json): PC 1280×800 및 터치 844×390. 실제 Z/Shift/돌진 버튼으로 취소 후 FX·지연 타격 0, MP/CD 유지, 다음 정상 공격의 실제 적 1회 적중 확인. 19→20회 성장, 전직 창 숙련 1/10·+2%, 페이지 재접속 복원 확인. 페이지 오류 0.
- [PC 숙련 화면](../qa/2026-11-10/reference-mastery/keyboard-mastery.png), [터치 숙련 화면](../qa/2026-11-10/reference-mastery/touch-mastery.png), [준비 범위](../qa/2026-11-10/reference-mastery/keyboard-startup.png).

브라우저의 적 배치·전직·19회 기록은 폐기 가능한 QA 세이브의 fixture다. 정본 스토리 전체 완주, 모든 보스/맵의 이번 회차 재검증, 실제 APK 재빌드·기기 플레이를 뜻하지 않는다.

## 온라인 복구·배포 정리

운영 `https://sertz.vercel.app`에서 계정·랭킹·거래소 500, 채팅·파티 503을 재현했다. 공통 원인은 운영 로그의 GitHub DB GET **401**이었다. 기존 키로 DB 복호화가 가능한 것을 확인했으며 계정·DB·암호화키를 초기화하지 않았다.

호스트 `GH_TOKEN`은 프록시용이다. 이 환경의 GitHub 요청에는 호스트 인증이 적용될 수 있어 로컬 200만으로 운영용 PAT를 검증하면 안 된다. 최초 복구 시도의 이 오판을 바로잡고 운영에서 제거했다. 기존 사용자 토큰들을 임시 Vercel Sandbox에서 검사해 classic PAT 2개의 401과 fine-grained PAT의 DB 읽기 200을 구분했다. 유효한 fine-grained PAT를 Production `GITHUB_TOKEN`에 설정하고 새 Git 소스 배포로 반영했다. 비영속 Sandbox는 중지·삭제 후 404를 확인했다. 토큰 값은 문서·저장소에 기록하지 않는다.

- [읽기 검증](../qa/2026-11-10/reference-mastery/online-read-results.json): 계정 상태·랭킹·거래소·채팅·파티·닉네임 API 모두 200.
- [쓰기/정리 검증](../qa/2026-11-10/reference-mastery/online-write-results.json): 비공개 QA 파티 생성·조회·탈퇴·제거 모두 정상. 잘못된 로그인은 정상 401. APK 출처 `https://localhost` OPTIONS는 204와 허용 CORS 헤더.
- 실제 계정의 정상 비밀번호 로그인·클라우드 저장 전체 흐름 및 APK 실기기는 위 검사로 완료를 주장하지 않는다.

배포 삭제는 `sertz` 프로젝트 `prj_iEfvcVgW790vIycqJBcix7T1R9wR`에만 수행한다. 최초 5개 중 최신 정상 운영 배포를 보존하고 이전 4개를 삭제한 후 목록 1개를 확인했다. 중간 복구·새 코드 배포들도 최종 운영 배포의 READY·별칭을 확인한 뒤 같은 기준으로 제거한다. 별도 프로젝트·DB·Drive 자료는 삭제 대상이 아니다.
