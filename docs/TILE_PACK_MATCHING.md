# SERTZ 지역 ↔ CC0 타일 팩 매칭표 (vc204)

> 근거: `_assets_in/itch/2d-assets` (github.com/Tiddybub/2d-assets, **전체 CC0 1.0**)
> 카탈로그 1,101개 자산 중 `tiles-terrain`/`fantasy` 계열 선별.
> 챕터 정의는 `src/game/stages.ts` CHAPTERS 에서 직접 추출(9개 챕터, 각 10구역).

## 1. SERTZ 챕터 지형 요구 (코드에서 추출)

| # | key | 제목 | 부제 | 요구 지형 |
|---|---|---|---|---|
| 2 | forest | 숲의 신전 | 미드가르드 서쪽 숲 | 숲·풀·신전 석재 |
| 3 | kingdom | 쿠소디아 | 선박의 왕국 · 늪지대 | **늪·물·목재(선박)** |
| 4 | alfheim | 알프헤임 | 요정의 성전 · 빛의 결정 | 빛·결정·성전 석재 |
| 5 | muspelheim | 무스펠헤임 | 극열의 해역 · 화산 지대 | **용암·현무암·화산재** |
| 6 | niflheim | 니플헤임 | 극한의 해역 · 얼음의 성전 | **눈·얼음** |
| 7 | cave | 스바르트알프헤임 | 어둠 요정들의 해역 · 수정 광맥 | **동굴·수정** |
| 8 | nidavellir | 니다벨리르 | 난쟁이들의 해역 · 룬 광산 | **광산·룬·금속** |
| 9 | hel | 헬 | 절벽 너머의 해역 · 대전쟁의 땅 | 묘지·뼈·황무지 |
| 10 | abyss | 세계수의 뿌리 | 심연의 근원 · 종언의 왕좌 | 심연·우주·신성 |

## 2. 후보 팩 (전부 CC0 1.0, 상업 이용 가능·출처 표기 불필요)

| 팩 | 경로 | 커버 지역 | 비고 |
|---|---|---|---|
| **RPG Base** | `fantasy/rpg-base` | 범용 기반 | 탑다운 RPG 지형 기본 세트 |
| **Roguelike Caves & Dungeons** | `fantasy/roguelike-caves-dungeons` | 7 cave, 8 nidavellir | 동굴·던전 전용 |
| **Tiny Dungeon** | `fantasy/tiny-dungeon` | 7, 10 | 소형 던전 타일 |
| **Tiny Town** | `fantasy/tiny-town` | 2, 3 마을 | 마을·건물 |
| **Tiny Farm** | `fantasy/tiny-farm` | 2 forest, 3 kingdom | 초원·농경 |
| **Roguelike Indoors** | `fantasy/roguelike-indoors` | 실내·신전 | 4 alfheim 실내 |
| **Sketch Desert** | `fantasy/sketch-desert` | 5 인접 사막 | 모래 |
| **Platformer Pack Medieval** | `fantasy/platformer-pack-medieval` | 4, 9 | 중세 석재·성벽 |
| **Map Pack** (Kenney) | `tiles-terrain/map-pack` | 2,3,6,7 부분 | 188개 64px, 지형 5~7종 한정 |
| **Roguelike/RPG pack** | `ui/roguelike-rpg-pack` | UI·아이콘 | 지형 아님 |

## 3. 커버리지 판정

| 지역 | 직접 커버 팩 | 판정 |
|---|---|---|
| 2 forest | Tiny Farm, Map Pack(풀) | 가능 |
| 3 kingdom | Tiny Town, Tiny Farm, Map Pack(물 인접) | 가능 |
| 4 alfheim | Roguelike Indoors, Platformer Medieval | 부분(빛/결정은 FX로) |
| 5 muspelheim | **직접 팩 없음** | **부족** — 현무암은 기존 `tile_magma`/`tile_basalt` 유지 |
| 6 niflheim | Map Pack(눈), Platformer Winter | 가능 |
| 7 cave | Roguelike Caves&Dungeons, Tiny Dungeon | 가능 |
| 8 nidavellir | Roguelike Caves&Dungeons + 금속 | 부분 |
| 9 hel | Platformer Medieval, 묘지 계열 | 부분 |
| 10 abyss | Tiny Dungeon + 기존 `tile_abyss`/`tile_nebula` | 부분 |

**결론:** 이 팩들로 9개 챕터 중 **6개는 직접 커버**, 3개(무스펠헤임·니다벨리르·헬)는
기존 256px 절차 생성 타일을 유지하는 혼합 구성이 현실적이다.
용암 전용 타일 팩은 이 저장소에 없으므로, 무스펠헤임은 현재 적용한
`tile_magma`(3,124색) + `tile_basalt` 조합을 유지한다.

## 3-1. 실측 결과 — **화풍 불일치로 혼용 불가** (체크아웃 후 확인)

아래는 팩 파일을 실제로 열어 측정한 결과다. 위 3절의 "커버 가능" 판정은
카탈로그 메타데이터에 근거한 것이었고, **실물 대조 결과를 반영해 정정한다.**

| 구분 | SERTZ 현재 지면 (256px 절차생성) | Kenney CC0 팩 (16~64px) |
|---|---|---|
| 고유색 | 136 ~ **3,124색** (`tile_cave` 214, `tile_magma` 3,124, `tile_grass` 787) | **10 ~ 12색** (`roguelike-caves-dungeons`, `tiny-dungeon`) |
| 파일 크기 | 214~787KB | 77~84KB |
| 표현 방식 | 고밀도 노이즈·명암 질감(painterly) | 플랫 컬러 + 심볼(icon) |
| 채도·톤 | 어둡고 무거운 자연색 | 밝고 채도 높은 장난감 색 |

**판정: "화풍이 다르다" 수준이 아니라 렌더링 철학이 다르다. 나란히 놓으면
Kenney 쪽이 빈 타일처럼 보인다.** 같은 장면에 섞으면 이질감이 크다.

추가 확인:
- `tiles-terrain/map-pack` 은 **월드맵용 대륙 타일**이지 지면 타일이 아니다
  (mapTile_001 이 남색 바탕 + 베이지 대륙 형상).
- `roguelike-caves-dungeons` 는 16×16 **1px 마진** 시트(`spritesheetInfo.txt` 명시).
- `fantasy/rpg-base` 는 64×64 개별 PNG 233장. 지형 바닥은 그중 75~80개,
  나머지는 지붕·문·창·소품.
- 용암·눈·황무지 타일은 이 저장소 **어디에도 없다**.

**따라서 용도 분리한다:**

| 용도 | 결정 |
|---|---|
| 플레이 화면 지면 | **현재 256px 절차생성 타일 유지** (`tileThemes.ts` 로 45장 정상화 완료) |
| 무스펠헤임 용암 | `tile_magma`(3,124색) + `tile_basalt` 유지 |
| 니플헤임 설원 | `tile_snow` 유지 |
| Kenney 팩 | **프로토타입·월드맵·UI·레벨 스케치** 전용. 플레이 지면에 직접 깔지 않는다 |

화풍을 맞추려면 Kenney 타일 위에 SERTZ식 노이즈 오버레이를 합성해야 하는데,
그 비용이 팩을 새로 받는 이득보다 크다.

## 4. 적용 원칙

1. **화풍 통일** — 한 지역 안에서는 한 팩만 쓴다(팩마다 픽셀 밀도·팔레트가 다름).
2. **정수배 확대** — 16/32px 팩은 nearest로 ×2/×4 확대해 64px 격자에 맞춘다.
3. **틴트 금지** — 지역 구분을 색 곱으로 하지 않는다(`tileThemes.ts` 주석 규칙).
4. **오토타일** — `src/game/autotile.ts` 의 4비트 마스크 경로를 그대로 쓴다.
5. **라이선스 기록** — 팩을 추가할 때마다 `public/assets/CREDITS.md` 에
   팩명·URL·라이선스 문구를 남긴다(CC0라도 출처 기록은 유지).

## 5. 아직 확인하지 않은 것

- 각 팩의 오토타일 지원 여부(경계 전용 타일이 체계적으로 있는지)는 팩마다 확인해야 한다.
  `roguelike-caves-dungeons` 는 16×16 1px 마진 시트로 확인했으나, 오토타일 규칙은 미확인.
- `fantasy/roguelike-indoors` 는 7개 파일뿐이어서 시트 형태로 보이나 내용 미확인.
- `fantasy/tiny-farm` / `tiny-town` 의 실제 타일 내용은 아직 열어보지 않았다.
