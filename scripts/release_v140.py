#!/usr/bin/env python3
"""v1.4.0 Release 생성 + APK 업로드 + 원격 md5 검증 (유저 지시 20건 — 마스터 프롬프트 v2.0)"""
import json, subprocess, hashlib, urllib.request, os, io, time

REPO = "apple01234/CERTZ"
TAG = "v1.4.0"
APK = "/home/z/my-project/download/SERTZ-v1.4.0.apk"
EXPECT_MD5 = "2cdc87474fd0e5c9a58beff27e471875"

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

BODY = """## v1.4.0 — 유저 지시 20건 대규모 업데이트: 밸런스 전면 패치 + UI 정비 + 비밀수첩 100종 (versionCode 92)

### 신규 시스템
- **이스터에그 + ARG 「비밀수첩」 100종** — 숨은 은신처 20 / NPC 히든 대화 15 / 입력 시크릿(코나미 등) 5 / 시간·날짜 8 / 히든 업적 10 / 외부 암호(ARG) 15 / 아이템 수집 10 / 행동 7 / 도감 10. 설정창 트래커(n/100) + 구간 보상(10/25/50/100개) + 공개 웹페이지 암호문(/secret/)
- **레벨 게이트 길라잡이** — 챕터마다 "Lv.n 이상부터 입장 가능" 잠금. 챕터 클리어 후에도 사냥·보스·반복 콘텐츠가 이어지는 진행 구조

### 밸런스 (지시 #1 르쯔 / #2·9·10 밸런스 / #14 마릿수)
- **후반 몬스터 HP 대폭 강화** — 최종 챕터 ×42 (기존 ×15.5), 공격력은 현행 유지
- **스토리 보스 HP ×3** — 노말 4.5 / 하드 7.2 / 카오스 18.6 (전 난이도 동률 강화)
- **르쯔(에메랄드) 수급 축소** — 출석 70% 축소(3/5/10→1/1/3), 유적 상자 35→15%, 정예 확정→40%, 금요일 킬 8→2%
- **퀘스트 요구 마릿수 레벨곡선** — 1~20렙 5~8마리 → 81렙+ 45~60마리, 보상 동반 상향

### UI/UX (지시 #15·17·18)
- **스탯창 고정 + 버프 아이콘 행** — 골드/공격/방어/크리 칩 고정, 버프 행은 스탯창 바로 아래
- **전체 UI 15% 축소** + 2선 버튼(보스/혜택/콘텐츠/유니온/거래소/랭킹/퀘스트로그) "더보기" 접기

### 안정성/버그 (지시 #4·5·6·8·12·16)
- **관리자 로그인 설명 완전 제거** — 클라이언트 힌트 노출 0건
- **요새 유적 렌더 수정** — 고정 depth가 y기반 depth 오브제에 가려지던 근본 수정
- **랭킹 조회 안정화** — 지수 백오프 3회 재시도 + 마지막 성공 캐시("n초 전 기준")
- **검은화면 원인 제거** — 에셋 로드 실패 명시 처리(건너뛰기)로 로더 교착 차단
- **재부팅 자동 이어하기** — 멀티윈도우/백그라운드 복귀 시 시작 화면 대신 마지막 캐릭터로 복귀
- **전역 반올림 포맷터** — 모든 표시 수치 소수 둘째 자리에서 반올림(첫째 자리까지 표기)

### 콘텐츠 (지시 #13)
- **5차 궁극기 8직업 고유 연출** — VFX2 팩 에셋 1:1 매핑(참격/성링/화살/폭풍/크리스탈/룬/분신/검기), 동일 이펙트 재활용 0건

---
- md5: `2cdc87474fd0e5c9a58beff27e471875` (111,665,566B · versionCode 92)
- 기존 세이브 그대로 유지 · 덮어설치 가능
- 📄 상세 가이드: http://sertz.z.ai/apk-guide.html
"""

rel = json.loads(api(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}").read())
if rel.get("id"):
    print(f"기존 릴리스 재사용: id={rel['id']}")
    rel_id = rel["id"]
    for a in rel.get("assets", []):
        if a["name"] == os.path.basename(APK):
            api(f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
            print(f"기존 asset 삭제: {a['name']}")
    api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}",
        data=json.dumps({"body": BODY, "draft": False, "prerelease": False}).encode(),
        headers={"Content-Type": "application/json"}).read()
else:
    payload = json.dumps({
        "tag_name": TAG, "target_commitish": "main", "name": f"SERTZ {TAG} — 비밀수첩 100종·대밸런스·UI 정비",
        "body": BODY, "draft": False, "prerelease": False,
    }).encode()
    rel = json.loads(api(f"https://api.github.com/repos/{REPO}/releases", data=payload,
                         headers={"Content-Type": "application/json"}).read())
    rel_id = rel["id"]
    print(f"신규 릴리스 생성: id={rel_id} tag={TAG}")

up_url = f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={os.path.basename(APK)}"
with open(APK, "rb") as f:
    data = f.read()
for attempt in range(3):
    try:
        api(up_url, data=data, headers={"Content-Type": "application/octet-stream"}).read()
        break
    except Exception as e:
        print(f"업로드 재시도 {attempt+1}: {e}")
        time.sleep(5)
print("업로드 완료")

time.sleep(3)
assets = json.loads(api(f"https://api.github.com/repos/{REPO}/releases/{rel_id}").read())["assets"]
for a in assets:
    print(f"asset: {a['name']} {a['size']}B state={a['state']}")

tmp = "/tmp/verify_v140.apk"
urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-{TAG}.apk", tmp)
remote = md5f(tmp)
print(f"원격 md5: {remote} — {'일치 ✓' if remote == EXPECT_MD5 else '불일치 ✗'}")
assert remote == EXPECT_MD5, "원격 md5 불일치!"
print("RELEASE COMPLETE")
