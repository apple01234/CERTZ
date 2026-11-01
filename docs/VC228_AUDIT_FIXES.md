# vc228 — 전수 감사 9건 수정

`/ponytail-audit` 지적 전건 처리. 각 항목에 **무엇을 근거로 고쳤는지** 남긴다.

---

## 결과 요약

| # | 지적 | 조치 | 검증 |
|---|---|---|---|
| 1 | 147MB 오디오 백업이 배포에 포함 | `assets_backup/`으로 이동 | public 330M → **180M** |
| 2 | `mutateDb` 실패 시 캐시 오염 | 사본에서 변형 + 성공 시에만 교체 | `db-cache-isolation` **11 PASS** |
| 3 | 부트 오디오 낭비 / 미사용 5개 | 5개 이동 (부트 목록은 원래 정상) | 참조 0 확인 |
| 4 | `tilemap.ts` 223줄 데드 코드 | 삭제 | 참조 6심볼 전부 0 |
| 5 | `register` 데드코드 (감사 로그 누락) | `audit` 를 return 위로 | tsc/eslint |
| 6 | 레이트리밋 IP 스푸핑 | 마지막 홉 사용 | — |
| 7 | API 키 인라인 | env + 폴백 | tsc |
| 8 | 데드 파일 7개 860줄 | 삭제 | tsc 통과 |
| 9 | (확인) 핫패스 | 문제 없음 | — |

```
tsc 0 · eslint 0 · build 0 · 테스트 206 PASS / 0 FAIL
```

---

## 1. 147MB 백업 제거

`public/assets/audio/.orig*` 4개 폴더 = 152개 파일, **전부 현재 곡의 이전 인코딩**(신규 0).
`postbuild.js:L42` 의 `cpSync(public, standalone)` 이 그대로 복사해
`.next-apk` 342MB, `electron/game` 까지 3중 포함이었다.

→ `assets_backup/audio/` 로 이동(gitignore 등록). `cpSync` 는 손대지 않았다.

## 2. 캐시 오염 (실돈 버그)

`loadDb(true)` 가 `cache.db` 와 **동일 참조**를 주고 `fn(db)` 가 직접 변형했다.
PUT 6회 전부 실패 시 캐시에 미저장 변경이 남아 다음 8초간 모든 읽기가 거짓을 봤다
(거래소: 이미 팔린 물건이 안 팔린 것처럼).

```ts
const working = structuredClone(db) as DbShape;
const out = fn(working);
const put = await ghPutRaw(backupEncrypt(JSON.stringify(working)), sha);
if (put.ok) { cache = { db: working, sha: put.sha, at: Date.now() }; ... }
```

**주의**: `structuredClone` 은 세이브 파일이 클 때 비용이 있다. 실측 전
`db.saves` 총량을 확인할 것. 현재 세이브 상한 2MB × 사용자 수이므로
수십 MB 규모면 문제 있음 — 그 경우 `saves` 만 지연 복사하는 방식으로 바꿔야 한다.

## 3·4. 오디오 — 감사 보고 정정

감사에서 "미사용 84개/125MB"라 했으나 **오진**이었다:

- `BGM_PRELOAD_TRACKS = ["bgm_title"]` — 이미 타이틀 1곡만 부트 로드 중(나머지는 구역 진입 시 LRU 3곡 지연 로딩).
- `skl_*.ogg` 30개는 `SKILL_SFX_FILES` 객체에 등록돼 **실사용 중**. 내 정규식이 객체 리터럴을 못 봤다.

실제 미사용은 **5개/3.8MB**(`bgm_title1`, `skl_electron1`, `skl_flame1`, `skl_holy1`, `skl_thunder2`).

## 5. `tilemap.ts` 삭제 — 복구 불가

`paintTilemap` 등 6심볼 외부 참조 0, 테스트 참조 0 → 삭제.

**실수**: git 미추적 파일이라 백업 없이 지웠고, turbopack 캐시는 압축·분절돼 원문 복구 실패.
이후 파일 삭제는 **먼저 `assets_backup/dead_code/` 로 복사**하는 규칙을 적용했다(8번).

이후 같은 벽 3분할이 필요하면 `docs/VC213_ASSET_FIX.md` 의 설계 기록
(FLOOR `(0,4)(1,4)` / 밴드 `(2,4)(3,4)` / CAP `(0,3)(1,3)(2,3)`+`(3,3)` / FACE `(4,2)(4,3)`)로
재작성하면 된다 — 좌표는 QC 실측값이라 남아 있다.

## 6. `register` 감사 로그

```ts
return {...};                    // ← 여기서 종료
audit("register", {...});        // 영원히 실행 안 됨
return {...};                    // 중복
```
→ `audit` 를 return 위로. **가입 감사 로그가 지금까지 전부 비어 있었다.**

## 7. IP 스푸핑

`x-forwarded-for` 첫 값은 클라이언트가 쓸 수 있다. 매 요청 임의 IP면 버킷이 매번
새로 생겨 로그인·가입·채팅·파티 레이트리밋이 **사실상 무력**. 마지막 홉으로 변경.

## 8. 데드 파일 7개 (860줄)

`parallax.ts`(418) `DangerFX.ts`(132) `Vfx3.ts`(117) `layers.ts`(85)
`assets3d.ts`(69) `useIsTouch.ts`(33) `utils.ts`(6) — 정확한 import 0.
→ `assets_backup/dead_code/` 백업 후 삭제.

**오진 정정**: 감사에서 `Vfx3` 8회·`layers` 20회 참조로 봤으나, `Vfx3` 는 `Vfx3D`(사용 중)의
부분 문자열이고 `layers` 는 `parallax.ts` 내부 지역변수였다. 정확한 import 검사로 0 확정.

## 9. 핫패스

`update()` 532줄에 배열 호출 1개(`enemies.filter`), 2초 간격 + 상한 9마리 가드.
**문제 없음.**

---

## 남은 것

- `structuredClone` 비용 실측 (2번)
- `clientIp` 마지막 홉은 단일 프록시 가정 — 다단 프록시면 홉 수 조정 필요
- 세이브 파일이 수십 MB 규모면 2번 방식 재검토
- `tilemap.ts` 벽 3분할이 실제로 필요하면 `WorldScene` 에 **배선한 뒤** `autotile.ts` 를 대체할 것
