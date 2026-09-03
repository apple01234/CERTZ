#!/usr/bin/env python3
# GitHub Release v3.0.4 생성 + APK 업로드 (urllib — curl -x 소문자=프록시 함정 회피)
import json, urllib.request, pathlib

TOKEN = pathlib.Path("/home/z/my-project/.gh_token")
if TOKEN.exists():
    TOKEN = TOKEN.read_text().strip()
else:
    # origin remote 임베디드 토큰 폴백
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
    "tag_name": "v3.0.4",
    "target_commitish": "main",
    "name": "v3.0.4 — 스킬 강화·전직별 고유기·모바일 개선",
    "body": (
        "## 활·화살 수정 + 전직 성장 체감 + 스킬 완전 고유화 + 모바일 개선\n\n"
        "1. **활 방향 수정** — 활이 조준 방향을 정확히 향함(기존 90° 오프셋 제거), 화살이 발사 방향대로 날아감\n"
        "2. **전직마다 기존 스킬 강화** — 회전베기 반경/배율·볼트 크기·화살 관통/발수 티어별 증가 + 전직 시 클래스색 각성 이펙트\n"
        "   - 3차+: 회전베기 이중 회전+적 끌어당김 / 화살 2차 연사 / 볼트 유도뢰 3발\n"
        "   - 4차+: 회전베기 출혈 추가타+지면 균열 / 발광 화살 / 강화 시전 이펙트\n"
        "3. **3·4차 스킬 임팩트 대폭 상향** — 낙뢰 6타+기절, 신의 화살비 12발, 종언의 일격 4.8배+화면 플래시 등\n"
        "4. **스킬 겹침 0** — 4차 8직업의 3차기를 신규 고유 메커니즘으로 교체: 피의 격노·성흔 폭발·화살 폭우·폭풍 소용돌이·연쇄 번개·중력 붕괴·그림자 지뢰·파동 검기 (16개 상위직 전부 서로 다른 3차기)\n"
        "5. **모바일 퀘스트창 토글** — 트래커 헤더 전체 터치로 접기/펼치기\n"
        "6. **모바일 스킬 버튼 축소+2×2 그리드** — 56px→44px, 4차까지 해금돼도 자리 부족 없음\n"
        "7. **모바일 3·4차기 사용 가능** — 터치 버튼 이벤트 미수신 버그 수정\n"
        "8. **itch.io 에셋 확대** — 0x72 DungeonTilesetII 신규 몬스터 6종(가면 전사·오르크 전사·오르크 주술사·지옥견 워골·고블린 약탈자·거대 시체) 전 구역 혼합 스폰, 각자 고유 AI(출혈/돌진/원거리/독)\n\n"
        "versionCode 19 · sha256 2047fd56…"
    ),
    "draft": False,
    "prerelease": False,
}))
rid = rel["id"]
print("release id:", rid)

# 2) APK 업로드
apk = pathlib.Path("/home/z/my-project/download/SERTZ-v3.0.4.apk").read_bytes()
req = urllib.request.Request(
    f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name=SERTZ-v3.0.4.apk",
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
