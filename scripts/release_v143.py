#!/usr/bin/env python3
"""v1.4.3 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 리포트 6건 — 유적 히트박스·철거 / 등급업 큐브 / 보스 유물 아이콘 / 공동 토벌전 / 재림 시리즈)
   release_v142.py 계승 — APK 전용"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.3"
APK = "/home/z/my-project/download/SERTZ-v1.4.3.apk"
EXPECT_MD5 = "e84879e38296cd2356fe8db6add7658e"

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

BODY = """## v1.4.3 — 유저 리포트 6건 전부 반영 (versionCode 95)

### 👻 요세유적 보이지 않는 히트박스 제거
- 유적 지지대의 은닉 충돌 판정(기둥 하단 zone)이 원인 — 시각 경계와 어긋난 채 플레이어를 막았다
- 구조물 철거와 함께 히트박스 원천 소멸

### 🏰 마을 유적 구조물 철거 (보물 상자만 잔존)
- 계단·발코니·목책·횃불·기둥·안내판 전부 제거
- 하루 1회 보상 보물상자(골드 + 에메랄드 확률)만 지상에 남긴다 — 상자는 충돌 없음

### 🎲 등급업 큐브 사용 가능
- 기존엔 착용 장비 탭의 [등급업] 버튼으로만 사용 가능해 큐브를 눌러도 아무 일 없는 상태였다
- 가방 큐브 행에서 [무기 등급업] / [방어구 등급업] 버튼 직접 노출
- 실패 시 원인별 안내 (큐브 없음 — 캐시상점 안내 / 이미 전설 등급)

### 🖼️ 보스 유물·일부 아이템 이미지 실패 근본 수정
- 근원: 보스 유물(bd_*) 등 아이콘이 Phaser 로드 목록 밖 → 보스 드롭이 아예 안 보였다
- 전 아이템 아이콘 173종 타이틀 지연 로드 등록 (texGuard 무결성 감시 대상 자동 합류)
- 드롭 텍스처 폴백 + UI 아이콘 <img> 자동 재시도(2회 캐시버스팅) 3중 방어

### ⚔️ 멀티 콘텐츠 — 파티 공동 토벌전 신설
- 파티 위젯의 [공동 토벌전] 버튼으로 입장 (단독 입장도 가능)
- 레이드 보스 "심연의 감시자" — 파티원 수만큼 HP +35%/명 · 보상 증가 · 에메랄드 +1/명
- 같은 파티가 입장하면 서로 보이고 공격 연출 동기화 (기존 멀티 릴레이 재사용)

### 🐉 재림 시리즈 완성
- 보스 재도전 창에 재림의 땅 보스 3종 추가 — 재림5 베오르드 / 재림10 요르문간드 / 재림15 나그라파르
- 난이도(이지~카오스) 공용 적용 · 재림판 계수(HP ×5 · ATK ×2.2 · 보상 ×3)

---
- md5: `e84879e38296cd2356fe8db6add7658e` (111,668,934B · versionCode 95)
- 기존 세이브 그대로 유지 · 덮어설치 가능
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html"""

assert not os.path.exists(f"/tmp/.rel_v143_done"), "재실행 방지"
open("/tmp/.rel_v143_done", "w").write("1")

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
        "name": "SERTZ v1.4.3 — 리포트 6건 (유적 정리·등급업 큐브·아이콘·공동 토벌전·재림 완성)",
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
    if a["name"] == "SERTZ-v1.4.3.apk":
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 asset 삭제: {a['id']}")
        time.sleep(2)

# 3) 업로드
up_url = f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name=SERTZ-v1.4.3.apk"
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
remote = f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.4.3.apk"
tmp = "/tmp/verify_v143.apk"
urllib.request.urlretrieve(remote, tmp)
rm = md5f(tmp)
print(f"원격 md5: {rm}")
assert rm == EXPECT_MD5, "원격 md5 불일치!"
print("✅ v1.4.3 릴리스 완료 — 원격 md5 일치")
