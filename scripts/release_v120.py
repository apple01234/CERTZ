#!/usr/bin/env python3
"""v1.2.0 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 17건)
   v1.1.1 스크립트 개선식: AAB 제외(유저 지시 — 이번엔 APK만)"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.2.0"
ASSETS = [
    ("/home/z/my-project/download/SERTZ-v1.2.0.apk", "76fa2bad71a120e163e12d5a14c9e13d"),
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

BODY = """## v1.2.0 — 유저 지시 17건 반영: 외형 대개편 + 접속 근본 수정 + 타격감 (versionCode 88)

### 버그 수정 / 기능
- **유저 거래소 접속 안됨 (근본 수정)** — 로그인 유저의 API 호출이 Authorization 헤더 때문에 CORS 프리플라이트(OPTIONS 401/404)로 전부 실패하는 구조 문제(게스트만 동작했던 역설). ① 토큰을 URL 쿼리로 전송해 프리플라이트 0회 ② FC 배포 래퍼 OPTIONS 204 응답 ③ 서버 쿼리 토큰 지원 ④ HUD에 거래소 직행 버튼 추가
- **포니테일 헤어 완전 제거** — 위치 보정 대신 아이템 자체 폐지. 보유자는 18 에메랄드 자동 환수(1회성, 세이브 플래그로 이중 환수 방지)
- **긴급 귀환 하루 3회 제한** — 악용 방지. 로컬 날짜 기준 자정 리셋, 초과 시 안내 배너
- **환생 후 맵 이동 차단** — 환생 시 방문 구역 기록(visited)도 초기화해 지역 이동 부적으로 환생 전 해방 맵 워프 불가

### 콘텐츠 / 개선
- **예쁜 여캠 (애니메이션풍)** — 전 여캠 시트에 눈 하이라이트·아이리스·속눈썹 + 블러셔 + 머리 광택 도트 적용
- **2차 전직 8직업 외형 완전 분화** — 버서커(붉은 머리 광전사)/가디언(강철 은발)/스나이퍼(올리브 저격수)/윈드러너(하늘빛 경장갑)/아크메이지(제비꽃 로브)/세이지(상아 현자)/어세신(칠흑 암살자)/스와시버클러(남빛 검객) — 여/남 각 8종 × 28프레임 448장 신규 스프라이트. 3·4차는 계열 2차 외형 승계, 코스튬 착용 시 코스튬 우선
- **GM 전용 외형** — 파란 몸 + 무지개 머리(GM 캐릭터). GM 계정 로그인 시 캐릭터 생성에서 선택 가능 + 서버 롤(admin) 검증으로 비GM 사용 차단
- **환생 차수별 NPC 대사** — 환생 1·2·3차마다 마을 주민·아이가 기억하고 다르게 반응 (놀람→경외→전설 취급)
- **채팅창 자동 절단** — 일정 높이(화면 32%) 초과 시 위(오래된 메시지)부터 자동 잘라냄, 여유 생기면 복귀
- **타격감 히트스톱** — 피격 순간 물리 정지: 일반 26ms · 크리티컬 55ms · 격파 70ms + 미세 카메라 흔들림
- **경험치 비약 3종** — 고급 성장의 비약(필요 EXP 60%)/태풍 성장의 비약(150%)/극한 성장의 비약(즉시 +1레벨, Lv200 미만) — 골드/캐시상점 판매
- **감정 버블** — 대화 시작 ！·레벨업 ★·취침 zZ·GM 엘릭서 ♥ 등 캐릭터 감정 표현
- **SNS OAuth 가이드** — 구글/카카오/네이버 로그인 키 발급·적용 가이드 별첨 (SNS_OAuth_키발급_적용_가이드.txt)

### 배포물
- **APK**: SERTZ-v1.2.0.apk (106,750,594B · versionCode 88)

md5: 76fa2bad71a120e163e12d5a14c9e13d
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.2.0 — 외형 대개편·거래소 근본 수정·타격감", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.2.0 — 외형 대개편·거래소 근본 수정·타격감",
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
    ok_apk = "76fa2bad71a120e163e12d5a14c9e13d" in guide
    print(f"apk-guide 서빙 md5 포함: APK={ok_apk}")
    if not ok_apk:
        print("!! guide에 새 md5 없음 — 정정 필요")
except Exception as e:
    print(f"guide 확인 실패: {e}")
