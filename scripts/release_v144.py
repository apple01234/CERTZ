#!/usr/bin/env python3
"""v1.4.4 Release 생성 + APK 업로드 + 원격 md5 검증
   (첫 사냥터 Lv3 교착 근본 수정 — NPC 3명 대화→레벨3 · 초행자 훈련장 복구 ·
    파티 보드 무한루프 수정 · 보물상자 렌더 복구 · v1.4.3 병합 유실분 복구)
   release_v143.py 계승 — APK 전용"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.4"
APK = "/home/z/my-project/download/SERTZ-v1.4.4.apk"
EXPECT_MD5 = "81ed988f4db2e5a3343865da6fbadea9"

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

BODY = """## v1.4.4 — 첫 사냥터 레벨 교착 근본 수정 (versionCode 96)

### 🗣️ NPC 3명 대화 → 레벨 3 달성 (유저 지시)
- 마을 주민 2명 + 카이엔 교관(전직 NPC) = 총 3명과 대화를 끝내면 레벨 3이 즉시 달성
- "첫 사냥터로 가려면 3레벨이 필요한데 3레벨을 어떻게 찍음??"의 정면 해결
- 첫 퀘스트가 「마을 NPC 3명과 인사」로 개편 — 누구에게 말해야 하는지 명확 안내
- 레벨업은 정규 경로(스탯/AP+5/연출)로 처리 — 중복 지급 없음 (Lv.3 이상이면 미지급)

### 🐺 초행자 훈련장 복구 (병합 유실분)
- 이전 업데이트에서 유실됐던 마을 훈련장 복구 — 훈련용 늑대 3마리 상시 리스폰 + 표지판 + 횃불
- 훈련용 늑대는 기본 늑대의 0.6배 HP / 0.35배 공격 / 0.9배 경험치 — Lv1도 3~4방
- 보물상자(하루 1회)와 남쪽 이웃으로 공존 배치 — 마을에서 1→3레벨 루트 완성

### 🧊 "캐릭터 선택 후 응답없음"급 프리즈 근본 수정 — 오늘의 파티 미션 보드
- 파티 보드의 오늘의 미션 선택 로직이 날짜 해시에 따라 순환 사이클에 빠져
  3종을 영영 채우지 못하는 무한루프 — 메인 스레드 정지(게임 전체 멈춤)
- 결정적 Fisher-Yates 셔플로 교체 — 어떤 날짜에도 즉시 종료·항상 3종 선택

### 🧰 보물상자 렌더 복구
- 유적 철거 후 하루 1회 보상 상자의 텍스처(map_chest_f)가 로드 목록에서 빠져 있던 것 복구

### ♻️ v1.4.3 병합 유실분 전면 복구
- 파티 시너지 콤보(계열 조합 버프 실적용) + 오늘의 파티 미션 보드 + 솔로 가호
- 성능 최적화 4종(오라 LUT·프레임 실측 창·포탈 가이드 스로틀 등) + 마을 이상한 비석(ARG 힌트)

---
- md5: `81ed988f4db2e5a3343865da6fbadea9` (117,497,248B · versionCode 96)
- 기존 세이브 그대로 유지 · 덮어설치 가능 (구버전 진행분도 첫 퀘스트부터 자동 재개)
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html"""

assert not os.path.exists(f"/tmp/.rel_v144_done"), "재실행 방지"
open("/tmp/.rel_v144_done", "w").write("1")

# 1) 기존 릴리스 있으면 재사용, 없으면 생성
r = api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}")
rel = json.loads(r.read().decode())
if "id" in rel and rel.get("id"):
    rid = rel["id"]
    print(f"기존 릴리스 재사용: id={rid}")
else:
    payload = json.dumps({
        "tag_name": TAG,
        "target_commitish": "main",
        "name": "SERTZ v1.4.4 — 첫 사냥터 Lv3 교착 수정 (NPC 3명 대화→레벨3·훈련장 복구·프리즈 수정)",
        "body": BODY,
        "draft": False,
        "prerelease": False,
    }).encode()
    r = api(f"https://api.github.com/repos/{REPO}/releases", payload)
    rel = json.loads(r.read().decode())
    rid = rel["id"]
    print(f"릴리스 생성: id={rid}")

# 2) 기존 asset 동일명 있으면 삭제
for a in rel.get("assets", []):
    if a["name"] == "SERTZ-v1.4.4.apk":
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 asset 삭제: {a['id']}")
        time.sleep(2)

# 3) 업로드
up_url = f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name=SERTZ-v1.4.4.apk"
data = open(APK, "rb").read()
req = urllib.request.Request(up_url, data=data, headers={
    "Authorization": f"token {TOKEN}", "User-Agent": "curl",
    "Content-Type": "application/octet-stream",
    "Content-Length": str(len(data)),
})
up = urllib.request.urlopen(req, timeout=1200)
asset = json.loads(up.read().decode())
print(f"업로드 완료: asset id={asset['id']} size={asset['size']}")

# 4) 원격 재다운로드 md5 검증
time.sleep(3)
remote = f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.4.4.apk"
tmp = "/tmp/verify_v144.apk"
urllib.request.urlretrieve(remote, tmp)
rm = md5f(tmp)
print(f"원격 md5: {rm}")
assert rm == EXPECT_MD5, "원격 md5 불일치!"
print("✅ v1.4.4 릴리스 완료 — 원격 md5 일치")
