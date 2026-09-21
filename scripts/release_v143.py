#!/usr/bin/env python3
"""v1.4.3 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 6건 — 유적 삭제·초반 동선·최적화·파티 콘텐츠·유니온 에셋·ARG 복구)
   v1.4.2 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.3"
APK = "/home/z/my-project/download/SERTZ-v1.4.3.apk"
EXPECT_MD5 = "414e9533c1b82a1ede3c038e6b3d669c"

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

BODY = """## v1.4.3 — 유저 지시 6건: 고대 유적 삭제 · 초반 레벨 동선 보강 · 최적화(퀄리티 유지) · 파티 콘텐츠 · 유니온 에셋 · ARG 페이지 복구 (versionCode 95)

### 1️⃣ 고대(요새) 유적 전면 삭제
- 마을 랜드마크였던 요새 유적 2층 구조물(발코니·계단·기둥·목책·횃불·2층 상자)을 코드·전용 텍스처 로드까지 완전 제거 — 3세대 반복 불만의 근원 제거
- 유적 전용 텍스처(map_ground/map_props/map_torch/map_chest 등) 미로드로 부팅 요청 수·용량 절감
- 자리는 '초행자 훈련장'으로 대체 — 빈 공간 없이 콘텐츠 교체

### 2️⃣ 초반 레벨 동선 보강 (신규 유저 1→3레벨 루트 완성)
- **1-1 진입 게이트 Lv3→Lv1 완화** — 시작하자마자 첫 사냥터 입장 가능
- **마을 「초행자 훈련장」 신설** — 훈련용 늑대 3마리 상시 리스폰(기본 늑대의 0.6배 HP/0.35배 공격/0.9배 EXP), 표지판·퀘스트 마커로 시선 유도
- **초보 사냥 퀘스트 신설** — 마을 퀘스트 3단 체인(주민 인사 → 훈련용 늑대 4마리 사냥 → 숲의 신전 이동)
- Lv1→2→3 구간이 마을 안에서 3~5분 내 매끄럽게 연결

### 3️⃣ 최적화 (비주얼 품질 그대로)
- **오라 색 LUT(64단계)** — 매 프레임 HSL→RGB 변환을 사전 계산 조회로 (GC 할당 0)
- **적 애니메이션 키 캐싱** — 적 20기 × 60fps 기준 초당 2,400회 문자열 생성 제거
- **포탈 가이드 갱신 150ms 스로틀** — 화살표 이동은 프레임당 갱신 없이도 부드럽다
- **화면 밖 원격(1,700px+) 갱신 생략** — 보간만 하고 애니·이름표·오라 갱신 스킵
- 프레임 실측 필드 노출(평균/최악/개체수) — 적응형 품질 시스템과 연동

### 4️⃣ 파티 콘텐츠 2종
- **파티 시너지 콤보** — 파티원 직업 계열 조합별 버프(전사+마법사 등): EXP/골드 시너지, 3계열 '모험의 단합'(EXP+22%) 등
- **오늘의 파티 미션 보드** — 일일 3종(파티 순찰/원정 이동/결정 조사·처치), 파티 풀 보상 / 솔로 50%
- **솔로 가호** — 파티 없이도 EXP +5% (솔플 유저 소외 방지)

### 5️⃣ 유니온 전용 시각 에셋 13종
- 아티팩트 아이콘 6종(공격/체력/크리티컬/골드/방어/속도) — **성장 단계별 등급 프레임**(일반→희귀→영웅→전설, 프레임+발광+배지 분리)
- 유니온 버프 아이콘 4종 + 레이드 보스 전용 초상 3종(베히모스·니드호그·아비슬로드)
- 기존 최고 수준 에셋 품질에 맞춘 전용 일러스트

### 6️⃣ ARG 힌트 웹페이지 복구
- **/secret/ 2종 복구·리디자인(모바일 대응 뷰포트)** — 첫 페이지 URIEL 두문자 암호, 두 번째 조각 ROT13 암호문
- APK 다운로드 가이드 소스 주석에 암호 단서(8426) 복원
- 마을 어귀에 **「이상한 비석」** 신설 — 낙서를 읽으면 세계수의 기록(/secret/)이 열린다 + 비밀수첩 힌트 버튼 재연결

---
- md5: `414e9533c1b82a1ede3c038e6b3d669c` (117,493,536B · versionCode 95)
- 기존 세이브 그대로 유지 · 덮어설치 가능 (유적 상자 일일보상은 폐기, 마을 퀘스트 진행분은 초보 사냥 퀘스트로 자연 이어짐)
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html"""

# 1) 기존 릴리스 존재 확인
r = api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}")
rel = json.loads(r.read() if hasattr(r, "read") else b"{}")
rel_id = rel.get("id")
if rel_id:
    print(f"기존 Release 존재(id={rel_id}) — 자산 교체")
else:
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": "SERTZ v1.4.3 — 유저 지시 6건",
        "body": BODY, "draft": False, "prerelease": False,
    }).encode()
    r = api(f"https://api.github.com/repos/{REPO}/releases", payload, {"Content-Type": "application/json"})
    rel = json.loads(r.read())
    rel_id = rel["id"]
    print(f"Release 생성: id={rel_id} tag={TAG}")

# 2) 기존 자산 삭제 후 업로드
r = api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}/assets")
for a in json.loads(r.read() if hasattr(r, "read") else b"[]"):
    if a.get("name") == os.path.basename(APK):
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 자산 삭제: {a['name']}")
        time.sleep(1)

url = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={os.path.basename(APK)}"
data = open(APK, "rb").read()
req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Authorization", f"token {TOKEN}")
req.add_header("Content-Type", "application/octet-stream")
r = urllib.request.urlopen(req, timeout=1800)
print("업로드:", json.loads(r.read())["browser_download_url"])

# 3) 원격 md5 검증
for attempt in range(5):
    try:
        tmp = "/tmp/_remote_check.apk"
        urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.4.3.apk", tmp)
        remote = md5f(tmp)
        os.remove(tmp)
        assert remote == EXPECT_MD5, f"원격 md5 불일치: {remote}"
        print(f"원격 md5 검증 ✓ — {remote}")
        break
    except Exception as e:
        print(f"검증 재시도 {attempt+1}/5: {e}")
        time.sleep(5)
else:
    raise SystemExit("원격 검증 실패")
print(f"\n✅ v1.4.3 릴리스 완료: https://github.com/{REPO}/releases/download/{TAG}/SERTZ-v1.4.3.apk")
