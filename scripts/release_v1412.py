# -*- coding: utf-8 -*-
"""v1.4.12 GitHub Release 생성 + APK 업로드 + 원격 md5 검증"""
import os, sys, json, hashlib, urllib.request

REPO = "apple01234/CERTZ"
TAG = "v1.4.12"
APK = "/home/z/my-project/download/SERTZ-v1.4.12.apk"
TOKEN = None

# 토큰 복원 (git remote에서)
import subprocess
remote = subprocess.check_output(["git", "-C", "/home/z/my-project", "remote", "get-url", "origin"], text=True).strip()
if "x-access-token:" in remote:
    TOKEN = remote.split("x-access-token:")[1].split("@")[0]
assert TOKEN, "GitHub 토큰 없음"

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
    body = """SERTZ v1.4.12 — 유저 지시 22건 반영

## 버그 수정
- 시작 화면 벚꽃 이펙트·배경 제거
- 캐릭터 선택 전 게임 자동 시작 버그 수정 (항상 캐릭터 선택부터)
- 업데이트 후 스프라이트 애니메이션 미로딩 근본 수정 (3라운드 재시도 + 캐시 우회)
- GM 로그인 안됨·랭킹 실패 시 원인(구버전 서버) 명확 안내

## 게임 시스템
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
    rel = api(f"repos/{REPO}/releases", data={"tag_name": TAG, "name": "SERTZ v1.4.12 — 유저 지시 22건", "body": body, "draft": False, "prerelease": False})
    print(f"릴리스 생성: id={rel['id']}")

# 2) APK 업로드
name = "SERTZ-v1.4.12.apk"
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
