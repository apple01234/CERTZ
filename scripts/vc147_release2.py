#!/usr/bin/env python3
"""vc147 릴리스 정리: 9월 실험분 구자산 삭제 → 새 APK 업로드 → 제목/본문 vc147 노트 교체 → 무결성 검증."""
import json, hashlib, time, urllib.request, sys

REMOTE = [l.strip().split("= ")[1] for l in open("/home/z/my-project/.git/config") if "github.com" in l and "url = " in l][0]
TOKEN = REMOTE.split("https://")[1].split(":")[1].split("@")[0]
REPO = "apple01234/CERTZ"
API = "https://api.github.com"

def req(path, method="GET", data=None, headers=None, raw=False, timeout=120):
    h = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "vc147"}
    if headers:
        h.update(headers)
    base = "" if path.startswith("https://") else API  # 절대 URL(uploads.github.com)은 베이스 미부착
    r = urllib.request.Request(base + path, data=data, method=method, headers=h)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=timeout) as resp:
                b = resp.read()
                return (resp.status, b if raw else (json.loads(b) if b else {}))
        except urllib.error.HTTPError:
            raise
        except Exception as e:
            print(f"  retry {attempt+1}: {e}")
            time.sleep(8)
    raise RuntimeError("network exhausted")

NOTES = open("/home/z/my-project/release_docs/vc147_notes.md").read() if False else """SERTZ v1.0.7 (vc147) — 피드백 30종 대반영

## 전투·성장
- 5차 궁극기 피해 ×300% / 제2궁극기 ×500%
- 제2궁극기 획득: Lv.220 + 12단계 스토리 퀘스트 "각성의 대가" (카이엔 교관에게 수주)
- 신화 등급 장비 4종 (위그드라실 심장검 등 — 상점 최상위)
- 유니온 영향력 ×2.5 + 유니온 레벨 보너스 (부캐 육성 가치 대폭 상향)

## 연출
- 쉐이더: 기본 밝기 복원 + 툰 셰이딩 강화, 강도 슬라이더 정방향 수리
- 계열별 궁극기 지면 연출 (마법진은 마법사만 — 전사 균열/궁수 화살부채꼴/도적 공허/해적 폭발)
- 데드아이 제2궁극기 100련 저격 화살 가시화
- 니플헤임 설원 톤 복원, 투구/후드 치장 7종 얼굴 복원

## 버그
- 1:1 거래 수신 시 '거래 수락' 즉시 표시
- 모바일 미니맵 하단 정중앙 복귀 (오른쪽 치우침 제거)
- 보물상자 검은 상자 잔여 제거 · 시련의 탑 20마리 캡 · 전 맵 50마리 캡
- 스킬/공격 버튼 단축키 표시 · 제2궁극기 버튼 1차 궁극기 바로 옆 배치

## 콘텐츠·기타
- 게임 시작 화면부터 로그인 가능
- 전 챕터 사연/기믹 퀘스트 18종 추가 · 맵별 NPC 3종 다양화 + 반복 의뢰
- 30FPS 절전 모드 (기기 발열/멈춤 대책) · 우상단 자동전투 중복 버튼 철거
- 앱 아이콘 YGGDRASIL 전면 교체

## 설치
- 덮어설치 호환 (동일 서명 cc774f34) · versionCode 147 · versionName 1.0.7
- md5 bf28c52d3a9812081d03938a28489384 · sha1 d3d2b8e5bdf3e2753e8a3ed273c4f282250b2b33 (147,167,185B)
- iOS: SERTZ-vc147-ios-unsigned.ipa (unsigned — Sideloadly/TrollStore iOS≤16.6.1)
"""

# 1) 릴리스 조회
st, rel = req("/repos/" + REPO + "/releases/tags/v1.0.7")
rid = rel["id"]
print("release", rid, "assets:", [a["name"] for a in rel["assets"]])

# 2) 구(9월 실험) 자산 삭제 — 신규 vc147 APK와 이름이 다른 구버전 3종
STALE = {"SERTZ-v1.0.7-web.zip", "SERTZ-v1.0.7.aab", "SERTZ-v1.0.7.apk"}
for a in rel["assets"]:
    if a["name"] in STALE:
        req(f"/repos/{REPO}/releases/assets/{a['id']}", "DELETE")
        print("삭제(구자산)", a["name"])

# 3) 새 APK 업로드 (SERTZ-vc147.apk)
have = {a["name"] for a in req(f"/repos/{REPO}/releases/{rid}")[1]["assets"]}
apk_path = "/home/z/my-project/download/SERTZ-vc147.apk"
if "SERTZ-vc147.apk" not in have:
    apk = open(apk_path, "rb").read()
    up = rel["upload_url"].split("{")[0]
    for attempt in range(1, 7):
        try:
            st, _ = req(up + "?name=SERTZ-vc147.apk", "POST", apk, {"Content-Type": "application/octet-stream"}, raw=True, timeout=900)
            print("APK 업로드", st, len(apk), "bytes")
            break
        except Exception as e:
            print(f"  업로드 재시도 {attempt}: {e}")
            time.sleep(10)
    else:
        sys.exit(2)

# 4) 제목/본문 vc147 노트로 교체
req(f"/repos/{REPO}/releases/{rid}", "PATCH", json.dumps({
    "name": "SERTZ v1.0.7 (vc147) — 피드백 30종 대반영",
    "body": NOTES, "prerelease": False,
}).encode(), {"Content-Type": "application/json"})
print("릴리스 노트 교체 완료")

# 5) 무결성 검증
durl = "https://github.com/" + REPO + "/releases/download/v1.0.7/SERTZ-vc147.apk"
for attempt in range(5):
    try:
        got = urllib.request.urlopen(urllib.request.Request(durl, headers={"User-Agent": "vc147"}), timeout=900).read()
        break
    except Exception as e:
        print(f"  다운로드 재시도 {attempt}: {e}")
        time.sleep(10)
else:
    sys.exit(3)
local = open(apk_path, "rb").read()
m1, m2 = hashlib.md5(local).hexdigest(), hashlib.md5(got).hexdigest()
print("다운로드", len(got), "B · md5", "PASS" if m1 == m2 else "FAIL", m1)
st, rel2 = req("/repos/" + REPO + "/releases/tags/v1.0.7")
print("최종 자산:", [(a["name"], a["size"]) for a in rel2["assets"]])
sys.exit(0 if m1 == m2 else 1)
