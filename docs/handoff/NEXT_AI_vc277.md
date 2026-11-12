# 다음 AI 작업 지시서 — SERTZ 잔여 작업

작성: 2026-11-11 UTC
기준 커밋: **`ae9f62d2`** (main = origin/main, 작업 트리 클린)
기준 버전: **vc277 / 2.2.21**

---

## 0. 먼저 읽을 것 (순서 고정)

| 순서 | 파일 | 목적 |
|---|---|---|
| 1 | `AGENTS.md` | 저장소 규칙·금지사항 |
| 2 | `worklog.md` (마지막 200줄) | vc270~277 작업 이력과 **실수 기록** |
| 3 | `docs/handoff/CROSSCODE_NEXT_AI.md` | 이전 인계서 |
| 4 | `docs/qa/2026-11-11/crosscode/APPLIED_v276.md` | 이펙트 3단 시점 분리 |
| 5 | `docs/qa/2026-11-11/crosscode/APPLIED_v277.md` | 구역 볼륨 스폰 |
| 6 | `/root/workspace/_keep/ISEKAI_SPUM_REPORT_V2.md` | 참고 게임 구조 조사 (번들 전수 파싱) |

**스토리 변경이 필요할 때만** `docs/handoff/evernote-approved/1.txt`~`8.txt`를 순서대로 읽는다.
다른 스토리 문서를 정본으로 섞지 않는다.

---

## 1. 절대 규칙

1. **운영 DB/암호화키를 초기화하지 않는다.**
2. **인증 토큰·시크릿을 문서·커밋·로그에 남기지 않는다.**
3. **CrossCode / ISEKAI GATE의 코드·이미지·음악을 런타임으로 복사하지 않는다.**
   구조·수치·설계 원칙만 참고한다.
4. 검증 없이 "완료"라고 쓰지 않는다. **실행해서 나온 수치만** 보고한다.
5. 테스트 통과를 목적으로 HP·무적·레벨·시간·진행을 주입하지 않는다.
   (시각 검증에서 `canPlayerAction` 게이트를 여는 것은 허용 — 판정과 무관한 경우만, 주석으로 명시)
6. 변조(probe) 후에는 **반드시 복원하고 `grep`으로 확인**한다. vc277에서 변조가 남아
   측정값이 이식 전과 똑같이 나온 사고가 있었다.
7. 라우트를 추가하면 **`android-build.yml`과 `exe-build.yml` 양쪽** `ROUTE_DIRS`를 고친다.
   vc274~277에서 이걸 놓쳐 빌드가 4번 실패했다.

---

## 2. 현재 상태 (사실만)

### 완료
- vc276: 스킬 이펙트 `_c`/`_Dust`/`_Hit` 3단 시점 분리 (실측 33/100/183ms)
- vc277: 구역 볼륨 스폰 `CreepZone` (실측 ratio 1.25→1.81)
- CI 부팅 검증 `boot-check.yml` (부팅 불가를 실제로 잡는 것 확인)
- APK/EXE 정적 export 격리 목록 동기화 + 재발 방지 테스트

### 검증 수치
- `npm test` **673/673**, `tsc --noEmit` 클린, `lint:strict` 클린, `next build --webpack` EXIT 0
- Boot Check CI success, APK `v2.2.21` / 인증서 `cc774f34…` (vc273·276·277 동일)
- 런타임 에셋 **7,910개** (vc273과 동일)

### 미적용 (이번 지시서의 대상)
- **SPUM 파츠 조합 코디** — 캐릭터 커스터마이징 확장
- **표정 3장 스왑 시스템**
- **`C_`/`P_` 피벗 분리** (회전 애니 재사용)
- 나머지: 실기기 검증, 대규모 스테이지 구역 품질

---

## 3. 작업 A — SPUM 파츠 코디 확장 (최우선)

### 참고 구조 (ISEKAI GATE, 실측 확인됨)
```
Hero_10203
└ C_Actor → P_Actor
  ├ C_Leg_F/B → P_Leg_F/B → Leg_F/B
  └ C_Torso → P_Torso
    ├ C_Arm_F/B → P_Arm_F/B
    ├ C_Head → P_Head → Head_00/01/02   ← 표정 3장 동시 보유
    │   ├ C_Hair_B_00 / C_Hair_B_01 / C_Hair_F / C_SideHair_B / C_SideHair_F
    │   └ C_Ear_B / C_Ear_F
    └ C_Weapon → P_Weapon
```
- `C_` = 컨테이너(빈 노드), `P_` = 피벗(회전 기준점 분리)
- 좌우 대칭이 아니라 **앞/뒤(`_F`/`_B`)**
- 파츠 14종: Hair 387 / Arm 340 / Leg 320 / Head 160 / Torso 158 / Weapon 158 / Hat 129 / Cape 98 / Ear 92 / Wing 48 / Ribbon 32 / String 28 / Apron 20
- `pixelsPerUnit = 1.0`, 캐릭터 실루엣 약 **51×44px**
- **표정 전환 = 같은 좌표에서 스프라이트 스왑** (Head_00/01/02가 동일 위치에 겹쳐 있음)

### 현재 SERTZ 상태
- `src/game/characterAppearance.ts` (61줄) — `CharacterAppearance { cls, gender, skinIdx, outfit, gmSkin, gmApproved }`
- `resolveBodyPrefix()` — 성별+피부 → 몸체 프리픽스. 우선순위: gm → outfit → 직업 전용 → 피부
- `appearanceFrames.json` — 프레임별 crop 메타 (예: `chf0_idle0.webp` crop 34,15,28×40)
- 에셋: `acc_*` (망토·왕관·후광·날개·리본), `outfit_*` (코스튬 시트), `chf*`/`chm*` (몸체)
- **이미 있는 것 (중요)**: `WorldScene`에 `accOverlays` 배열 + `ACC_ANCHORS`(텍스처키 → 앵커 좌표) +
  `syncCosmeticAura()` 가 있다. 액세서리를 매 프레임 플레이어 위치에 붙이고 depth 를 조정한다.
  `~12776` 부근에서 `acc_crown`/`acc_ribbon`/`acc_halo`/`acc_wings_*` 를 각각 분기 처리한다.
  **이미 "부위별 부착"의 원형이 있으므로 새로 만들지 말고 이걸 일반화한다.**
- **한계**: 지금은 **몸체 통짜 시트 + 액세서리 오버레이**. 파츠 단위 조합이 아니고,
  액세서리 분기가 `if (a.key === ...)` 하드코딩이라 종류를 늘리려면 코드를 고쳐야 한다.

### 이번에 할 것 (범위를 좁힌다)
전체 SPUM 이식이 아니라 **"부위별 교체가 가능한 최소 구조"**를 만든다.
핵심은 하드코딩 분기를 **데이터 주도 레이어 목록**으로 바꾸는 것이다.

1. `CharacterAppearance`에 부위 필드 추가 (기존 필드는 유지 — 세이브 호환)
   ```ts
   parts?: {
     hair?: string | null;    // 'hair_f_01' 등
     hat?: string | null;
     cape?: string | null;
     weaponSkin?: string | null;
     face?: "idle" | "happy" | "angry" | null;  // 표정
   } | null;
   ```
2. `resolveBodyPrefix` 옆에 `resolvePartLayers(look)` 추가 —
   그리기 순서(뒤→앞)대로 레이어 배열을 돌려주는 **순수 함수**.
   ```ts
   // 반환 예: [{ key, anchor: 'head'|'torso'|'leg'|'weapon'|'back', dy, depthBias }]
   ```
   순서 규칙: `leg_B → wing_B → cape_B → torso → arm_B → weapon → head → hair_B → face → hair_F → hat → arm_F → cape_F → wing_F`
3. `syncCosmeticAura()` 의 `if (a.key === ...)` 하드코딩을 **`PART_ANCHORS` 데이터 테이블**로 교체.
   기존 `ACC_ANCHORS` 는 유지하고, 새 테이블은 그 위에 얹는다(기존 액세서리 동작 불변).
4. 표정은 `face` 필드로 같은 좌표에서 스왑 — 애니메이션 없이 교체만.
5. 세이브: `parts`는 optional. 없으면 기존 동작(현재와 100% 동일). **구 세이브가 깨지면 안 된다.**

### 하지 말 것
- 몸체 시트를 파츠로 쪼개지 마라. 기존 28프레임 세트와 3·4차 전용 외형이 전부 깨진다.
- 새 그림을 그리지 마라. `acc_*`/`outfit_*`/`chf*`/`chm*`만 쓴다.
- 코디 UI를 크게 만들지 마라. 이번엔 **렌더 파이프라인**이 목표다.
- `accOverlays` 의 기존 depth 규칙(`player.depth ± 0.2/0.3`)을 깨지 마라.
  날개는 `depth-0.2`(항상 뒤), 나머지는 `+0.3`. 이건 v1.3.0 에서 고친 회귀다.

### 검증 (필수)
- `tests/part-layers.test.mjs` 신규: 그리기 순서 고정, 미지정 시 기존 동작, 구 세이브 호환
- 브라우저: 코디 착용 전/후 스크린샷 + **레이어 순서를 DOM이 아니라 픽셀로** 확인
  (캐릭터 중심 crop 후 부위별 색 분포 비교)
- `npm test`, `tsc`, `lint:strict`, `next build --webpack` 전부 통과

---

## 4. 작업 B — 대규모 스테이지 구역 품질 (중간)

vc277의 알려진 한계를 닫는다.

- 1-1은 **8마리/2종족**이라 표본이 작다. 20마리 이상·3종족 이상 스테이지에서 ratio를 재측정.
- `splitCreepZones`의 보로노이 분할이 불균등(6구역 → cells 18/23/11/7/3/2).
  **k-means 스타일 반복**(중심 재계산)으로 균등화 검토. 단 결정론은 유지.
- 목표: 3종족 스테이지에서 ratio ≥ 1.5, 종족별 반경 편차 ≤ 30%.
- 측정 스크립트는 `scripts/playtest-creep-zone.mjs` 재사용. 여러 스테이지를 순회하도록 확장.

---

## 5. 작업 C — 실기기 검증 (사용자만 가능)

에이전트가 할 수 없다. **사용자에게 넘길 체크리스트**만 작성하라.

- 기기: Galaxy S20+
- 확인: 스킬 3단 이펙트가 "차고→내려찍고→터진다"로 읽히는가 / 근접 다수전 가독성 /
  구역별 종족이 눈에 구분되는가 / 발열·프레임
- 산출물: `docs/qa/<날짜>/device-check.md` (사용자가 채운다)

---

## 6. 빌드·배포 절차 (반드시 이 순서)

```bash
# 1. 버전 범프 (build.gradle 이 단일 출처)
#    versionCode +1, versionName +0.0.1
node scripts/sync-android-version.mjs

# 2. package.json / package-lock.json 도 같은 버전으로 (테스트가 검사한다)

# 3. 전체 검증
npx tsc --noEmit
npm run lint:strict
npm test
npx next build --webpack

# 4. 커밋·푸시 (main 만)
git push origin main

# 5. GitHub Actions 가 자동 실행: Android / EXE / Boot Check / Verify
gh run list --limit 4

# 6. 릴리스 자산·SHA·인증서 확인
git rev-parse HEAD && git ls-remote origin main
gh release view v<버전> --json assets -q '.assets[].name'
```

**버전을 올리지 않으면 기존 릴리스 자산을 덮어쓴다.**

---

## 7. 함정 (이번 세션에서 실제로 밟은 것)

| 함정 | 증상 | 대응 |
|---|---|---|
| Turbopack dev | inotify 한계로 죽음 | `next build --webpack` + `next start` |
| `next start` | `os.networkInterfaces()` 실패 | `-H 127.0.0.1` 필수 |
| `.env.local` 미로드 | `SERTZ_BACKUP_KEY 미설정` 경고 다수 | `set -a && . ./.env.local && set +a` |
| 백그라운드 서버 | 세션 정리 시 종료 | `persist_on_release: true` |
| Playwright 경로 | `.hermes/cache` 는 vision 도구가 못 봄 | `/root/workspace` 로 복사 |
| `useSkill1` 계측 | 1차 직업은 시그니처 분기로 `spawnSkillImpact` 미도달 | `__SERTZ__` 훅으로 직접 호출 |
| 튜토리얼 게이트 | `canPlayerAction()` false 로 스킬 미발동 | 게이트만 해제(판정과 무관), 주석 명시 |
| `ubuntu-latest` | 기존 테스트 2건 실패 | `ubuntu-24.04` 로 핀 |
| 라우트 추가 | APK/EXE 빌드 실패 | **두 워크플로** `ROUTE_DIRS` 동시 수정 |
| probe 변조 | 측정값이 이식 전과 동일 | 복원 후 `grep -c PROBE` 확인 |
| vision 판독 | GM 버튼 오판(환각) | **DOM·픽셀 교차 검증** 필수 |

---

## 8. 산출물 규칙

- 작업마다 `worklog.md`에 **실패한 시도도** 기록한다 (다음 AI가 같은 길을 안 가도록).
- QA 문서: `docs/qa/<날짜>/` 아래. 적용 내용은 `APPLIED_v<code>.md`.
- 수치는 **측정값 + 측정 방법**을 같이 쓴다. "개선됨"만 쓰지 않는다.
- 못 한 것은 "못 했다"고 쓴다.

---

## 9. 시작 체크리스트

```
[ ] git status 클린 확인
[ ] git fetch origin && git rev-parse HEAD == origin/main 확인
[ ] AGENTS.md 읽기
[ ] worklog.md 마지막 200줄 읽기
[ ] npm ci (node_modules 없으면)
[ ] npx tsc --noEmit 로 기준선 확인
[ ] npm test 로 673/673 기준선 확인
```

기준선이 673이 아니면 **먼저 원인을 밝혀라**. 그 상태로 작업하면 회귀를 못 잡는다.
