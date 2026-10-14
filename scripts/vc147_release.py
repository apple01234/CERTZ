#!/usr/bin/env python3
"""vc147 — GitHub 정식 릴리스 v1.0.7 생성 + APK 업로드 + 무결성 검증."""
import json, hashlib, urllib.request, sys

REMOTE = ""
for line in open("/home/z/my-project/.git/config"):
    if "github.com" in line and "url = " in line:
        REMOTE = line.strip().split("= ")[1]
        break
TOKEN = REMOTE.split("https://")[1].split(":")[1].split("@")[0]
REPO = "apple01234/CERTZ"
API = "https://api.github.com"

def req(path, method="GET", data=None, headers=None, raw=False):
    h = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "vc147"}
    if headers: h.update(headers)
    r = urllib.request.Request(API + path, data=data, method=method, headers=h)
    with urllib.request.urlopen(r) as resp:
        body = resp.read()
        return (resp.status, body if raw else (json.loads(body) if body else {}))

NOTES = """SERTZ v1.0.7 (vc147) — 피드백 30종 대반영

## 전투·성장
- 5차 궁극기 피해 ×300% / 제2궁극기 ×500%
- 제2궁극기 획득: Lv.220 + 12단계 스토리 퀘스트 "각성의 대가" (카이엔 교관)
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
- 보물상자 검은 상자 잔여 제거, 시련의 탑 20마리 캡, 전 맵 50마리 캡
- 스킬/공격 버튼 단축키 표시, 제2궁극기 버튼 1차 궁극기 바로 옆 배치

## 콘텐츠·기타
- 게임 시작 화면부터 로그인 가능
- 전 챕터 사연/기믹 퀘스트 18종 추가, 맵별 NPC 3종 다양화 + 반복 의뢰
- 30FPS 절전 모드 (기기 발열/멈춤 대책), 우상단 자동전투 중복 버튼 철거
- 앱 아이콘 YGGDRASIL 전면 교체

## 설치
- 덮어설치 호환 (동일 서명 cc774f34)
- md5: bf28c52d3a9812081d03938a28489384
- sha1: d3d2b8e5bdf3e2753e8a3ed273c4f282250b2b33 (147,167,185B · versionCode 147)
- iOS: unsigned IPA (빌드 완료 시 자동 첨부) — Sideloadly/TrollStore(iOS≤16.6.1)로 설치
"""

# 1) 기존 릴리스 확인/삭제
try:
    st, rel = req("/repos/" + REPO + "/releases/tags/v1.0.7")
    print("기존 v1.0.7 릴리스 존재 — 재사용", rel.get("id"))
except urllib.error.HTTPError as e:
    if e.code == 404:
        st, rel = req("/repos/" + REPO + "/releases", "POST", json.dumps({
            "tag_name": "v1.0.7", "name": "SERTZ v1.0.7 (vc147) — 피드백 30종 대반영",
            "body": NOTES, "prerelease": False,
        }).encode(), {"Content-Type": "application/json"})
        print("릴리스 생성", rel.get("id"))
    else:
        raise

# 2) APK 업로드 (DNS 일시 실패 대비 재시도)
up = rel["upload_url"].split("{")[0]
apk = open("/home/z/my-project/download/SERTZ-vc147.apk", "rb").read()
import time
uploaded = False
for attempt in range(1, 7):
    try:
        st, upl = req(up + "?name=SERTZ-vc147.apk", "POST", apk, {"Content-Type": "application/octet-stream"}, raw=True)
        print("업로드", st, len(apk), "bytes")
        uploaded = True
        break
    except Exception as e:
        print(f"업로드 시도 {attempt} 실패: {e} — 15초 후 재시도")
        time.sleep(15)
if not uploaded:
    sys.exit(2)

# 3) 무결성 검증 — 다운로드 md5 대조
durl = "https://github.com/" + REPO + "/releases/download/v1.0.7/SERTZ-vc147.apk"
import urllib.request as u2
r2 = u2.Request(durl, headers={"User-Agent": "vc147"})
got = u2.urlopen(r2, timeout=600).read()
m1 = hashlib.md5(apk).hexdigest(); m2 = hashlib.md5(got).hexdigest()
print("다운로드", len(got), "bytes · md5 대조", "PASS" if m1 == m2 else "FAIL", m1, m2)
sys.exit(0 if m1 == m2 else 1)
