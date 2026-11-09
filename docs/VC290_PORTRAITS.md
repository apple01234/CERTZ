# vc290 — 2026-11-09 Drive 초상화 배급 적용

- **배급분**: Google Drive `131Wb1jEDPLyWeqCGtCISM7g6lNgKSnvX` (52.9 MB ZIP)
- **수량**: 41개 PNG(각 1024×1024) → **164개 초상화**
- **적용일**: 2026-11-09
- **적용 대상**: SERTZ (`/root/workspace/CERTZ`) 대화 초상화

## 1. 소스 분석

PixAI로 생성된 이미지 41장. **파일 1개가 4개 초상화**를 담고 있다:

```
1024×1024 = 2×2 그리드, 사분면(512×512)마다 캐릭터 1명
41 × 4 = 164개
```

- 스타일: 픽셀아트 판타지 RPG (기사/마법사/궁수/사제/암살자 등)
- 프레이밍: 흉상(bust) — 대화 초상화에 적합
- **배경: 순백색, 불투명** (알파 전부 255, 흰색 비율 57%) → 제거 필요

## 2. SERTZ 규격 (실측)

| 항목 | 기존 초상화 | 처리 후 |
|---|---|---|
| 크기 | 84×84 | **84×84** |
| 포맷 | RGBA PNG (webp 아님) | RGBA PNG |
| 투명도 | 약 46% | 31~49% |
| 등록 | `npcportrait/_map.json` | 동일 |

## 3. 변환 (`tools/import_portraits_20261109.py`)

1. 1024² → 512² 사분면 4개 분할
2. **흰 배경 제거** — 테두리에서 시작하는 flood-fill(BFS).
   단순 임계값이 아니라 *테두리에 연결된* 흰 영역만 지워
   캐릭터 내부의 흰색(눈 하이라이트·옷 장식)을 보존한다.
3. 인물 bbox 검출 → 84×84 캔버스 **하단 중앙 정렬**(대화창 피벗 규칙)
4. 84px 초과 시 축소. **확대는 하지 않음**(원본 화질 보존)
5. 24px 미만 조각은 노이즈로 버린다

결과: `dxp_<파일번호2><사분면>.png` (예: `dxp_29tl.png`)

## 4. 게임 연결 — 3단계

### 4.1 화자 → 초상화 매핑이 없었다

대사 데이터의 화자 **85명** 중 `_map.json` 에 있는 것은 **24명**뿐.
**61명이 초상화 없이 이름만 표시**되던 상태였다(최다 화자 "연합 안내인" 106회 포함).

→ 품질 점수(채움률 × 인물 높이) 상위 61장을 빈도순 화자에 배정해
`_map.json` 에 **별칭 키**로 등록(`aliasOf` 필드로 원본 추적).

### 4.2 하드코딩 경로 검사가 새 규격을 배제했다 (버그)

`DialogueBox.tsx` 의 두 함수가 `src.includes("/npc_")` 로 생성 초상화를 판별했다.
새 파일명 `dxp_*` 는 이 조건에 걸리지 않아 **전부 무시**됐다.

```diff
- if (direct && String(direct).includes("/npc_")) return direct;
+ if (direct && String(direct).includes("/npcportrait/")) return direct;
```

파일명이 아니라 **디렉터리**로 판정하도록 바꿔 규격 추가 시 재발을 막았다.
(`portraitOf` 와 `faceFor` 두 곳)

### 4.3 `NPC_PORTRAITS` 표가 우선순위였다

`portraitOf` 는 `_map.json` 보다 **하드코딩 표를 먼저** 본다.
표에 이미 등록된 13명은 별칭을 넣어도 기존 SPUM 스프라이트가 계속 나왔다.
→ 표의 `tex` 를 `dxp_*` 로 교체해 신규 초상화가 실제로 표시되게 했다.

## 5. 함께 고친 버그 (vc289 잔여)

`dx_hornbunny_atk0.webp` **404** — 뿔없는 토끼는 원본에 Attack 시트가 없는데
`X3_MONSTERS` 배열에 넣어 `atk0` 을 일괄 요청했다.

```diff
-const X3_MONSTERS = [..., "dx_hornbunny", "dx_hornrabbit"]
+const DX_MONSTERS = ["dx_hornbunny", "dx_hornrabbit"] as const;  // 전용 루프
```

부팅 시 4xx 가 4건 → **3건**으로 감소(남은 3건은 기존 구조:
`_vercel/speed-insights`, `maps/_index.json`, `api/auth/me`).

## 6. 검증

| 항목 | 결과 |
|---|---|
| 초상화 생성 | **164개** |
| 중복 검사 (dHash 8×8, hamming≤6) | 고유 **163** / 중복 1쌍(`dxp_20tl`=`dxp_21tl`) |
| 육안 검증 (28장) | 머리 잘림·흰박스·깨진 이미지 **없음** |
| `_map.json` 키 | 58 → **283** (164 신규 + 61 별칭) |
| `tsc --noEmit` | **0 errors** |
| 매니페스트 경로 해석 | 8/8 성공, 파일 실재 확인 |
| HTTP 서빙 | `dxp_*.png` **200** |
| **UI 렌더 (Playwright)** | 4명 전부 `<img>` naturalWidth **84**, 화면 78×78, `visible: true` |
| 스크린샷 육안 | 대화창에 붉은머리 캐릭터 정상 표시, 화자명 "연합 안내인" |

### 재현

```bash
# 변환
/root/workspace/re_dump/.venv/bin/python tools/import_portraits_20261109.py --dry
/root/workspace/re_dump/.venv/bin/python tools/import_portraits_20261109.py

# 런타임 검증 (프로덕션 빌드 + 서버 필요)
PORT=3500 node server.js &
PROBE_URL=http://127.0.0.1:3500 node scripts/probe_portraits.mjs     # 매니페스트·파일·84×84
PROBE_URL=http://127.0.0.1:3500 node scripts/probe_portrait_ui.mjs   # 실제 대화창 <img> 렌더
```

## 7. 남은 것

- **103장 미배정**: 164개 중 61개만 화자에 연결했다. 나머지는
  신규 NPC/보스 초상화 후보로 `_map.json` 에 등록만 되어 있다
  (`portraitId` 로 지명 호출 가능).
- **표현 차이**: 별칭 배정은 품질 점수 기반 자동 매핑이라
  캐릭터 성격과 화자 역할이 완벽히 맞지는 않는다. 수동 조정이 필요하면
  `_map.json` 의 `aliasOf` 를 바꾸면 된다.
- **중복 1쌍**: `dxp_20tl` / `dxp_21tl` 이 사실상 동일. 다른 화자에 배정되지 않았는지 확인 권장.
