#!/usr/bin/env python3
# GitHub Release v3.0.2 생성 + APK 업로드 (urllib — curl -x 소문자=프록시 함정 회피)
import json, urllib.request, pathlib

TOKEN = pathlib.Path("/home/z/my-project/.gh_token")
if TOKEN.exists():
    TOKEN = TOKEN.read_text().strip()
else:
    # origin remote 임베디드 토큰 폴백 (worklog v3.0-eight 경로)
    import re
    cfg = pathlib.Path("/home/z/my-project/.git/config").read_text()
    m = re.search(r"https://x-access-token:([^@]+)@github\.com", cfg)
    TOKEN = m.group(1)

HDR = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "sertz-bot"}
REPO = "apple01234/CERTZ"

def api(url, data=None, headers=None, raw=False):
    if isinstance(data, str):
        data = data.encode()
    req = urllib.request.Request(url, data=data, headers=headers or HDR)
    with urllib.request.urlopen(req) as r:
        b = r.read()
        return json.loads(b) if not raw else b

# 1) 릴리스 생성
rel = api(f"https://api.github.com/repos/{REPO}/releases", json.dumps({
    "tag_name": "v3.0.2",
    "target_commitish": "main",
    "name": "v3.0.2 — 직업별 자동전투 최적화",
    "body": (
        "## 자동사냥이 직업 정체성대로 싸웁니다\n\n"
        "- **전사/도적**: 돌진기로 적에게 접근(갭클로저) + 주변 2마리 이상일 때 회전베기(광역)\n"
        "- **궁수**: 적이 붙으면 질풍차지/후퇴로 거리 유지(카이팅) + 군집 대상 관통 화살 — 관통 화살 8방향 자유 조준\n"
        "- **마법사**: 매직 볼트 쿨마다 즉시 시전 + 적 접근 시 점멸로 이탈\n"
        "- **공통**: 공격 전 대상 방향 자동 조준 보정, 단일 몹은 기본공격으로 마나 절약\n\n"
        "versionCode 16 · sha256 e8e601b5…"
    ),
    "draft": False,
    "prerelease": False,
}))
rid = rel["id"]
print("release id:", rid)

# 2) APK 업로드
apk = pathlib.Path("/home/z/my-project/download/SERTZ-v3.0.2.apk").read_bytes()
req = urllib.request.Request(
    f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name=SERTZ-v3.0.2.apk",
    data=apk,
    headers={**HDR, "Content-Type": "application/octet-stream"},
)
with urllib.request.urlopen(req) as r:
    asset = json.loads(r.read())
print("asset:", asset["name"], asset["size"], asset["state"])

# 3) 업로드 무결성 재확인 (CDN 재다운로드)
import hashlib
local = hashlib.sha256(apk).hexdigest()
with urllib.request.urlopen(urllib.request.Request(asset["browser_download_url"], headers={"User-Agent": "sertz-bot"})) as r:
    remote = hashlib.sha256(r.read()).hexdigest()
print("sha256 local :", local[:16])
print("sha256 remote:", remote[:16])
print("MATCH" if local == remote else "MISMATCH!!")
