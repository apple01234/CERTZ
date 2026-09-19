#!/usr/bin/env python3
"""v1.3.0 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 9건)
   v1.2.1 스크립트 계승 — APK 전용(AAB 제외, 유저 지시 "일단 apk만")"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.3.0"
ASSETS = [
    ("/home/z/my-project/download/SERTZ-v1.3.0.apk", "dba6d3e1ad08d13b85ba590084866f7b"),
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

BODY = """## v1.3.0 — 유저 지시 9건 반영: SNS 임시 중단 + 날개 등 뒤 고정 + NPC급 옷 세트 + 왕국 랭킹 + Drive 에셋 통합 + 층식 맵 (versionCode 90)

### UI/접속
- **SNS(구글/카카오/네이버) 로그인 임시 비활성화** — 재개 시까지 로그인창에 안내 문구 표시. 서버 연동·계정은 유지되며 자체 가입/로그인은 정상. 재개는 AuthPanel의 숨김 블록만 되돌리면 즉시 가능
- **선 3개(☰) UI 삭제** — 유저 지시로 HUD에서 제거. 메뉴 나가기 기능은 **설정창 → 메뉴 화면 카드**(캐릭터 선택/게임 시작 화면)로 그대로 이용 가능

### 렌더 근본 수정
- **날개 항상 등 뒤 고정** — 이동 방향(정면/측면/후면)에 따라 날개가 앞뒤로 바뀌어 보이던 문제 근본 수정: ① 어떤 방향이든 날개 depth는 본체 뒤 고정 ② 정면 -5px·측면 -2px·후면 +2px로 등 쪽 위치 유지 ③ 좌우 전환 시 flipX 뒤집힘 제거(대칭 시트) ④ 대화 중 착용 시에도 생성 단계에서 올바른 depth 부여(E2E에서 발견한 잔존 버그까지 차단)

### 신규 콘텐츠 (BM 유도)
- **NPC급 옷 세트 4종** — 드래곤 나이트/프로스트 세이지/사쿠라 궁정/보이드 리퍼 (48💎). 코스튬 슬롯 완전 교체 — 남/여 시트 전체 생성
- **오로라류 후광 체감 강화** — 캐시상점 오로라 후광이 "착용해도 변화가 없다"는 문제 개선: 선명한 림 링 2장 역회전 + 궤도 트윙클 4개 + 바닥 글로우 3층 구성(기존 알파 0.26 은은한 글로우만 존재)
- **소모품 사용 개수 지정 + MAX** — 경험치 책/귀환서류를 수량 입력으로 한 번에 사용(전량 버튼 지원, 가방 기타 탭)
- **왕국 랭킹 + 랭커 전용 상점** — 환생·탑·레벨·경험치 종합 점수 Top50 + 내 순위(콘텐츠 허브 → 랭킹 탭, 서버 /api/rank). Top10 랭커는 랭커 전용 상점에서 **랭커 오라(황금 림)·황금 왕관** 구매 가능(서버 검증)

### 에셋 대량 통합 (유저 Drive 팩 3종)
- **VFX 58종** — Matthew Guz Slash(참격/크리/충격파)·GameVFX Buff(오라/번개)·Vefects Anime(임팩트)·Hovl Magic(마법진)·UNI VFX(폭발)·CartoonVFX Fireworks(축하 불꽃)·Cherry Petals(벚꽃잎) — 근접 타격감/스킬 연출/레벨업 축하 전반 투입 (scripts/prep_drive_assets.py 변환)
- **SFX 48종** — 원소별 AOE 시전/폭발 21세트 + 화살/폭탄/버프/연기 등 (Vefects WAV → OGG)
- **층식 구조 타일맵** — Cainos 타일셋으로 마을 요새 유적 2층 구조 신설: 계단 오르내리기(keepLayer 0↔1)·상층 타일 depth 스왑·횃불 64프레임 애니·상자 개봉 32프레임 애니 + 상호작용 보상

### 부팅 로드 정합
- vfx2/map 타일셋이 구빌드 청크에 섞여 404가 나던 상태 정리 — setPath 분리 로드(vfx2/ PNG 58·map/ PNG 6)로 완전 해소, E2E 에셋 로드 3건 실측

### 배포물
- **APK**: SERTZ-v1.3.0.apk (111,150,952B · versionCode 90)

E2E: v1.3.0 신규 19/19 PASS + v1.2.1 회귀 25/25 PASS
md5: dba6d3e1ad08d13b85ba590084866f7b
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.3.0 — 날개 등 뒤 고정·옷 세트 4종·왕국 랭킹·에셋 통합·층식 맵", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.3.0 — 날개 등 뒤 고정·옷 세트 4종·왕국 랭킹·에셋 통합·층식 맵",
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
        headers={"Authorization": f"token {TOKEN}", "Content-Type": "application/vnd.android.package-archive",
                 "User-Agent": "curl"},
        method="POST",
    )
    resp = json.load(urllib.request.urlopen(upl, timeout=1800))
    print(f"업로드 완료: {name} id={resp['id']} state={resp['state']} size={resp['size']}")

# 3) 원격 재다운로드 md5 검증
import time
time.sleep(3)
for path, expect in ASSETS:
    name = os.path.basename(path)
    url = f"https://github.com/{REPO}/releases/download/{TAG}/{name}"
    tmp = f"/tmp/verify_{name}"
    urllib.request.urlretrieve(url, tmp)
    remote = md5f(tmp)
    assert remote == expect, f"원격 md5 불일치: {remote} != {expect}"
    print(f"원격 검증 OK: {url} md5={remote}")

print("\n=== v1.3.0 릴리스 완료 ===")
