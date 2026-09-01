#!/usr/bin/env python3
# GitHub Release v3.0.8 생성 + APK/EXE 업로드 (urllib — v3.0.6 스크립트 패턴)
import json, urllib.request, pathlib

TOKEN = pathlib.Path("/home/z/my-project/.gh_token")
if TOKEN.exists():
    TOKEN = TOKEN.read_text().strip()
else:
    import re
    cfg = pathlib.Path("/home/z/my-project/.git/config").read_text()
    m = re.search(r"https://x-access-token:([^@]+)@github\.com", cfg)
    TOKEN = m.group(1)

HDR = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "sertz-bot"}
REPO = "apple01234/CERTZ"

def api(url, data=None, headers=None, raw=False):
    if isinstance(data, str):
        data = data.encode()
    req = urllib.request.Request(url, data=data, headers=headers or HDR)
    with urllib.request.urlopen(req) as r:
        b = r.read()
        return json.loads(b) if not raw else b

rel = api(f"https://api.github.com/repos/{REPO}/releases", json.dumps({
    "tag_name": "v3.0.8",
    "target_commitish": "main",
    "name": "v3.0.8 — 아뜰란티스 스핀오프·Windows EXE 데스크톱·멀티 서버 개선",
    "body": (
        "## v3.0.8 — 잠뜰 TV 아뜰란티스 스핀오프 + Windows EXE 첫 배포\n\n"
        "### 1. 스핀오프: '아뜰란티스 — 잠뜰의 인어' (/atlantis)\n"
        "- Phaser.js 2D 탑다운 타일맵 게임 — JSON 기반 타일맵 로딩 시스템(11종 맵) + WASD 이동\n"
        "- **성물 상성 시스템 클래스(RelicAffinity)** — 성물 장착 시 특정 몬스터 데미지 배율 변경\n"
        "  (카운터 속성 ×2.2 / 라그나로크급 ×0.6)\n"
        "- 9+1 세계(미드가르드~니플헤임·아스가르드) 포탈 이동 · 성물 7종 + 보석 7종 수집\n"
        "- 환경 퍼즐(룬 문양·화염 결계 반지) · 보스 4연전 · 스토리 12단계 · 세이브/이어하기\n"
        "- 본편 타이틀 ↔ 스핀오프 상호 이동 링크\n\n"
        "### 2. Windows EXE 데스크톱 (신규)\n"
        "- Electron 패키징 — 내장 게임 서버(Next.js + socket.io) 동봉, 설치 없이 단일 exe 실행\n"
        "- 실행 시 자체 로컬 서버 기동 → 오프라인 싱글 + 같은 PC 멀티 기본 지원\n"
        "- 타이틀 우하단 🌐 버튼으로 원격 멀티플레이 서버 지정 가능 (웹/APK 플레이어와 동일 서버)\n\n"
        "### 3. 멀티 서버 개선\n"
        "- APK 기본 서버 주소 갱신 (라이브 서버 자동 연결)\n"
        "- EXE(Electron)도 서버 설정 UI 지원 — 로컬/원격 모드 표시 구분\n\n"
        "### 검증\n"
        "- 아뜰란티스 E2E 51 PASS / 0 FAIL (JSON 타일맵·WASD 실측·상성 3종 실측·포탈 10기·"
        "룬 퍼즐·보스 4연전·아스가르드 개방·엔딩·세이브)\n"
        "- 본편 회귀 v3.0.7 38 PASS / 0 FAIL\n"
        "- EXE: 내장 서버 HTTP 200 + socket.io 핸드셰이크 실측\n\n"
        "versionCode 23 · APK: SERTZ-v3.0.8.apk · EXE: SERTZ-3.0.8-win.exe"
    ),
    "draft": False,
    "prerelease": False,
}))

print("release:", rel["id"], rel["html_url"])

def upload(path, name, ctype):
    data = pathlib.Path(path).read_bytes()
    up = api(
        f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name={name}",
        data,
        headers={**HDR, "Content-Type": ctype},
        raw=True,
    )
    up = json.loads(up)
    print("asset:", up["name"], up["size"], up["state"])

upload("/home/z/my-project/download/SERTZ-v3.0.8.apk", "SERTZ-v3.0.8.apk", "application/vnd.android.package-archive")
upload("/home/z/my-project/download/SERTZ-v3.0.8-win.exe", "SERTZ-v3.0.8-win.exe", "application/octet-stream")

rel2 = api(f"https://api.github.com/repos/{REPO}/releases/tags/v3.0.8", raw=False)
for a in rel2["assets"]:
    print("check:", a["name"], a["size"])
