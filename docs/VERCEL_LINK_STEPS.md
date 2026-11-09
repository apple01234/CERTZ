# Vercel 연결 — 남은 절차 (vc291)

> 현재 상태: **Vercel CLI 로 링크된 적 없음.** projectId 를 코드로 복원할 수 없다.
> 이 문서는 `vercel login` 한 번만 하면 끝나도록 순서를 고정해 둔 것이다.

---

## 지금 확인된 사실 (추측 아님)

| 확인 항목 | 결과 | 방법 |
|---|---|---|
| `.vercel/project.json` | **없음** | `ls .vercel` |
| git 히스토리 전체에 존재한 적 | **없음** | `git rev-list --all` 전수 `git cat-file -e` |
| Vercel CLI 로그인 | **로그아웃** | `vercel whoami` → `Logged out` |
| `sertz.vercel.app` | **HTTP 200 (라이브)** | `curl` |
| `sertz11.vercel.app` | **404** | `curl` — 폐기된 것으로 보임 |
| CLI 캐시 orgId 후보 | `team_3l7zpSe6Fbf7QK0Q3EGEdwiX` | `~/.local/share/com.vercel.cli/config.json` |

**정정 사항**: `docs/REVAMP_100.md` #27 과 `tests/vercel-deploy.test.mjs` 주석이
"`.vercel/project.json` — projectId/orgId 바인딩됨" 이라고 적고 있었으나 **사실이 아니다.**
히스토리 어디에도 그 파일은 없었다. 그 문구 때문에 "설정은 정상, Git 연동만 남았다"는
잘못된 진단이 굳어졌다.

---

## 절차

### 1. 로그인 (사용자 직접)

```bash
cd /root/workspace/CERTZ
npx vercel login
```

> ⚠ 이 단계는 **반드시 사용자가 직접** 한다. 에이전트는 자격증명을 입력하지 않는다.
> 이메일/OAuth 중 편한 방식으로. 브라우저가 없으면 `--github` 또는 매직링크를 쓴다.

### 2. 프로젝트 연결

```bash
npx vercel link
# 기존 프로젝트를 고를 것인지 물으면 → "Link to existing project" 선택
# sertz.vercel.app 에 해당하는 프로젝트를 고른다 (새로 만들지 말 것)
```

`vercel link` 가 `.vercel/project.json` 을 만든다. 여기에 `projectId`/`orgId` 가 들어간다.

### 3. 상태 확인

```bash
node scripts/vercel_bind_check.mjs
# [vercel] 바인딩 있음 — projectId=prj_xxx orgId=team_xxx
```

### 4. 테스트가 자동으로 통과하는지 확인

```bash
npm test
# 533 tests / 532 pass / 0 fail / 1 skipped  ← skip 이 pass 로 바뀐다
```

`tests/vercel-deploy.test.mjs` 는 바인딩 파일이 **있으면** 내용을 검사하고
**없으면** skip 한다. 파일만 생기면 자동으로 검사 모드로 전환된다. 테스트 수정 불필요.

### 5. 커밋 여부 결정 — 여기서 판단이 갈린다

`.gitignore:37` 이 `.vercel` 을 제외한다. 두 가지 선택:

**A. 바인딩을 커밋한다** (테스트 이름값을 하려면 이쪽)
```bash
# .gitignore 에서 .vercel 만 예외 처리
echo '!.vercel/project.json' >> .gitignore
git add -f .vercel/project.json .gitignore
```
- 장점: 다른 환경(CI/다른 PC)에서도 `vercel link` 없이 배포 가능
- 단점: `projectId`/`orgId` 는 **비밀값은 아니지만** 저장소에 노출된다.
  Vercel 공식 문서도 커밋을 권장하는 편이다(팀 협업용).

**B. 커밋하지 않는다** (로컬 전용)
- `.gitignore` 를 그대로 두고, 배포는 `vercel --prod` 로만 한다.
- 이 경우 테스트는 계속 skip 이다. **그게 정직한 상태다** — 링크 안 된 환경에서는
  바인딩이 없는 게 맞으니까.

### 6. 배포 확인

```bash
npx vercel --prod
curl -s -o /dev/null -w "%{http_code}\n" https://sertz.vercel.app/
```

---

## 배포 전 반드시 — 버전 범프

`android-version.json` 을 올리지 않으면 GitHub Release 의 기존 APK 자산을 **덮어쓴다.**

```json
// 현재
{"code": 261, "name": "2.2.5"}
// 배포 시
{"code": 262, "name": "2.2.6"}
```

APK 는 `.github/workflows/android-build.yml` 이 `android/**` 푸시로 자동 빌드한다.
서명키 4종은 Secret 에 등록돼 있다. Release 에 `SERTZ-vc{code}.apk` 로 첨부된다.

---

## 주의 — `sertz11.vercel.app` 은 404 (다만 API 는 정상)

`worklog.md:2697` 에 "멀티서버 분리: Vercel(sertz)=정적 미러, sertz11=게임 서버 본체"
라고 적혀 있으나, 지금 `sertz11.vercel.app` 은 **404** 다.

**실측 결과 (2026-11-09):**

| 확인 | 결과 |
|---|---|
| `sertz.vercel.app/api/version` | **200** — `{"latest":"2.2.5","code":261}` |
| `sertz.vercel.app/api/rank` | **200** |
| `sertz.vercel.app/api/auth/me` | **200** |
| `sertz11.vercel.app` | **404** |

**판정**: `sertz11` 은 소켓(멀티플레이) 전용 호스트였다. `src/game/net.ts:104` 주석에
"Vercel은 계정/거래소 API 본체지만 소켓 서버는 **없다**" 고 명시돼 있고
`GAME_SERVER` 가 비면 **오프라인으로 정상 폴백**한다. 즉:

- 계정·거래소·랭킹·버전게이트 → **정상** (sertz 미러가 처리)
- 실시간 멀티플레이 소켓 → **없음** (오프라인 폴백, 게임 진행에 지장 없음)

따라서 `sertz11` 404 는 **지금 당장 급한 결함이 아니다.** 멀티를 되살릴 때만
`NEXT_PUBLIC_GAME_SERVER` 를 채우면 `net.ts:106` 경로가 부활한다.

다만 확인해 둘 것: 기존 APK 가 `GAME_SERVER` 를 빌드타임에 인라인했다면
멀티 연결을 계속 재시도하며 지연을 만들 수 있다. 실기기(S20+)에서
파티/친구 진입 시 타임아웃이 있는지 한 번 보는 게 좋다.

