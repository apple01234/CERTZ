#!/usr/bin/env python3
# GitHub Release v3.0.5 생성 + APK 업로드 (urllib — v3.0.4 스크립트 패턴)
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
    "tag_name": "v3.0.5",
    "target_commitish": "main",
    "name": "v3.0.5 — 스타포스 장비강화 + 조이스틱 개선",
    "body": (
        "## 장비 강화 (스타포스) + 터치 조이스틱 개선\n\n"
        "### 1. 장비 강화 — 스타포스 콘텐츠 (메이플스토리 Star Force식)\n"
        "- **★15까지 확장** (기존 +12) — 성공률 곡선 [100,85,70,55,40,35,30,25,20,15,12,10,8,6,5]\n"
        "- **★5/★10/★15 마일스톤 보너스** (누적):\n"
        "  - 무기: ★5 공격+4·치명+2% / ★10 공격+6·치명+3% / ★15 공격+8·치명+5% (최대 공격+18·치명+10%)\n"
        "  - 방어구: ★5 HP+25 / ★10 방어+2·HP+50 / ★15 방어+3·HP+80 (최대 방어+5·HP+155)\n"
        "- **성급 티어 색상** — ★1~4 흰색 / ★5~9 청록 / ★10~14 보라 / ★15 금색\n"
        "- **강화 연출**: 성공 시 티어색 스타 버스트+확장 링 / 실패 시 잿빛 연기 / 마일스톤 돌파 시 3중 링+화면 플래시+쉐이크+배너\n"
        "- **상시 강화 효과**: ★4+ 오라(티어별 색·크기 강화) / ★8+ 주변 스파클 입자 / ★15 궤도성 2기 회전\n"
        "- **스타포스 UI**: 성 15칸 바·마일스톤 효과 안내·스탯 미리보기(현재→다음)·성공 금빛/실패 붉은 흔들림 반응\n"
        "- ★12~15 강화 비용 급증 구간 추가 (골드 싱크) · ★9 이상 실패 시 1성 하락 유지\n"
        "- 세이브 호환: 기존 세이브의 강화 수치 그대로 유지, 마일스톤 HP는 sfHp 필드로 중복 가산 방지\n\n"
        "### 2. 터치 조이스틱 인식 범위 축소 — NPC 상호작용 개선\n"
        "- 기존: 화면 왼쪽 45% × **전체 높이** (NPC 머리 위 상호작용 칩을 조이스틱 레이어가 덮음)\n"
        "- 변경: 화면 **좌하단 46% × 55%** 로 축소 — 화면 상단 45%는 NPC/월드 탭 여유 영역\n"
        "- 상호작용 칩을 조이스틱보다 위에 렌더링 (z-order 수정) — NPC 근처에서 칩 탭이 확실히 눌림\n"
        "- 칩 터치 타깃 확대 (px-4→px-5) + 조이스틱 대기 중 안내 패드 표시 (좌하단 점선 원)\n\n"
        "### 검증\n"
        "- 신규 E2E 33 PASS / 0 FAIL (성공률 곡선·마일스톤 스탯 실측·실패 하락·세이브 sfHp·오라 티어·궤도성·UI 성 바 30칸·조이스틱 46%×55%·칩 탭→GM 패널 오픈·조이스틱 이동)\n"
        "- 회귀: v2.7 12/12 · v3.0.1 10/10 · v3.0.2 12/12 · v3.0.3 23/23 · v3.0.4 24/24\n\n"
        "versionCode 20 · APK: SERTZ-v3.0.5.apk"
    ),
    "draft": False,
    "prerelease": False,
}))

print("release:", rel["id"], rel["html_url"])

apk = pathlib.Path("/home/z/my-project/download/SERTZ-v3.0.5.apk").read_bytes()
up = api(
    f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name=SERTZ-v3.0.5.apk",
    apk,
    headers={**HDR, "Content-Type": "application/vnd.android.package-archive"},
    raw=True,
)
up = json.loads(up)
print("asset:", up["name"], up["size"], up["state"])

rel2 = api(f"https://api.github.com/repos/{REPO}/releases/tags/v3.0.5", raw=False)
for a in rel2["assets"]:
    print("check:", a["name"], a["size"])
