# 2026-11-11 KST 운영 검증 후속

운영 https://sertz.vercel.app, 게임 코드 `828c205be8726522bdab518f038c7edb8fdd7c4a`, 2.2.9/vc265에서 실행했다. 평가에 나온 `714ec915`는 최종 배포 이전의 중간 SHA다. 후속 확인에서는 main과 운영이 모두 `828c205`였다.

## 확인된 결과

- 완전히 새 브라우저에서 캐릭터 생성 → 프롤로그 → 이동/대화/공격/회피/스킬/획득/가방/의뢰/보고 → 튜토리얼 완료. 연습 도중 새로고침으로 복원 검증. 약 64초, 브라우저 예외 0. [실행 결과](tutorial.json).
- 같은 실제 저장을 이어서 키 입력으로 `howlrstone1x2 → 1x3 → 1x4 → 2x1 → 2x2 → 2x3`에 진입했다. 20마리 사냥 의뢰 두 개를 실제 처치로 완료했고 레벨 20에 도달했다. 레벨/골드/진행/적 HP/시간 배율을 조작하지 않았다.
- 첫 보스 디오는 실제 HP **178,200**이었다. 기본 장비·AP 미배분 상태의 단순 키보드 봇은 HP 175,622를 남기고 사망했다. **첫 보스 처치는 미검증이다.** 자동 조작의 대응/성장 선택이 제한돼 있으므로 이 결과만으로 모든 이용자가 진행 불가능하다고 단정하지 않는다. [실패 기록](first-boss-attempt.json).
- 보스 HP를 낮추거나 무적/GM 기능을 사용해 성공으로 바꾸지 않았다. 다음 검증에서는 정상 UI의 장비·AP·전직 성장과 회피를 포함해야 한다.

기존 vc265의 운영 가입/로그인/클라우드 왕복·비활성 캐릭터 보존·구버전 409·임시 계정 삭제 검증은 [릴리스 기록](https://github.com/apple01234/CERTZ/releases/tag/v2.2.9)에 있다. 이번 실행은 장기간 기존 이용자 계정으로 플레이한 검증을 대신하지 않는다.

## 재현 명령

```sh
TUTORIAL_QA_URL=https://sertz.vercel.app \
TUTORIAL_QA_OUT=/dev/shm/certz-live-progression node scripts/playtest-tutorial.mjs
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs scripts/playtest-live-progression.mjs
```

저장 상태 파일은 로컬의 폐기 가능한 QA 자료다. 저장소에는 원시 브라우저 storage/cookie를 올리지 않는다.

## 배포 일치성 검사

`node scripts/check_deploy_status.js`는 실제 GitHub main과 운영 `/api/version` SHA를 비교한다. Git 원격 URL에서 자격 증명을 추출하던 옛 스크립트를 대체한다. 누락 SHA·이전 배포·HTTP 실패는 성공 처리하지 않고, 일치 응답 도중 main이 바뀌어도 다시 확인한다.

`Verify production matches main` 워크플로는 main push 및 수동 실행에 동작한다. 배포 대기 중에는 20초 간격으로 최대 30회 확인하고 끝까지 불일치하면 실패 상태를 남긴다. 새 push는 이전 검사를 취소하고 새 main을 검사한다. 앱 에셋·게임 규칙은 이 QA 변경으로 수정하지 않는다.
