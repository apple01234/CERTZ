#!/usr/bin/env python3
"""v3.0.3 GitHub Release 생성 + APK 업로드 + CDN 재다운로드 무결성 대조"""
import base64
import hashlib
import json
import os
import re
import time
import urllib.request

REPO = "apple01234/CERTZ"
TAG = "v3.0.3"
NAME = "SERTZ v3.0.3 — 스킬 3/4차(고유 메커니즘) + GM NPC + 몬스터 개성화"
APK = "/home/z/my-project/download/SERTZ-v3.0.3.apk"
BODY = """SERTZ v3.0.3 (versionCode 18)

## 신규 6항목
1. **직업별 3차 스킬 + 강화** — 3차 전직부터 스킬 3개(V), 4차는 4개(B)
2. **GM NPC** (마을 전직관 옆) — 자유전직 28클래스 전체 / 골드 / 레벨 / 풀회복 / AP
3. **몬스터 고유 개성화** — itch.io 0x72 DungeonTileset II(CC0) 7종 신규:
   원거리 캐스터(임프·강령술사·암초물고기) / 돌진형(촐트) / 출혈(굶주린 좀비·그늘 이리·헬하운드)
   / 독(늪지 독괴물·독개구리·거미 — 사망 시 독 장판) / 감속(얼음 좀비·서리 날도요)
4. **아이템 전면 스태킹** — 아이콘+수량 배지 (마을 귀환서 등 소모품 1행 병합)
5. **상위직 고유 메커니즘 16종** — 전장의 함성/성역(빛 결계+자힐)/절사명중/폭풍의 눈/낙뢰/시간 왜곡
   /그림자 칼날/연격 무도(흡혈) + 종언의 일격/심판의 빛기둥/신의 화살비(유도)/천공의 폭풍
   /마나 붕괴/영원의 고리(시간 정지)/그림자 군주(분신)/검무(점멸 연격)
6. **무기 정체성 완전 구현** — 궁수=활(상시 장착) / 마법사=지팡이(상시 장착) / 도적=단검+표창(3회마다 투척)

sha256: {sha}
""".format(sha=hashlib.sha256(open(APK, "rb").read()).hexdigest())


def token():
    p = "/home/z/my-project/.gh_token"
    if os.path.exists(p):
        return open(p).read().strip()
    cfg = open("/home/z/my-project/.git/config").read()
    m = re.search(r"https://x-access-token:([^@]+)@github\.com", cfg)
    if m:
        return m.group(1)
    raise SystemExit("no token")


T = token()


def api(url, data=None, method=None, ctype="application/json"):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {T}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    body = None
    if data is not None:
        if isinstance(data, (dict, list)):
            body = json.dumps(data).encode()
        elif isinstance(data, str):
            body = data.encode()
        else:
            body = data
        req.add_header("Content-Type", ctype if not isinstance(data, (dict, list)) else "application/json")
    req.data = body
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        try:
            return json.loads(raw) if raw else {}
        except Exception:
            return {}


# 1) 기존 동일 태그 릴리스 삭제(재배포 대응)
try:
    rel = api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}")
    if rel.get("id"):
        api(f"https://api.github.com/repos/{REPO}/releases/{rel['id']}", method="DELETE")
        print(f"기존 {TAG} 릴리스 삭제 (id {rel['id']})")
        time.sleep(1)
except Exception as e:
    print("tags 조회:", e)

# 2) Release 생성
rel = api(f"https://api.github.com/repos/{REPO}/releases", data={
    "tag_name": TAG,
    "target_commitish": "main",
    "name": NAME,
    "body": BODY,
    "draft": False,
    "prerelease": False,
})
rid = rel["id"]
print(f"Release 생성: id={rid} url={rel.get('html_url')}")

# 3) APK 업로드
up = rel["upload_url"].split("{")[0] + "?name=SERTZ-v3.0.3.apk"
data = open(APK, "rb").read()
api(up, data=data, ctype="application/vnd.android.package-archive")
print(f"APK 업로드 완료: {len(data):,}B")

# 4) CDN 재다운로드 무결성 대조
asset = api(f"https://api.github.com/repos/{REPO}/releases/{rid}")["assets"][0]
cdn = asset["browser_download_url"]
print("CDN:", cdn)
with urllib.request.urlopen(cdn) as r:
    blob = r.read()
h1 = hashlib.sha256(data).hexdigest()
h2 = hashlib.sha256(blob).hexdigest()
print(f"로컬 sha256: {h1[:16]}… ({len(data):,}B)")
print(f"CDN  sha256: {h2[:16]}… ({len(blob):,}B)")
print("무결성:", "MATCH" if h1 == h2 else "MISMATCH!!")
