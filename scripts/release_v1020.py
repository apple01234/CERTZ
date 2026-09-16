#!/usr/bin/env python3
"""v1.0.20 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 피드백 4건 — Task 84)
   v1.0.19 스크립트 개선식: 업로드 후 apk-guide 서빙 md5 검증 유지"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.0.20"
APK = "/home/z/my-project/download/SERTZ-v1.0.20.apk"
EXPECT_MD5 = "6d22a7148db7160b1fe4fd5e3d237fde"

TOKEN = subprocess.run(
    ["git", "remote", "get-url", "origin"], capture_output=True, text=True, cwd="/home/z/my-project"
).stdout.strip()
TOKEN = TOKEN.split("x-access-token:")[1].split("@")[0]

HDRS = {"Authorization": f"token {TOKEN}", "User-Agent": "curl", "Accept": "application/vnd.github+json"}


def api(url, data=None, headers=None, method=None):
    h = dict(HDRS)
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        return urllib.request.urlopen(req, timeout=180)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return io.BytesIO(b'{"message":"not found"}')
        raise


def md5f(path):
    m = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            m.update(chunk)
    return m.hexdigest()


local_md5 = md5f(APK)
size = os.path.getsize(APK)
assert local_md5 == EXPECT_MD5, f"로컬 md5 불일치 {local_md5}"
print(f"로컬: {APK} {size}B md5={local_md5}")

BODY = """## v1.0.20 — UI 전면 교체 + 유니온·전직 수정 + 검은화면 대책 (versionCode 85)

### 🎨 UI 전면 교체 (AI스러운 UI → 게임형)
- 타이틀: 금 잉곽 픽셀 로고타입 + 우드 프레임 부제 플레이트 + 금빛 베벨 버튼
- 전 패널 19곳: 딥 네이비 바디 + 우드 이중 프레임 + 내곽 금선 (글래스·보라 그라데이션 제거)
- 로비: 게임형 헤더/카드/생성 마법사 · HUD: 우드 칩 버튼 + 게임형 LV 플레이트 · 대화창: 우드 프레임 + 금 네임플레이트 · 터치 스킬 버튼: 네이비+골드 링

### 🐛 버그 수정
- **유니온 UI 모바일 짤림** — 너비/높이 제한 클래스 변조로 제한이 아예 빠졌던 것 복원 (375×812 실측 수납)
- **생성 캐릭터 전직 데드락** — 로비 생성 캐릭터는 1차 직업 보유 출생이라 2차 시련이 영구히 시작 불가했던 버그 → 카이엔 대화로 2차 시련 바로 시작 (3차 이상 연쇄 게이트 유지)

### 🛡 검은화면 대책
- **부팅 로딩 화면 신설** — 로고+진행바+TIP 순환 (APK 콜드스타트의 순수 검은 화면 제거)
- **크래시 복구 오버레이** — 미처리 예외 시 "다시 시작" 안내 화면 표시 (React 밖 순수 DOM — 게임이 죽어도 복구 경로 확보)
- HUD 버튼행 flex-wrap — 375px 세로에서 전 패널 버튼 수납

md5: `6d22a7148db7160b1fe4fd5e3d237fde` (106,109,482B)
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.0.20 — UI 전면 교체·유니온/전직 수정·검은화면 대책", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.0.20 — UI 전면 교체·유니온/전직 수정·검은화면 대책",
            "body": BODY,
            "draft": False,
            "prerelease": False,
        }).encode(),
        headers={"Content-Type": "application/json"},
    ))
    rel_id = created["id"]
    print(f"릴리스 생성 id={rel_id}")

# 2) 업로드
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}"))
up = rel["upload_url"].split("{")[0]
name = f"SERTZ-{TAG}.apk"

for a in rel.get("assets", []):
    if a["name"] == name:
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 asset 삭제 id={a['id']}")

data = open(APK, "rb").read()
upl = urllib.request.Request(
    f"{up}?name={name}",
    data=data,
    headers={"Authorization": f"token {TOKEN}", "Content-Type": "application/octet-stream", "User-Agent": "curl"},
    method="POST",
)
resp = json.load(urllib.request.urlopen(upl, timeout=600))
print(f"업로드 완료 asset id={resp['id']} size={resp['size']}")

# 3) 원격 md5 복수검증
req = urllib.request.Request(
    f"https://github.com/{REPO}/releases/download/{TAG}/{name}",
    headers={"User-Agent": "curl"},
)
remote = urllib.request.urlopen(req, timeout=600).read()
rm = hashlib.md5(remote).hexdigest()
print(f"원격 재다운로드: {len(remote)}B md5={rm}")
print("MD5 일치!" if rm == EXPECT_MD5 else f"MD5 불일치!! 기대 {EXPECT_MD5}")

# 4) apk-guide 서빙 md5 잔존 검증 (로컬 서버 기준)
try:
    guide = urllib.request.urlopen("http://localhost:3000/apk-guide.html", timeout=15).read().decode()
    print(f"apk-guide 서빙 md5 포함: {EXPECT_MD5 in guide}")
    if EXPECT_MD5 not in guide:
        print("!! guide에 새 md5 없음 — 정정 필요")
except Exception as e:
    print(f"guide 검증 스킵: {e}")

print("DONE")
