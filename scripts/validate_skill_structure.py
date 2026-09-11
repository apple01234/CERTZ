# -*- coding: utf-8 -*-
"""
STEP 5: 스킬 구조 회귀 검증기 (문서 3.6절 — 통과율 하락 없음 + 개선 1건 이상 판정)
사용: python3 validate_skill_structure.py <skill_dir> [--strict-preserve <marker> ...]
9개 구조 게이트 + (--strict-preserve) 원문 보존 마커 검사 결과를 JSON으로 출력.
"""
import json, os, re, sys

def check_skill(skill_dir, preserve_markers=None):
    r = {"skill_dir": skill_dir, "checks": {}, "preserve": []}
    md_path = os.path.join(skill_dir, "SKILL.md")
    C = r["checks"]

    # G1 frontmatter
    ok = False
    if os.path.isfile(md_path):
        head = open(md_path, encoding="utf-8").read(4096)
        ok = head.lstrip().startswith("---")
    C["G1_frontmatter"] = ok

    body = open(md_path, encoding="utf-8").read() if os.path.isfile(md_path) else ""

    # G2 description 존재·충분한 길이 (frontmatter 내에서만 추출 — 본문 누수 방지)
    fm = ""
    if body.lstrip().startswith("---"):
        end = body.find("\n---", body.find("---") + 3)
        fm = body[body.find("---") + 3: end]
    m = re.search(r"^description:\s*(.+)", fm, re.M)
    desc = m.group(1).strip() if m else ""
    C["G2_description"] = len(desc) >= 80

    # G3 경계 문구: 비발동 조건(부정 경계) 또는 명시적 발동 범위 조건(只要/仅当)
    C["G3_boundary"] = any(k in desc for k in (
        "不使用", "不触发", "禁止", "排除", "跳过", "不要",
        "금지", "제외", "하지 않", "사용하지 않", "스킵",
        "只要", "仅当", "whenever", "only if"))

    # G4 name 필드
    C["G4_name"] = bool(re.search(r"^name:\s*\S", body, re.M))

    # G5 본문 500줄 한도 (frontmatter 포함 전체)
    C["G5_line_limit_500"] = (body.count("\n") + (0 if body.endswith("\n") else 1)) <= 500

    # G6 본문이 언급한 포인터 파일 존재 (references/…, tutorials/…, evals/…)
    refs = set(re.findall(r"(?:references|tutorials|evals)/[A-Za-z0-9_./-]+\.(?:md|json)", body))
    C["G6_pointers_exist"] = all(os.path.isfile(os.path.join(skill_dir, p)) for p in refs) if refs else True
    r["pointers"] = sorted(refs)

    # G7 evals.json 유효성
    ev_ok = False
    ev_path = os.path.join(skill_dir, "evals", "evals.json")
    if os.path.isfile(ev_path):
        try:
            ev = json.load(open(ev_path, encoding="utf-8"))
            ev_ok = bool(ev.get("skill_name")) and len(ev.get("evals", [])) > 0 and all(
                e.get("id") is not None and e.get("prompt") and e.get("expectations") for e in ev["evals"])
        except Exception:
            ev_ok = False
    C["G7_evals_valid"] = ev_ok

    # G8 장애기록(faq) — references/faq.md 4항목 형식 또는 본문 전용 장애 기록 섹션(실기록, 문서 3.5.5 허용)
    faq_ok = False
    faq_path = os.path.join(skill_dir, "references", "faq.md")
    if os.path.isfile(faq_path):
        faq = open(faq_path, encoding="utf-8").read()
        entries = faq.count("\n## ")  # 엔트리 카운트 — 제목은 H1(# ) 규약이라 첫 "## "도 엔트리 (2026-09-10 랩 실측 버그 수정: 구 로직 `-1`은 "## " 제목 규약 가정이 H1 규약과 불일치해 1건 FAQ를 0으로 계산)
        faq_ok = entries >= 1 and all(k in faq for k in ("症状", "原因", "解决", "复发防止"))
    if not faq_ok:
        m = re.search(r"^## .*(踩坑|故障|FAQ).*$", body, re.M)
        if m:
            seg = body[m.end():]
            nxt = re.search(r"^## ", seg, re.M)
            seg = seg[: nxt.start()] if nxt else seg
            faq_ok = len(re.findall(r"\d{4}-\d{2}-\d{2}", seg)) >= 1 and "暂无" not in seg
    C["G8_faq_grounded"] = faq_ok

    # G9 tutorials 인덱스 + 파일명 규칙
    tut_ok = False
    tut_idx = os.path.join(skill_dir, "tutorials", "README.md")
    if os.path.isfile(tut_idx):
        tuts = [f for f in os.listdir(os.path.join(skill_dir, "tutorials"))
                if re.match(r"tutorial-.+-\d{4}-\d{2}-\d{2}\.md$", f)]
        tut_ok = len(tuts) >= 1
    C["G9_tutorials_indexed"] = tut_ok

    # 원문 보존 마커
    for mk in preserve_markers or []:
        r["preserve"].append({"marker": mk, "ok": mk in body})

    r["passed"] = sum(1 for v in C.values() if v)
    r["total"] = len(C)
    r["preserve_ok"] = all(p["ok"] for p in r["preserve"])
    return r

if __name__ == "__main__":
    targets = [
        (sys.argv[1], [m for m in sys.argv[2:] if not m.startswith("--")])
    ] if len(sys.argv) > 1 else []
    out = [check_skill(d, mk) for d, mk in targets]
    print(json.dumps(out, ensure_ascii=False, indent=1))
