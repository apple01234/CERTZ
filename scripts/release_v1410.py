#!/usr/bin/env python3
"""v1.4.10 Release 생성 + APK 업로드 + 원격 md5 검증
   (유저 지시 8건: 구매 수량 직접 입력·전투 UI 기본공격 밀착·유적풍 소품 제거·
    고목 충돌·히트박스 정밀 정렬·튜토리얼/설명 강화·챕터별 보스 BGM)
   release_v149.py 계승 — APK 전용"""
import json, subprocess, hashlib, os, re

REPO = "apple01234/CERTZ"
TAG = "v1.4.10"
APK_NAME = "SERTZ-v1.4.10.apk"
APK_LOCAL = "/home/z/my-project/download/SERTZ-v1.4.10.apk"

def md5f(path):
    m = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            m.update(chunk)
    return m.hexdigest()

md5 = md5f(APK_LOCAL)
size = os.path.getsize(APK_LOCAL)

BODY = f"""## SERTZ v1.4.10 — 유저 지시 8건 (vc102)

### 🛒 상점·인벤토리
- **구매 수량 직접 입력** — 상점 수량 스테퍼의 가운데 숫자를 탭해 키패드로 바로 입력 (1~99, −/+ 버튼 병행)
- 판매 수량 입력·MAX 전량 판매는 기존 그대로 유지

### 📱 전투 UI (모바일)
- **기본공격 버튼 밀착 재정렬** — [스킬 그리드] → [자동전투·물약] → [기본공격] 순으로 배치, 모든 액션 아이콘이 공격 버튼 바로 옆에 밀착

### 🌲 맵·오브젝트 정합성
- **숲 필드 유적풍 이질 소품 전면 제거** — 다른 아트스타일의 183~235px 유적 소품(fm_tree/fm_prop) 철거, 나무/바위 세트 통일
- **고목 충돌 부여** — 128px 데드트리를 뚫고 다니던 문제 수정 (헬·동굴·화산)
- 대형 뼈 소품(cl_bones) 발밑 렌더 제거

### 🎯 히트박스 정밀 정렬
- **정예 몬스터 피격 판정 스케일 보정** — 1.55배 정예의 판정이 시각 몸통보다 작던 문제 수정
- **플레이어 투사체 판정 프레임 기반** — 화살·볼트·파동 모두 스프라이트 크기에 맞춤 (기존 고정 12px 원판)

### 💬 튜토리얼·게임 중 설명 강화
- 튜토리얼 6단계 전부 상세 설명으로 보강 (조작법·위치·대처법)
- 컨텍스트 힌트 배너 — 보스 구역 진입 / 사망 / HP 30% 이하 / 필드 진입 시 1회 안내

### 🎵 챕터별 보스 BGM 전용화
- 9챕터 보스전 곡이 **전부 달라짐** — boss1~9 챕터 1:1 매핑
- 신규 보스곡 4트랙(bgm_boss6~9) 추가 · 재림 보스 r5/r10/r15 전용 배치
- ⚠️ 40트랙 → 44트랙으로 확대 (APK 용량 일부 증가)

### 💾 세이브 안내
- 기존 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다

---
- md5: {md5}
- size: {size}B
- applicationId: com.sertz.myapp · versionCode: 102 · versionName: 1.4.10
- 서명: 기존 릴리스 키 동일
"""

TOKEN = os.environ.get("GITHUB_TOKEN")
if not TOKEN:
    cfg = open("/home/z/my-project/.git/config").read()
    m = re.search(r"https://x-access-token:([^@]+)@github\.com", cfg)
    TOKEN = m.group(1)

def api(path, method="GET", data=None):
    cmd = ["curl", "-s", "-X", method, f"https://api.github.com{path}",
           "-H", f"Authorization: token {TOKEN}", "-H", "Accept: application/vnd.github+json"]
    if data is not None:
        cmd += ["-d", json.dumps(data)]
    out = subprocess.check_output(cmd)
    return json.loads(out) if out.strip() else {}

# 1) 릴리스 생성 or 재사용
rel = None
for r in api(f"/repos/{REPO}/releases?per_page=15"):
    if r.get("tag_name") == TAG:
        rel = r
        break
if rel:
    rel = api(f"/repos/{REPO}/releases/{rel['id']}", "PATCH",
              {"tag_name": TAG, "name": "SERTZ v1.4.10 — 유저 지시 8건: 편의성·정합성 대개편 (vc102)", "body": BODY})
    print(f"기존 릴리스 갱신: id {rel['id']}")
else:
    rel = api(f"/repos/{REPO}/releases", "POST",
              {"tag_name": TAG, "target_commitish": "main",
               "name": "SERTZ v1.4.10 — 유저 지시 8건: 편의성·정합성 대개편 (vc102)", "body": BODY})
    print(f"신규 릴리스: id {rel['id']}")

rid = rel["id"]

# 2) 기존 동명 에셋 삭제
for a in rel.get("assets", []):
    if a["name"] == APK_NAME:
        api(f"/repos/{REPO}/releases/assets/{a['id']}", "DELETE")
        print(f"기존 에셋 삭제: {a['name']}")

# 3) 업로드
up = subprocess.run(["curl", "-s", f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name={APK_NAME}",
                     "-H", f"Authorization: token {TOKEN}", "-H", "Content-Type: application/octet-stream",
                     "--data-binary", f"@{APK_LOCAL}"], capture_output=True, text=True)
asset = json.loads(up.stdout)
print(f"업로드 완료: {asset.get('name')} · {asset.get('size')}B · state={asset.get('state')}")

# 4) 원격 무결성 검증
url = f"https://github.com/{REPO}/releases/download/{TAG}/{APK_NAME}"
subprocess.run(["curl", "-sL", "-o", "/tmp/verify_v1410.apk", url], check=True)
remote = open("/tmp/verify_v1410.apk", "rb").read()
rmd5 = hashlib.md5(remote).hexdigest()
print(f"원격 md5: {rmd5} — {'일치 OK' if rmd5 == md5 else '불일치 FAIL'}")
print("=== v1.4.10 릴리스 완료 ===")
