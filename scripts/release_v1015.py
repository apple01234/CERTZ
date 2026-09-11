#!/usr/bin/env python3
"""v1.0.15 Release 생성 + APK 업로드 + 원격 md5 검증 (Task 79)"""
import json, subprocess, sys, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.0.15"
APK = "/home/z/my-project/download/SERTZ-v1.0.15.apk"
EXPECT_MD5 = "c588b0060b8093eb5f290c53ffbfcdc1"

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

existing = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if isinstance(existing, dict) and existing.get("id"):
    rel_id = existing["id"]
    print(f"[2] 기존 릴리스 발견 id={rel_id} draft={existing.get('draft')}")
else:
    body = (
        "## SERTZ v1.0.15 (versionCode 80)\n\n"
        "### 로그인 안 됨 — 3차 보고 근본 수정\n"
        "- **원인**: 기본 접속 서버(sertz4)가 구버전 서버 프로그램으로 고정돼 있어 APK의 로그인 요청 사전확인(OPTIONS)이 404로 실패 — 채팅(실시간 소켓)은 되는데 로그인만 안 되던 현상\n"
        "- **수정**: 로그인/가입 요청을 사전확인 없이 보내는 방식(text/plain 단순 요청)으로 전환 — 구형 서버에서도 로그인 성공 (sertz4 실측 200 확인)\n"
        "- 로그인 유저 캐시 폴백 — 계정창을 다시 열 때 로그아웃처럼 보이던 현상 완화\n\n"
        "### 이전 버전(v1.0.14) — 멀티 투사체 방향 근본 수정\n"
        "- 원격 유저의 활·화살이 등 뒤로 나가던 버그 수정(네트워크 flip 물리 방향 정규화)\n"
        "- 적 원거리 투사체 진행 방향 정렬\n\n"
        "### 다운로드\n"
        f"- `SERTZ-v1.0.15.apk` ({size:,} bytes)\n"
        f"- MD5: `{local_md5}`\n\n"
        "※ 기존 버전 위에 덮어쓰기 설치하면 세이브가 유지됩니다."
    )
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": "SERTZ v1.0.15 — 어디서든 로그인",
        "body": body, "draft": False, "prerelease": False,
    }).encode()
    rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases", payload, {"Content-Type": "application/json"}, "POST"))
    rel_id = rel["id"]
    print(f"[2] 릴리스 생성 id={rel_id}")

assets = json.load(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}"))["assets"]
names = [a["name"] for a in assets]
print(f"[3] 기존 에셋: {names}")
if APK.split("/")[-1] not in names:
    up = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name=SERTZ-v1.0.15.apk"
    with open(APK, "rb") as f:
        data = f.read()
    res = json.load(api(up, data, {"Content-Type": "application/vnd.android.package-archive"}, "POST"))
    print(f"[3] 업로드 완료 state={res['state']} size={res['size']}")
    assert res["state"] == "uploaded"
else:
    print("[3] 에셋 이미 존재 — 업로드 생략")

url = f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.0.15.apk"
print(f"[4] 원격 다운로드 검증: {url}")
tmp = "/home/z/my-project/scripts/.remote_check.apk"
urllib.request.urlretrieve(url, tmp)
remote_md5 = md5f(tmp)
os.remove(tmp)
print(f"[4] 원격 md5={remote_md5}")
assert remote_md5 == local_md5, "원격 md5 불일치!"
print("=== OK — Release v1.0.15 배포 검증 완료 ===")
