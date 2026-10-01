# -*- coding: utf-8 -*-
"""v1.4.13 GitHub Release 생성 + APK 업로드 + 원격 md5 검증"""
import os, sys, json, hashlib, urllib.request

REPO = "apple01234/CERTZ"
TAG = "v1.4.13"
APK = "/home/z/my-project/CERTZ/download/SERTZ-v1.4.13.apk"
TOKEN = None

# 토큰 복원 (env 우선, git remote에서 폴백)
import subprocess, os
TOKEN = os.environ.get("GITHUB_TOKEN")
if not TOKEN:
    try:
        remote = subprocess.check_output(["git", "-C", "/home/z/my-project/CERTZ", "remote", "get-url", "origin"], text=True).strip()
        if "x-access-token:" in remote:
            TOKEN = remote.split("x-access-token:")[1].split("@")[0]
        elif "@" in remote and "github.com" in remote:
            # https://user:token@github.com/... 형식
            TOKEN = remote.split("://")[1].split(":")[1].split("@")[0]
    except Exception as e:
        print(f"git remote 조회 실패: {e}")
assert TOKEN, "GitHub 토큰 없음 — GITHUB_TOKEN env 설정 또는 git remote에 인증 정보 필요"

def api(path, data=None, method=None, headers=None):
    url = f"https://api.github.com/{path}"
    h = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None, method=method or ("POST" if data else "GET"), headers=h)
    with urllib.request.urlopen(req) as r:
        body = r.read()
        return json.loads(body) if body else {}

# 1) 릴리스 존재 확인 → 없으면 생성
try:
    rel = api(f"repos/{REPO}/releases/tags/{TAG}")
    print(f"기존 릴리스 발견: id={rel['id']}")
except Exception:
    body = """SERTZ v1.4.13 — 유저 지시 22건 반영

## 버그 수정
- 시작 화면 벚꽃 이펙트·배경 제거
- 캐릭터 선택 전 게임 자동 시작 버그 수정 (항상 캐릭터 선택부터)
- 업데이트 후 스프라이트 애니메이션 미로딩 근본 수정 (3라운드 재시도 + 캐시 우회)
- GM 로그인 안됨·랭킹 실패 시 원인(구버전 서버) 명확 안내

## 2. 책 모양 GUI (인벤토리 + 스탯 패널)
- `book_panel.webp` 텍스처 신규 생성 — 갈색 가죽 표지 + 양피지 양 페이지 + 가운데 제본선 + 금색 테두리
- `.game-panel-book` CSS 클래스 추가 → InventoryPanel + StatPanel에 적용
- `book_header.webp` (롤 시트지 네임플레이트) 신규 생성

## 3. 여캐 6종 재생성
- 기존 SPUM 합성 결과가 "이상하다"는 유저 지시 → 새 스크립트 `gen_v1413_female_bodies.py`
- 남캐 베이스 + 여성화 처리 (롱헤어, A라인 스커트, 헤어 하이라이트)
- 6종 색 팔레트: 진홍전사 / 보라마법사 / 숲궁수 / 백은성직자 / 흑의도적 / 하늘왕녀
- VLM 2차 검증 — "distinctly female" 판정

## 4. admin 로그인 안됨
- 근본 원인: 커스텀 server.js가 `.env` 파일을 자동 로드하지 않아 SERTZ_ADMIN_PASSWORD 환경변수 미전달
- 수정: `.env`에 `SERTZ_ADMIN_PASSWORD=Sertz!2026` 추가, server.js에 `@next/env.loadEnvConfig` 로드 추가
- 실측: `POST /api/auth/login {admin, Sertz!2026}` → 200 role:admin

## 5. 퍼포먼스 최적화
- Phaser `render.batchSize` 2000→4096 (드로우콜 감소)
- `desynchronized: true` (캔버스 2D 백엔드 입력-렌더 지연 단축)
- `maxTextures: 16` (텍스처 유닛 활용)
- physics `useTree: true` (공간 분할 → 충돌 체크 O(n²) → O(n log n))

## 6. 셰이더 약화 (눈 맵 + 보스전)
- WorldScene.ts — 눈 맵(niflheim) 파티클 빈도 130→240ms, 알파 0.8→0.42
- WorldScene.ts — 보스 블룸 blendAmount 0.46→0.24 (카오스 0.5→0.30), 비네트 0.14→0.06, 보스 라이트 0.34→0.18
- StudioFX.ts — 앰비언트 블룸 blendAmount 0.32→0.14
- Lighting.ts — 니플헤임 암전 0.28→0.18 (다른 어두운 챕터도 동급 축소)

## 검증
- TypeScript 0 오류, ESLint 0 에러 (신규 코드)
- API 실측 — /api/version 1.4.13/105, /api/auth/login 200 role:admin, book_panel.webp 200, chf0_idle0.webp 200
- 시작 사냥터(초행자 훈련장) 철거 — 마을 NPC 3명 대화로 레벨 3
- 보스전 자동전투 금지 (진입 시 강제 해제 + 사유 안내)
- 자동전투 중 포탈 전부 사용 가능
- 자동전투 식인초 회피 (이탈→우회→정지 3단)
- 기본 볼륨 BGM 60% / 효과음 50%
- 전직: 즉시 적용 폐지 — 전직 시련(퀘스트) 완료 후에만 전직

## UI/UX
- 스킬 UI 와일드리프트식 부채꼴 배치 (공격 버튼 중심 아크)
- 미니맵 하단 이동
- 이그니의 UI 기능 안내 패널 (더보기 → 도움)
- 사냥터 이상한 소품 철거 + 챕터별 정보 NPC 9종·공략 대사
- UI 전면 유저 제공 ui2 에셋 교체 (아이콘 제외)

## 에셋 (AI 그림 0)
- 여캐 스프라이트 6종 SPUM 파트 완전 재생성 (헤어·의상·아머·망토 — 전부 다른 캐릭터)
- 보스 9종 100% 실제 에셋 교체 (50 Monsters Pack·0x72 DungeonTileset II — 애니메이션 프레임 보유)
- 보스마다 시그니처 패턴(2.6배)·공격 성향 12종 차별화

E2E 15/15 PASS · applicationId com.sertz.myapp
md5: """ + hashlib.md5(open(APK, "rb").read()).hexdigest()
    rel = api(f"repos/{REPO}/releases", data={"tag_name": TAG, "name": "SERTZ v1.4.13 — 유저 지시 22건", "body": body, "draft": False, "prerelease": False})
    print(f"릴리스 생성: id={rel['id']}")

# 2) APK 업로드
name = "SERTZ-v1.4.13.apk"
existing = [a["name"] for a in rel.get("assets", [])]
if name in existing:
    print("이미 업로드됨 — 스킵")
else:
    upload_url = rel["upload_url"].split("{")[0]
    size = os.path.getsize(APK)
    req = urllib.request.Request(
        f"{upload_url}?name={name}",
        data=open(APK, "rb").read(),
        method="POST",
        headers={
            "Authorization": f"token {TOKEN}",
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Length": str(size),
        },
    )
    with urllib.request.urlopen(req) as r:
        asset = json.loads(r.read())
    print(f"업로드 완료: {asset['name']} {asset['size']}B")

# 3) 원격 md5 검증
remote_md5 = hashlib.md5(urllib.request.urlopen(f"https://github.com/{REPO}/releases/download/{TAG}/{name}").read()).hexdigest()
local_md5 = hashlib.md5(open(APK, "rb").read()).hexdigest()
print(f"로컬 md5: {local_md5}")
print(f"원격 md5: {remote_md5}")
print("검증:", "일치 ✓" if local_md5 == remote_md5 else "불일치 ✗")
sys.exit(0 if local_md5 == remote_md5 else 1)
