#!/usr/bin/env python3
"""v1.4.11 Release 생성 + APK 업로드 + 원격 md5 검증
   (유저 지시 6건: Drive 에셋 대통합·보스 2차 전면 교체·자동전투 진동 수정·
    신규 코스튬 2종·appId 일원화·ARG 완전 제거)
   release_v1410.py 계승 — APK 전용"""
import json, subprocess, hashlib, os, re

REPO = "apple01234/CERTZ"
TAG = "v1.4.11"
APK_NAME = "SERTZ-v1.4.11.apk"
APK_LOCAL = "/home/z/my-project/download/SERTZ-v1.4.11.apk"

def md5f(path):
    m = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            m.update(chunk)
    return m.hexdigest()

md5 = md5f(APK_LOCAL)
size = os.path.getsize(APK_LOCAL)

BODY = f"""## SERTZ v1.4.11 — 유저 지시 6건 (vc103)

### 🎨 Google Drive 신규 에셋 팩 적극 통합 (유저 지시 1·3·4)
- **신규 팩 128MB에서 게임용 53종 변환 투입** — Hovl Studio 마법 이펙트 29종(마법진·테크링·번개·지균·결정·플래시·연기·눈꽃 등) · Matthew Guz 참격 2차 17종(참격 6종·충격파·폭발·크리·스파크·화염) · Toon 먼지/바닥 5종 · 벚꽃 팩 2종
- **잠자던 기존 에셋까지 최대한 활용** — 파티클킷(pk_) 27종·신전/제단/성배 소품(ep_)·광산 소품(kd_)·자동타일 지면 스캐터(tx_ 45종 중 변형타일 배치)·자생나무 3종(kd_plant)·에메랄드 아이콘·이원 횃불 — **총 약 140종이 이번 버전에서 새로 화면에 등장**
- 타이틀 화면: 벚꽃 언덕 배경(황혼 톤) + 꽃잎 낙하 연출 / 사쿠라 코스튬 착용자 전용 벚꽃 파티클

### 👑 보스 9종 아트 전면 교체 2차 (유저 지시 2)
- **애니 셀셰이드 방향으로 완전 신규 일러스트** — SPUM 캐릭터와 톤이 맞는 맵풀스토리 스타일 (심연의 수호자·니드호그·수르트·펜리르·스콜·가름·아부디토스 전부)
- 원작 고증 유지: 보스의 이름·속성·역할·챕터는 그대로, 텍스처 규격도 원본과 동일(fit_pad) — **히트박스/판정 100% 불변**
- 보스 패턴에 신규 이펙트 오버레이: 소환 룬 마법진·빔 시전 테크링·낙뢰 섬광+지균 데칼·장판 결정 파편·사망 대형 폭발+상승 연기·페이즈 전환 플래시

### ⚔️ 자동전투 "제자리 왔다갔다" 근본 수정 (유저 지시 6)
- **사거리 진입 시 이동 홀드 즉시 해제** — 기존엔 접근 홀드가 사거리 안에서도 밀어붙여 적을 통과해 반대편으로 나가는 진동 재현
- **사거리 75~78% 정지거리 도입** — 사거리 경계에서 접근↔공격이 번갈아 나오며 떨리는 것 제거
- **배회 목표 BFS 연결성 검증** — 벽 뒤 도달 불가 지점으로 걸어가 부딪히던 것 차단
- **카이팅 방향 홀드 600ms** — 원거리 직업이 좌우로 뒤집히며 떨리는 것 억제
- **끼임 감지 경화** — 이동↔공격이 번갈아 나올 때 감지가 리셋돼 못 잡던 벽 끼임 수복

### 👗 신규 코스튬 2종 (BM 상점)
- **화염의 무희** (백발·진홍 드레스) · **신비술사** (보라 트윈테일) — 남녀형 시트 완비

### 📦 appId com.sertz.myapp 일원화 (유저 지시 5)
- capacitor.config·네이티브 MainActivity 패키지·namespace·URL 스킴 전부 com.sertz.myapp로 통일 (Play applicationId는 기존과 동일 — 재설치 그대로 가능)

### 🚫 ARG 체계 완전 제거
- 비밀수첩·이스터에그 100종·eggTick 삭제, 구버전 세이브 ARG 키(sertz.eggs/visits) 자동 청소 — 무한 재부팅 근원 최종 봉쇄

### 💾 세이브 안내
- 기존 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다

---
- md5: {md5}
- size: {size}B
- applicationId: com.sertz.myapp · versionCode: 103 · versionName: 1.4.11
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
              {"tag_name": TAG, "name": "SERTZ v1.4.11 — Drive 에셋 대통합·보스 2차 전면 교체·자동전투 진동 수정 (vc103)", "body": BODY})
    print(f"기존 릴리스 갱신: id {rel['id']}")
else:
    rel = api(f"/repos/{REPO}/releases", "POST",
              {"tag_name": TAG, "target_commitish": "main",
               "name": "SERTZ v1.4.11 — Drive 에셋 대통합·보스 2차 전면 교체·자동전투 진동 수정 (vc103)", "body": BODY})
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
subprocess.run(["curl", "-sL", "-o", "/tmp/verify_v1411.apk", url], check=True)
remote = open("/tmp/verify_v1411.apk", "rb").read()
rmd5 = hashlib.md5(remote).hexdigest()
print(f"원격 md5: {rmd5} — {'일치 OK' if rmd5 == md5 else '불일치 FAIL'}")
print("=== v1.4.11 릴리스 완료 ===")
