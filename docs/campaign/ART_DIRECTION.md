# 기억의 서약 — 사용자 제공 에셋 기준

사용자 최신 피드백에 따라 Kenney Tiny Town/Tiny Dungeon 기반 표현을 교체했다. 공유된 `CERTZ-src-slim-20261102-2213.tar.gz`의 에셋을 사용하며 원본 픽셀을 재작성하지 않는다.

- 인물: 기존 SPUM `npcbody` 렌더를 선택 화면·월드·동료에 연결한다. 구매/복원 기록은 `docs/assets_license/spum_npc_restore.json` 및 `public/assets/CREDITS.md`를 따른다.
- 초상: 기존 `DialogueBox.tsx`의 `npcportrait/_map.json` 원본 crop을 재사용한다. 새 얼굴이나 가짜 표정 프레임을 합성하지 않는다.
- 가구·수목: 기존 `furn_*`, `fm_*`, `objects/`를 사용한다. 실제 그림을 확인한다. `obj_dungeon_table`은 이름과 달리 항아리 그림이므로 실제 탁자인 `furn_table.webp`를 연결했다.
- 배치: `decorObjects.ts`의 카탈로그/배치 예산과 `WorldScene.placeDecor`의 목표·입장 지점 보호 원칙을 작은 스토리 맵에 적용한다.
- 지형·보스: Drive `assets_dl/extracted/dungeoncrawl_32x32/`의 DCSS 원본(CC0). 10개 지역의 재질과 22개 보스에 각각 대응하는 스프라이트를 연결한다. 도서관·항구·숲·유적의 구조와 소품을 구분한다.
- VFX: 기존 pixelfx sunburst 시트(MIT)를 사용한다. 강한 효과는 원소술에 제한하고 기본 공격은 짧은 선, 회피는 발밑 표시, 피해는 재사용 텍스트로 표현한다.
- UI: 기존 Galmuri, 자체 픽셀 아이콘과 잉크/양피지/금빛 색을 유지한다. 모든 월드 이미지는 nearest 필터를 사용한다.
- 음악: 기존 `audio.ts`의 곡별 음량 보정·효과음 간격·동시 재생 상한을 재사용한다. 제공된 탐험/설원/기계/별/보스 곡을 한 번에 한 곡만 스트리밍하고 앱이 숨겨지면 정지한다.

`public/assets/campaign/drive/manifest.json`에는 압축본의 원래 경로, 출처, 선택 파일 SHA-256, 규격을 기록한다. 새 DCSS 파일만 캠페인 디렉터리에 복사하고 기존 프로젝트 에셋은 원래 경로에서 재사용한다. 빌드 허용 목록은 이 선택 목록을 보존한다.

DCSS 라이선스/원본 설명은 같은 디렉터리의 `LICENSE.txt`/`README.txt`, 기존 팩과 녹음의 출처는 배포에 포함하는 `campaign/PROJECT_CREDITS.md`를 참조한다. 기존 유료 팩을 CC0로 표시하지 않는다. SPUM 동작 프레임은 이 전달본에 없어 월드 인물은 정적 원본과 방향 전환을 사용한다.
