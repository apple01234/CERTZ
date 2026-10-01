#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.4.9 릴리스 — GitHub Release v1.4.9 생성/갱신 + APK 업로드 + 원격 무결성 검증 + 다운로드 안내 갱신."""
import hashlib, json, os, subprocess, sys

REPO = "apple01234/CERTZ"
TAG = "v1.4.9"
APK_LOCAL = "/home/z/my-project/download/SERTZ-v1.4.9.apk"
APK_NAME = "SERTZ-v1.4.9.apk"

apk_bytes = open(APK_LOCAL, "rb").read()
md5 = hashlib.md5(apk_bytes).hexdigest()
size = len(apk_bytes)
print(f"APK: {APK_NAME} · {size}B · md5 {md5}")

BODY = f"""## SERTZ v1.4.9 (versionCode 101)

### 🐉 보스 전면 리뉴얼 (유저 지시 3 — 보스 디자인·애니메이션 보강)
- **보스 9종 아트 전부 신규 일러스트로 리페인팅** — 심연의 수호자·눈보라의 거수·니드호그·수르트·펜리르·심연의 군주·스콜&하티·가름·아부디토스 (재림 보스 3종 베오르드/요르문간드/나그라파르도 함께 새로워집니다)
- 원본과 동일한 텍스처 규격으로 교체 — 히트박스·밸런스 판정 100% 불변
- **애니메이션 전면 강화**
  - 등장: 하늘 높이에서 낙하 착지 (Bounce 이징 + 착지 순간 오라색 충격파·먼지 버스트·화면 진동)
  - 상시: 부피 보존 호흡 펄스(±2.2%) — 멈춰 있는 것 같지 않은 생동감
  - 공격: 패턴별 예동(스쿼시&스트레치) — 강타는 몸을 젖혔다 내려찍고, 돌진은 웅크렸다 러닝 스타트, 브레스는 들이마신 뒤 분출
  - 피격: 미세 진동 반응 추가 (기존 화이트 플래시 유지)
  - 페이즈 전환: 포효 자세 + 기존 버스트/배너 연계
  - 사망: 오라색 잔상 3겹 확산 소멸 + 본체 페이드 + 2중 충격파 (기존 폭발 연출 위에 강화)

### 📱 전투 UI 우측 정렬 (유저 지시 1)
- 스킬·물약·자동전투 버튼 클러스터를 화면 오른쪽 끝으로 이동 (우측 여백 8px→4px, 태블릿/PC 20px→4px)
- 우상단 HUD(자동 토글·퀘스트·사운드 열)도 동일하게 오른쪽 끝 정렬

### 🔑 관리자 계정 복구 경로 공식화 (유저 지시 2)
- 서버 시작 시 `SERTZ_ADMIN_PASSWORD` 환경변수를 설정하면 admin 계정 비밀번호가 자동 동기화 — 분실해도 항상 복구 가능
- 계정 DB 원격 복원 경로에 잔존하던 구 기본 비밀번호(admin123) 시드 제거 — 무작위 발급+로그 1회 노출로 통일

### ♻️ 회귀
- v1.4.8 전 기능 유지 (최적화·보안 헤더·중앙 모달 UI·기능별 사운드 분리·BGM 크로스페이드·패널 애니메이션)
- E2E 11/11 PASS (버전·admin 로그인·보스 아트 9종 서빙·월드 진입·UI 우측 여백 실측·텍스처 로드·콘솔 에러 0)

### 💾 세이브 안내
- 기존 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다

---
- md5: {md5}
- size: {size}B
- applicationId: com.sertz.myapp · versionCode: 101 · versionName: 1.4.9
- 서명: 기존 릴리스 키 동일
"""

TOKEN = os.environ.get("GITHUB_TOKEN")
if not TOKEN:
    cfg = open("/home/z/my-project/.git/config").read()
    import re
    m = re.search(r"https://x-access-token:([^@]+)@github\.com", cfg)
    TOKEN = m.group(1)
HEAD = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"}

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
              {"tag_name": TAG, "name": "SERTZ v1.4.9 — 보스 전면 리뉴얼 (vc101)", "body": BODY})
    print(f"기존 릴리스 갱신: id {rel['id']}")
else:
    rel = api(f"/repos/{REPO}/releases", "POST",
              {"tag_name": TAG, "target_commitish": "main",
               "name": "SERTZ v1.4.9 — 보스 전면 리뉴얼 (vc101)", "body": BODY})
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
subprocess.run(["curl", "-sL", "-o", "/tmp/verify149.apk", url], check=True)
remote = open("/tmp/verify149.apk", "rb").read()
rmd5 = hashlib.md5(remote).hexdigest()
print(f"원격 md5: {rmd5} — {'일치 ✓' if rmd5 == md5 else '불일치 ✗'}")

# 5) 다운로드 안내 txt — v1.4.9 블록 선두 삽입
txt_p = "/home/z/my-project/download/APK_다운로드_안내.txt"
txt = open(txt_p, encoding="utf-8").read()
v149_block = f"""v1.4.9 (최신) — 보스 전면 리뉴얼 (유저 지시 3건: 보스 디자인·애니메이션 보강 / 전투 UI 우측 정렬 / admin 복구 경로)
· 다운로드: https://github.com/{REPO}/releases/download/{TAG}/{APK_NAME}
· md5: {md5} ({size}B, versionCode 101)
"""
if "v1.4.9 (최신)" not in txt:
    txt = v149_block + "\n" + txt
    open(txt_p, "w", encoding="utf-8").write(txt)
print("APK_다운로드_안내.txt 갱신 OK")
print("=== v1.4.9 릴리스 완료 ===")
