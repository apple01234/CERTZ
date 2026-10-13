#!/usr/bin/env python3
# vc146 재빌드 APK → GitHub Release v1.0.6 --clobber 업로드 + 무결성 검증
import json, subprocess, sys, urllib.request, hashlib, os, time

REMOTE_URL = subprocess.check_output(["git", "-C", "/home/z/my-project", "config", "--get", "remote.origin.url"], text=True).strip()
TOKEN = REMOTE_URL.split("https://")[1].split(":")[1].split("@")[0]
API = "https://api.github.com/repos/apple01234/CERTZ"
APK = "/home/z/my-project/android/app/build/outputs/apk/release/app-release.apk"
NAME = "SERTZ-vc146.apk"
TAG = "v1.0.6"

def api(url, method="GET", data=None, headers=None, ct=None):
    h = {"Authorization": f"token {TOKEN}", "User-Agent": "sertz-builder", "Accept": "application/vnd.github+json"}
    if ct: h["Content-Type"] = ct
    if headers: h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req) as r:
        return r.status, r.read()

md5 = hashlib.md5(open(APK, "rb").read()).hexdigest()
sha1 = hashlib.sha1(open(APK, "rb").read()).hexdigest()
size = os.path.getsize(APK)
print(f"[local] {NAME} {size:,}B md5={md5} sha1={sha1}")

# 1) 릴리스 조회 → upload_url
st, body = api(f"{API}/releases/tags/{TAG}")
rel = json.loads(body)
upload_url = rel["upload_url"].split("{")[0]
print(f"[release] {rel['name']} | assets {len(rel['assets'])}개")

# 2) 기존 동명 자산 삭제 (--clobber 효과)
for a in rel["assets"]:
    if a["name"] == NAME:
        st, _ = api(f"{API}/releases/assets/{a['id']}", method="DELETE")
        print(f"[delete] 기존 {NAME} → HTTP {st}")
        time.sleep(2)

# 3) 업로드
data = open(APK, "rb").read()
st, body = api(f"{upload_url}?name={NAME}", method="POST", data=data, ct="application/vnd.android.package-archive")
up = json.loads(body)
print(f"[upload] HTTP {st} → {up['name']} {up['size']:,}B state={up['state']}")

# 4) 다운로드 무결성 검증
time.sleep(3)
url = f"https://github.com/apple01234/CERTZ/releases/download/{TAG}/{NAME}"
req = urllib.request.Request(url, headers={"User-Agent": "sertz-builder"})
dl = urllib.request.urlopen(req).read()
dmd5 = hashlib.md5(dl).hexdigest()
print(f"[verify] downloaded {len(dl):,}B md5={dmd5}")
print("RESULT:", "PASS" if dmd5 == md5 and len(dl) == size else "FAIL")

# apk-guide 갱신용 값 출력
print(f"\n[guide-values] size={size} md5={md5} sha1={sha1}")
