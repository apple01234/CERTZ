#!/usr/bin/env python3
"""vc148 릴리스 생성: v1.0.8 태그 신설 → SERTZ-vc148.apk 업로드 → 제목/본문 노트 → 무결성 검증."""
import json, hashlib, time, urllib.request, urllib.error, sys

REMOTE = [l.strip().split("= ")[1] for l in open("/home/z/my-project/.git/config") if "github.com" in l and "url = " in l][0]
TOKEN = REMOTE.split("https://")[1].split(":")[1].split("@")[0]
REPO = "apple01234/CERTZ"
API = "https://api.github.com"
TAG = "v1.0.8"
APK = "/home/z/my-project/download/SERTZ-vc148.apk"

def req(path, method="GET", data=None, headers=None, raw=False, timeout=180):
    h = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "User-Agent": "vc148"}
    if headers:
        h.update(headers)
    base = "" if path.startswith("https://") else API
    r = urllib.request.Request(base + path, data=data, method=method, headers=h)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=timeout) as resp:
                b = resp.read()
                return (resp.status, b if raw else (json.loads(b) if b else {}))
        except urllib.error.HTTPError as e:
            if e.code >= 500 and attempt < 4:
                print(f"  5xx retry {attempt+1}: {e.code}")
                time.sleep(8)
                continue
            raise
        except Exception as e:
            print(f"  retry {attempt+1}: {e}")
            time.sleep(8)
    raise RuntimeError("network exhausted")

apk_bytes = open(APK, "rb").read()
MD5 = hashlib.md5(apk_bytes).hexdigest()
SHA1 = hashlib.sha1(apk_bytes).hexdigest()
SIZE = len(apk_bytes)
print(f"APK: {SIZE:,}B md5={MD5} sha1={SHA1}")

NOTES = f"""SERTZ v1.0.8 (vc148) — 보스 그리드 긴급 수리

## 보스 아트
- 종언의 마룡 아부디토스·재림의 파수꾼 베오르드·혈안의 문지기 가름 — '보스 그리드를 이상하게 짤랐다' 제보 수리
  · 컬러 화룡+흑룡 실루엣 혼합 / 보라 악마 기사+붉은 늑대 혼합 / 유령선 공유 등 이질 아트 전부 소거
  · 유저 원본 bsw_ HD 시트 격자(8열×7행 192.5×147 / 6열×7행 204×184) 그대로 재슬라이싱 — 프레임 잘림 0
  · 베오르드 전용 흑룡 아트 부여 (boss2 유령선 공유 해제)
- 전 보스 12종이 유저 원본 HD 아틀라스로 통일 완수

## 동봉 (v1.0.7 — 피드백 30종)
- 5차 궁극기 ×300% / 제2궁극기 ×500% · Lv.220 + 12단계 스토리 퀘스트 "각성의 대가"
- 쉐이더 정방향 수리 + 툰 셰이딩 강화 · 계열별 지면 연출(마법진=마법사만)
- 1:1 거래 수락 버그 · 모바일 미니맵 중앙 복귀 · 검은 상자 잔여 제거
- 탑 20마리/맵 50마리 캡 · 단축키 표시 · 랭킹 즉시 갱신 · 타이틀 로그인
- 니플헤임 설원 톤 · 치장 얼굴 복원 7종 · 사연 퀘스트 18종 · NPC 의뢰
- 신화 장비 4종 · 유니온 ×2.5 · 30FPS 절전 모드 · YGGDRASIL 앱 아이콘

## 설치
- 덮어설치 호환 (동일 서명 cc774f34) · versionCode 148 · versionName 1.0.8
- md5 {MD5} · sha1 {SHA1} ({SIZE:,}B)
- iOS: SERTZ-vc148-ios-unsigned.ipa (unsigned — Sideloadly/TrollStore iOS≤16.6.1)
- 웹: https://sertz.vercel.app (code 148) · 가이드: https://sertz.vercel.app/apk-guide.html
"""

# 1) 기존 릴리스 조회
st, rel = req(f"/repos/{REPO}/releases/tags/{TAG}")
if st == 200:
    rel_id = rel["id"]
    print(f"existing release id={rel_id} — cleaning assets")
    for a in rel.get("assets", []):
        s, _ = req(f"/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
        print(f"  delete {a['name']}: {s}")
else:
    body = {"tag_name": TAG, "target_commitish": "main", "name": "SERTZ v1.0.8 (vc148)",
            "body": NOTES, "draft": False, "prerelease": False}
    st, rel = req(f"/repos/{REPO}/releases", method="POST",
                  data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    print(f"create release: {st} id={rel.get('id')}")
    rel_id = rel["id"]

# 2) 노트 갱신 (재실행 대비)
st, rel = req(f"/repos/{REPO}/releases/{rel_id}", method="PATCH",
              data=json.dumps({"name": "SERTZ v1.0.8 (vc148)", "body": NOTES}).encode(),
              headers={"Content-Type": "application/json"})
print(f"patch notes: {st}")

# 3) APK 업로드
up = rel["upload_url"].split("{")[0]
st, up_res = req(up + f"?name=SERTZ-vc148.apk", method="POST", data=apk_bytes,
                 headers={"Content-Type": "application/vnd.android.package-archive"})
print(f"upload apk: {st} size={up_res.get('size')}")

# 4) 무결성: 다운로드 후 md5 대조
dl_url = f"https://github.com/{REPO}/releases/download/{TAG}/SERTZ-vc148.apk"
for attempt in range(10):
    try:
        with urllib.request.urlopen(dl_url, timeout=180) as r:
            got = r.read()
        break
    except Exception as e:
        print(f"  dl retry {attempt+1}: {e}")
        time.sleep(6)
dl_md5 = hashlib.md5(got).hexdigest()
print(f"verify: {len(got):,}B md5={dl_md5} -> {'PASS' if dl_md5 == MD5 else 'FAIL'}")
sys.exit(0 if dl_md5 == MD5 else 1)
