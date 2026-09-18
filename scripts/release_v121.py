#!/usr/bin/env python3
"""v1.2.1 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 7건)
   v1.2.0 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.2.1"
ASSETS = [
    ("/home/z/my-project/download/SERTZ-v1.2.1.apk", "379b6f6b1a536ea1deaff35941b60d5d"),
]

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
        return urllib.request.urlopen(req, timeout=300)
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


for path, expect in ASSETS:
    local = md5f(path)
    assert local == expect, f"로컬 md5 불일치 {path}: {local} != {expect}"
    print(f"로컬 OK: {path} {os.path.getsize(path)}B md5={local}")

BODY = """## v1.2.1 — 유저 지시 7건 반영: 치장 위치 근본 수정 + 펫 정책 개편 + 최적화 + 메뉴 나가기 (versionCode 89)

### 버그 수정
- **치장 부착 위치 근본 수정** — 마왕의 날개·요정의 날개·왕관·리본·후광이 시트별 실루엣(머리 높이)에 정확히 붙도록 프레임별 앵커 테이블 도입(전 바디 시트 1,372프레임 알파 스캔). 기존 고정 오프셋은 여캠 긴머리/직업 시트/GM 등 시트가 바뀌면 위치가 어긋났다. 후광 보브·날개 흔들림 트윈이 매 프레임 동기화에 덮여 무의미하던 버그도 함께 수정(시간 기반 연출로 교체)
- **마왕/요정 날개 아트 재생성** — 26×14 → 40×24 확대 리드로우(박쥐 스캘럭 골격+막 구조) + 게임 표시 1.35배. 기존엔 날개가 몸 폭보다 좁아 몸 뒤에 숨어 "위치가 이상한" 것처럼 보였다

### 펫 정책 (BM 개편)
- **펫은 BM(에메랄드) 전용 판매** — 골드 상점에서 팔던 슬라임 젤리(8💎)/요정 핑크이(14💎)를 캐시상점으로 이동. 펫 9종 전량 에메랄드 전용(기존 보유분은 그대로 사용 가능)
- **프리미엄 펫 특전** — 비싼 펫(아틀라스 30💎/철석 슬라임 32💎/유니 40💎/리퍼 55💎) 소환 중엔 인벤토리에서 **라고스 상점을 바로 열 수 있음**(어디서든 원격 상점 — 인벤 펫 상세에 전용 버튼)

### 최적화 (최적화 최적화 최적화)
- **적 AI 3단 스로틀** — 950px 밖 5Hz(기존) + **1400px 밖 1.25Hz 신설** — 혼잡 맵 프레임 드롭 추가 완화
- **부팅 분할 로드** — 코스튬/직업/GM 시트 37종(≈1,036프레임)을 부팅에서 타이틀 백그라운드 로드로 이관. 첫 로딩 요청 절반 이하, 시작 버튼 시점엔 대부분 수신 완료(미완료시 자동 대기)
- **자동 저사양 게이터** — 프레임 저하 시 셰이더·지속 파티클·화면 흔들림(21곳)·스파클 자동 축소, 회복 시 자동 복원. 설정창에 **실시간 FPS 표시** 카드 신설

### 기타 지시 반영
- **비약 → 책 이름 변경** — 고급/태풍/극한 성장의 비약 → 고급/태풍/극한 **성장의 책**
- **메뉴 나가기 신설** — 기존엔 인게임에서 게임 시작창/캐릭터 선택으로 돌아가는 길이 없었음. 우상단 **☰ 버튼** → "캐릭터 선택 화면으로 / 게임 시작 화면으로" + 설정창 상시 버튼. 세이브 후 안전 전환(멀티 정리·타이머 종료 포함)
- **미소녀 강화** — 여캠 얼굴 전면 패스: 크고 반짝이는 애니눈 확장·속눈썹·볼터치 강화·입술 픽셀 + 기본 여캠 6피부에 트윈테일 사이드 스트랜드 베이크(직업/코스튬 여캠에도 볼터치+입술)

### 배포물
- **APK**: SERTZ-v1.2.1.apk (106,763,574B · versionCode 89)

md5: 379b6f6b1a536ea1deaff35941b60d5d
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.2.1 — 치장 위치 수정·펫 BM 전용·최적화·메뉴 나가기", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.2.1 — 치장 위치 수정·펫 BM 전용·최적화·메뉴 나가기",
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

for path, _ in ASSETS:
    name = os.path.basename(path)
    for a in rel.get("assets", []):
        if a["name"] == name:
            api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
            print(f"기존 asset 삭제: {name} id={a['id']}")

    data = open(path, "rb").read()
    upl = urllib.request.Request(
        f"{up}?name={name}",
        data=data,
        headers={"Authorization": f"token {TOKEN}", "Content-Type": "application/octet-stream", "User-Agent": "curl"},
        method="POST",
    )
    resp = json.load(urllib.request.urlopen(upl, timeout=600))
    print(f"업로드 완료: {name} asset id={resp['id']} size={resp['size']}")

# 3) 원격 md5 복수검증
for path, expect in ASSETS:
    name = os.path.basename(path)
    req = urllib.request.Request(
        f"https://github.com/{REPO}/releases/download/{TAG}/{name}",
        headers={"User-Agent": "curl"},
    )
    remote = urllib.request.urlopen(req, timeout=600).read()
    rm = hashlib.md5(remote).hexdigest()
    print(f"원격 재다운로드: {name} {len(remote)}B md5={rm}")
    print(f"  → {'MD5 일치!' if rm == expect else f'MD5 불일치!! 기대 {expect}'}")

# 4) apk-guide 서빙 md5 검증
try:
    guide = urllib.request.urlopen("http://localhost:3000/apk-guide.html", timeout=15).read().decode()
    print("guide 서빙 md5 포함:", MD5GUIDE if (MD5GUIDE := "379b6f6b1a536ea1deaff35941b60d5d") in guide else "미포함!!")
except Exception as e:
    print("guide 검증 실패:", e)
