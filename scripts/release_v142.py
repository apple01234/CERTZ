#!/usr/bin/env python3
"""v1.4.2 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 리포트 2건 — 스프라이트 로딩 실패 자동 재시도 + 요새 유적 타일맵 정상화)
   v1.3.1/v1.4.0 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.2"
APK = "/home/z/my-project/download/SERTZ-v1.4.2.apk"
EXPECT_MD5 = "7482a68498ff1efa4498614a3515007c"

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

BODY = """## v1.4.2 — 재진단 근본 수정: 요새 유적 타일맵 최종 수정 + 스프라이트 무결성 감사·수복 체계 (versionCode 94)

### 🏰 요새 유적 타일맵 근본 수정 (실측 확정 원인)
- **엔진 렌더 결함 확정** — 이 엔진(Phaser 4)은 Image.setCrop 시 크롭 영역을 오브젝트 위치가 아닌 '전체 텍스처 쿼드 내 원래 오프셋'에 렌더한다. 잔디 타일은 +96px, 흙 타일은 +64px 밀려 그려져 발코니 아래에 'π(탁자) 모양' 유령 구조물이 생기고, 목책·계단은 화면 밖으로 밀려나 안 보였다. (스크린샷 실측으로 확정 — v1.4.1은 crop 수치만 교정해 렌더 이동을 잡지 못했음)
- **프레임 방식 전환** — 아틀라스에 이름 프레임(kg_grass/kg_dirt/kg_fence/kg_stairs)을 등록해 스프라이트시트와 동일 경로로 렌더. 어떤 엔진 버전에서도 위치가 어긋나지 않는 구조
- 발코니(잔디+흙 16타일)·기둥 2개·목책 4개·나무계단·횃불·2층 상자가 모두 의도 위치에 렌더되는 것을 스크린샷+E2E 좌표 실측으로 검증

### 🖼️ 스프라이트 미로딩 2차 방어 — texGuard 무결성 체계
- **전수 무결성 감사** — 부트 완료/월드 진입 시점에 기대 텍스처(985종+) 전수를 대조해 누락/손상분을 자동 재로드 (v1.4.1 재시도 3회 한도 초과분까지 커버)
- **상주 감시** — 백그라운드 복귀·WebGL 컨텍스트 복구 직후 재검증 + 9초 주기 표본 감사로 WebView의 이미지 회수(eviction)분도 자동 복구
- 수복 시 씬 오브제 재결합(setTexture)까지 처리해 화면에 즉시 반영

---
- md5: `7482a68498ff1efa4498614a3515007c` (111,666,934B · versionCode 94)
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
        "tag_name": TAG, "target_commitish": "main", "name": f"SERTZ {TAG} — 요새 유적 최종 수정·스프라이트 무결성 감사 체계",
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

tmp = "/tmp/verify_v142.apk"
urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-{TAG}.apk", tmp)
remote = md5f(tmp)
print(f"원격 md5: {remote} — {'일치 ✓' if remote == EXPECT_MD5 else '불일치 ✗'}")
assert remote == EXPECT_MD5, "원격 md5 불일치!"
print("RELEASE COMPLETE")
