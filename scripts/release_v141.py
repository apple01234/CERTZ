#!/usr/bin/env python3
"""v1.4.1 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 리포트 2건 — 스프라이트 로딩 실패 자동 재시도 + 요새 유적 타일맵 정상화)
   v1.3.1/v1.4.0 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.1"
APK = "/home/z/my-project/download/SERTZ-v1.4.1.apk"
EXPECT_MD5 = "ddc0447300d9fba9541d5688d2b6df11"

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

BODY = """## v1.4.1 — 유저 리포트 2건 수정: 스프라이트 로딩 실패 자동 복구 + 요새 유적 타일맵 정상화 (versionCode 93)

### 🖼️ 스프라이트 미로딩 수정
- **로드 실패 자동 재시도 체계** — 부팅 로더/타이틀 지연 로더에서 실패한 파일을 자동으로 최대 3회 재요청. Android WebView가 1천+ 로컬 에셋 요청 중 일부를 실패시키면 Phaser 로더가 그 파일을 조용히 건너뛰어 해당 스프라이트가 세션 내내 안 보이던 원인을 차단
- 재시도 후에도 실패한 파일만 선별적으로 건너뛰고 로딩은 항상 완료 (검은화면 재발 없음)

### 🏰 요새 유적 타일맵 정상화 (근본 원인 3종 수정)
- **흙 타일 투명/돌테두리 버그** — 크롭+좌우반전(flipX) 조합 시 크롭 영역이 텍스처 전체 기준으로 미러링되는 Phaser 4 동작 때문에, 반전 흙타일이 투명 셀(448,32)을 가리켜 발코니가 구멍투성이로 보였음 → 반전 폐지 + 아틀라스 내부의 균일 흙셀(48,32)·잔디 셀(48,0)로 크롭 교정
- **난간 = 실제 목책** — 기존 난간 크롭(368,96)은 울타리가 아니라 '창·도끼' 오브제였음 → props 시트의 실제 목책(254,86)으로 교체
- **계단 = 실제 나무계단** — 발코니 오른쪽 아래에 부유했던 흙타일 4장을 props 시트의 나무계단 소품(158,680)으로 교체, 계단통로에 정확히 부착

---
- md5: `ddc0447300d9fba9541d5688d2b6df11` (111,665,538B · versionCode 93)
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
        "tag_name": TAG, "target_commitish": "main", "name": f"SERTZ {TAG} — 스프라이트 로딩 자동 복구·요새 유적 정상화",
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

tmp = "/tmp/verify_v141.apk"
urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-{TAG}.apk", tmp)
remote = md5f(tmp)
print(f"원격 md5: {remote} — {'일치 ✓' if remote == EXPECT_MD5 else '불일치 ✗'}")
assert remote == EXPECT_MD5, "원격 md5 불일치!"
print("RELEASE COMPLETE")
