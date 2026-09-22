#!/usr/bin/env python3
"""v1.4.3 Release 생성 + APK 업로드 + 원격 md5 검증 (캐릭터 선택 후 진입 불가·웹페이지 응답없음 근본 수정)
   v1.4.2 스크립트 계승 — APK 전용"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.3"
APK = "/home/z/my-project/download/SERTZ-v1.4.3.apk"
EXPECT_MD5 = "6bdbb1fceee8be446b2842849b8e7399"

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

BODY = """## v1.4.3 — 캐릭터 선택 후 게임 진입 불가·웹페이지 응답없음 근본 수정 (versionCode 95)

### 🎮 원인 확정 — 1,036장 외형 일괄 로드가 진입을 막고 있었다
- 타이틀 화면에서 코스튬/직업/GM 외형 시트 **37종 × 28프레임(≈1,036장 webp)** 을 백그라운드로 몰아서 받고, 게임 시작 버튼을 누르면 **전체 완료를 기다렸다** 진입하는 구조였음
- 대량 로드 압박으로 브라우저/Android WebView의 메인 스레드가 포화 → **"캐릭터 선택 후 게임이 안 들어가고 웹페이지가 응답없음"** 상태 발생 (최악 시 8초 폴백 + 그 이후에도 1,036장 텍스처 업로드 부하가 이어짐)

### 🔧 근본 수정 — 필요한 외형 1종만, 즉시 진입
- **타이틀 일괄 지연 로드 폐지** — 1,036장 요청 자체를 제거. 이어하기 캐릭터에 필요한 외형 시트 **1종(28프레임)** 만 준비 후 바로 진입
- **신규 캐릭터는 로드 0** — 기본 외형(부트 로드분)이므로 즉시 진입 (E2E 실측 진입 1.8초)
- **게임 중 동적 로드** — 전직/GM 승인 등으로 필요해진 시트는 그 자리에서 로드 후 전환 (로더 우회 네이티브 병렬 로딩 + 게임 루프 폴링 재적용 — 로더 경합과 무관하게 100% 전환)
- **폴백 방어** — 로드 실패 시에도 기본 외형으로 정상 기동 (무한 루프 방지 한도 내 자동 재시도)

### ✅ 검증
- 신규 E2E 12/12 PASS (타이틀 외형 요청 0건 · 월드 등장 1.8초 · pageerror 0)
- 회귀 5종 97/97 PASS (v1.4.2 12·v1.4.1 14·v1.3.1 16·v1.3.0 19·v1.2.1 24 — 유적 렌더·texGuard·코스튬 전환 포함)
- APK aapt 검증: versionCode 95 / versionName 1.4.3

---
- md5: `6bdbb1fceee8be446b2842849b8e7399` (111,667,602B · versionCode 95)
- 기존 세이브 그대로 유지 · 덮어설치 가능
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html
"""

# 1) 기존 릴리스/태그 확인
rel = json.loads(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}").read())
if rel.get("id"):
    print(f"기존 릴리스 재사용: id={rel['id']}")
    rel_id = rel["id"]
    for a in rel.get("assets", []):
        if a["name"] == os.path.basename(APK):
            api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
            print(f"기존 asset 삭제: {a['name']}")
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"body": BODY, "draft": False, "prerelease": False}).encode(),
        headers={"Content-Type": "application/json"}).read()
else:
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": f"SERTZ {TAG} — 캐릭터 선택 진입 프리징 근본 수정",
        "body": BODY, "draft": False, "prerelease": False,
    }).encode()
    rel = json.loads(api(f"https://api.github.com/repos/{REPO}/releases", data=payload,
                         headers={"Content-Type": "application/json"}).read())
    rel_id = rel["id"]
    print(f"신규 릴리스 생성: id={rel_id} tag={TAG}")

# 2) APK 업로드
up_url = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={os.path.basename(APK)}"
with open(APK, "rb") as f:
    data = f.read()
for attempt in range(3):
    try:
        api(up_url, data=data, headers={"Content-Type": "application/octet-stream"}).read()
        break
    except Exception as e:
        print(f"업로드 재시도 {attempt+1}: {e}")
        time.sleep(5)
print("업로드 완료")

# 3) 원격 검증
time.sleep(3)
assets = json.loads(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}").read())["assets"]
for a in assets:
    print(f"asset: {a['name']} {a['size']}B state={a['state']}")

tmp = "/tmp/verify_v143.apk"
urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-{TAG}.apk", tmp)
remote = md5f(tmp)
print(f"원격 md5: {remote} — {'일치 ✓' if remote == EXPECT_MD5 else '불일치 ✗'}")
assert remote == EXPECT_MD5, "원격 md5 불일치!"
print("RELEASE COMPLETE")
