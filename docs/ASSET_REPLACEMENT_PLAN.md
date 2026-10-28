# SERTZ — 대규모 에셋 교체 작업 계획

작성 시각: 2026-10-27
입력: Google Drive 2건 (5.49GB → 해제 9.4GB)
- `asset1.bin` = 1.78GB / 3,030 파일
- `asset2.bin` = 8.11GB / 46,322 파일

## 0. 에셋 인벤토리 (실측)

| 팩 | 내용 | SERTZ 활용도 |
|---|---|---|
| **Tiny RPG Forest** | 544×512 탑다운 타일셋, 영웅/두더지/트리언트 스프라이트 | **★★★ 지면 타일 메인** |
| Tileset/Dungeon Tale | 624×512 종합 아틀라스(캐릭터·소품·UI) | ★★ 보조 오브젝트 |
| Cainos Top Down Basic | 256×256 잔디/석재/벽 | ★ 보조 |
| TopDown 2D RPG BE3 | 101×101 소형 타일 | ★ 보조 |
| 2DGamekit | 8192×8192 초대형 타일셋(플랫포머) | ✕ 탑다운 부적합 |
| RPG Icons Pixel Art | 아이콘 대량 | ★★ UI |
| MonstersSFX | 몬스터 사운드 | ★★ 오디오 |
| RPGTALK / SPUM | 대화·캐릭터 생성 | ★ |

## 1. 현재 상태

- 타일 47개(`public/assets/tile_*.webp`), 그중 27종이 `stages.ts`에서 사용됨
- `groundTex` 22종 + `pathTex` 17종
- 아틀라스 보스 13종(직전 작업에서 재조립 완료)

## 2. 작업 우선순위

### P0 — 타일맵 전면 교체 (핵심 요청)
1. Tiny RPG Forest `tileset-sliced.png`에서 지면 타일 추출
2. Dungeon Tale에서 실내/던전 타일 추출
3. 챕터별 테마 매핑 (9왕국 + DLC 10행성)
4. `stages.ts`의 `groundTex`/`pathTex` 갱신
5. `BootScene` ASSET_LIST, `WorldScene` TX_SET_OF 동기화
6. 블룸 가드(`highLumaGround`) 재확인

### P1 — 몬스터·캐릭터 스프라이트
- Tiny RPG Forest의 mole/treant/hero 활용
- Dungeon Tale 몬스터

### P2 — UI 아이콘
- RPG Icons Pixel Art → `public/assets/ui/`

### P3 — 사운드
- MonstersSFX → `public/assets/audio/`

## 3. 검증 규칙 (기존 작업에서 확립)

타일 교체 시 반드시 3중 대조:
1. `stages.ts` 참조 이름
2. `BootScene` ASSET_LIST 등록
3. `public/assets/` 파일 존재

추가로 `TX_SET_OF`(WorldScene) 누락 시 지면 변형 스캐터가 조용히 사라진다.
블룸 가드는 타일 이름이 아니라 `highLumaGround` 집합으로 판정해야 한다.

## 4. 제약

- 디스크 16GB 여유 → 대용량 해제 주의
- 확산 모델 없음 → AI 생성 불가, **기존 에셋만 사용**
- 3시간 내 완료 목표
