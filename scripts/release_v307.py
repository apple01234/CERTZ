#!/usr/bin/env python3
# GitHub Release v3.0.7 생성 + APK 업로드 (urllib — v3.0.6 스크립트 패턴)
import json, urllib.request, pathlib

TOKEN = pathlib.Path("/home/z/my-project/.gh_token")
if TOKEN.exists():
    TOKEN = TOKEN.read_text().strip()
else:
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

rel = api(f"https://api.github.com/repos/{REPO}/releases", json.dumps({
    "tag_name": "v3.0.7",
    "target_commitish": "main",
    "name": "v3.0.7 — 유저 거래소·강화 주문서·장신구 스타포스·세이지 힐러",
    "body": (
        "## v3.0.7 — 4대 기능 업데이트 (versionCode 22)\n\n"
        "### 1. 유저 거래소 🏪\n"
        "- 보스 전용 드롭 9종(전설)을 **에메랄드로 사고팔 수 있는 거래소** 신설\n"
        "- 상점에서 여전히 구매 불가(tradeLock 유지) — 거래소에서만 거래\n"
        "- 판매가 = 구매가의 60% (거래 수수료): 수호자 8 → 아부디토스 30 에메랄드\n"
        "- 진입: 상점 헤더 '거래소' 버튼 / 가방 보스 드롭 카드 '거래소 판매' 버튼\n\n"
        "### 2. 강화 주문서 📜\n"
        "- 상점 신규 아이템 (150G): 사용 시 다음 강화 시도 성공률 **+15%p** (충전 최대 3장 = +45%p)\n"
        "- 강화 시도 1회당 1장 소모 (성공/실패 무관) — 성공률 실측 반영\n"
        "- 상점 스타포스 섹션에 충전 현황 표기, 가방에서 '충전' 버튼\n\n"
        "### 3. 장신구 스타포스 ✨\n"
        "- 반지/펜던트도 무기·방어구와 동일 체계로 ★15까지 강화 가능\n"
        "- ★5/★10/★15 마일스톤: 치명 트랙(반지) crit +2/+6/+12 · HP 트랙(펜던트) +20/+55/+110\n"
        "- 가방 장신구 카드에 강화 버튼 + 성 바 + 보너스 표기, HP 마일스톤 자동 동기화\n"
        "- 세이브 저장/복원 완전 지원 (성 + HP 가산 이력)\n\n"
        "### 4. 세이지 계열 순수 힐러 강화 💚\n"
        "- 정화의 파동: 자힐 상향(8+4티어×타격수) + **MP 회복 신규** + 반경 내 원격 아군 치유 파동(멀티)\n"
        "- 크로니컬 시간 왜곡(3차기): 필드가 **자신 HP 틱 회복** (시간이 상처를 되감음)\n"
        "- 이터널 영원의 고리(4차기): **HP 25% + MP 50% 즉시 회복** 추가\n\n"
        "### 검증\n"
        "- 신규 E2E 38 PASS / 0 FAIL (거래소 사이클·주문서 결정론 성공률·장신구 마일스톤·힐 실측·패널 UI)\n"
        "- 회귀: v2.7 12/12 · v3.0.1 10/10 · v3.0.2 12/12 · v3.0.3 23/23 · v3.0.4 24/24 · v3.0.5 33/33 · v3.0.6 44/44\n\n"
        "versionCode 22 · APK: SERTZ-v3.0.7.apk"
    ),
    "draft": False,
    "prerelease": False,
}))

print("release:", rel["id"], rel["html_url"])

apk = pathlib.Path("/home/z/my-project/download/SERTZ-v3.0.7.apk").read_bytes()
up = api(
    f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name=SERTZ-v3.0.7.apk",
    apk,
    headers={**HDR, "Content-Type": "application/vnd.android.package-archive"},
    raw=True,
)
up = json.loads(up)
print("asset:", up["name"], up["size"], up["state"])

rel2 = api(f"https://api.github.com/repos/{REPO}/releases/tags/v3.0.7", raw=False)
for a in rel2["assets"]:
    print("check:", a["name"], a["size"])
