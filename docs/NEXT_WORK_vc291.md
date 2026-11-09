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

## 1. [높음] 랭킹 필터 등급 아이콘 배선 — ✅ 해결됨 (vc291)

**당시 문제**: `globals.css` 의 `.sertz-sym*` CSS 가 사용처 0인 죽은 코드였고,
`--sym-w: 1200px` 계산도 실제 시트(4800px)와 어긋났다.

**현재 상태 (검증: `git grep sertz-sym` → 0건)**
- 죽은 CSS 블록은 **삭제됐다.**
- `public/assets/ui_sym/` 38종은 랭킹 1~3위 메달로 **실제 사용 중**이다.
  `Panels.tsx:4582` — `symbol-place-1st/2nd/3rd-*.png`, `imageRendering: "pixelated"`.
  이모지(👑🥈🥉)를 픽셀 메달로 바꾼 것으로, 기기마다 이모지 크기·색이 튀던 문제가 해소됐다.
- `symbol-place-*` 는 애니가 아니라 **1프레임으로 구운 정적 PNG** 라
  `steps()` 배경 애니메이션 자체가 필요 없었다. 그래서 CSS 를 지운 것이 정답이었다.

**재작업 금지.**

---

## 2. [완료·정정] 보스 러시 — 코드는 다 있고 **진입 버튼만 없었다**

**근거**: ISEKAI GATE 식별자에서 `BossRushModeIngamePlayerLevelupHandler`(255개 Mode 계열 중).

**vc291 에서 실제로 일어난 일 (기록)**
- `bossRush.ts`(321줄) + `BossRushPanel.tsx`(259줄) + 세이브 필드 + 해금 조건 +
  정산(`commitRunResult`) + 테스트 300줄까지 **다 들어갔다.**
- 그런데 `grep 'panel: "bossrush"' src/` → **0건**. 패널 라우팅(`if (panel === "bossrush")`)은
  있는데 **여는 버튼이 없어서 게임에서 도달 불가능**했다.
- 커밋 메시지는 "패널 라우팅 배선"이라 적혀 있었고, 그것만 보고 완료로 판단했다.
  **"배선됐다"와 "사용자가 열 수 있다"는 다르다.**
- 교훈: 기능 완료 판정은 `panel ===` 존재가 아니라 **`panel: "xxx"` 를 emit 하는
  진입점이 있는지**로 한다. 새 패널을 만들면 진입 버튼을 같은 커밋에 넣는다.

**vc291b 에서 추가한 것**
- `Panels.tsx` 혜택 패널의 `바르가 원정대 열기` 옆에 `보스 러시` 버튼.
- `isBossRushUnlocked()` 를 읽어 잠금이면 흐리게 + 🔒, 해금이면 🔥 로 입구에서 미리 표시.
  (패널 안에서도 잠금 안내가 있지만, 눌러보고 나서야 알게 되는 걸 막는다.)

**남은 검증**: 웨이브 3/5/10 클리어 시 3택1 강화가 스탯에 반영되는지,
런 종료 후 재접속에서 최고 기록이 유지되는지 — 실기기(S20+)에서 확인 필요.

---

## 2-b. [높음] 보스 러시 실제 전투 연결 — 아직 안 됨

위 패널은 **강화 선택·정산 UI**다. `WorldScene` 에서 보스 러시 웨이브를
실제로 스폰하고 클리어를 감지하는 경로가 붙었는지 확인해야 한다.

**확인 명령**
```bash
grep -rn "bossrush\|BossRush" src/game/scenes/WorldScene.ts | head
```
0건이면 패널만 있고 전투는 없는 상태다(버튼을 눌러도 진행이 안 된다).
기존 보스 9종 스폰 경로를 재사용해 `clearWave()` → 강화 선택 → 다음 웨이브로 잇는다.

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

## 6. [기술부채] 기존 테스트 실패 10건 — ✅ 전부 해결됨 (vc291)

**당시**: 499 pass / 10 fail 이 기준선이었다.

**현재: 509 pass / 0 fail.** (검증: `node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs --test tests/*.test.mjs tests/campaign/*.test.mjs`)

원인 판정 결과 — **테스트 자체가 틀린 경우가 대부분**이었다.

| 번호 | 판정 | 조치 |
|---|---|---|
| 293~296 초상화 매핑 | **실제 게임 버그였다** | 아래 참조 |
| 131~133 프롤로그 cinematic | 테스트 계약이 코드보다 뒤처짐 | 정리됨 |
| 220~221 아틀라스 셀 스케일 | 프레임 규격 변경 미반영 | 정리됨 |
| 497 Vercel 바인딩 | `.vercel/project.json` 커밋으로 해소 | 정리됨 |

### 초상화 매핑 — 실제 버그 (커밋 `2bb11176`)

유저 지적 "초상화와 월드 캐릭터가 따로 논다"의 **직접 원인**이었다.
`_map.json` 에서 이름으로 신원이 확정되는 화자들이 무작위 AI 얼굴을 쓰고 있었다:

| 화자 | 잘못된 얼굴 | 고친 뒤 |
|---|---|---|
| 라일락 연합의 기록자 (27회 등장) | dxp_26br | npc_lilac.png |
| 라일락 월드의 안내인 | dxp_36br | npc_lilac.png |
| 라일락 연합 | dxp_21bl | npc_lilac.png |
| 스칼렛의 환영 | dxp_35tl | npc_scarlet.png |
| 어둠의 군주 스칼렛 | dxp_30tr | npc_scarlet.png |
| 근위대장 아리스텔라 | dxp_35tr | npc_aristella.png |
| 아리스텔라 | **npc_ari.png (다른 캐릭터!)** | npc_aristella.png |

`npc_ari.png`(금발 전사)와 `npc_aristella.png`(은발 성기사)는 다른 인물이다.
지금은 `npc_ari` 는 "아리" 1건, `npc_aristella` 는 아리스텔라 3건만 쓴다.

**테스트도 틀려 있었다**: 종전 테스트는 `tex`(화자 이름)에 `/lilac/` 을 기대했다.
화자 이름이 "lilac" 이 될 수 없으니 **항상 실패**하는 검사였고, AI 얼굴이 붙어 있어도
잡지 못했다. 이제 **파일명**을 검사한다.

**남은 관찰**: 초상화 283개 중 225개가 PixAI 생성물이고 정본 근거가 있는 것은 25개다.
명백한 오매핑만 고쳤다. 나머지 AI 초상화 존치 여부는 별도 판단이 필요하다.

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

| 순위 | 작업 | 근거 강도 | 예상 규모 | 상태 |
|---|---|---|---|---|
| 1 | 랭킹 등급 아이콘 CSS 마감(또는 삭제) | 확실 | 소 | ✅ 해결(삭제 + 픽셀 메달 사용중) |
| 2 | 보스 러시 모드 | 확실(REA 식별자) | 대 | ⬜ 다음 |
| 3 | 우편함 | 확실(번들 텍스트) | 중 | ⬜ |
| 4 | 백팩 이벤트 | 확실(식별자 2종) | 중~대 | ⬜ |
| 5 | JENNY 설계 참고 | 선별 필요 | 소 | ⬜ |
| 6 | 기존 테스트 10건 | 확실 | 중 | ✅ **509 pass / 0 fail** |
| 7 | 릴리스 버전 범프 | 규칙 | 소 | ⬜ 배포 직전 |

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
