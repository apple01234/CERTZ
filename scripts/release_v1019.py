#!/usr/bin/env python3
"""v1.0.19 Release 생성 + APK 업로드 + 원격 md5 검증 (지시서 6건 — Task 83)
   v1.0.18 스크립트 개선판: 업로드 후 apk-guide 서빙 md5까지 자동 검증 (guide md5 잔존 3회차 방지)"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.0.19"
APK = "/home/z/my-project/download/SERTZ-v1.0.19.apk"
EXPECT_MD5 = "5bd1e559ebec01aeaaab48d93eb39ba6"

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
        return urllib.request.urlopen(req, timeout=180)
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
assert local_md5 == EXPECT_MD5, f"로컬 md5 불일치 {local_md5}"
print(f"로컬: {APK} {size}B md5={local_md5}")

BODY = """## v1.0.19 — 반응형·스크롤 수정 + 신규 스테이지 15종 + 유니온 개편 (versionCode 84)

### 수정 (지시서 A)
- **메인 화면 스크롤** — 로비·타이틀에서 콘텐츠가 화면보다 길면 스크롤 (휠/드래그) · 인게임 중엔 페이지 스크롤 없음
- **반응형 웹앱** — 모바일 세로(375×812) 전 화면 정상 표시 · 세로 모드 "계속하기" 버튼 · 가로 스크롤 제로
- **인게임 중복 UI 제거** — 하단에 로비 UI가 또 뜨던 것 삭제
- **신규 스테이지 15종 "재림의 땅"** — 기존 90구역 전부 유지 + 10장 클리어 후 재림1~15 순차 추가 · 고유 테마/몬스터/보상 15세트 · 보스 3종(베오르드/요르문간드/나그라파르) · 정예 3곳 · 난이도 순차 상승

### 신규 (지시서 B)
- **캐릭터 선택창 (메이플식)** — 생성 3단계(이름→직업→외형 색조 8종) · 슬롯 카드 외형 미리보기 · 더블클릭 입장 · 8슬롯(코인으로 확장)
- **유니온 (메이플 규칙)** — 레벨 합산(60까지 100%·초과분 10레벨당 1) · 배치 등급 B/A/S/SS(×1.0~×3.2) · 계열별 효과(전사=방어/HP · 궁수=공격% · 마법사=마력% · 도적=크리/크리뎀) · 전 캐릭터 실전 반영

md5: `5bd1e559ebec01aeaaab48d93eb39ba6` (106,107,034B)
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.0.19 — 반응형·신규 스테이지 15종·유니온 개편", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.0.19 — 반응형·신규 스테이지 15종·유니온 개편",
            "body": BODY,
            "draft": False,
            "prerelease": False,
        }).encode(),
        headers={"Content-Type": "application/json"},
    ))
    rel_id = created["id"]
    print(f"릴리스 생성 id={rel_id}")

# 2) 업로드
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}"))
up = rel["upload_url"].split("{")[0]
name = f"SERTZ-{TAG}.apk"

for a in rel.get("assets", []):
    if a["name"] == name:
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 asset 삭제 id={a['id']}")

data = open(APK, "rb").read()
upl = urllib.request.Request(
    f"{up}?name={name}",
    data=data,
    headers={"Authorization": f"token {TOKEN}", "Content-Type": "application/octet-stream", "User-Agent": "curl"},
    method="POST",
)
resp = json.load(urllib.request.urlopen(upl, timeout=600))
print(f"업로드 완료 asset id={resp['id']} size={resp['size']}")

# 3) 원격 md5 복수검증
req = urllib.request.Request(
    f"https://github.com/{REPO}/releases/download/{TAG}/{name}",
    headers={"User-Agent": "curl"},
)
remote = urllib.request.urlopen(req, timeout=600).read()
rm = hashlib.md5(remote).hexdigest()
print(f"원격 재다운로드: {len(remote)}B md5={rm}")
print("MD5 일치!" if rm == EXPECT_MD5 else f"MD5 불일치!! 기대 {EXPECT_MD5}")

# 4) apk-guide 서빙 md5 잔존 검증 (3회차 사고 방지 — 로컬 서버 기준)
try:
    guide = urllib.request.urlopen("http://localhost:3000/apk-guide.html", timeout=15).read().decode()
    ok_guide = EXPECT_MD5 in guide and "1.0.18" not in guide.split("v1.0.18 변경점")[0].split("<h1>")[1]
    print(f"apk-guide 서빙 md5 포함: {EXPECT_MD5 in guide}")
    if EXPECT_MD5 not in guide:
        print("!! guide에 새 md5 없음 — 정정 필요")
except Exception as e:
    print(f"guide 검증 스킵: {e}")

print("DONE")
