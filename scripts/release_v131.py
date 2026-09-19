#!/usr/bin/env python3
"""v1.3.1 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 9건 — SPUM 코스튬/자가치유/부활/스타포스/전직개편)
   v1.3.0 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.3.1"
APK = "/home/z/my-project/download/SERTZ-v1.3.1.apk"
EXPECT_MD5 = "1de1357fde46d696beb89b0c3567c454"

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


local = md5f(APK)
assert local == EXPECT_MD5, f"로컬 md5 불일치: {local} != {EXPECT_MD5}"
size = os.path.getsize(APK)
print(f"로컬 OK: {APK} {size}B md5={local}")

BODY = """## v1.3.1 — 유저 지시 9건 반영: SPUM 신규 코스튬 8종 + 검은화면/멈춤 자가치유 + 가까운 마을 부활 + 전 장비 스타포스 + 전직 퀘스트 개편 (versionCode 91)

### 신규 코스튬 (지시 #1)
- **SPUM 소재 신규 코스튬 8종** — 발키리/마녀/숲수호자/백합/대군주/성기사/칼날/항해사. 투구·후드·망토 등 SPUM 실제 파트 조합으로 여형/남형 시트를 **완전 교체**해 새 외형 본체로 제작(기존 캐릭터 단순 변색 아님). 교차 성별 착용 지원(여캠→대군주, 남캠→발키리 등)

### 안정성 (지시 #5 검은화면 / #8 멈춤)
- **검은화면 자가치유** — 로더 교착 폴백 + 장시간 백그라운드 복귀 시 자동 재부팅(씬 update가 죽어도 프레임 워처 단계에서 감지해 복구)
- **게임 멈춤 수정** — 앱 전환 복귀 시 입력/물리 자가치유 + 히트스톱 재개 가드(히트스톱 중 백그라운드 이동 → 복귀 후 영원히 멈추던 케이스 차단)

### 시스템 (지시 #3 스타포스 / #4 전직 / #6 부활 / #7 소수)
- **모든 장비 스타포스** — 장신구(반지/목걸이 등)도 atk/def 트랙 신설로 강화 가능. 일부 장비만 가능했던 제한 폐지
- **전직 조각회수 폐지 → 맵 이동 퀘스트** — 메이플스토리식: 계열별로 다른 맵을 이동하며 완수하는 퀘스트로 개편
- **부활 시 가까운 마을** — 필드 사망 시 개방된 마을 중 가장 가까운 곳으로 복귀(미개방 마을로 보내지던 문제 수정)
- **능력치 소수 정리** — 크리틱률/속도 등 표시값 소수 정리

### 월드/최적화 (지시 #2 지형물 / #9 최적화)
- **지형물 배치 수정** — 요새 유적 구조물/포탈/입장 지점 보호 반경 신설, 장식 지형물 겹침 배치 제거
- **최적화** — 모바일(Android) 기본 절전 모드(fxMode low) + 적 리스폰 상한 축소

---
- md5: `1de1357fde46d696beb89b0c3567c454` (111,654,919B · versionCode 91)
- 기존 세이브 그대로 유지 · 덮어설치 가능
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html
"""

# 1) 기존 릴리스/태그 확인
rel = json.loads(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}").read())
if rel.get("id"):
    print(f"기존 릴리스 재사용: id={rel['id']}")
    rel_id = rel["id"]
    for a in rel.get("assets", []):
        if a["name"] == os.path.basename(APK):
            api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
            print(f"기존 asset 삭제: {a['name']}")
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"body": BODY, "draft": False, "prerelease": False}).encode(),
        headers={"Content-Type": "application/json"}).read()
else:
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": f"SERTZ {TAG} — SPUM 코스튬 8종·자가치유·전 장비 스타포스",
        "body": BODY, "draft": False, "prerelease": False,
    }).encode()
    rel = json.loads(api(f"https://api.github.com/repos/{REPO}/releases", data=payload,
                         headers={"Content-Type": "application/json"}).read())
    rel_id = rel["id"]
    print(f"신규 릴리스 생성: id={rel_id} tag={TAG}")

# 2) APK 업로드
up_url = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={os.path.basename(APK)}"
with open(APK, "rb") as f:
    data = f.read()
for attempt in range(3):
    try:
        api(up_url, data=data, headers={"Content-Type": "application/octet-stream"}).read()
        break
    except Exception as e:
        print(f"업로드 재시도 {attempt+1}: {e}")
        time.sleep(5)
print("업로드 완료")

# 3) 원격 검증
time.sleep(3)
assets = json.loads(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}").read())["assets"]
for a in assets:
    print(f"asset: {a['name']} {a['size']}B state={a['state']}")

tmp = "/tmp/verify_v131.apk"
urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-{TAG}.apk", tmp)
remote = md5f(tmp)
print(f"원격 md5: {remote} — {'일치 ✓' if remote == EXPECT_MD5 else '불일치 ✗'}")
assert remote == EXPECT_MD5, "원격 md5 불일치!"
print("RELEASE COMPLETE")
