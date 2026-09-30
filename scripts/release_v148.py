#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.4.8 릴리스 — GitHub Release v1.4.8 생성/갱신 + APK 업로드 + apk-guide/다운로드 안내 갱신."""
import hashlib, json, os, subprocess, sys

REPO = "apple01234/CERTZ"
TAG = "v1.4.8"
APK_LOCAL = "/tmp/SERTZ-v1.4.8.apk"
APK_NAME = "SERTZ-v1.4.8.apk"

apk_bytes = open(APK_LOCAL, "rb").read()
md5 = hashlib.md5(apk_bytes).hexdigest()
size = len(apk_bytes)
print(f"APK: {APK_NAME} · {size}B · md5 {md5}")

BODY = f"""## SERTZ v1.4.8 (versionCode 100)

### ⚡ 게임 전체 최적화 (유저 지시 1)
- 타깃 판정 프레임 캐시 — 투사체×적 판정이 매 프레임 배열을 재할당하던 구조 제거 (GC 스파이크·CPU 상수 배수 절감)
- 투사체 트레일 16장 풀링 + 타격 충격 링 8장 풀링 — 사격 중 초당 20개씩 오브젝트를 만들고 버리던 비용 제거
- 성능 카드(__SERTZ_PERF__) 500ms 스로틀, 절전 모드 쉐이크 게이트 누락분 수습

### 🖥 UI 공간 축소 + 겹침 근원 차단 (유저 지시 2·3)
- 우측/좌측 부유 위젯(계정·파티·친구) 완전 철거 → HUD 더보기 메뉴로 진입, 창은 중앙 모달로 통일
- 퀘스트 트래커 폭 축소(46vw→최대 260px) + 강제 간격 제거, 모바일에서 미니맵을 채팅 바 위로 올려 가림 해소
- z-index 표준화(랭킹/전직 30→40 등), 계정 모달 최상위화

### 🔒 보안 강화 (유저 지시 4)
- 전역 보안 헤더(CSP·nosniff·X-Frame-Options·Referrer-Policy·Permissions-Policy·HSTS)
- CORS 오리진 화이트리스트(* 제거) · 쿠키 Secure 플래그 · 계정 DB 원자적 쓰기(tmp+rename)
- 클라우드 세이브 검증(형식·깊이·2MB 캡·10회/분 레이트리밋) · 소켓 GM 플래그 서버 토큰 검증(스푸핑 차단)
- 관리자 오토시드 알려진 기본 비밀번호 제거(무작위 12자·로그 1회 노출) · 로그인 계정 열거 방지 응답 통일 · XFF 스푸핑 차단

### 🎨 그래픽·사운드·애니메이션 강화 (유저 지시 5·6)
- 패널 등장 애니메이션(160ms 팝) 전면 적용 · 위험(HP 30%↓) 피격 시 암적색 화면 플래시
- BGM 구간 전환 크로스페이드(하드컷 제거)
- 기능별 사운드 전면 분리 — 퀘스트 차임 38중복·코인 15중복 해소: 상자/보상/구매/판매/충전/수락/차단/제작/점화/보스드롭 전용음 신설(추가 다운로드 0)
- 무음 버그 수정: 스나이프 사운드 키 누락·플레이어 사망 무음·근접 타격 이중 재생 제거·뮤트 토글/대화 줄넘김 피드백음

### ♻️ 회귀
- v1.4.7 전 기능 유지(재부팅 예산·지원센터·파티 콘텐츠·NPC 3명 Lv.3 보정)

### 💾 세이브 안내
- 기존 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다

---
- md5: {md5}
- size: {size}B
- applicationId: com.sertz.myapp · versionCode: 100 · versionName: 1.4.8
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
for r in api(f"/repos/{REPO}/releases?per_page=10"):
    if r.get("tag_name") == TAG:
        rel = r
        break
if rel:
    rel = api(f"/repos/{REPO}/releases/{rel['id']}", "PATCH",
              {"tag_name": TAG, "name": f"SERTZ v1.4.8 — 최적화·보안·UI 재편 (vc100)", "body": BODY})
    print(f"기존 릴리스 갱신: id {rel['id']}")
else:
    rel = api(f"/repos/{REPO}/releases", "POST",
              {"tag_name": TAG, "target_commitish": "main",
               "name": f"SERTZ v1.4.8 — 최적화·보안·UI 재편 (vc100)", "body": BODY})
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
subprocess.run(["curl", "-sL", "-o", "/tmp/verify.apk", url], check=True)
remote = open("/tmp/verify.apk", "rb").read()
rmd5 = hashlib.md5(remote).hexdigest()
print(f"원격 md5: {rmd5} — {'일치 ✓' if rmd5 == md5 else '불일치 ✗'}")

# 5) 가이드 갱신
guide_p = "/home/z/my-project/public/apk-guide.html"
guide = open(guide_p, encoding="utf-8").read()
guide = guide.replace("SERTZ v1.4.7 APK 다운로드 안내", "SERTZ v1.4.8 APK 다운로드 안내")
guide = guide.replace('<h1>SERTZ v1.4.7 APK 다운로드 안내</h1>', '<h1>SERTZ v1.4.8 APK 다운로드 안내</h1>')
guide = guide.replace(
    '<b>이번 버전(v1.4.7) — "오류나는 페이지 전면 철거" (유저 지시)</b>',
    '<b>이번 버전(v1.4.8) — "전체 최적화·보안 강화·UI 재편" (유저 지시 7건)</b>')
guide = guide.replace("releases/download/v1.4.7/SERTZ-v1.4.7.apk", f"releases/download/{TAG}/{APK_NAME}")
guide = guide.replace("⬇ SERTZ v1.4.7 APK 바로 다운로드 (117MB · 즉시 시작)", "⬇ SERTZ v1.4.8 APK 바로 다운로드 (117MB · 즉시 시작)")
import re as _re
guide = _re.sub(r'<li>무결성 확인용 md5: <code>[0-9a-f]+</code> \(<b>\d+B</b> · versionCode \d+\)</li>',
                f'<li>무결성 확인용 md5: <code>{md5}</code> (<b>{size}B</b> · versionCode 100)</li>', guide)
open(guide_p, "w", encoding="utf-8").write(guide)
print("apk-guide.html 갱신 OK")

txt_p = "/home/z/my-project/download/APK_다운로드_안내.txt"
txt = open(txt_p, encoding="utf-8").read()
v148_block = f"""v1.4.8 (최신) — 전체 최적화·보안 강화·UI 재편 (유저 지시 7건)
· 다운로드: https://github.com/{REPO}/releases/download/{TAG}/{APK_NAME}
· md5: {md5} ({size}B, versionCode 100)
"""
if "v1.4.8 (최신)" not in txt:
    txt = v148_block + "\n" + txt
    txt = txt.replace("v1.4.7 (최신)", "v1.4.7")
open(txt_p, "w", encoding="utf-8").write(txt)
print("APK_다운로드_안내.txt 갱신 OK")
print("=== 릴리스 완료 ===")
