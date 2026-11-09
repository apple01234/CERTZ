# SERTZ — 남은 작업 프롬프트 (vc291 이후)

> 기준 커밋: `4bd71f0d` (main, origin 동기화 완료)
> 작성 근거: REA 정적 분석 리포트(`/root/workspace/re_dump/REPORT.md`) + SERTZ 실코드 대조
> 원칙: 최적화하되 퀄리티는 깎지 않는다. 낭비 제거로만 성능을 얻는다.

---

## 0. 이번 세션에서 이미 처리한 것 (재작업 금지)

| 항목 | 상태 | 근거 |
|---|---|---|
| ISEKAI GATE 코드/메타데이터 분석 | 완료 | `re_dump/REPORT.md` — IL2CPP 134MB 암호화 블롭, 정적 추출 불가 판정 |
| isekai.ts 17개 섹션 (피규어/배지/룬/성좌/게이트디펜스/출석/업적/칭호/역할/조각상점) | **기존 이식 완료** | `src/game/isekai.ts` 581줄, `WorldScene.ts:6809`에서 `computeExtBonus` 배선 |
| Gigapack UI 심볼 38종 + 애니 76종 | 완료 | 커밋 `4bd71f0d`, `public/assets/ui_sym/`, `public/assets/fx/symbol-*` |
| 랭킹 1~3위 이모지 → 픽셀 메달 | 완료 | `Panels.tsx` |
| Gigapack 나머지 127종(폭발/마법) | **의도적 제외** | 기존 pixelfx 142종과 중복. `tools/import_gigapack.py`로 언제든 재추출 가능 |

---

## 1. [높음] 랭킹 필터 등급 아이콘 배선 — 미완성 CSS 마감

**문제**: `src/app/globals.css`에 선행 세션이 `.sertz-sym` / `.sertz-sym-place` / `.sertz-sym-rank`
CSS를 추가했으나 **사용처가 0인 죽은 코드**다. 게다가 배경 폭 계산이 틀렸다.

- CSS 가정: `--sym-w: 1200px` (60프레임 × 20px)
- 실제 시트: **4800px** (60프레임 × 80px)
- → 그대로 쓰면 프레임이 4분의 1 지점까지만 진행하고 끝난다.

**할 일**
1. `globals.css`의 vc291 블록을 실제 시트 규격에 맞춰 고친다.
   - `--sym-w`는 원본 4800px, 표시 크기는 `background-size`로 축소.
   - `steps(59)` + `forwards`는 유지(60프레임에서 마지막 프레임 정지).
   - `prefers-reduced-motion` 폴백도 종료 위치 유지.
2. 실제로 쓸 곳을 정한다. 후보: 랭킹 패널의 정렬/필터 버튼, 업적 등급 표시.
   **쓸 곳이 없으면 CSS를 삭제**한다(죽은 코드 방치 금지).
3. `npm run lint:strict`로 미사용 규칙이 걸리지 않는지 확인.

**검증**: 아이콘이 20px에서 또렷하고(4배 축소 → NEAREST 필수), 2.4초 후 마지막 프레임에서
멈추는지. `prefers-reduced-motion` 켠 상태에서도 숫자가 완성된 상태로 보이는지.

---

## 2. [높음] 보스 러시 모드 — REA에서 확인된 미이식 시스템

**근거**: ISEKAI GATE 식별자에서 `BossRushModeIngamePlayerLevelUpHandler`(255개 Mode 계열 중).
보스 연속전 + **인게임 레벨업** 구조. SERTZ에는 `bossRush` 문자열이 0건.

**할 일**
1. `src/game/` 에 `bossRush.ts` 신설 — 데이터+순수 계산만(Phaser 의존 금지, `isekai.ts` 패턴 준수).
   - 웨이브별 보스 편성, 웨이브 간 인게임 레벨업(3택1 강화), 런 단위 정산.
2. 기존 보스 9종(`bossDesign.ts`, `bossPhases.ts`)을 재사용한다. **신규 보스 아트 제작 금지.**
3. `WorldScene` 진입점 + 결과 패널. 보상은 기존 재화 체계(조각/에메랄드)만 사용.
4. 세이브 필드는 `config.ts` 규칙 준수 — 필드 의미/단위 변경 시 `SAVE_VERSION` 증가 +
   `migrateSave()`. 단순 추가 필드는 가드만.

**검증**: 웨이브 3/5/10 클리어 시 레벨업 선택지가 실제로 스탯에 반영되는지,
런 종료 후 세이브/재접속에서 최고 기록이 유지되는지.

---

## 3. [중간] 우편함(Mailbox) — 미이식

**근거**: REA 번들 한국어 텍스트 `우편이 없습니다.` 확인. SERTZ `mailbox` 0건.

**할 일**
- 서버 없이 동작하는 **로컬 우편함**부터. 보상 지급이 서버 시간에 의존하면 안 된다
  (오프라인/APK 첫 실행에서도 떠야 함 — `loadMapOverrides`가 throw하지 않는 패턴 참고).
- 용도: 시즌 패스 소급 보상, 점검 보상, 업적 미수령분 회수.
- UI는 기존 `Panels.tsx` 패널 패턴 재사용. 신규 디자인 금지.

**검증**: 수령 후 재접속 시 중복 수령이 불가능한지(idempotent).

---

## 4. [중간] 백팩 배치형 이벤트 — 미이식

**근거**: 식별자 `BackpackEventBagCandidateItem`, `BackpackPlacedItem`.
인벤토리에 아이템을 **배치**해 시너지를 만드는 이벤트. SERTZ에는 드래그앤드롭 인벤토리 없음
(`onDragStart` 0건, `draggable`은 전부 `false`).

**할 일**
1. 격자 배치 + 아이템별 인접 시너지 규칙을 데이터로 정의(`backpack.ts`).
2. 터치 환경 우선 — S20+ 실기기에서 드래그가 스크롤과 충돌하지 않아야 한다.
   `TouchControls.tsx`의 입력 게이트 규약을 따른다.
3. 성능: 아이템 100개 배치 시 리렌더가 프레임을 깎지 않도록 계산을 순수 함수로 분리.

**검증**: 드래그 중 화면 스크롤이 잠기는지, 배치 변경 시 시너지 합계가 즉시 갱신되는지.

---

## 5. [낮음] JENNY(Godot) 소스에서 가져올 만한 것 — 선별

**근거**: `/root/workspace/reference/JENNY-godot-src` (800 GDScript, 470 tscn, Godot 4.6.1).
**Godot 전환은 폐기됐으므로 코드 이식이 아니라 "설계만" 참고한다.**

가치 있는 후보만:
- `system/save_system.gd` — `PersistSave` 그룹 노드만 골라 저장하는 구조.
  SERTZ 세이브가 단일 객체인 것과 대비된다. **부분 저장**이 필요한지 검토만.
- `world/buffs/` — 버프를 `.tscn` 리소스로 분리(`damage_on_end`, `heal_over_time_effect` 등).
  SERTZ `statusEffects.ts`가 이미 유사하므로 **중복 이식 금지**, 누락된 효과 유형만 확인.
- `ui/ui_shaker.gd`, `jiggle_node_2d.gd` — 연출 커브. SERTZ `shakeScale.ts`와 비교 후
  더 좋은 커브만 채택.

**하지 말 것**: Godot 씬/스크립트를 그대로 옮기는 작업. 엔진이 다르다.

---

## 6. [기술부채] 기존 테스트 실패 10건 — 이번 세션에서 손대지 않음

변경 전 기준선과 동일하게 실패 중. **제 변경과 무관함을 stash 대조로 증명했다.**

| 번호 | 내용 |
|---|---|
| 131~133 | 프롤로그 cinematic:state 계약 (HUD 플래그) |
| 220~221 | 아틀라스 프레임 셀 스케일 / 프레임 띠 오버레이 |
| 293~296 | 라일락 초상화 매핑 (아리스텔라, 나레이터, npc_ 참조 완전성) |
| 497 | Vercel 프로젝트 바인딩 커밋 |

**할 일**: 위 10건을 하나씩 원인 판정. 4번(초상화)은 실제 게임 버그일 가능성이 높으므로
먼저 본다. 497(Vercel)은 배포 설정이라 사용자 확인이 필요할 수 있다.

---

## 7. [릴리스] 배포 전 체크 — 유저 지시 사항

- **반드시** `android-version.json`의 `versionCode`를 +1, `versionName`을 +0.0.1 올린다.
  안 올리면 기존 릴리스 자산을 clobber로 덮어쓴다.
  현재값: `{"code": 261, "name": "2.2.5"}` → `262 / 2.2.6`
- APK는 GitHub Actions(`.github/workflows/android-build.yml`)가 `android/**` 푸시로 자동 빌드.
  서명키 4종 Secret 등록돼 있음. Release에 `SERTZ-vc{code}.apk`로 첨부된다.
- 실기기 검증은 **Galaxy S20+** 기준. PC 헤드리스 수치로 판단하지 않는다.

---

## 우선순위 요약

| 순위 | 작업 | 근거 강도 | 예상 규모 |
|---|---|---|---|
| 1 | 랭킹 등급 아이콘 CSS 마감(또는 삭제) | 확실(죽은 코드 + 계산 오류) | 소 |
| 2 | 보스 러시 모드 | 확실(REA 식별자) | 대 |
| 3 | 우편함 | 확실(번들 텍스트) | 중 |
| 4 | 백팩 이벤트 | 확실(식별자 2종) | 중~대 |
| 5 | JENNY 설계 참고 | 선별 필요 | 소 |
| 6 | 기존 테스트 10건 | 확실(재현됨) | 중 |
| 7 | 릴리스 버전 범프 | 규칙 | 소 |

---

## 참고: 재현 명령

```bash
cd /root/workspace/CERTZ
npx tsc --noEmit                  # 타입 24초, 에러 0 목표
npm test                          # 499 pass / 10 fail 이 기준선
npm run lint:strict               # CI 강제용
python3 tools/import_gigapack.py --all    # Gigapack 재추출(필요 시)
python3 tools/bake_symbol_icons.py --all  # UI 아이콘 재굽기
```

## 참고: 자산 출처 원칙

`public/assets/CREDITS.md`에 팩별 라이선스를 적는다. Gigapack은 상업적 이용 가능 +
크레딧 요청이며 vc290 항목으로 표기 완료. 새 팩을 넣을 때는 **먼저 license.txt를 읽고**
상업적 이용/재배포 조건을 확인한 뒤 넣는다.
