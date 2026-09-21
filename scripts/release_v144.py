#!/usr/bin/env python3
"""v1.4.4 Release 생성 + APK 업로드 + 원격 md5 검증 (모바일 가로 로비 입장 불가 근본 수정)
   v1.4.3 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.4"
APK = "/home/z/my-project/download/SERTZ-v1.4.4.apk"
EXPECT_MD5 = "aaefe43028a133c2d07397bbf146ed34"

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
        return urllib.request.urlopen(req, timeout=300)
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


local = md5f(APK)
assert local == EXPECT_MD5, f"로컬 md5 불일치: {local} != {EXPECT_MD5}"
size = os.path.getsize(APK)
print(f"로컬 OK: {APK} {size}B md5={local}")

BODY = """## v1.4.4 — 모바일 가로 화면 "캐릭터 선택 후 게임 시작 안 됨" 근본 수정 (versionCode 96)

### 📱 증상 (유저 리포트)
- 폰을 가로로 들고 캐릭터를 고른 뒤 **「이 캐릭터로 시작」 버튼을 누를 수 없음** — 버튼이 화면 아래 바깥으로 밀려 있었음

### 🔬 근본 원인 (모바일 뷰포트 실측으로 확정)
- 로비 콘텐츠 행(`flex-1 min-h-0`)이 짧은 가로 높이(390px 등)에서 뷰포트 높이로 **압착**됨
- 캐릭터 정보 카드가 행 밖으로 넘쳐 그려지고, 시작 버튼이 **스크롤 가능 영역(scrollHeight) 초과** 위치에 렌더
- 실측: 버튼 중심 y=450 / 뷰포트 390 / scrollHeight 440 → 최대로 스크롤해도 도달 불가
- 데스크톱 E2E는 통과(높이 여유)라 폰에서만 터진 전형적인 뷰포트 회귀

### 🔧 수정
- **레이아웃 높이 압착 제거** — 콘텐츠 행이 콘텐츠 높이만큼 자라 루트 스크롤이 어떤 화면에서도 정상 동작
- **「이 캐릭터로 시작」 버튼을 캐릭터 카드 최상단으로 이동** — 스탯 위 주요 액션 우선 배치, 화면이 작아도 항상 바로 보임
- 수정 후 모바일 가로(844×390) 실측: 버튼 화면 안(inView, 가림 0) → 탭 → 마을 진입(player 생성) 확인

### ✅ 검증
- 모바일 뷰포트(가로 844×390) 캐릭터 생성 → 선택 → 시작 → 월드 진입 전 흐름 실측 PASS
- E2E v1.4.3 24/24 · 회귀 10/10·16/16 PASS (pageerror 0)

---
- md5: `aaefe43028a133c2d07397bbf146ed34` (117,493,972B · versionCode 96)
- 기존 세이브 그대로 유지 · 덮어설치 가능
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html"""

# 1) 기존 릴리스 존재 확인
r = api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}")
rel = json.loads(r.read() if hasattr(r, "read") else b"{}")
rel_id = rel.get("id")
if rel_id:
    print(f"기존 Release 존재(id={rel_id}) — 자산 교체")
else:
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": "SERTZ v1.4.4 — 모바일 가로 로비 입장 수정",
        "body": BODY, "draft": False, "prerelease": False,
    }).encode()
    r = api(f"https://api.github.com/repos/{REPO}/releases", payload, {"Content-Type": "application/json"})
    rel = json.loads(r.read())
    rel_id = rel["id"]
    print(f"Release 생성: id={rel_id} tag={TAG}")

# 2) 기존 자산 삭제 후 업로드
r = api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}/assets")
for a in json.loads(r.read() if hasattr(r, "read") else b"[]"):
    if a.get("name") == os.path.basename(APK):
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 자산 삭제: {a['name']}")
        time.sleep(1)

url = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={os.path.basename(APK)}"
data = open(APK, "rb").read()
req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Authorization", f"token {TOKEN}")
req.add_header("Content-Type", "application/octet-stream")
r = urllib.request.urlopen(req, timeout=1800)
print("업로드:", json.loads(r.read())["browser_download_url"])

# 3) 원격 md5 검증
for attempt in range(5):
    try:
        tmp = "/tmp/_remote_check.apk"
        urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.4.4.apk", tmp)
        remote = md5f(tmp)
        os.remove(tmp)
        assert remote == EXPECT_MD5, f"원격 md5 불일치: {remote}"
        print(f"원격 md5 검증 ✓ — {remote}")
        break
    except Exception as e:
        print(f"검증 재시도 {attempt+1}/5: {e}")
        time.sleep(5)
else:
    raise SystemExit("원격 md5 검증 실패")
print("v1.4.4 릴리스 완료")
