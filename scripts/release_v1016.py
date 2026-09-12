#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.0.16 GitHub Release 생성 + APK 업로드 + 원격 md5 복수검증
(release_v1014.py 패턴 재사용 — 404는 '없음'으로 처리, 토큰은 git remote URL에서 추출)"""
import hashlib
import io
import json
import mimetypes
import re
import subprocess
import time
import urllib.error
import urllib.request

REPO = "apple01234/CERTZ"
TAG = "v1.0.16"
APK = "/home/z/my-project/download/SERTZ-v1.0.16.apk"
NAME = "SERTZ v1.0.16 — 공격 방향 완전 정면화 · 환생 개편 · GM 표시"
BODY = (
    "## v1.0.16 — 공격 방향 완전 정면화 · 환생 개편 · GM 표시\n\n"
    "- 공격/스킬 방향 근본 수정: 전 시트 좌향 네이티브 통일 — 바라보는 방향 = 공격 방향 = 화살 방향\n"
    "- 환생 개편: 요구 레벨 200렙 + 직업·전직·레벨·스토리 전부 초기화 (시작 마을 귀환)\n"
    "- GM 계정: [GM] 금색 이름표 + 황금 오라 (모든 유저 화면에 표시)\n"
    "- 물약 정리(21→7종, 고급 물약 회복량 상향) + 신규 치장 6종\n"
    "- 스킬 이펙트 다변화: 전사 충격링 / 궁수 질풍링 / 도적 그림자 / 마법사만 마법진\n"
    "- 몬스터 벽 통과 방지 하드닝 + 적 HP바 렌더 절감 (최적화)\n"
    "- 멀티 혜택: 파티원당 EXP +8% · 같은 구역 동행당 +4% (최대 +36%)\n"
    "- 밸런스: 골드 +9% · 정예 보너스 상향 · 침공 보스 에메랄드 +3\n\n"
    "md5: 8aa802c21e046b6d62ae606d700b75e4\n"
    "versionCode 81\n"
)


def token_from_remote():
    url = subprocess.check_output(["git", "remote", "get-url", "origin"], cwd="/home/z/my-project", text=True).strip()
    m = re.search(r"https://x-access-token:([^@]+)@", url)
    if not m:
        raise SystemExit("no token in remote url")
    return m.group(1)


TOKEN = token_from_remote()
API = f"https://api.github.com/repos/{REPO}"


def api(path, data=None, headers=None, method=None, raw=False):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "ertz-release")
    body = None
    if data is not None:
        body = data if isinstance(data, bytes) else json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        r = urllib.request.urlopen(req, body, timeout=180)
        return r if raw else json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"message": "not found"}
        raise


def main():
    apk_bytes = open(APK, "rb").read()
    md5 = hashlib.md5(apk_bytes).hexdigest()
    print(f"local md5: {md5}  size: {len(apk_bytes)}")

    rel = api(f"/releases/tags/{TAG}")
    if rel.get("message") == "not found":
        print("release not found — creating")
        rel = api("/releases", {"tag_name": TAG, "name": NAME, "body": BODY, "draft": False, "prerelease": False})
        print("created id:", rel.get("id"))
    else:
        print("release exists id:", rel.get("id"))

    rid = rel["id"]
    asset_name = APK.split("/")[-1]
    asset = next((a for a in rel.get("assets", []) if a["name"] == asset_name), None)
    if asset:
        print("asset exists — deleting then re-uploading")
        api(f"/releases/assets/{asset['id']}", method="DELETE")

    up = f"https://uploads.github.com/repos/{REPO}/releases/{rid}/assets?name={asset_name}"
    ct = mimetypes.guess_type(asset_name)[0] or "application/octet-stream"
    for attempt in range(3):
        try:
            r = api(up, data=apk_bytes, headers={"Content-Type": ct}, method="POST", raw=True)
            out = json.loads(r.read().decode())
            print("uploaded state:", out.get("state"), "size:", out.get("size"))
            break
        except Exception as e:  # noqa: BLE001
            print(f"upload attempt {attempt + 1} failed: {e}")
            time.sleep(5)
    else:
        raise SystemExit("upload failed after retries")

    time.sleep(3)
    dl = f"https://github.com/{REPO}/releases/download/{TAG}/{asset_name}"
    print("remote re-download md5 check...")
    with urllib.request.urlopen(dl, timeout=600) as resp:
        remote = resp.read()
    rmd5 = hashlib.md5(remote).hexdigest()
    print(f"remote md5: {rmd5}")
    print("MATCH ✓" if rmd5 == md5 else "MISMATCH ✗")
    if rmd5 != md5:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
