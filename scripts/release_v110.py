#!/usr/bin/env python3
"""v1.1.0 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 피드백 4건 — Task 84)
   v1.0.19 스크립트 개선식: 업로드 후 apk-guide 서빙 md5 검증 유지"""
import json, subprocess, hashlib, urllib.request, os, io

REPO = "apple01234/CERTZ"
TAG = "v1.1.0"
APK = "/home/z/my-project/download/SERTZ-v1.1.0.apk"
EXPECT_MD5 = "41146159d483b7b67776fcbfa6073a76"

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
        return urllib.request.urlopen(req, timeout=180)
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


local_md5 = md5f(APK)
size = os.path.getsize(APK)
assert local_md5 == EXPECT_MD5, f"로컬 md5 불일치 {local_md5}"
print(f"로컬: {APK} {size}B md5={local_md5}")

BODY = """## v1.1.0 — 캐릭터 외형 대개편 + 프롤로그 + 버그 대량 수정 (versionCode 86)

### 캐릭터 외형 시스템 (지시 #1/#19/#21/#22)
- **여캠/남캠 선택** — 캐릭터 생성 3단계에서 성별 선택
- **피부 6종** — 백자·밝은·기본·밀색·구릿빛·초콜릿 (곱연산 틴트의 "다 어두워짐" 문제를 실제 스프라이트 재생성으로 근본 해결 — 밝은 피부 포함)
- **코스튬 10종 = 스프라이트 "완전 교체"** — 옷 겹치기 폐지, 머리·피부·의상 전부 다른 캐릭터로 변신 (SPUM NPC 방식)
  - 기존 4종 재탄생: 금발 왕자 / 그림자 검술사 / 봄바람 소녀(스커트) / 해군 장교
  - 프리미엄 6종 신설: 은월의 검희 / 진홍의 마녀 / 성녀 세라피나 / 심해의 가곡 / 나이트메어 기사 / 황금 백작 (28프레임 풀 애니메이션)
- **어태치 장식 5종 신설** — 왕관 / 진홍 리본 / 성스러운 후광 / 마왕의 날개 / 요정의 날개 (캐릭터에 고정 + 실시간 동기화)

### 프롤로그·인트로 (지시 #18)
- 새 캐릭터 시작 시 세계관 내레이션 시네마틱 4비트 (탭으로 넘기기 / 건너뛰기 지원 / 1회 시청 기록)

### 버그 수정 (지시 #4/#5/#6/#7/#9/#10/#11/#12/#13/#14/#15)
- **코스튬 해제 불가** — 해제 이벤트가 오라 슬롯으로만 처리되던 로직 수정, 슬롯 정확 해제
- **EERT 큐브 등급 하락 방지** — 현재 등급 미만으로 재설정 금지 (에픽 -> 레어 불가) / 등급업 큐브(장비 티어 승급)와 라벨 분리
- **운영자 무한 엘릭서·자동물약** — GM 무한 물약 + 자동물약 기본 활성화(45%/25%, 설정 저장값 우선)
- **카오스 보스전 어두워짐 완화** — 비네트 0.4->0.14, 블룸 축소 (지도까지 가려지던 문제 동반 해소)
- **어두운 맵 지도 가시성** — 미니맵 불투명 판 + 두꺼운 금테
- **몬스터 벽 뚫기** — 벽 안 스폰 원천 차단 (탑/파크/도장/게이트/침공 5경로, 가까운 열린 셀로 보정)
- **콘텐츠의 죽은 차원문 제거** — 다음 구역 없는 콘텐츠(탑/파크/게이트/도장)는 포탈 자가개방 금지
- **콘텐츠 퀘스트 로그 자동 팝업 제거** — 콘텐츠 진입마다 NPC 팝업처럼 뜨던 자동 오픈 폐기 (우상단 버튼/J키로 열기) + 콘텐츠에서 튜토리얼/마을 대사 억제
- **피규어 12종 전부 다른 모습** — 곰돌이 이모지 폐지, 실제 게임 스프라이트 렌더
- **부팅 로딩바 정렬 수정** — 채움 바가 프레임에서 9px 내려앉던 버그
- **라이트 절감** — 고정 환경광 5->3, 횃불 8->4 (저사양 기기 개선)
- **"무료 · 언제든" 류 문구 정리**

### 기타
- 캐릭터 스프라이트 588프레임 신규 (gen_char_system.py 파이프라인)
- 저작권 재확인: Mystic Woods(Game Endeavor) 라이선스 정정 — 프리미엄 버전 상업 이용 가능 (CREDITS.md)
- 플레이스토어 베타 출시 가이드 별첨 (download/플레이스토어_베타출시_가이드.txt)

md5: 41146159d483b7b67776fcbfa6073a76 (106,374,675B)
"""

# 1) 기존 릴리스 확인
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
if rel.get("id"):
    print(f"기존 릴리스 존재 id={rel['id']} — 재사용")
    rel_id = rel["id"]
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"name": "SERTZ v1.1.0 — 캐릭터 외형 대개편·프롤로그·버그 대량 수정", "body": BODY}).encode(),
        headers={"Content-Type": "application/json"}, method="PATCH")
else:
    created = json.load(api(
        f"https://api.github.com/repos/{REPO}/releases",
        data=json.dumps({
            "tag_name": TAG,
            "target_commitish": "main",
            "name": "SERTZ v1.1.0 — 캐릭터 외형 대개편·프롤로그·버그 대량 수정",
            "body": BODY,
            "draft": False,
            "prerelease": False,
        }).encode(),
        headers={"Content-Type": "application/json"},
    ))
    rel_id = created["id"]
    print(f"릴리스 생성 id={rel_id}")

# 2) 업로드
rel = json.load(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}"))
up = rel["upload_url"].split("{")[0]
name = f"SERTZ-{TAG}.apk"

for a in rel.get("assets", []):
    if a["name"] == name:
        api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"기존 asset 삭제 id={a['id']}")

data = open(APK, "rb").read()
upl = urllib.request.Request(
    f"{up}?name={name}",
    data=data,
    headers={"Authorization": f"token {TOKEN}", "Content-Type": "application/octet-stream", "User-Agent": "curl"},
    method="POST",
)
resp = json.load(urllib.request.urlopen(upl, timeout=600))
print(f"업로드 완료 asset id={resp['id']} size={resp['size']}")

# 3) 원격 md5 복수검증
req = urllib.request.Request(
    f"https://github.com/{REPO}/releases/download/{TAG}/{name}",
    headers={"User-Agent": "curl"},
)
remote = urllib.request.urlopen(req, timeout=600).read()
rm = hashlib.md5(remote).hexdigest()
print(f"원격 재다운로드: {len(remote)}B md5={rm}")
print("MD5 일치!" if rm == EXPECT_MD5 else f"MD5 불일치!! 기대 {EXPECT_MD5}")

# 4) apk-guide 서빙 md5 잔존 검증 (로컬 서버 기준)
try:
    guide = urllib.request.urlopen("http://localhost:3000/apk-guide.html", timeout=15).read().decode()
    print(f"apk-guide 서빙 md5 포함: {EXPECT_MD5 in guide}")
    if EXPECT_MD5 not in guide:
        print("!! guide에 새 md5 없음 — 정정 필요")
except Exception as e:
    print(f"guide 검증 스킵: {e}")

print("DONE")
