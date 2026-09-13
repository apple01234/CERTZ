#!/usr/bin/env python3
"""v1.0.18 Release 생성 + APK 업로드 + 원격 md5 검증 (Task 82)"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.0.18"
APK = "/home/z/my-project/download/SERTZ-v1.0.18.apk"
EXPECT_MD5 = "e35e39663ec36995e21a515180a51abf"

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

BODY = """## v1.0.18 — 로비·유니온·몬스터 파크 대형 업데이트 (versionCode 83)

### 새로운 콘텐츠
- **로비 (캐릭터 선택·생성)** — 캐릭터를 여러 개! 직업 프리뷰(대표 스킬·주 스탯·난이도)·이름 입력·삭제·슬롯 확장(기본 8개). 기존 세이브는 자동 이전
- **유니온 시스템** — Lv60+ 캐릭터 합산 레벨 → 브론즈~별 11등급 · 계열별 폴리오미노 그리드 배치(드래그·회전·자동 추천) · 지역 효과 전 캐릭터 적용 · 코인 상점·시간제 버프 4종·아티팩트 6종·AI 파티원 레이드(난이도 3종)
- **몬스터 파크** — 하루 2장 입장권 · 일반/어려움/지옥 · 90초 웨이브 사냥 · 파크 코인 상점

### 수정
- **환생**: 시작 캐릭터(생성 시 선택한 1차 직업)로 복귀 — 스킬·기본공격도 시작 직업 것으로 교체 · 5차 각성 누락 리셋 수정 · 환생 기록 로그 추가
- **셰이더 편안함**: "효과 강도" 슬라이더(0=끄기)·"플리커 완화 모드" 신설 · 보스전 밝기 상향(암전 완화+보스 광원)
- **모바일**: 하단 네비게이션 바(가방/스탯/유니온/콘텐츠/설정)

### 조작법
PC: 방향키 이동 · X 공격 · Z/C/V/B/A/S 스킬 · D/F 물약 · O 설정
모바일: 왼쪽 조이스틱 이동 · 우하단 스킬 패드 · 하단바 메뉴

md5: `e35e39663ec36995e21a515180a51abf` (106,102,434B)
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.0.18 — 로비·유니온·몬스터 파크",
            "body": BODY,
            "draft": False,
            "prerelease": False,
        }).encode(),
        headers={"Content-Type": "application/json"},
    ))
    rel_id = created["id"]
    print(f"릴리스 생성 id={rel_id}")

# 2) 업로드 URL 획득
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}"))
up = rel["upload_url"].split("{")[0]
name = f"SERTZ-{TAG}.apk"

# 기존 asset 있으면 삭제
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
