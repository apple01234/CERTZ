#!/usr/bin/env python3
# SERTZ v1.4.5 GitHub Release 생성 + APK 업로드 (토큰은 git remote URL에서 추출)
import json, subprocess, sys, urllib.request, os

REMOTE_URL = subprocess.check_output(["git", "-C", "/home/z/my-project", "config", "--get", "remote.origin.url"], text=True).strip()
TOKEN = REMOTE_URL.split("x-access-token:")[1].split("@github.com")[0]
API = "https://api.github.com/repos/apple01234/CERTZ"
APK = "/home/z/my-project/download/SERTZ-v1.4.5.apk"
TAG = "v1.4.5"

body = """## SERTZ v1.4.5 (versionCode 97)

### ♻️ 무한 재부팅 근본 차단 (이상한 돌·ARG 웹페이지 접속 후 복귀 시)
- **재부팅 예산 체계** — 2분 창에 자가 재부팅 최대 2회, 초과 시 자동 재부팅을 멈추고 수동 복구 화면 표시
- **이상한 비석(APK)** — 게임 화면을 떠나지 않고 ARG 페이지 주소를 클립보드로 안내 (WebView 이동 트리거 제거)
- **복귀 직후 15초 관찰 유예** — 외부 페이지 복귀 후 즉시 재부팅 제거 + 프리즈 판정은 루프 생존 확인 후

### 📋 플레이스토어 대비
- 광고 ID(AD_ID) 미사용 선언 (매니페스트 tools:node="remove")
- applicationId com.sertz.myapp (Play Console 등록명 일치 — 구버전 삭제 후 신규 설치 필요)
- 지원센터 /support (문의·기기 데이터 삭제·계정 삭제) + 개인정보처리방침 /privacy
- 모든 통신 HTTPS 강제 (http 자동 승격)

### 🌐 기타
- 멀티 진입 HUD 노출 (더보기 '멀티' 버튼 + 파티/친구 위젯 좌측 이동)
- v1.4.4 전 기능 유지 (NPC 3명 대화→Lv.3 · 초행자 훈련장 · 파티 콘텐츠 · 보물상자)

※ 계정 로그인 유저: 설치 후 로그인하면 클라우드 세이브가 자동 복원됩니다

apk md5: `c497b5fc9ec168db78b2eac6ece38e8b` (117,541,690B)"""

payload = json.dumps({
    "tag_name": TAG,
    "target_commitish": "main",
    "name": "SERTZ v1.4.5 — 무한 재부팅 차단 · 플레이스토어 대비 (vc97)",
    "body": body,
    "draft": False,
    "prerelease": False,
}).encode()

req = urllib.request.Request(f"{API}/releases", data=payload, headers={
    "Authorization": f"token {TOKEN}", "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req) as r:
        rel = json.load(r)
    print("[1] 릴리스 생성 OK — id:", rel["id"])
except urllib.error.HTTPError as e:
    print("[1] 릴리스 생성 실패:", e.read().decode()[:400])
    sys.exit(1)

upload_url = rel["upload_url"].split("{")[0] + f"?name=SERTZ-{TAG}.apk"
size = os.path.getsize(APK)
data = open(APK, "rb").read()
req2 = urllib.request.Request(upload_url, data=data, headers={
    "Authorization": f"token {TOKEN}", "Content-Type": "application/octet-stream",
    "Content-Length": str(size)})
with urllib.request.urlopen(req2) as r:
    asset = json.load(r)
print("[2] APK 업로드 OK —", asset.get("browser_download_url", "FAIL"))
