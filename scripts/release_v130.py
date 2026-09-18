#!/usr/bin/env python3
"""v1.3.0 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 9건)
   v1.2.1 스크립트 계승 — APK 전용(AAB 제외)"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.3.0"
ASSETS = [
    ("/home/z/my-project/download/SERTZ-v1.3.0.apk", "ff5ed235ef96738d9ed8ea67a5cc9358"),
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

BODY = """## v1.3.0 — 유저 지시 9건 반영: 오라 강화 + 층식 구조 맵 + 랭킹창 + 에셋 활용 (versionCode 90)

### 신규 기능
- **랭킹창 신설** — HUD 트로피 버튼. 전투력/레벨 랭킹(계정 서버가 클라우드 세이브 실시간 집계) + 콘텐츠 랭킹(수비전/균열/도장/탑) + 내 순위 카드. 주간 랭커 보상: 전투력 TOP10에게 에메랄드 지급(1위 30·3위 20·10위 10) — 매주 자정 리셋
- **소모품 수량 지정 사용** — 가방에서 물약/성장의 책 등을 −/＋/최대 버튼으로 개수를 정해 한 번에 사용 (책 5권 연속 사용 등)
- **층식 구조 타일맵** — 필드에 높은 지대(단) 생성: 암석 단 바닥 + 절벽 면 레이어링(플레이어가 면 앞에서 걷는 깊이감) + 절벽 콜리전 + 3단 계단 통행. 자동사냥 경로도 계단만 통과해 절벽에 끼는 문제 원천 차단
- **NPC급 옷 세트 3종 신규** — 화염무사(백발·진홍 갑주+금 트림)/서리기사(은발·백은 판금+빙하 청)/신비술사(제비꽃 머리·칠흑 로브+금성 문양) — 여/남 완전 분화 168프레임, 옷 세로 그라데이션+금 트림으로 "NPC처럼 완성된 한 벌"
- **망토 2종 신규** — 진홍의 망토·왕가의 망토 (금장 테두리+세로 주름)

### 개선
- **오로라류 오라 전면 강화** — 기존 후광 글로우만으로는 너무 미약해 "작동 안 함"처럼 보이던 문제를 실측(before/after 스크린샷)으로 확인 → 발판 룬 서클(Hovl MagicCircle, 정회전) + 회전 링(GameVFX, 역회전) + 궤도 위스프 3기(GameVFX glow) + 강화된 후광 4겹 패키지로 재탄생. 오로라/무지개/은하수는 실시간 색상 순환 연동
- **날개/망토 방향 인지 렌더** — 뒷모습(위 걷기·위 공격)에서는 날개·망토가 등에 보이고(플레이어 앞 레이어), 정면/측면에서는 등 뒤로 숨음 — "날개는 항상 등 뒤에 있다" 원칙 구현
- **VFX 에셋 3팩 통합** (Vefects Anime·Hovl Studio·GameVFX·PixelFX·Cainos·Petal Particles):
  마을 벚꽃 흩날림 · 크리티컬 별burst+참격 플래시 · 회복 하트(물약 사용) · 레벨업 황금 링 · 모닥불 실사 화염(PixelFX 5프레임) · 우물 물 튀김(Cainos 4프레임)

### 기타
- **SNS 로그인 임시 비활성** — OAuth 키 검증 후 재오픈 예정 (자체 계정 가입/로그인은 정상)
- **HUD ☰ 버튼 제거** — 메뉴 나가기는 설정(⚙) → 메뉴 화면 카드에서 (캐릭터 선택/게임 시작 화면)

### 다운로드
- APK (106,996,714B · versionCode 90 · md5 `ff5ed235ef96738d9ed8ea67a5cc9358`)
"""

# 1) 릴리스 생성
payload = json.dumps({
    "tag_name": TAG,
    "target_commitish": "main",
    "name": "SERTZ v1.3.0 — 오라 강화·층식 구조 맵·랭킹창·에셋 활용",
    "body": BODY,
    "draft": False,
    "prerelease": False,
}).encode()
r = api(f"https://api.github.com/repos/{REPO}/releases", payload)
d = json.loads(r.read())
rel_id = d.get("id")
print("release id:", rel_id, d.get("html_url") or d.get("message"))
assert rel_id, "릴리스 생성 실패"

# 2) 업로드
for path, _ in ASSETS:
    name = os.path.basename(path)
    size = os.path.getsize(path)
    url = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={name}"
    req = urllib.request.Request(url, data=open(path, "rb").read(), method="POST", headers={
        **HDRS, "Content-Type": "application/octet-stream", "Content-Length": str(size),
    })
    resp = urllib.request.urlopen(req, timeout=600)
    ad = json.loads(resp.read())
    print("uploaded:", ad["name"], ad["size"], "state:", ad["state"])

# 3) 원격 재다운로드 md5 검증
for path, expect in ASSETS:
    name = os.path.basename(path)
    remote = f"https://github.com/{REPO}/releases/download/{TAG}/{name}"
    print("remote check:", remote)
    with urllib.request.urlopen(remote, timeout=600) as r:
        data = r.read()
    m = hashlib.md5()
    m.update(data)
    ok = m.hexdigest() == expect
    print(f"remote md5: {m.hexdigest()} ({len(data)}B) match={ok}")
    assert ok, "원격 md5 불일치"
print("ALL RELEASE CHECKS PASSED")
