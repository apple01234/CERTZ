# SERTZ 콘텐츠 보충 기획서 — v1.0.16 (미배포 · 로컬 전용)

> 작성: DSH 자율 세션. 근거는 전부 코드·에셋 **실측**이며 추측을 배제했다.
> **커밋·푸시하지 않음** — `main` 푸시가 Vercel 프로덕션 자동배포를 유발하기 때문.

---

## 1. 작업 범위

기존 구조·밸런스를 **바꾸지 않고** 비어 있는 곳만 채우는 것이 원칙이다.
새 시스템·새 파일·새 의존성·새 에셋을 만들지 않았고, 이미 있는 `EnemyProfile`·`BOSS_DROP_ITEMS`
스키마와 아이콘 텍스처만 재사용했다.

| 구분 | 내용 | 상태 |
|---|---|---|
| 적 고유 개성 | `EnemyProfile` 미적용 **21종** 보충 | ✅ 완료 |
| 재림 보스 전리품 | `vord`/`jorm`/`nagr` 드롭 **3종** 신설 | ✅ 완료 |
| 보스 아틀라스 | `boss_vord` 중복 · 6종 프레임 경계 접촉 | ⏸ 진단만 (에셋 생성 필요) |

---

## 2. 격차 발견 방법

감으로 찾지 않고 데이터에서 역산했다.

**① 적 개성 누락 (21종)**
`stages.ts`의 `ENEMIES` 34종을 파싱해 각 항목에 `profile:` 키가 있는지 기계 검사
→ **13종만 보유, 21종 누락**.

**② 재림 보스 전리품 누락 (3종)**
`BOSS_DEFS`(12종) 키 집합과 `BOSS_DROP_ITEMS`(9종)·`TRADE_PRICES`(9종) 키 집합을 대조
→ `vord`/`jorm`/`nagr` 3종 누락.

**③ 소비 코드로 실제 영향 확인**
```ts
// Enemy.ts:242
const prof = this.def.profile;   // undefined → 근접 FSM만 동작

// WorldScene.ts:7840
const dropKey = BOSS_DROP_ITEMS[def?.key ?? "guardian"];
if (dropKey && this.boss) { ... }  // undefined → 드롭 블록 전체를 조용히 건너뜀
```
두 건 모두 **무음 실패**(silent failure)였다. 오류도 로그도 없이 아무 일도 일어나지 않는다.

---

## 3. 적 고유 개성 21종 보충

`stages.ts:49` 주석은 v3.0.3에서 "몬스터마다 고유 개성"을 선언하지만 실제 적용은 13종뿐이었다.
**초반 3챕터에 배치된 적들이 대부분 비어 있어 게임 초반 전투가 단조로웠다.**

### 배분 원칙

- `ranged` / `charge` / `apply` / `fieldOnDeath` 4종을 종의 정체성에 맞게 부여
- 수치는 **기존 13종의 실제 사용값 범위 안에서만** 선택 — 새 밸런스 곡선을 만들지 않음
  - `charge`: `cd` 3000~5400 · `speed` 320~500 · `time` 360~640
  - `apply`: `chance` 0.3~0.55 · `dps` 0~7 · `dur` 1800~5000
  - `ranged`: `projSpeed` 280~340 · `range` 240~290 · `cd` 2100~2600
  - `fieldOnDeath`: `dps` 4~8 · `dur` 3000~4000 · `radius` 70~100
- **`projAnim`은 실제 등록된 4종만 사용**: `fx-fireball` `fx-icelance` `fx-darkbolt` `fx-magicorb`
  (textures.ts 기준 등록 목록 — 없는 키를 쓰면 투사체가 렌더되지 않는다)
- `apply.kind`는 `bleed`/`poison`/`slow`, `fieldOnDeath.kind`는 `poison`/`fire`만 (타입 제약)

### 결과 (기계 검증)

```
ENEMIES 총 34종
profile 없음: 없음 (전종 보유)
개성 분포: ranged=10  charge=11  apply=18  fieldOnDeath=6
유효성: 전부 통과 (projAnim/apply.kind/field.kind/charge 필드)
```

### 대표 배치와 의도

| 적 | 부여한 개성 | 설계 의도 |
|---|---|---|
| 이그드라실 늑대 | 돌진 | 첫 조우에서 "예고 후 돌진"을 학습 |
| 심연 하수인 | 출혈 | 기본 근접 + 상태이상 입문 |
| 동굴 거미 | 독 + 사망 독장판 | 좁은 굴에서 장판 회피 유도 |
| 수정 골렘 | 느린 대형 돌진 | "단단하고 느림"을 돌진 예고로 표현 |
| 서리 늑대 | 돌진 + 감속 | 이동기 압박 |
| 얼음 골렘 | 원거리(icelance) | 느린 근접의 약점을 사거리로 보완 |
| 심연 유령 | 원거리(darkbolt) | 통과 불가 적에게 원거리 역할 |
| 능대 | 독 | 늪 컨셉 |
| 불꽃 늑대 | 돌진 + 사망 화염 | 죽여도 안심 못 하는 압박 |
| 화염 정령 | 원거리(fireball) | 정령 컨셉의 원거리 |
| 룬 골렘 | 원거리(magicorb) + 감속 | 룬 마법 정체성 |
| 헬 하운드 | 돌진 + 출혈 | 후반 늑대 계열의 상위 정체성 |
| 독개구리 | 독 + 사망 독장판 | 초반 독 학습 |
| 궁전 뒷쥐 | 출혈 | 잡몹이지만 물면 아픔 |
| 황혼 박쥐 | 고속 돌진 | 속도 정체성 |
| 잿불 새 | 원거리 + 사망 화염 | 비행 원거리 |
| 서리 날도요 | 원거리 + 감속 | 카이팅 방해 |
| 동굴 달팽이 | 강한 감속(0.55) | 느린 개체의 위협을 감속으로 |
| 장벽 돌골렘 | 느린 대형 돌진 | "장벽" 컨셉 |
| 광포한 오거 | 돌진 | 대형 근접 |
| 고블린 약탈자 | 출혈 | 빠른 약탈자 |

---

## 4. 재림 보스 전리품 3종 신설

`BOSS_DEFS` 12종 중 **재림 지역 3종만 전용 드롭이 없었다.**

| 보스 | HP | 신규 아이템 | 옵션 | 슬롯 | 거래가 |
|---|---|---|---|---|---|
| 재림의 파수꾼 베오르드 | 42,000 | 파수꾼의 지진핵 | def 4 · maxHp 160 | ring | 36 |
| 요르문간드 | 60,000 | 세계수의 독니 | crit 16 · atk 12 | ring | 42 |
| 나그라파르 | 95,000 | 종언의 천사인장 | crit 20 · maxHp 150 · def 3 | pendant | 52 |

- 수치는 기존 9종의 강함 계층(스콜 crit8/hp80 → 아부디토스 crit18/hp130)을 **이어받아**
  보스 HP 순(42,000 < 60,000 < 95,000)으로 배치
- 거래가는 기존 최고가 30 위로 계단식(36/42/52)
- **아이콘은 기존 `i_bd_*` 재활용 — 신규 에셋 0**
  (`i_bd_guardian` / `i_bd_nidhog` / `i_bd_abudditos`)
- `tradeLock: true` + `bossDrop` 툴팁 → 상점 구매 차단, 거래소 경로만 허용

### 5곳 싱크 (하나라도 빠지면 무음 실패)

| 위치 | 줄 | 확인 |
|---|---|---|
| `data.ts` `ItemKey` 유니온 | L122 | ✅ |
| `data.ts` `ITEMS` 등록 | L382-384 | ✅ |
| `data.ts` `TRADE_PRICES` | L885-887 | ✅ |
| `data.ts` `TRADE_STOCK` | L901 | ✅ |
| `data.ts` `BOSS_DROP_ITEMS` | L1156-1158 | ✅ |

---

## 5. 보스 아틀라스 문제 (미해결 — 이미지 생성 필요)

`textures.ts` `BOSS_ATLAS` 13종을 **Pillow로 실측**한 결과.

### 5-1. `boss_vord`가 `boss_abudditos`와 사실상 같은 그림

```
boss_abudditos  3576 x 1540   fw=298 fh=220   7행
boss_vord       3576 x 1540   fw=298 fh=220   7행
SHA256 상이(재인코딩됨) · 48x48 썸네일 평균 절대오차 10.88/255
```

주석은 "재림의 파수꾼 베오르드 — 흑룡 (기존 boss2 유령선 공유 해제)"라고 적혀 있으나
**실제 파일은 아부디토스 복제본**이다. → **베오르드가 아부디토스로 보인다.**

### 5-2. 6종 프레임이 셀 경계에 접촉 (잘림)

각 행의 프레임에서 알파가 셀 경계(x=0, x=fw-1, y=0, y=fh-1)에 닿는 프레임 수:

```
boss          [1,1,2,2,2,2,1]      boss3        [5,2,2,2,4,2,1]
boss_fenrir   [5,5,1,1,2,1,2]      boss_skoll   [0,0,0,3,1,1,2]
boss_hati     [1,0,2,1,0,0,0]      boss_jorm    [1,3,1,2,4,2]
```

반면 `boss2` `boss_nidhog` `boss_surt` `boss_nagr` `boss_abudditos` `boss_vord` `boss_gram`은
**경계 접촉 0** — 슬라이싱 방식 자체는 정상이고, 위 6종의 **원본 그림이 셀보다 크다.**

### 5-3. 높이는 전부 정확

13종 모두 `fh × 행수 = 이미지 높이`로 정확히 일치.
→ **행 설정(`BOSS_ATLAS_ROWS`)은 맞고 그림만 문제**다.
따라서 행 수를 건드리면 오히려 회귀가 난다.

---

## 6. 검증 기록

| 검사 | 방법 | 결과 |
|---|---|---|
| 타입 검사 | `tsc --noEmit --ignoreConfig` (stages.ts, data.ts) | **exit=0, 오류 0** |
| 개성 커버리지·유효성 | 스크립트 파싱 검사 | 34/34 보유, 전부 통과 |
| 보스 드롭 싱크 | `grep bd_vord` | 5건 (L122/382/885/901/1156) |
| 아틀라스 실측 | Pillow 13종 | 5-1·5-2·5-3 |

`projAnim` 4종 · `apply.kind` 3종 · `fieldOnDeath.kind` 2종이 **실제 등록값인지**도 함께 검사했다.

> **`tsc` 주의**: 프로젝트에 `node_modules`가 없어 임시 설치한 컴파일러로 검사했다.
> `tsconfig.json`이 존재하므로 `--ignoreConfig`가 필요하다.

---

## 7. 남은 일

| # | 항목 | 선행 조건 |
|---|---|---|
| 1 | `boss_vord` 전용 아트 교체 | **Gemini API 키** (`GOOGLE_API_KEY`) |
| 2 | 경계 접촉 6종 재생성 | 동일 |
| 3 | NPC 128×128 도트 18종 (`CHAPTER_VILLAGE_NPC` 9챕터 × 2명) | 동일 |
| 4 | 웹 빌드 | `node_modules` 설치 필요 |
| 5 | APK / EXE 빌드 | Java·Android SDK 툴체인 (Linux 경로 `/home/z/jdk` — Windows에 없음) |
| 6 | IPA 빌드 | macOS + Xcode 필수 (Windows 원천 불가) |
| 7 | dsh `google.baseURL` 수정 | `/v1beta/openai` 누락 → 현재 POST 404 |

**Gemini 키 미설정 확인 (실측)**: `GOOGLE_API_KEY`가 User·Machine·프로세스 전부 없음.
또한 `google.baseURL`이 루트라 `POST /chat/completions`가 404이고,
정확한 경로는 `https://generativelanguage.googleapis.com/v1beta/openai`
(POST 시 400 응답 = 경로 존재, 인증만 필요).

---

## 8. 지킨 원칙

- 기존 틀·내용 유지 — 리팩터가 콘텐츠를 죽이면 실패
- 자주 호출되는 지점(기본공격·적 처치)에 과한 연출 금지
  → 개성은 **AI 상태 전이**로만 추가 (파티클·스케일 증가 0)
- 새 의존성 0 · 새 에셋 0 (아이콘 재활용)
- 세이브 필드 추가 없음 → `config.ts` 3곳 싱크 불필요
- 커밋·푸시 금지 (프로덕션 자동배포 방지)

---

## 9. 전 영역 교차 검증 (라운드 4 추가)

목표가 나열한 **7개 영역 전부**를 기계 검사로 확인했다. 정의만 있고 연결이 빠진
"무음 실패"가 있는지가 목적이다.

| 검사 | 결과 |
|---|---|
| 버프 3-way (`ITEMS`↔`BUFF_DEFS`↔`BuffKey`) | **8 / 8 / 8 일치** |
| 펫 3-way | **11 / 11 / 11 일치** |
| 치장 3-way | 54 / 56 / 56 — 차이 2건은 아래 참조(정상) |
| `ITEMS` ↔ `ItemKey` 전수성 | **194 ↔ 194, 누락 0 / 여분 0** |
| 아이콘 파일 실존 | **누락 0** (194종이 참조하는 아이콘 전부) |
| 9챕터 정합 4종 | `SET_GEAR`·`SET_BONUS`·`FRAGMENT_META`·`CHAPTER_VILLAGE_NPC` **각 9/9, 누락·여분 0** |
| `SET_GEAR` → `ITEMS` 참조 | 누락 0 |
| `BOSS_DROP_ITEMS` → `ITEMS` | 누락 0 |
| `TRADE_PRICES` ↔ `TRADE_STOCK` | **12 ↔ 12 일치**, 가격 단조 증가(8 → 52) |
| `DAILY_DEAL_POOL` → `ITEMS` | 18종 전부 실존 |

### 9-1. `cos_isekai` / `cos_pixel` — 격차 아님(정상 설계)

`COSMETIC_DEFS`에는 있으나 `ItemKey`·`ITEMS`에는 없다. 처음엔 고아로 보였으나
**이세카이 상점 전용 직접 지급 경로**임을 확인했다:

```
isekai.ts:217-218   cos_isekai: { atk: 10, hp: 120 } / cos_pixel: { atk: 6, crit: 2 }
isekai.ts:509-510   { cost: 90, grant: "cos_isekai" } / { cost: 90, grant: "cos_pixel" }
data.ts:589         CosmeticKey = ... | "cos_isekai" | "cos_pixel"   ← ItemKey 와 별도 유니온
```

`grant`로 직접 해금되므로 인벤토리(`ITEMS`)를 거치지 않는다. **의도된 분리이며 고칠 대상이 아니다.**

### 9-2. 측정 오류 3건 자체 정정 (기록)

검증 중 나온 세 건은 모두 **파서 결함**이었고 데이터 문제가 아니었다. 같은 실수를
반복하지 않도록 남긴다.

1. `cos_isekai`/`cos_pixel` "고아" → 정규식 `^\s{2}key\s*:` 가 이 두 줄만 놓친 오탐.
   `tsc` exit=0 이 이미 전수성 위반이 아님을 보장하고 있었다.
2. `TRADE_PRICES` 에 `tier` 라는 가짜 항목 → 슬라이스 경계를 `export const tradeValue` 로
   잡았으나 실제 선언은 **`export function tradeValue`** 라 파일 끝까지 스캔됨.
3. `TRADE_STOCK` 이 0건 → 배열(`[]`)인데 객체(`{}`) 파서를 적용한 탓.

> 교훈: 데이터 정합성 검사는 **`tsc` 등 컴파일러 검사를 먼저** 돌리고, 파서 결과가
> 컴파일러와 모순되면 파서를 의심한다.