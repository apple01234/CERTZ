#!/usr/bin/env python3
"""vc148 IPA 릴리스 재업로드: tmp_SERTZ-vc148-ios-unsigned.ipa → v1.0.8 릴리스 첨부 + 무결성 검증."""
import json, hashlib, time, urllib.request, urllib.error, sys

REMOTE = [l.strip().split("= ")[1] for l in open("/home/z/my-project/.git/config") if "github.com" in l and "url = " in l][0]
TOKEN = REMOTE.split("https://")[1].split(":")[1].split("@")[0]
REPO = "apple01234/CERTZ"
API = "https://api.github.com"
TAG = "v1.0.8"
IPA = "/home/z/my-project/tmp_SERTZ-vc148-ios-unsigned.ipa"

def req(path, method="GET", data=None, headers=None, raw=False, timeout=300):
    h = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "vc148"}
    if headers:
        h.update(headers)
    base = "" if path.startswith("https://") else API
    r = urllib.request.Request(base + path, data=data, method=method, headers=h)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=timeout) as resp:
                b = resp.read()
                return (resp.status, b if raw else (json.loads(b) if b else {}))
        except urllib.error.HTTPError as e:
            if e.code >= 500 and attempt < 4:
                time.sleep(8); continue
            raise
        except Exception as e:
            print(f"  retry {attempt+1}: {e}")
            time.sleep(8)
    raise RuntimeError("network exhausted")

ipa_bytes = open(IPA, "rb").read()
MD5 = hashlib.md5(ipa_bytes).hexdigest()
SIZE = len(ipa_bytes)
print(f"IPA: {SIZE:,}B md5={MD5}")

st, rel = req(f"/repos/{REPO}/releases/tags/{TAG}")
assert st == 200, f"release not found: {st}"
rel_id = rel["id"]
up = rel["upload_url"].split("{")[0]
names = [a["name"] for a in rel.get("assets", [])]
if "SERTZ-vc148-ios-unsigned.ipa" in names:
    print("IPA already present — skip")
else:
    st, up_res = req(up + "?name=SERTZ-vc148-ios-unsigned.ipa", method="POST", data=ipa_bytes,
                     headers={"Content-Type": "application/octet-stream"})
    print(f"upload ipa: {st} size={up_res.get('size')}")

# 무결성
dl = f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-vc148-ios-unsigned.ipa"
for attempt in range(10):
    try:
        with urllib.request.urlopen(dl, timeout=300) as r:
            got = r.read()
        break
    except Exception as e:
        print(f"  dl retry {attempt+1}: {e}")
        time.sleep(6)
print(f"verify: {len(got):,}B md5={hashlib.md5(got).hexdigest()} -> {'PASS' if hashlib.md5(got).hexdigest() == MD5 else 'FAIL'}")

# 최종 자산 목록
st, rel = req(f"/repos/{REPO}/releases/tags/{TAG}")
print("assets:", [(a["name"], a["size"]) for a in rel["assets"]])
