#!/usr/bin/env python3
"""vc154_release_cleanup.py — 릴리스 v1.0.9 구버전 자산 정리 + 이름/노트 vc154 갱신."""
import json, urllib.request, urllib.error

GT = open("/home/z/my-project/.secrets/github_token").read().strip() if False else None
import subprocess
GT = subprocess.run(["git", "remote", "get-url", "origin"], cwd="/home/z/my-project",
                    capture_output=True, text=True).stdout
import re
m = re.search(r"apple01234:([^@]+)@github\.com", GT)
GT = m.group(1) if m else ""
API = "https://api.github.com/repos/apple01234/CERTZ"
REL = 385985773

def req(url, method="GET", body=None):
    r = urllib.request.Request(url, method=method, headers={"Authorization": f"Bearer {GT}"})
    data = json.dumps(body).encode() if body else None
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, data=data, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

# 1) 현재 자산 목록
st, rel = req(f"{API}/releases/{REL}")
print(f"release: {rel.get('name')}")
assets = rel.get("assets", [])

KEEP = {"SERTZ-vc154.apk", "SERTZ-vc154-mapping.txt", "SERTZ-vc153-setup.exe"}
# SERTZ-vc153-setup.exe는 vc154 EXE 빌드 완료 시 자동첨부되면 그때 삭제(여기선 유지)
for a in assets:
    if a["name"] in KEEP:
        print(f"  KEEP {a['name']} ({a['size']:,}B)")
    else:
        st2, _ = req(f"{API}/releases/assets/{a['id']}", method="DELETE")
        print(f"  DEL  {a['name']} ({a['size']:,}B) → {st2}")

# 2) 이름/노트 갱신
note = ("v1.0.12 (vc154) — 유저 제보 일괄+궁극기 개편: "
        "①기본공격 X 키탭 제거(자동 버튼 위 유령 X — attack 버튼 relative 누락 근본 수리) "
        "②NPC 선택지 E키 확정 한글 IME 수리(한글 2벌식 ㄷ → e.code KeyE 판정 — 상점·전직관 ↑/↓+E) "
        "③블레이드마스터 궁극기 「극의 — 무한 검무 백연타」 개편: 가속 100베기(0.096s→0.02s·총~5.8s)+붉은 死 한자 블룸(절제 톤)+HIT 카운터+시네마 레터박스+마일스톤 링, 화력 총량 보존(43.0배), 원격 100연타 동기화 "
        "④사(死)의 일섬 한자 블룸 절제(발광 25% 축소) "
        "⑤오버레이 시퀀스 게임 시간 통일(저FPS 안전망 조기 해제 근본 수리) · E2E 10/10 · "
        "다운로드: SERTZ-vc154.apk (versionCode 154·덮어설치 호환)")
st3, _ = req(f"{API}/releases/{REL}", method="PATCH",
             body={"name": "SERTZ v1.0.12 (vc154)", "body": note, "make_latest": "true"})
print(f"name/notes PATCH → {st3}")

# 3) 최종 자산 목록
st4, rel = req(f"{API}/releases/{REL}")
for a in rel.get("assets", []):
    print(f"  final: {a['name']} {a['size']:,}B")
