#!/usr/bin/env python3
"""v1.0.14 Release 생성 + APK 업로드 + 원격 md5 검증 (Task 78)"""
import json, subprocess, sys, hashlib, urllib.request, os

REPO = "apple01234/CERTZ"
TAG = "v1.0.14"
APK = "/home/z/my-project/download/SERTZ-v1.0.14.apk"
EXPECT_MD5 = "313438c31e004b5e0feb4424393b4f15"

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
        return urllib.request.urlopen(req, timeout=120)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            import io
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
print(f"[1] 로컬 APK md5={local_md5} size={size}")
assert local_md5 == EXPECT_MD5, f"로컬 md5 불일치! {local_md5} != {EXPECT_MD5}"

# 1) 기존 릴리스 확인 (재실행 대비)
existing = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if isinstance(existing, dict) and existing.get("id"):
    rel_id, state = existing["id"], existing["draft"]
    print(f"[2] 기존 릴리스 발견 id={rel_id} draft={state}")
    if state:
        api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
            json.dumps({"draft": False}).encode(), {"Content-Type": "application/json"}, "PATCH")
        print("    draft → published 전환")
else:
    body = (
        "## SERTZ v1.0.14 (versionCode 79)\n\n"
        "### 투사체 방향 — 멀티 근본 수정\n"
        "- 원격 유저의 활·화살이 **항상 등 뒤로** 나가던 버그 수정 — 네트워크 flip을 물리 방향(오른쪽=true)으로 정규화\n"
        "- 공격 중 flipX는 걷기 컨벤션과 의미가 정반대(공격 시트 우향 네이티브)였던 것이 근원 — `netFacingFlip` 신설\n"
        "- 적 원거리 투사체(파이어볼·다크볼트 등) 진행 방향 회전 정렬 — 역주행 렌더 수정\n\n"
        "### 다운로드\n"
        f"- `SERTZ-v1.0.14.apk` ({size:,} bytes)\n"
        f"- MD5: `{local_md5}`\n\n"
        "※ 설치 시 기존 버전 위에 덮어쓰기하면 세이브가 유지됩니다."
    )
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": "SERTZ v1.0.14 — 화살은 조준의 방향으로",
        "body": body, "draft": False, "prerelease": False,
    }).encode()
    rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases", payload, {"Content-Type": "application/json"}, "POST"))
    rel_id = rel["id"]
    print(f"[2] 릴리스 생성 id={rel_id}")

# 2) 에셋 확인/업로드
assets = json.load(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}"))["assets"]
names = [a["name"] for a in assets]
print(f"[3] 기존 에셋: {names}")
if APK.split("/")[-1] not in names:
    up = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name=SERTZ-v1.0.14.apk"
    with open(APK, "rb") as f:
        data = f.read()
    res = json.load(api(up, data, {"Content-Type": "application/vnd.android.package-archive"}, "POST"))
    print(f"[3] 업로드 완료 state={res['state']} size={res['size']}")
    assert res["state"] == "uploaded"
else:
    print("[3] 에셋 이미 존재 — 업로드 생략")

# 3) 원격 md5 검증 (릴리스 URL 실다운로드)
url = f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.0.14.apk"
print(f"[4] 원격 다운로드 검증: {url}")
tmp = "/home/z/my-project/scripts/.remote_check.apk"
urllib.request.urlretrieve(url, tmp)
remote_md5 = md5f(tmp)
os.remove(tmp)
print(f"[4] 원격 md5={remote_md5}")
assert remote_md5 == local_md5, "원격 md5 불일치!"
print("=== OK — Release v1.0.14 배포 검증 완료 ===")
