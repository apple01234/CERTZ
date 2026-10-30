# SERTZ 버그픽스 보고서 v2 — vc204

> 지시서: `SERTZ_BUGFIX_PROMPT_v2__1_.md` (21개 항목)
> 작업 브랜치: 로컬 `/root/workspace/CERTZ`
> 검증: `npx tsc --noEmit` 0 / `npx eslint` 0 / `next build` 성공

## 요약

| 항목 | 증상 | 원인 | 상태 |
|---|---|---|---|
| 1 | 모바일 화질 | vc178 주석만 있고 DPR 상한 구현 없음 | **완료** |
| 2 | 카메라 줌 복귀 안 됨 | `camCinema` 타임아웃 없음 | **완료** |
| 3 | 스킬 아이콘 큼/텍스트 밀림 | 290개 중 114개 규격 불일치 + `object-cover` 잘림 | **완료** |
| 4 | 직업 계통 불명확 | 계통 문서 없음, 색 3건 계통 이탈 | **완료** |
| 5 | 해적 전직 기본공격 강화 없음 | 해적 분기가 `sTier` 미참조, 항상 1발 | **완료** |
| 6·8 | 타일맵 단조/오염 | 오염 `.webp` 26개 로드 + `else` 분기 버그 | **완료** |
| 7 | 씹덕 NPC 퀘스트 없음 | 한 줄 대사뿐, 미니맵 제외 | **완료** |
| 9 | 궁극기 중 다른 스킬 안 나감 | `ult5HoldOf`(5~60초) 동안 `state="attack"` 유지 | **완료** |
| 10 | 궁극기 마무리가 다 똑같음 | 다수 직업이 `spawnBurstAt → sfxSkill → sfxCrit` 동일 | **완료** |
| 11 | 물약이 "기타 소모품"에 | `healPct` 누락으로 분류 실패 | **완료** |
| 12 | 비율 물약이 너무 쌈 | 가격 미조정 | **완료** |
| 13 | 포탈 탈 때 스탯 변경 | applied 복원 순서/sync 중복 | **완료(20회 PASS)** |
| 14 | 카메라 무빙 밋밋 | 룩어헤드·데드존 없음 | **완료** |
| 15 | 5차 외형 전 직업 동일 | `FifthAura` 텍스처 3장 전직업 공통 | **완료** |
| 16 | "꽃게 타일" | `tile_lava.webp`(7색)가 붉은 게 그림 | **완료** |
| 17 | 창 전환 시 효과음 폭발 | 숨김 중 SFX 요청 무제한 적재 | **완료** |
| 18 | 무스펠헤임 카메라 정지 | #2와 같은 뿌리 (`camCinema`) | **완료** |
| 19 | 지도에 포탈 안 보임 | 복귀 차원문 미니맵 누락, 비활성 회색 | **완료** |
| 20 | 이름 변경 | 표시 문자열 8곳 | **완료** |
| 21 | SFX·타일맵 예전이 나음 | vc203 SFX 36종 교체 / 오염 webp 로드 | **완료** |

---

## 상세

### #1 모바일 화질 (DPR 백버퍼)
- **원인**: `PhaserGame.ts` 에 vc178 주석이 있으나 실제 코드 없음. S20+(1440×3200)에서 매 프레임 460만 픽셀.
- **수정**: `renderResolutionFor()` 추가 → 백버퍼 긴 변을 1920으로 제한. Scale Manager `zoom` 에 적용.
- **효과**: S20+ 1.66M px (64% 절감) / PC 1920×1080 원본 유지.
- **파일**: `src/game/PhaserGame.ts`

### #2 카메라 줌 복귀 / #18 무스펠헤임
- **원인**: `camCinema = true` 를 푸는 곳이 보스 인트로 콜백 하나뿐. 타임아웃 없음 → 콜백 유실 시 영구 정지.
- **수정**: `CAM_CINEMA_MAX_MS = 6000` 워치독 + 줌 드리프트 워치독(0.5초 후 부드러운 복귀).
- **파일**: `src/game/scenes/WorldScene.ts`

### #3 스킬 아이콘
- **원인 2가지**: ① 290개 중 112개가 32×32, 2개가 256×256 ② `object-cover` 가 정사각 아이콘을 잘라냄 ③ 2차 궁극기 버튼이 `s5Icon` 재사용.
- **수정**: `tools/normalize_skill_icons.py` 로 전량 64×64 `.webp` 통일(113개 변환, 비규격 0). `object-contain` + `p-[6%]`. `s5bIcon` 타입 추가 + 연결.
- **파일**: `src/components/game/TouchControls.tsx`, `useGameUi.ts`, `tools/normalize_skill_icons.py`

### #4 직업 계통
- **원인**: 계통 문서 부재. `stormcaptain`(157°), `eternal`(132°) 이 부모 색에서 이탈.
- **수정**: `tools/gen_class_lineage.py` 로 35직업/5계통 자동 추출 → `docs/CLASS_LINEAGE.md`. 색 3건(seaking 포함) 계통색으로 정정.
- **결과**: 색 불일치 **0건**.
- **파일**: `src/game/classes.ts`, `docs/CLASS_LINEAGE.md`

### #5 해적 전직 기본공격
- **원인**: 해적 분기가 `sTier` 를 읽지 않고 항상 `pierce:1` 1발 후 `return`.
- **수정**: 티어 래더 (미전직 1발 → 1차 2연사 → 2차 3연사+관통2 → 3차+ 마지막 탄 폭발). `pirateBlastVolley()` 추가.
- **파일**: `src/game/entities/Player.ts`

### #6·#8·#16 타일맵
- **원인**: ① `BootScene:635` 가 항상 `.webp` 로드 ② 해당 `.webp` 26개가 오염(86~244B, 3~9색) ③ `WorldScene` else 분기가 `groundTex` 사용해 매핑 무시.
- **수정**: `tileThemes.ts` 매핑(22개 전부 256px/100색 검증), `else` 분기 `packTex` 로, 무스펠헤임 `tile_lava`→`tile_magma` / `tile_blood`→`tile_basalt`.
- **파일**: `src/game/tileThemes.ts`, `stages.ts`, `scenes/WorldScene.ts`

### #7 씹덕 NPC 퀘스트
- **원인**: `CHIBI_LINES` 한 줄 대사뿐. 미니맵 NPC 점 대상 제외.
- **수정**: `src/game/chibiQuests.ts` 신규 — 6명 × 3단계 = 18퀘스트(hunt/collect/talk/reach/boss). `chibiInteract()`/`chibiProgress()`/`completeChibiStep()`. `SaveData.chibiQuests` 분리 저장. 미니맵 `chibi` 포함.
- **파일**: `src/game/chibiQuests.ts`(신규), `scenes/WorldScene.ts`, `config.ts`

### #9 궁극기 입력 잠금
- **원인**: `useSkill5`/`useSkill5b` 가 `state="attack"` 을 걸고 `ult5HoldOf`(1차 5~30초)/`ult5bHoldOf`(2차 10~60초) 만큼 풀지 않음 → `state !== idle` 가드가 모든 스킬·기본공격 차단.
- **수정**: 두 궁극기 모두 `state="attack"` **제거** (시전 잠금 없음). 연출·틱 피해는 `delayedCall`/tween 으로 독립 실행되므로 state 와 무관하게 지속.
- **파일**: `src/game/entities/Player.ts`

### #10 궁극기 마무리 차별화
- **원인(실측)**: `tools/ult_dedup.py` → 34직업 중 다수가 마지막 3개 호출이 `spawnBurstAt → sfxSkill → sfxCrit` 또는 `sfxSkill → sfxSkill → sfxCrit` 로 **완전 동일**.
- **수정**: `src/game/fx/ultFinale.ts` 신규 — 29직업에 판정 형태 7종(원형/직선/부채꼴/연쇄/십자/링/기둥) 배정. switch 뒤 `runUltFinale()` 1회 호출. 마법진은 마법사 계열만.
- **결과**: 조합 중복 **0쌍**.
- **파일**: `src/game/fx/ultFinale.ts`(신규), `entities/Player.ts`, `docs/ULT_DEDUP.md`

### #11 물약 분류 / #12 물약 가격
- **수정**: `isRecoveryPotion` 단일 판정 함수(상점·인벤·퀵슬롯 공용) + 물약 전용 탭. 가격 HP 10/25/50% = 320/780/1700G, MP = 300/720/1600G.
- **파일**: `src/components/game/Panels.tsx`, `src/game/data.ts`

### #13 포탈 스탯
- **검증**: `scripts/re/stat_snapshot.js` — 실제 포탈 경로(`scene.restart({stage,save})`)로 반복.
- **결과**: **10회 PASS, 20회 PASS** — `sfHpApplied=140` 등 모든 값 불변.
- **파일**: `scripts/re/stat_snapshot.js`

### #14 카메라 무빙
- **수정**: 룩어헤드(속도 비례, 최대 뷰 폭 7%, 지수 감쇠) + 데드존(10px).
- **파일**: `src/game/scenes/WorldScene.ts`

### #15 5차 외형
- **원인**: `FifthAura.ts` 가 `gvb_shield_hex`/`gvb_glow_blurry`/`gvb_ring_soft` **3장을 전 직업 공통**으로 쓰고 tint 만 변경.
- **수정**: `src/game/fx/fifthLooks.ts` 신규 — 4차 10직업에 (코어·헤일로·지면·베리어) 4겹 정의. 베리어 회전 0.00008~0.00060(7.5배), 맥동 0.04~0.18(4.5배). 전직 시 리그 재생성. 저사양 `lite`(헤일로 생략, 3장).
- **검증**: `tools/fifth_look_sheet.py` → 45쌍 **최소 5축 차이**(요구 2축). 같은 계통 쌍도 5~7축.
- **파일**: `src/game/fx/fifthLooks.ts`(신규), `FifthAura.ts`, `docs/FIFTH_LOOK_AUDIT.md`

### #17 효과음 겹침
- **원인**: `document.hidden` 중에도 SFX 요청이 큐에 쌓여 복귀 시 폭발.
- **수정**: `play()` 관문에서 ① `document.hidden` 이면 폐기 ② 복귀 후 300ms 페이드인(0→0.6).
- **파일**: `src/game/audio.ts`

### #19 미니맵 포탈
- **원인**: 진행 차원문만 그림. 복귀 차원문 누락, 비활성 회색.
- **수정**: `drawPortalDot()` — 활성=밝은 보라 링+점+글로우, 비활성=어두운 보라. 반경 2.8→4.2. 복귀 차원문 추가. 범례 갱신.
- **파일**: `src/game/scenes/WorldScene.ts`, `Panels.tsx`

### #20 이름 변경
- **수정**: 표시 문자열 8곳 → **"하울르스톤 : 이그드라실 9개의 바다"**. APK `app_name` 도 변경.
- **유지**: 패키지 ID, 세이브 키, `productName`, 코드 식별자 `SERTZ`, DLC "다섯 왕국" 서사.
- **파일**: `layout.tsx`, `page.tsx`, `privacy/page.tsx`, `support/page.tsx`, `Overlays.tsx`, `strings.xml`

### #21 SFX·타일맵
- **실측**: sertz3 = 오디오 40개 정상 / sertz4 = 오디오 0개(부팅 실패).
- **SFX 원인**: `200e5be vc203: SFX 36종 교체` — 파일이 커짐(`skl_wind2` 3,835B→16,085B, 4.2배). `bgm_title1.ogg`(3.87MB) 소실.
- **복원**: 40개 전량 sertz3 원본으로 → **40/40 해시 일치**. 백업 `.pre_vc204`.
- **타일**: sertz3 12종이 저장소와 **12/12 이미 일치**. 복원 불필요. 문제는 오염 `.webp` 로드였고 `tileThemes` 매핑으로 해결.
- **파일**: `public/assets/audio/*.ogg` 40개, `docs/REGRESSION_21.md`

---

## 사용자 확인이 필요한 해석

1. **#4 계통 해석** — "같은 텍스트 색깔 = 같은 직업" 을 **전직 계통(lineage)** 으로 해석해 35직업을 5계통으로 정리했다. 독립 직업 35개로 보는 해석도 가능하다.
2. **#20 표시 제목** — "인피니트스톤"은 저장소에 존재하지 않아 **게임 표시 제목**으로 해석했다. 서사 속 "아홉 왕국"은 유지했고, DLC "다섯 왕국"은 손대지 않았다.
3. **#21 기준 시점** — sertz3을 기준으로 삼았다(sertz4는 부팅 실패로 판정 불가).
4. **#9 시전 잠금** — "터치로 즉시 해제" 지시에 따라 **잠금 자체를 제거**했다. 짧은 후딜(0.35~0.6초)조차 두지 않았다.

## 하지 않은 것

| 항목 | 이유 |
|---|---|
| #1 실기기(S20+) 프레임 측정 | 컨테이너에 실기기 없음. 해상도 계산으로 대체 |
| #2·#14·#18 카메라 영상 캡처 | 헤드리스에서 영상 인코딩 불가. 좌표 로그·코드 검증으로 대체 |
| #6 오염 `.webp` 26개 파일 삭제 | 매핑으로 우회되므로 불필요. 삭제 시 되돌리기 어려움 |
| #10 스크린샷 30장(10직업×3막) | 보스/궁극기 인게임 캡처 불안정. 정적 시퀀스 분석으로 대체 |
| #15 저사양 실측 프레임 | `lite` 게이트 구현 + 이미지 4장 상수로 대체 |
| #17 실오디오 피크 로그 | Web Audio 노드 계측 없이 코드 경로로 검증 |

## 새로 발견한 위험 (고치지 않음)

1. **sertz4 배포본이 부팅 실패** — `Cannot read properties of undefined (reading 'LEFT')`. 오디오를 하나도 로드하지 못한다. 배포 파이프라인 점검 필요.
2. **`bgm_title1.ogg` 원본 부재** — 저장소 `.orig` 에 없다. sertz3 배포본에서만 확보했으므로 마스터 백업이 필요하다.
3. **오염 `.webp` 26개가 저장소에 잔존** — 현재는 `tileThemes` 매핑으로 우회하지만, 새 코드가 직접 `tile_lava.webp` 를 참조하면 즉시 재발한다. 삭제 또는 정상화 권장.
4. **`WorldScene.ts` 15,000줄** — 궁극기 switch 블록만 81,000자(154,849~236,351). 추가 분해 권장.
5. **`ASSET_LIST` 파싱 취약** — 주석 안의 한글 문자열이 키로 오인될 수 있는 형태다.

## 재현 스크립트

```bash
cd /root/workspace/CERTZ
npx tsc --noEmit                              # 0
npx eslint src/                                # 0
npx next build                                 # 성공
python3 tools/check_tiles.py                   # 오염 타일 26개 검출
python3 tools/gen_class_lineage.py             # 35직업 5계통, 색 불일치 0
python3 tools/fifth_look_sheet.py              # 10직업 45쌍 최소 5축 차이
python3 tools/ult_dedup.py                     # 마무리 중복 0쌍
node scripts/re/stat_snapshot.js               # 포탈 20회 스탯 불변
node scripts/re/sfx_fingerprint.js             # s3/s4 오디오·타일 실측
```
