#!/usr/bin/env python3
"""
vercel_cleanup.py — Vercel 배포 이력 정리 (반복 실행 가능)
정책: 유저 요구 — "최신버전과 그전버전 빼고는 항상 전부 지워"
  · KEEP  : 현재 라이브(별칭 연결) 프로덕션 배포 1개 + 그 바로 이전 프로덕션 배포 1개 (롤백 타깃)
            (사이에 끼인 accounts-backup 자동배포 등 중간 배포는 코드가 라이브와 동일하므로 삭제)
  · DELETE: 위 2개를 제외한 나머지 전부 (구 프로덕션 + 프리뷰 전부)
사용법:
  python3 scripts/vercel_cleanup.py list          # 전체 배포 나열 + KEEP/DELETE 미리보기
  python3 scripts/vercel_cleanup.py run [--yes]   # 실제 삭제 실행 (--yes면 확인 프롬프트 생략)
"""
import json
import sys
import time
import datetime
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN = (ROOT / ".secrets" / "vercel_token").read_text().strip()
TEAM = "team_tU80jP4GxpzCqs69YnAYe0jl"
PROJECT_ID = "prj_aV9S7OMQ2Qq6TFTT7HCAlfvIADG5"
API = "https://api.vercel.com"


def api(method, path, body=None, retries=3):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    if data:
        req.add_header("Content-Type", "application/json")
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            if e.code == 429:  # rate limit — 백오프 후 재시도
                wait = 5 * (attempt + 1)
                print(f"  ⏳ 429 rate-limited, {wait}s 대기...")
                time.sleep(wait)
                continue
            try:
                err = json.loads(e.read().decode())
            except Exception:
                err = {"error": {"message": f"HTTP {e.code}"}}
            return {"_http_error": e.code, "error": err.get("error", err)}
        except Exception as e:
            if attempt == retries - 1:
                return {"_http_error": 0, "error": {"message": str(e)}}
            time.sleep(3)
    return {"_http_error": 0, "error": {"message": "retries exhausted"}}


def fetch_all_deployments():
    """전체 배포 페이지네이션 수집 (limit=100/페이지, until 커서 역순 순회)"""
    out = []
    until = None
    while True:
        path = f"/v6/deployments?limit=100&teamId={TEAM}&projectId={PROJECT_ID}"
        if until:
            path += f"&until={until}"
        d = api("GET", path)
        deps = d.get("deployments", [])
        if not deps:
            break
        out.extend(deps)
        if len(deps) < 100:
            break
        until = min(x["createdAt"] for x in deps) - 1
        time.sleep(0.3)
    # 중복 제거 + 최신순 정렬
    seen = set()
    uniq = []
    for x in out:
        if x["uid"] not in seen:
            seen.add(x["uid"])
            uniq.append(x)
    uniq.sort(key=lambda x: x["createdAt"], reverse=True)
    return uniq


def ts(ms):
    return datetime.datetime.fromtimestamp(ms / 1000).strftime("%m-%d %H:%M")


def _is_noise_msg(msg):
    """코드 미변경 자동 커밋 분류: accounts backup / worklog / UUID 자동커밋"""
    m = msg.strip()
    return (m.startswith("accounts backup")
            or m.startswith("worklog")
            or (len(m) >= 36 and "-" in m and all(c in "0123456789abcdef-" for c in m)))


def _has_code_diff(sha_a, sha_b):
    """로컬 git으로 두 커밋 간 '코드 실질 변경' 여부 판정 (db-backup 데이터 제외).
    True=코드 다름 / False=코드 동일 / None=판정 불가(SHA 소실 등)"""
    import subprocess
    try:
        for s in (sha_a, sha_b):
            r = subprocess.run(["git", "cat-file", "-e", f"{s}^{{commit}}"],
                               cwd=ROOT, capture_output=True)
            if r.returncode != 0:
                return None
        r = subprocess.run(
            ["git", "diff", "--quiet", sha_a, sha_b, "--",
             ":(exclude)db-backup", ":(exclude)backups", ":(exclude)download",
             ":(exclude)scripts", ":(exclude)worklog.md", ":(exclude)*.md"],
            cwd=ROOT, capture_output=True)
        return r.returncode == 1  # 1=diff 있음(코드 다름), 0=동일
    except Exception:
        return None


def pick_keepers(deps):
    """KEEP 선정: (1) 라이브 배포, (2) 라이브와 '코드가 실질로 다른' 가장 최근 프로덕션(=직전 버전, 롤백 타깃).
    코드 미변경 배포(백업 자동배포 등)는 아무리 최신이어도 KEEP에서 제외 — 유저 기준 '버전'은 코드 변경분."""
    prod = [d for d in deps if d.get("target") == "production"
            and d.get("state") == "READY" and d.get("readyState") == "READY"]
    # 라이브 배포 uid = 별칭 매핑에서 가져옴
    alias = api("GET", f"/v4/aliases?teamId={TEAM}&projectId={PROJECT_ID}")
    live_uid = None
    for a in alias.get("aliases", []):
        dep = a.get("deployment") or {}
        if dep.get("uid"):
            live_uid = dep["uid"]
            break
    keep, keep_uids = [], set()
    live = None
    if live_uid:
        live = next((d for d in deps if d["uid"] == live_uid), None)
    if live is None and prod:
        live = prod[0]  # 별칭 조회 실패 시 최신 READY 프로덕션으로 폴백
    if live:
        keep.append(live)
        keep_uids.add(live["uid"])
        live_sha = (live.get("meta") or {}).get("githubCommitSha", "")
        # 롤백 타깃: 라이브보다 오래된 프로덕션 중 '코드 실질 변경'이 있는 첫 배포
        for d in prod:
            if d["uid"] in keep_uids:
                continue
            m = d.get("meta") or {}
            msg = m.get("githubCommitMessage", "")
            sha = m.get("githubCommitSha", "")
            if _is_noise_msg(msg):
                continue  # 코드 미변경 자동배포 → 롤백 가치 없음
            diff = _has_code_diff(sha, live_sha) if (sha and live_sha) else None
            if diff is False:
                continue  # 메시지는 버전이지만 코드가 라이브와 동일(예: 직전 버전이 현재와 같은 경우)
            keep.append(d)
            keep_uids.add(d["uid"])
            break
    return keep, keep_uids


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "list"
    deps = fetch_all_deployments()
    if not deps:
        print("배포가 0개입니다.")
        return
    keep, keep_uids = pick_keepers(deps)

    print(f"전체 배포: {len(deps)}개 | KEEP {len(keep)}개 | DELETE {len(deps) - len(keep)}개\n")
    print("== KEEP (유지) ==")
    for d in keep:
        m = d.get("meta") or {}
        print(f"  + {d['uid']} | {ts(d['createdAt'])} | {d.get('target')} | {m.get('githubCommitMessage', '')[:48]}")
    print("\n== DELETE (삭제 목록) ==")
    to_delete = [d for d in deps if d["uid"] not in keep_uids]
    for d in to_delete:
        m = d.get("meta") or {}
        print(f"  - {d['uid']} | {ts(d['createdAt'])} | {d.get('target')} | {m.get('githubCommitMessage', '')[:48]}")

    if mode != "run":
        print("\n(미리보기 모드 — 실행하려면: python3 scripts/vercel_cleanup.py run)")
        return

    confirm = "--yes" in sys.argv
    if not confirm:
        ans = input(f"\n위 {len(to_delete)}개 배포를 삭제할까요? [y/N]: ").strip().lower()
        if ans != "y":
            print("취소됨.")
            return

    ok = fail = 0
    for i, d in enumerate(to_delete, 1):
        r = api("DELETE", f"/v13/deployments/{d['uid']}?teamId={TEAM}")
        if r.get("_http_error") or r.get("error"):
            msg = (r.get("error") or {}).get("message", r)
            # 이미 삭제된 경우(404)는 성공 처리
            if "not found" in str(msg).lower() or r.get("_http_error") == 404:
                print(f"  [{i}/{len(to_delete)}] {d['uid']} — 이미 없음(404) → 통과")
                ok += 1
            else:
                print(f"  [{i}/{len(to_delete)}] {d['uid']} — 실패: {msg}")
                fail += 1
        else:
            print(f"  [{i}/{len(to_delete)}] {d['uid']} — 삭제됨")
            ok += 1
        time.sleep(0.5)
    print(f"\n완료: 삭제 {ok} / 실패 {fail}")
    if fail == 0:
        print("✓ 저장소 정리 완료 — KEEP 2개(라이브+롤백)만 남김")


if __name__ == "__main__":
    main()
