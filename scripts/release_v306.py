#!/usr/bin/env python3
# GitHub Release v3.0.6 생성 + APK 업로드 (urllib — v3.0.5 스크립트 패턴)
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
    "tag_name": "v3.0.6",
    "target_commitish": "main",
    "name": "v3.0.6 — 스킬 겹침 0·기본공격 강화·보스 대폭 강화·보스 드롭템",
    "body": (
        "## 유저 9항목 — 스킬 고유화 완성 + 전직 기본공격 강화 + 보스/드롭 개편\n\n"
        "### 1. 반복 의뢰 버그 수정 (근본 원인)\n"
        "- 구역별 몬스터 로테이션(1~6구역 단일종) 때문에 [반복] 토벌 대상이 맵에 아예 없어 카운트가 안 되던 버그\n"
        "  → 반복 의뢰 대상 몬스터를 구역 스폰에 자동 편입 (스토리 beat 편입과 동일 패턴)\n"
        "- 반복 의뢰 진행도(카운트/목표) 세이브 — 재입장 시 리셋되지 않음\n\n"
        "### 2. 2차 전직부터 스킬이 실제로 변합니다 (메커니즘 교체)\n"
        "- 기존: 2차 전직은 라벨만 바뀌고 Z/C 동작 동일 → 수정: **Z(주력기)/C(기동기) 12종+12종 클래스 고유 메커니즘**\n"
        "  - 버서커 파괴의 회전베기(명중 출혈) / 가디언 성벽 강타(지진파+방어버프)\n"
        "  - 스나이퍼 매의 관통 화살(즉발 저격 라인) / 윈드러너 회오리 화살(끌어당김)\n"
        "  - 아크메이지 아크 볼트(착탄 폭발) / 세이지 정화의 파동(자힐 파동)\n"
        "  - 어세신 그림자 참수(점멸 강타) / 스와시버클러 연타 난무(5연속 속공)\n"
        "  - 기동기: 살상 돌진(공버프)·불굴 돌진(방버프)·매의 질풍·질풍 가르기·대전이 점멸·순환 점멸(MP흡수)·암습 돌진(출혈)·화려한 돌진·그림자 숨기(다음 공격 강화)\n"
        "  - 도적 1차 Z가 회전베기에서 **칼날 폭풍(단검 부채꼴 투척)**으로 교체 — 전사와 겹침 제거\n\n"
        "### 3. 전직마다 기본공격 강화\n"
        "- 미전직 1타 → 1차 2연타 → 2차 3연타 → 3차 검기 파동 → 4차 대형 파동\n"
        "- 궁수 화살 1발 → 2발(1차) → 3발(3차) / 마법사 볼트 동일 래더 / 도적 표창 3회→2회마다·다연발\n\n"
        "### 4. 직업·세부직업 스킬 겹침 완전 제거 (28클래스)\n"
        "- 같은 계열 형제 직업(버서커↔가디언 등 12쌍)까지 Z/C 메커니즘 100% 상이\n"
        "- 3차/4차는 계열 승격으로 2차기 강화판 사용 (전직 강화 모델)\n\n"
        "### 5. 크리티컬 100% 초과분 → 크리티컬 데미지\n"
        "- 크리 확률 130% → 항상 크리 + 크리 데미지 +30% (1.7 → 2.0배, 1:1 전환)\n\n"
        "### 6. 원거리 자동사냥 '끼어버림' 버그 수정\n"
        "- 코너/맵 가장자리 판정 추가 — 8방향 전부 막히면 **적 통과 돌진 탈출** 또는 **정면 반격**\n"
        "- 후퇴 방향 탐색 72→110px 확대 + 주변 위협 스코어링 (몬스터 사이로 끼이는 후퇴 방지)\n\n"
        "### 7. 전체 사운드 밸런스 조정\n"
        "- 동일 SFX 55ms 스로틀 + 동시 12개 캡 (대량 처치 시 사운드 월 해결)\n"
        "- 전투 기초음 하향(swing 0.5→0.34 등) / BGM 0.42→0.34 — SFX 가독성 우선 래더\n\n"
        "### 8. 보스 대폭 강화\n"
        "- HP +69% (3200→5400 기준, ×1.25·배율 0.9→1.35) / ATK 상향\n"
        "- **보스 공격 방어 관통 50%** — 방어 스택으로 보스가 무력화되던 것 수정\n"
        "- 페이즈별 공격 태진 단축(p1 0.85/p2 0.7/격노 0.5)·격노 시 추격 1.18배·탄막 증가(12/16/20·volley 12)\n\n"
        "### 9. 보스 전용 드롭템 (9종 전설 등급)\n"
        "- 보스 9종 각각 유니크 장신구 100% 드롭 — **상점 판매 금지(tradeLock)**\n"
        "- 추후 유저 거래소에서 사고팔게 할 예정 (인벤토리 전설 금색 테두리)\n\n"
        "### 검증\n"
        "- 신규 E2E 34 PASS / 0 FAIL (겹침 0 전수·2차 스킬 교체·기본공격 연타 실측·크뎀 전환·반복 의뢰·코너 반격·보스 공식·드롭 tradeLock)\n"
        "- 회귀: v2.7 12/12 · v3.0.1 10/10 · v3.0.2 12/12 · v3.0.3 23/23 · v3.0.4 24/24 · v3.0.5 33/33\n\n"
        "versionCode 21 · APK: SERTZ-v3.0.6.apk"
    ),
    "draft": False,
    "prerelease": False,
}))

print("release:", rel["id"], rel["html_url"])

apk = pathlib.Path("/home/z/my-project/download/SERTZ-v3.0.6.apk").read_bytes()
up = api(
    f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name=SERTZ-v3.0.6.apk",
    apk,
    headers={**HDR, "Content-Type": "application/vnd.android.package-archive"},
    raw=True,
)
up = json.loads(up)
print("asset:", up["name"], up["size"], up["state"])

rel2 = api(f"https://api.github.com/repos/{REPO}/releases/tags/v3.0.6", raw=False)
for a in rel2["assets"]:
    print("check:", a["name"], a["size"])
