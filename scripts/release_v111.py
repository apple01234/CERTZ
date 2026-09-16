#!/usr/bin/env python3
"""v1.1.1 Release 생성 + APK+AAB 업로드 + 원격 md5 검증 (유저 신고 8건 + AAB 빌드)
   v1.1.0 스크립트 개선식: AAB 업로드/검증 추가"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.1.1"
ASSETS = [
    ("/home/z/my-project/download/SERTZ-v1.1.1.apk", "76c2f2f7d4f3def7bc1837ea4e98b179"),
    ("/home/z/my-project/download/SERTZ-v1.1.1.aab", "e4b12b3f99ed7e32e12e18d0cad19016"),
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

BODY = """## v1.1.1 — 유저 신고 8건 수정 + 플레이스토어용 AAB (versionCode 87)

### 버그 수정 (유저 신고 8건)
- **튜토리얼이 가려진다** — 튜토리얼 진행 중 보상 팝업·퀘스트 트래커가 중하단으로 물러난다 (tut:active 이벤트 연동, 종료 시 원위치)
- **무릉도장 일반 유저 사용 불가** — 콘텐츠 허브에 「훈련장」 탭 신설, 운영자(GM) 없이도 도장 입장
- **결제 취소 "결제 취소됨" 무한 반복** — 유저 취소(cancelled)와 진짜 실패(error/unavailable)를 분류, 취소는 조용히 종료
- **포니테일(마이태)이 얼굴 앞에 걸린다** — 방향별 시트 전환(정면 f/측면 s/뒷면 b) + 묶음 원점 보정으로 뒤통수에 착용
- **무지개 오라 등 이펙트 이름=외관 불일치** — 무지개 오라 실제 무지개 색 실시간 순환(rainbow/aurora/galaxy 위상 진행)
- **왕가의 왕관 등 장식 착용 불가** — 캐시상점 구매 즉시 장식 슬롯 착용(오라 슬롯 오류 수정) + 슬롯 지정 착용/해제
- **남녀 치장 분리** — 같은 코스튬도 성별에 따라 여성형 cost_* / 남성형 costm_* 실루엣 전용 스프라이트 10종씩 전면 재생성
- **유저 거래소 사용 불가** — 게스트 상태에 인라인 로그인 버튼 → 계정창 바로 열림

### 배포물
- **APK**: SERTZ-v1.1.1.apk (106,502,352B · versionCode 87)
- **AAB(플레이스토어 업로드용)**: SERTZ-v1.1.1.aab (105,509,173B) — Play Console 내부 테스트 트랙 업로드용

md5:
- APK: 76c2f2f7d4f3def7bc1837ea4e98b179
- AAB: e4b12b3f99ed7e32e12e18d0cad19016
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.1.1 — 유저 신고 8건 수정·AAB 빌드", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.1.1 — 유저 신고 8건 수정·AAB 빌드",
            "body": BODY,
            "draft": False,
            "prerelease": False,
        }).encode(),
        headers={"Content-Type": "application/json"},
    ))
    rel_id = created["id"]
    print(f"릴리스 생성 id={rel_id}")

# 2) 업로드 (APK + AAB)
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

# 3) 원격 md5 복수검증 (APK + AAB)
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

# 4) apk-guide 서빙 md5 잔존 검증 (로컬 서버 기준)
try:
    guide = urllib.request.urlopen("http://localhost:3000/apk-guide.html", timeout=15).read().decode()
    ok_apk = "76c2f2f7d4f3def7bc1837ea4e98b179" in guide
    ok_aab = "e4b12b3f99ed7e32e12e18d0cad19016" in guide
    print(f"apk-guide 서빙 md5 포함: APK={ok_apk} AAB={ok_aab}")
    if not (ok_apk and ok_aab):
        print("!! guide에 새 md5 없음 — 정정 필요")
except Exception as e:
    print(f"guide 확인 실패: {e}")
