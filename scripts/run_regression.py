# -*- coding: utf-8 -*-
"""
STEP 5 실행부: baseline(스냅샷) vs 강화 후 통과율 비교 → 판정
판정식: 통과율 하락 없음 AND 개선 ≥1건 AND 원문 보존 마커 전부 통과
"""
import json, subprocess, sys

V = "/home/z/my-project/scripts/validate_skill_structure.py"

CASES = [
    {
        "name": "version-management",
        "baseline": "/home/z/my-project/skills-workspace/version-management-snapshot",
        "enhanced": "/home/z/my-project/skills/version-management",
        "preserve": ["## 1. 项目创建", "## 4. 版本恢复", "## 6. 操作速查", "### 1.2 路径强制检查（关键规则）",
                     "禁止", "git tag --sort=-v:refname"],
    },
    {
        "name": "task-review",
        "baseline": "/home/z/my-project/skills-workspace/task-review-snapshot",
        "enhanced": "/home/z/my-project/skills/task-review",
        "preserve": ["## 触发时机", "## 执行步骤", "## 质量标准", "调用了 5 次及以上的工具",
                     "先检查 skills/ 目录下是否已有匹配的技能文件", "踩坑记录只记真正踩过的坑，不要编造"],
    },
    {
        "name": "skill-creator",
        "baseline": "/home/z/my-project/skills-workspace/skill-creator-snapshot",
        "enhanced": "/home/z/my-project/skills/skill-creator",
        "preserve": ["Decide what you want the skill to do", "## Improving the skill",
                     "## Advanced: Blind comparison", "one continuous sequence",
                     "best_description", "Please add steps to your TodoList"],
    },
]

summary, all_ok = [], True
for c in CASES:
    base = json.loads(subprocess.run(["python3", V, c["baseline"]] + c["preserve"],
                                     capture_output=True, text=True).stdout)[0]
    enh = json.loads(subprocess.run(["python3", V, c["enhanced"]] + c["preserve"],
                                    capture_output=True, text=True).stdout)[0]
    no_regress = enh["passed"] >= base["passed"]
    improved = enh["passed"] > base["passed"]
    preserve_ok = enh["preserve_ok"] and base["preserve_ok"]
    verdict = "PASS" if (no_regress and improved and preserve_ok) else "FAIL"
    all_ok &= verdict == "PASS"
    print(f"=== {c['name']} ===")
    print(f"  baseline : {base['passed']}/{base['total']}  fails={[k for k, v in base['checks'].items() if not v]}")
    print(f"  enhanced : {enh['passed']}/{enh['total']}  fails={[k for k, v in enh['checks'].items() if not v]}")
    print(f"  preserve : {sum(1 for p in enh['preserve'] if p['ok'])}/{len(enh['preserve'])} markers ok")
    print(f"  pointers : {enh['pointers']}")
    print(f"  판정     : {verdict} (no_regress={no_regress}, improved={improved}, preserve={preserve_ok})")
    summary.append({"skill": c["name"], "baseline": f"{base['passed']}/{base['total']}",
                    "enhanced": f"{enh['passed']}/{enh['total']}", "verdict": verdict})

print(json.dumps(summary, ensure_ascii=False))
sys.exit(0 if all_ok else 1)
