# vc229 — 세이브 방식 최적화

지시: **"세이브 방식 효율적이게 변경"**

측정 → 병목 확정 → 수정 → 검증 순서로 진행했다.
**구조를 추측으로 바꾸지 않았다.**

---

## 1. 측정 (무엇이 실제로 비싼가)

`tools/measure_save_cost.mjs` · `tools/measure_compression.mjs`

### 세이브 1건 크기

| 진행도 | 크기 |
|---|---|
| 보통 | 19.2 KB |
| 중상 | 51.7 KB |
| 최대 | **98.8 KB** |

### 크기 상위 필드 (최대 세이브 기준)

| 필드 | 크기 |
|---|---|
| `seen` | 14.2 KB |
| `potentials` | 12.2 KB |
| `visited` | 8.2 KB |
| `achClaimed` | 8.0 KB |
| `monsterKills` | 5.9 KB |
| `starMap` | 5.8 KB |
| `accUp` | 5.4 KB |
| `fragmentsFound` | 5.2 KB |
| **상위 8개 합계** | **64.9 KB / 66%** |

### 저장 1회당 비용 — **O(유저 수)**

세이브 하나를 저장하면 **DB 전체를 암호화해 PUT** 한다.

| 유저 수 | DB 크기 | 암호화 | GitHub PUT 본문 |
|---|---|---|---|
| 10 | 195KB | 8.1ms | 0.3MB |
| 50 | 979KB | 6.9ms | 1.7MB |
| 200 | 3.9MB | 22.9ms | 6.8MB |
| **500** | **9.8MB** | **48.2ms** | **17.0MB** |
| 1000 | 19.6MB | 100.5ms | 34.0MB |

### 저장 빈도

`AuthPanel` 이 **90초마다** 자동 업로드한다(`setInterval`, `auth:cloudPush` 훅 포함).
→ 유저 500명이면 **시간당 20GB** 를 GitHub 에 재전송하는 계산이 나온다.

### 압축 효과

| | 크기 | 비율 |
|---|---|---|
| 원본 | 30.6 KB | 100% |
| gzip -9 | 7.3 KB | 24% |
| **brotli -9** | **2.9 KB** | **10%** |

세이브는 반복 키가 많은 JSON 이라 사전 기반 압축이 잘 듣는다.

---

## 2. 왜 DB 분할(유저별 파일)을 지금 안 했나

SZBK1 컨테이너를 **직접 읽는 코드가 9곳**이다:

```
accounts/index.js (1,201줄)   ← 레거시 node 서버
scripts/db_accounts_dump.js
scripts/db_accounts_list.js
scripts/db_check_admin.js
scripts/db_find_player.js
scripts/db_remove_rank_entry.js
scripts/db_reset_admin_pw.js
scripts/ghdb_seed.js
scripts/verify_dbkey_rotation.mjs
+ src/lib/ghdb.ts
```

포맷을 바꾸면 그 전부가 **조용히** 깨진다. 게다가 지금은 저장 빈도가 낮고
(90초 1회 × 동시 사용자 수십) 선형 비용이 실사용에서 병목이 아니다.

순서를 나눈다:
- **1단계(이번)** — 압축 + 무변경 쓰기 생략. **포맷 유지, 위험 0**
- 2단계 — 트래픽이 늘면 세이브를 유저별 파일로 분리

---

## 3. 구현

### `src/lib/saveCodec.ts` (신규)

- `compressJson` / `decompressJson` — brotli 우선, gzip 이 더 작으면 gzip.
  접두사(`BR:`/`GZ:`)로 압축 여부를 **데이터 자신이** 들고 있다.
- 512바이트 미만은 압축하지 않는다(태그 3바이트가 손해).
- `saveFingerprint` — 내용 해시. 같으면 쓰기를 건너뛴다.

### `src/lib/saveAccess.ts` (신규)

세이브 레코드 접근자를 **한 곳으로** 모은다.

- `saveDataOf` / `saveCharsOf` — 압축본·평문·문자열 JSON 을 모두 처리
- `mutateSaveData` — 읽기(풀기) → 수정 → 쓰기(압축) 를 묶음
- `packSaveRec` / `unpackSaveRec`

**왜 필요한가**: `db.saves[uid].data` 를 직접 읽던 곳이 **8곳**이었다.
압축 저장을 켜면 그 전부가 조용히 깨진다 —
`data.owned` → undefined → 거래소가 "미보유"로 거절,
`data.gold` → undefined → **골드 증발**.

### 교체한 8곳

| 파일 | 무엇 |
|---|---|
| `cloud-save/route.ts` | GET 압축 해제, POST 압축 + 무변경 생략 |
| `sapi.ts` | `ownedCountOf` · `creditOwned` · `ownsListableItem` · `rankListFor` |
| `market/buy` | 구매자 골드 차감 |
| `market/collect` | 판매 정산 지급 |
| `market/list` | 에스크로 차감 |
| `iap/verify` | 에메랄드 지급 |

---

## 4. 테스트가 잡아낸 실제 버그

`tests/save-codec.test.mjs` 작성 중 **세이브 유실 버그**를 발견했다.

```
compressJson({gold:1})  →  '{"gold":1}'   (512B 미만이라 압축 안 함)
packSaveRec(...)        →  data 에 위 "문자열"을 그대로 저장
saveDataOf(...)         →  접두사가 없으니 → null
                        →  "세이브 없음"으로 보임
```

즉 **작은 세이브가 통째로 사라진다.** 접두사만으로 판별한 설계 탓이다.

수정: `saveDataOf`/`saveCharsOf` 가 **문자열이면 일단 JSON 파싱을 시도**한다.
압축본은 `decompressJson` 이 먼저 풀고, 평문 문자열은 그대로 파싱된다.

이 버그는 컴파일로도, eslint 로도, 기존 테스트로도 잡히지 않았다.
**런타임 동작을 검증하는 테스트를 쓰지 않았다면 배포 후 세이브가 사라졌다.**

---

## 5. 결과

| 항목 | 전 | 후 | 개선 |
|---|---|---|---|
| 세이브 1건 (보통) | 19.2 KB | **3.1 KB** | −84% |
| 세이브 1건 (최대) | 98.8 KB | **12.8 KB** | −87% |
| 저장 1회 PUT (500명) | 16.8 MB | **2.7 MB** | **−84%** |
| 무변경 시 쓰기 | 매번 | **0회** | 100% |

```
tsc 0 · eslint 0 · next build 0
save-codec 43 · db-cache-isolation 11 · hitbox-offset 15 · gamestate 23
fa-assets 25 · eventbus-balance 5 · hitstop-overlap 13 · keyhint-sync 10
save-migration 7 · melee-tier 12 · shake-scale 30 · shake-a11y 21
utility-ai 22 · input-extraction 12
= 249 PASS / 0 FAIL
```

---

## 6. 호환성

- **구 세이브(평문 객체)** — `packed` 없음 → 그대로 읽힌다. 첫 저장 시 압축 형태로 승격.
- **신 세이브(압축)** — `packed: true` + 접두사 문자열.
- **작은 세이브** — 문자열 JSON 으로 저장돼도 읽힌다(위 버그 수정).
- **클라이언트** — 응답 형태가 동일하므로 **변경 없음**.
- **`accounts/index.js`** — 구 포맷만 읽으므로 신 세이브를 못 읽는다.
  단, vc205 이후 이 파일은 **모든 API 를 Next 로 위임**하고 세이브를 불투명하게만 다룬다.
  도달성 검증 결과(7절) 레거시 수정은 불필요.

## 7. 레거시 `accounts/index.js` 호환 — **안전 확인 완료**

`server.js` 가 `attachAccountsBefore("./accounts")` 로 레거시를 **실제로 붙인다**.
그래서 "미사용"이라고 단정하지 않고 도달성 분석을 했다
(`tests/legacy-accounts-compat.test.mjs` · 18 PASS).

### 연결 구조

```
server.js
  └─ attachAccountsBefore(handleNext)     ← 미들웨어
       ├─ OPTIONS 프리플라이트만 직접 응답 (구 APK 호환)
       └─ 그 외 전부 handleNext(req,res)  ← Next 라우트로 위임
```

즉 **모든 API 는 Next(`src/app/api/**`) → ghdb.ts 단일 구현**이 처리한다.

### 평문 세이브 접근이 남아 있는 곳 (10곳)

| 함수 | 도달 가능? | 이유 |
|---|---|---|
| `handle()` | **불가** | export 안 됨, 내부 호출 0 |
| `rankEntries()` | **불가** | `rankListFor` 에서만 호출되고 그 함수도 미호출 |
| `rankListFor()` | **불가** | 내부 호출 0, export 안 됨 |
| `handleMarket()` | **불가** | `handleMarketRequestStub()` 로 대체돼 항상 false |
| `ownsListableItem()` | **불가** | `handleMarket` 안에만 존재 |

### 부팅 경로(유일하게 살아있는 곳)는 안전

`restoreFromGithubIfFresh()` 는 부팅 시 무조건 실행된다(`accounts/index.js:382`).
이 함수는 세이브를 **불투명하게 병합만** 한다:

```js
for (const [kk, vv] of Object.entries(src)) if (db[k][kk] === undefined) db[k][kk] = vv;
```

`lv`/`gold` 같은 내부 필드를 읽지 않으므로 압축본이어도 그대로 통과한다.
복원 후 `persistDb()` → `backupPush()` 로 재기록되지만, 기록은 원본 바이트를
암호화해 다시 올리는 것이라 **세이브 내부 형식을 건드리지 않는다**.

### 결론

**레거시 수정 불필요.** 신 포맷(압축 세이브)은 Next 안에서만 해석되고,
레거시는 세이브를 불투명 데이터로만 다룬다.
단, 스크립트(`scripts/db_*.js`)로 DB 를 직접 열어 세이브를 볼 때는
`saveDataOf` 와 같은 풀기 단계가 필요하다 — 그건 운영 도구라 별건으로 둔다.

## 9. 운영 DB 실측 검증 (키 확보 후)

`SERTZ_BACKUP_KEY` 확보 → 라이브 `accounts.enc` 복호화 → **실제 세이브 7건**으로 검증.

### 세이브 압축 실측 (운영 데이터)

| uid | lv | 전 | 후 | 비율 | 왕복 |
|---|---|---|---|---|---|
| `123456` | 241 | 19.5KB | 3.8KB | **19%** | ✓ |
| `admin` | 174 | 9.6KB | 3.8KB | 40% | ✓ |
| `fantastic…` | 28 | 2.7KB | 1.6KB | 61% | ✓ |
| `hyw6259…` | 34 | 2.6KB | 1.6KB | 61% | ✓ |
| `seokbin1…` | 8 | 2.3KB | 1.4KB | 61% | ✓ |
| `g_OQrZ0E…` | 200 | 2.3KB | 1.4KB | 62% | ✓ |
| `g_102370…` | 237 | 16.9KB | 3.2KB | **19%** | ✓ |
| **합계** | | **55.8KB** | **16.8KB** | **30%** | **0 실패** |

고레벨 세이브(lv 237~241)가 **19%** 로 가장 많이 줄었다.
`seen`/`visited`/`achievements` 같은 반복 문자열 배열이 고레벨에서 커지기 때문 — 압축이 가장 필요한 곳에서 가장 잘 듣는다.

### 거래소 시나리오 (실제 유저)

```
123456: gold 9,155,089 → 9,154,089 (차감 1,000)  ✓
```

### HTTP 실측

서버를 키·토큰과 함께 기동한 뒤:

| 엔드포인트 | 응답 | 확인 내용 |
|---|---|---|
| `/api/rank` | **200** | 운영자 lv=241 재생성, 11명 전원 |
| `/api/market` | **200** | 활성 매물 `bd_guardian` +3 |
| `/api/auth/me` | **200** | `{"user":null}` (미로그인, 정상) |
| `POST /api/auth/cloud-save` (미인증) | **401** | `{"error":"로그인이 필요해요"}` |

즉 **압축 세이브가 실제 운영 데이터로 정상 해석**된다.

### 자격증명 취급

| 항목 | 위치 | 권한 |
|---|---|---|
| `GITHUB_TOKEN` | `.secrets/github_token` | `600`, gitignore 차단 확인 |
| `SERTZ_BACKUP_KEY` | `.secrets/backup_key` | `600`, gitignore 차단 확인 |

`git ls-files .secrets` → **0개** (추적 안 됨).
프로덕션(Vercel)에는 두 값 모두 이미 설정돼 있다.

## 10. 남은 것

- **2단계(DB 분할)** — 유저 1000명 이상 또는 저장 주기가 짧아지면 필요.
  세이브를 `saves/<uid>.enc` 로 쪼개고 인덱스만 유지하면 O(1) 이 된다.
- `seen`/`visited`/`achClaimed` 가 여전히 상위 66% —
  비트셋(bitfield)으로 바꾸면 10배 더 줄지만, 세이브 스키마 변경이라 별건.
- `scripts/db_*.js` 7개는 신 포맷을 못 읽는다 — 운영 조회 도구에 풀기 단계 추가 권장.
