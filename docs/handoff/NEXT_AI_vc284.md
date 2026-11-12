# 다음 AI 작업 지시서 — SERTZ 잔여 작업 (vc283 이후)

> 기준 커밋: `56865f3e` (main, origin 동기화 완료) · 버전 **vc283 / 2.2.25**
> 작성 근거: 이 세션에서 실제로 `git grep`·`ls`·테스트 실행으로 확인한 값만 적었다.
> 원칙: **최적화하되 퀄리티는 깎지 않는다.** 낭비 제거로만 성능을 얻는다.

> **주의 — `56865f3e` 가 기록전 종료 경로를 추가로 고쳤다.**
> 다른 세션(Claude)이 vc283 직후에 올린 커밋이다. 같은 영역을 건드렸으므로
> 작업 전 `git show 56865f3e` 로 무엇이 바뀌었는지 먼저 읽는다.
> 특히 **APK/EXE 자동 빌드가 제거됐다**(7절 참조).

---

## 0. 먼저 읽을 것 (순서 고정)

1. `AGENTS.md` — 저장소 규칙. **코드 변경 전 필수.**
2. `worklog.md` 마지막 두 Task(`vc283`, `vc283 후속`) — 직전 작업과 그 한계.
3. `docs/handoff/CURRENT_HANDOFF.md` — 반드시 지킬 사용자 지시(정본 8개·이야기 규칙).
4. 이 문서.

`docs/handoff/MERGE_BCBCD2D.md` 는 **역사 기록**이다. 거기 "남은 문제"로 적힌
보스 기록전 3건은 vc283 에서 처리됐다. 재작업하지 않는다.

---

## 1. 절대 규칙

| # | 규칙 | 이유 |
|---|---|---|
| 1 | **실행해서 나온 수치만 보고한다.** 추정·기대값을 결과처럼 쓰지 않는다. | 이전 세션에서 "PASS" 를 추정으로 쓴 사고가 있었다. |
| 2 | 검증용 프로브(`[PROBE]`·임시 분기)를 넣었으면 **복원 후 `git grep` 으로 0건 확인**한다. | 프로브 켠 채 측정해 AFTER==BEFORE 가 나온 사고가 있었다. |
| 3 | 저장 필드를 추가하면 **`SaveData` + 복원 + `buildSave` 를 함께** 고친다. | 필드만 추가하면 재접속 시 사라진다. |
| 4 | 씬 전환은 **`startTransition()` 한 통로**만 쓴다. | 직접 `scene.start()` 는 로딩·세이브 가드를 우회한다. |
| 5 | 커밋·푸시는 **`apple01234/CERTZ` main 만**. 다른 저장소 금지. | 사용자 지시. |
| 6 | 버전 범프는 **`build.gradle` 이 단일 출처**. `package.json`·`package-lock.json` 도 같이 올린다. | 테스트가 세 곳 일치를 강제한다. |
| 6-1 | **빌드(APK/EXE/웹 프로덕션)는 유저가 하라고 할 때만 한다.** 빌드를 안 하는 동안에는 **버전도 올리지 않는다.** | 2026-11-12 유저 지시(AGENTS.md). 없는 설치 파일을 가리키게 된다. |
| 7 | **에셋 신규 생성 금지.** 원본/사용자 자료/다운로드 우선. | 사용자 지시. 텍스처 재활용·틴트로 해결한다. |
| 8 | **Godot 으로 가지 않는다.** Phaser 4 + Next.js 유지. | 사용자가 Godot 전환을 폐기했다. |

---

## 2. 현재 상태 (사실만)

### 검증된 수치 (현재 main = `56865f3e`)

| 항목 | 값 | 확인 방법 |
|---|---|---|
| 전체 테스트 | **746 / 746 pass, 0 fail** | `npm test` |
| 타입 | `tsc --noEmit` EXIT 0 | — |
| 린트 | `eslint src --max-warnings 0` EXIT 0 | — |
| 프로덕션 빌드 | `next build --webpack` 성공 (41s) | vc283 시점 |
| 버전 | vc283 / 2.2.25 | `android/app/build.gradle` |
| 런타임 에셋 | 7,910개 | vc273 과 동일 |

### vc283 + `56865f3e` 에서 완료된 것 (재작업 금지)

- **vc283** — 기록전 입장: 전용 경기장 `contest`, 카운트다운 → 서버 `start` → 고정 `guardian`, 중도 이탈 `abandoned` 보고, 실제 타격/피해 집계(`Boss.onLandedHit`).
- **`56865f3e`** — 기록전 종료: 시간 초과/포기/사망 시 보스를 먼저 치운 뒤 복귀(경기장 갇힘 해소), 사망 즉시 `failed` 보고 + 사망 패널티 면제, 제출 재전송(`submitWithRetry`), `contest:start` 리스너 누수 해제, 파티 체력 공유·조우 컷신·GM 체험 보상 없이 독립 판.
- 테스트 9건 추가(`tests/boss-contest-exit.test.mjs` 85행 등).

### 이번 지시서의 대상 (실측으로 확인한 미완성)

| 항목 | 실측 상태 | 근거 |
|---|---|---|
| **파츠 슬롯 배선** | `characterParts.ts` 의 `CharacterParts`·`PART_DRAW_ORDER` **사용처 0건** | `grep -rn "CharacterParts\|PART_DRAW_ORDER" src/` → 정의 파일 외 0 |
| **코디 에셋** | `acc_*` **7종뿐** (crown/ribbon/halo/wings×2/cape×2) | `ls public/assets/ \| grep -c "^acc_"` → 7 |
| **표정 스왑** | `npcface/` **24장**(7종족×3표정) 있으나 **NPC 대사창 전용** | `DialogueBox.tsx:134` — 플레이어 표정 경로 없음 |
| **`face` 슬롯** | `PART_DRAW_ORDER` 에 이름만 있고 배선 없음 | 위와 동일 |

**핵심**: `characterParts.ts` 는 **설계도만 있고 시공이 안 된 상태**다.
타입(`CharacterParts`)·순서(`PART_DRAW_ORDER`)·앵커(`PartAnchor`)·계산(`placePart`)은
갖춰져 있고, 실제로 쓰이는 건 `PART_ANCHORS`(장식 7종)뿐이다.

**오해 주의 — 세이브 필드는 이미 있다.**
`src/game/config.ts` 의 `PlayerSave` 에 다음이 **이미 정의·마이그레이션·저장되고 있다**:

| 필드 | 줄 | 현재 쓰임 |
|---|---|---|
| `outfit?: string \| null` | 215 | 코스튬 — 렌더 경로 있음 |
| `hair?: string \| null` | 216 | **저장만 되고 렌더 없음**(포니테일 v1.2.0 폐지) |
| `lookTint?: number \| null` | 218 | 로비 색조 |
| `gender?: "m" \| "f"` | 219 | 남/여 |
| `skinIdx?: number` | 225 | 피부 0~5 |

즉 "세이브에 파츠 필드를 새로 추가" 하는 일이 **아니다.** `hair` 는 이미 저장되는데
그리는 코드가 없어서 **넣어도 화면에 안 나오는** 상태다. 배선이 빠진 것이다.
새 필드(`parts`)를 만들지 말고 **기존 `hair`/`outfit` 을 렌더에 연결**하는 쪽이 맞다.

---

## 3. 작업 A — 파츠 슬롯 실제 배선 (최우선)

### 목표

`CharacterParts` 를 세이브에 저장하고, `hair`·`hat`·`cape`·`face` 를 실제로 그린다.
**새 에셋을 만들지 않고** 이미 있는 것만 쓴다.

### 3-1. 왜 이게 최우선인가

지금 코디는 두 계통이 따로 논다.

| 계통 | 저장 | 렌더 | 상태 |
|---|---|---|---|
| `COSMETIC_DEFS` (오라 20+종·코스튬 10종) | `save.cosmetics: string[]` | 오라 렌더러 / 코스튬 스프라이트 교체 | ✅ 완성·사용 중 |
| `CharacterParts` (hair/hat/cape/face) | 없음 | 없음 | ❌ **타입만 존재** |

사용자가 코디를 요청하면 실제로는 첫 번째 계통만 만족한다. 두 번째를 붙이면
"모자·망토·머리·표정" 이라는 **새 축**이 열린다. 이게 남은 작업 중 가장 값이 크다.

### 3-2. 설계 (기존 구조를 깨지 않는다)

1. **저장**: **새 필드를 만들지 않는다.** `hair`·`outfit` 은 `PlayerSave` 에 이미 있고
   마이그레이션(`config.ts` 515행 부근)도 이미 정규화한다.
   - 확인: `if (d.outfit === undefined) d.outfit = null;`, `d.hair` 환수 처리(v1.2.0).
   - `CharacterParts` 타입은 **런타임 뷰(view)** 로만 쓴다 —
     `toCharacterParts(save)` 같은 순수 함수로 `PlayerSave` → `CharacterParts` 변환.
     저장 스키마를 두 벌로 만들면 복원·클라우드 동기화에서 어긋난다.
2. **렌더**: `WorldScene` 의 `accOverlays` 와 **같은 경로**를 쓴다.
   - 이미 `placePart(spec, {...})` 가 있고 `PART_ANCHORS` 를 lookup 한다.
   - `characterParts.ts` 의 `PART_ANCHORS` 에 `hair`·`hat`·`cape_*` 스펙을 **추가**한다.
     - `cape_crimson`/`cape_royal` 은 이미 있으니 **재사용**, 새로 만들지 않는다.
   - `PART_DRAW_ORDER` 순서대로 정렬해 그린다(뒤→앞). 지금은 추가 순서대로 그려서
     모자가 망토 위로 오는 등 z-order 가 어긋날 수 있다.
3. **해금 경로**: `COSMETIC_DEFS` 에 `slot` 필드를 이미 쓰고 있다(`outfit_*` 이 `slot: "outfit"`).
   같은 방식으로 `slot: "hat" | "cape"` 를 주면 상점·보상 경로가 그대로 재사용된다.
   **새 상점 UI 를 만들지 않는다.**

### 3-3. 에셋 현실 (여기서 범위를 좁힌다)

실제로 있는 것:

```
acc_crown.webp  acc_ribbon.webp  acc_halo.webp
acc_wings_devil.webp  acc_wings_fairy.webp
acc_cape_crimson.webp  acc_cape_royal.webp      ← 7종
npcface/{elf,knight,mage,merchant,priest,smith,villager}_{neutral,happy,angry}.png  ← 24장
spum_*.webp  ← 14종 (NPC 본체)
```

**없는 것**: 플레이어용 `hair_*`(포니테일은 v1.2.0 에서 폐지됨), `hat_*`, `face_*`(플레이어용).

따라서 **1단계 범위**는 이렇게 잡는다.

| 슬롯 | 이번에 할 것 | 근거 |
|---|---|---|
| `cape` | ✅ 배선 완료 — `acc_cape_*` 2종을 슬롯으로 승격 | 에셋 있음 |
| `hat` | ✅ `acc_crown`·`acc_ribbon`·`acc_halo` 를 hat 슬롯으로 | 에셋 있음 |
| `face` | ⚠️ **보류 권장** — 플레이어 얼굴 에셋이 없다 | `npcface` 는 NPC 전용 |
| `hair` | ⚠️ **보류 권장** — 플레이어 헤어 에셋이 없다 | 폐지됨 |

`face`/`hair` 를 억지로 하려면 에셋 생성이 필요한데 **규칙 7 위반**이다.
지시서는 **`cape` + `hat` 승격**까지만 요구한다. 이건 순수 배선이라 새 에셋 0.

### 3-4. 하지 말 것

- `accOverlays` 를 새 배열로 갈아엎지 말 것. **확장**한다.
- `if (a.key === "acc_crown")` 같은 하드코딩을 **되살리지 말 것**. vc278 에서 데이터 테이블로 바꾼 걸 되돌리는 짓이다.
- 플레이어 얼굴/헤어를 **AI 생성하지 말 것**.
- 코디 상점 UI 를 **새로 만들지 말 것**. 기존 `COSMETIC_DEFS` 경로를 쓴다.

### 3-5. 검증 (필수)

```bash
# 1. 타입·린트
npx tsc --noEmit && npx eslint src --max-warnings 0

# 2. 회귀 — 파츠 z-order 와 앵커는 기존 테스트가 legacy 참조 구현과 대조한다
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
  --test tests/part-layers.test.mjs

# 3. 세이브 왕복 — hair/outfit 이 저장·복원되는지
#    (기존 tests/save-migration.test.mjs 에 케이스를 추가한다)
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
  --test tests/save-migration.test.mjs

# 4. 전체
npm test
```

**보고 기준**: `tests/part-layers.test.mjs` 가 이미 "legacy 분기와 수치 동일" 을
고정하고 있다. 슬롯을 추가해도 이 테스트가 깨지면 **계산식이 틀린 것**이다.

---

## 4. 작업 B — 지역별 로딩 실측 (중간)

### 목표

`ensureWorldAssets` 의 지역별 선택 로딩이 **실제로 몇 초를 아끼는지** 숫자로 남긴다.

### 왜

vc279 에서 초기 에셋 동시 요청을 6→24 로 올렸다(평가 92초 로딩 대응).
그런데 **어느 지역에서 몇 초 걸리는지 측정값이 worklog 에 없다.** 회귀를 잡으려면 기준선이 필요하다.

### 할 것

1. 브라우저 계측 스크립트로 지역 3~5곳의 로딩 시간을 잰다.
   - 기존 `scripts/playtest-*.mjs` 패턴을 재사용한다.
2. 결과를 `docs/qa/<날짜>/loading/` 에 JSON 으로 남긴다.
3. 24 동시 요청이 실제로 이득인지, 아니면 저사양에서 역효과인지 **숫자로 판정**한다.

### 제약

이 컨테이너에서는 **브라우저 기동이 안 된다**(아래 6절 참조). 실기기나 다른 환경에서 한다.
측정 못 했으면 **"못 했다"고 쓴다.** 추정치를 쓰지 않는다.

---

## 5. 작업 C — 실기기 검증 (사용자만 가능)

`docs/APK_DEVICE_CHECKLIST.md` 를 그대로 실행한다. 20분.

이번에 추가된 확인 항목:

| 항목 | 기대 |
|---|---|
| 기록전 입장 | 경기장으로 전환 → 3·2·1 카운트다운 → 보스 등장 |
| 기록전 종료(`56865f3e`) | 시간 초과·포기·사망 시 경기장에 갇히지 않고 보스가 먼저 정리된 뒤 복귀 |
| 기록전 사망 | 즉시 failed 보고, 사망 패널티 없음 |
| S20+ 발열 | 30분 플레이 후 발열·프레임 저하 확인 |

**이 항목은 AI 가 닫을 수 없다.** 체크 결과만 사용자에게 받아 worklog 에 적는다.

---

## 6. 이 컨테이너의 알려진 제약 (삽질 금지)

이 환경에서 **확인된 실패**다. 같은 시도로 시간을 쓰지 말 것.

| 시도 | 증상 | 원인 |
|---|---|---|
| `node server.js` | `OS file watch limit reached` → Turbopack panic | `/proc/sys/fs/inotify/max_user_watches` 조회·설정 **권한 없음(Permission denied)** |
| `npx next start` | `uv_interface_addresses` EACCES → 즉시 종료 | 네트워크 인터페이스 조회 권한 없음 |
| `ps` | `Unable to get system boot time` | 컨테이너에 `/proc/stat` 부팅시간 없음 |
| `du` (git pack) | `Operation not permitted` | `.git/objects/pack` 이 심볼릭 링크(LFS) |

**대안**: 검증은 `npm test`(Node 테스트)로 한다. Phaser 씬 내부는 **소스 계약 테스트**로 고정한다
(`tests/boss-contest-flow.test.mjs` 가 그 예 — 정규식으로 배선을 검사).

```bash
# Phaser 없이 서버 스토어 계약을 실제로 돌리는 예 (vc283 에서 씀)
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
  --test tests/boss-contest-entry.test.mjs
```

---

## 7. 빌드·배포 절차

> **중요 (`56865f3e` + AGENTS.md 2026-11-12 유저 지시)**
> - **빌드(APK/EXE/웹 프로덕션)는 유저가 하라고 할 때만 한다.**
> - main 푸시 트리거 자동 빌드는 **꺼져 있다**(`android-build.yml`·`exe-build.yml` 의 `push:` 제거). 수동 실행만 남았다.
> - **빌드를 안 하는 동안에는 버전 6곳도 올리지 않는다.** 안 그러면 없는 설치 파일을 가리킨다.
> - 커밋·푸시는 계속한다. 빌드만 멈춘 것이다.

### 평상시 (빌드 요청 없을 때)

```bash
npx tsc --noEmit
npx eslint src --max-warnings 0
npm test
git add -A && git commit -m "vcNNN: ..." && git push origin main
# 버전 범프 없음 · 빌드 없음
```

### 유저가 빌드를 요청했을 때만

```bash
# 1. 버전 범프 — build.gradle 이 단일 출처
#    versionCode +1, versionName +0.0.1
#    주석에 이번 변경 요약을 남긴다 (기존 관례)

# 2. 나머지 버전 싱크 (AGENTS.md 기준 6곳)
#    android/app/build.gradle · server.js · next.config.ts
#    public/apk-guide.html · download/APK_다운로드_안내.txt · Overlays.tsx 배지
node scripts/sync-android-version.mjs   # android-version.json
#    package.json / package-lock.json 도 같은 버전으로 (테스트가 강제)

# 3. 검증
npx next build --webpack

# 4. 수동 실행 — 푸시해도 자동으로 안 돈다
gh workflow run android-build.yml
gh workflow run exe-build.yml
gh run list --limit 3

# 5. 릴리스 자산·SHA·인증서 확인
```

**함정**: `versionCode` 를 안 올리고 빌드를 돌리면 GitHub Release 의 **기존 자산을
clobber 로 덮어쓴다.** 빌드할 때는 반드시 먼저 올린다.

**함정 2**: vc283 은 `7efde475` 에서 푸시됐고 그때는 자동 빌드가 살아 있었다.
지금은 꺼져 있으므로 "푸시했는데 릴리스가 없다" 를 버그로 오해하지 않는다.

---

## 8. 함정 (실제로 밟은 것)

| 함정 | 증상 | 대응 |
|---|---|---|
| 얕은 클론의 `origin/main` | `ahead 1, behind 10` 오표시 | `git ls-remote origin refs/heads/main` 로 실제 SHA 확인 후 `git update-ref` |
| 로컬 HEAD 가 원격과 갈라짐 | `reset --hard` 시 작업 유실 | 백업 브랜치 먼저 생성 |
| 정규식 계약 테스트 | 함수에 주석 한 줄 추가해도 깨짐 | `{0,1600}` 같은 **길이 상한 쓰지 말고** 함수 경계(`\n  }\n\n  /**`)로 자른다 |
| 테스트가 옛 구현을 고정 | 구현을 고치면 테스트가 실패 | **테스트가 틀린 것**인지 **구현이 틀린 것**인지 먼저 판정한다. vc283 에서는 테스트가 옛 계약(현재 지역 보스)을 고정하고 있어 테스트를 갱신했다 |
| `if (this.boss) return;` | TS 가 이후 `this.boss` 를 `never` 로 좁혀 필드 접근 차단 | 지역 변수 `const existing: Boss \| null = this.boss;` 로 우회 |
| worklog 에 추정치 기재 | 다음 AI 가 사실로 신뢰 | **못 한 것은 "못 했다"고 쓴다** |

---

## 9. 산출물 규칙

- 코드 변경 → `worklog.md` 에 `## Task — <날짜> vcNNN` 섹션 추가.
  - 무엇을·왜·검증 수치·**못 한 것** 을 반드시 구분해서 쓴다.
- 브라우저/실기기 검증 → `docs/qa/<날짜>/<주제>/APPLIED_vcNNN.md`.
- 테스트 추가 → 기존 파일 이름 관례를 따른다(`tests/<주제>-<성격>.test.mjs`).

---

## 10. 시작 체크리스트

```bash
cd /root/workspace/CERTZ
git log --oneline -1                  # 56865f3e 인지 확인
git status --short                    # 비어 있어야 한다
git ls-remote origin refs/heads/main  # 로컬 HEAD 와 일치 확인
npm test                              # 746/746 기준선 확인
# 버전·빌드는 건드리지 않는다 (유저 요청 시에만)
```

기준선이 다르면 **먼저 왜 다른지 확인**하고 사용자에게 알린다. 그 위에서 작업하지 않는다.

---

## 부록 — 이번 세션에서 실제로 쓴 명령

```bash
# 기준선 확인
npm test 2>&1 | grep -E "^not ok|^# (tests|pass|fail)" -A4

# 파츠 배선 상태 확인 (사용처 0 이면 미배선)
grep -rn "CharacterParts\|PART_DRAW_ORDER" src/ --include=*.ts --include=*.tsx

# 코디 에셋 실물 확인
ls public/assets/ | grep -cE "^acc_"

# 표정 에셋 확인
ls public/assets/npcface/ | wc -l

# 대상 테스트만 빠르게
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \
  --test tests/boss-contest-flow.test.mjs
```
