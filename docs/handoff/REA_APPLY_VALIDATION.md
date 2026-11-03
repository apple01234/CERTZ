# 원본 런타임 RE 적용 검사 — 2026-11-03

인계용 중간 구현의 검증이다. 전체 개편/전체 스토리/운영 배포 완료를 뜻하지 않는다.

- `npm test`: **87/87 통과**. 새 맵165필드의 연결/출입구/열린 경계/원본 레이어/소품, 실제 Player 시전의 준비·발동·취소·중복 타격·치유·원소 반응, 실제 카메라 감독의 공유 잠금/완료 신호/스킵/정리를 검사한다.
- `npx tsc --noEmit`: 통과.
- `npx eslint src --max-warnings 0`: 통과. WorldScene 파일 크기로 인한 Babel 안내문만 출력되며 린트 오류/경고는 없다.
- 브라우저: `scripts/verify-rea-runtime.mjs`, Chromium, 원본 GameRoot,1280×800 및390×844. 실제 생성/시작 화면을 거치고 테스트 전용 내부 scene 접근으로 대표 상태를 검사했다. 결과는 [results.json](./rea-apply-evidence/results.json).

| 브라우저 확인 | 결과 |
|---|---|
| howlrstone1x1 /3x1 /6x1 /10x2 | library/coast/grove/citadel 각각 실제 TilemapLayer3개 생성. 기본 장비 weapon_1/armor_1 유지. |
| 첫 장,3장,6장 감독 | 재생 중 카메라 이동/줌/physics pause, Escape 직후 camCinema/dialoguing=false, physics resume, zoom=baseZoom1.5. 첫 장의 실제 chm0 배우 표시 확인. |
| 직업10종 S1 | 모든 직업에서 startup→release와 서로 다른 rea:skill/원본 이펙트 객체 확인 및 캡처. 테스트에서 레벨/직업을 직접 바꾸고 시전했으므로 정상 전직 해금이나 UI 키보드 흐름 전체 검증은 아니다. |
| 필드 식탁 | 실제 StaticBody56×18,90도 회전 후18×56. 이전 바디 제거와 회수 후 바디 제거 확인. 플레이어의 모든 방향 통과/걸림을 수동 플레이한 것은 아니다. |
| 화면 예외 | pageerror0. 로컬 계정 API는 서버 GitHub DB키 부재로500; 로그인/운영 DB 검증은 하지 않았다. |

발견하고 수정한 문제: Phaser4의 Camera.resetFX는 zoomEffect를 초기화하지 않는다. 첫 브라우저 검사에서 스킵 다음 프레임 줌이 다시 바뀌었고, zoomEffect.reset을 명시한 뒤 재검사했다. 진행 중 스토리 감독에 기존6초 카메라 워치독이 개입하는 경로도 막았다.

직접 확인한 스크린샷:

- [첫 장 카메라와 실제 배우](./rea-apply-evidence/howlrstone1x1-cinematic.png)
- [해안 구조와 기존 의뢰/안내 UI](./rea-apply-evidence/howlrstone3x1-play.png)
- [벨리카 번개 계열 S1 발동](./rea-apply-evidence/skill-sniper.png)
- [모바일 원본 HUD](./rea-apply-evidence/mobile-original-hud.png)

남은 시각적 문제도 캡처에 보존했다. 서로 다른 기존 타일/캐릭터/소품 스타일이 섞여 있고, 기존 기능 안내창·보상창·일반 대화가 플레이필드/컷씬에 겹친다. 직업을 테스트로 직접 바꿨기 때문에 HUD 일부 갱신 시점도 정식 전직 흐름과 다르다. 새 감독의 배우/움직임 연결과 완성된 미술 방향은 구분해야 한다. 안내 UI 큐와 정본 의뢰/대사/지역 정렬은 후속 작업이다.

프로덕션 웹 빌드/배포, APK 빌드·설치, 실제 휴대폰 성능, 전체15장 정상 플레이, 실제 다인 서버/실결제는 이번 인계 체크포인트에서 수행하지 않았다.
