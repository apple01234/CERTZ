# -*- coding: utf-8 -*-
"""
STEP 4: skill-creator 패턴 D 분리 수술 (Task 74 SOP — 원문 전부 보존 이동)
- Section A (163-290) Running and evaluating test cases → references/eval-workflow.md
- Section B (333-406) Description Optimization        → references/description-optimization.md
- Section C (420-457) GLM.ai + Cowork                → references/platform-adapters.md
- 본문: 요약+포인터로 치환, description 경계 보강(Pattern B)
순서 불변 준수: 스냅샷(완료, 태그 v1) → 편집(본 스크립트) → 검증(별도 실행)
"""
import os, sys

SKILL = "/home/z/my-project/skills/skill-creator/SKILL.md"
REFDIR = "/home/z/my-project/skills/skill-creator/references"

src = open(SKILL, encoding="utf-8").read()
lines = src.split("\n")  # 0-based 인덱스 = 줄번호-1


def slice_lines(a, b):
    """1-based [a, b] 포함 슬라이스 (원문 그대로)"""
    return "\n".join(lines[a - 1 : b])


# ── 경계 재확인 (하드 실패 시 중단 — 치환 실수 방지) ──
assert lines[162].startswith("## Running and evaluating test cases"), lines[162]
assert lines[291].startswith("## Improving the skill"), lines[291]
assert lines[332].startswith("## Description Optimization"), lines[332]
assert lines[407].startswith("### Package and Present"), lines[407]
assert lines[419].startswith("## GLM.ai-specific instructions"), lines[419]
assert lines[444].startswith("## Cowork-Specific Instructions"), lines[444]
assert lines[458].startswith("## Reference files"), lines[458]

SEC_A = slice_lines(163, 290)  # Running and evaluating test cases (끝의 --- 포함)
SEC_B = slice_lines(333, 406)  # Description Optimization (끝의 --- 포함)
SEC_C = slice_lines(420, 457)  # GLM.ai + Cowork (끝의 --- 포함)

PROV = (
    "> 출처: SKILL.md 원문 전부 보존 이동 (2026-09-10, 패턴 D — 500줄 한도 준수).\n"
    "> 본문에는 요약과 포인터만 남는다. 이 파일이 단일 진실원천 — 여기만 수정할 것.\n\n"
)

os.makedirs(REFDIR, exist_ok=True)

refs = {
    "eval-workflow.md": (
        "# 평가 워크플로 — 러닝·채점·뷰어 (원문 보존)\n\n" + PROV + SEC_A
    ),
    "description-optimization.md": (
        "# 설명(description) 최적화 — 트리거 평가 루프 (원문 보존)\n\n" + PROV + SEC_B
    ),
    "platform-adapters.md": (
        "# 플랫폼별 조정 — GLM.ai / Cowork (원문 보존)\n\n" + PROV + SEC_C
    ),
}
for name, content in refs.items():
    with open(os.path.join(REFDIR, name), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"WROTE references/{name} ({content.count(chr(10))+1} lines)")

# ── 본문 치환 블록 (요약 + 포인터) ──
BODY_A = """## Running and evaluating test cases

This section is one continuous sequence — don't stop partway through. Do NOT use `/skill-test` or any other testing skill. Put results in `<skill-name>-workspace/` as a sibling to the skill directory, organized by iteration (`iteration-N/eval-<ID>/`). Don't create directories upfront — create them as you go.

The full step-by-step procedure lives in `references/eval-workflow.md` — read it before your first run, and whenever a command or field name is in doubt. The non-negotiable skeleton:

1. **Spawn all runs (with-skill AND baseline) in the same turn.** Improving an existing skill? Snapshot it first (`cp -r <skill-path> <workspace>/skill-snapshot/`) and point the baseline subagent at the snapshot. Write an `eval_metadata.json` per test case; give evals descriptive names, not "eval-0".
2. **While runs are in progress, draft assertions** — objectively verifiable, descriptively named — and update `eval_metadata.json` + `evals/evals.json`. Don't force assertions onto subjective skills.
3. **As each run completes, immediately save its notification data** (`total_tokens`, `duration_ms`) to `timing.json` in that run directory — this data arrives once and isn't persisted elsewhere.
4. **Grade, aggregate, analyze, and launch the viewer.** The `grading.json` expectations array must use exactly `text`, `passed`, `evidence` — the viewer breaks on other field names. Aggregate with `python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>`, do the analyst pass (`agents/analyzer.md`), then launch `eval-viewer/generate_review.py` (use `--static <output_path>` with no display; iteration 2+ adds `--previous-workspace`). Never hand-write boutique HTML for this.
5. **Read `feedback.json` when the user is done.** Empty feedback means "fine as is" — spend your effort where the user wrote complaints.

---"""

BODY_B = """## Description Optimization

The description field in SKILL.md frontmatter is the primary mechanism that determines whether GLM invokes a skill. After creating or improving a skill, offer to optimize it for better triggering accuracy.

The full loop lives in `references/description-optimization.md` (generate ~20 realistic should/should-not-trigger queries with genuinely tricky near-miss negatives → review with the user via `assets/eval_review.html` → run `python -m scripts.run_loop` in the background → apply `best_description`, selected by test score not train score). Simple one-step queries are poor eval cases — GLM only consults skills for tasks it can't easily handle alone.

---"""

BODY_C = """## Platform adaptations (GLM.ai / Cowork)

The core loop is identical everywhere; mechanics change per platform. Full details: `references/platform-adapters.md`.

- **GLM.ai** (no subagents): run test prompts yourself one at a time, skip baselines and quantitative benchmarking, present outputs inline for feedback, skip description optimization (needs `glm -p`).
- **Cowork** (no display): use `--static <output_path>` for the viewer and proffer the link; feedback arrives as a downloaded `feedback.json`; description optimization works but comes last.
- **Either way**: GENERATE THE EVAL VIEWER *BEFORE* evaluating the outputs yourself — get examples in front of the human ASAP.
- **Updating an existing skill**: preserve the original directory name and `name` frontmatter; copy to a writable location before editing if the installed path is read-only.

---"""

# 원문 위치 치환 (뒤에서 앞으로 — 인덱스 시프트 방지)
out = lines[:]
out[419:457] = BODY_C.split("\n")   # 420-457
out[332:406] = BODY_B.split("\n")   # 333-406
out[162:290] = BODY_A.split("\n")   # 163-290
body = "\n".join(out)

# ── Pattern B: description 경계 보강 (G3) ──
OLD_DESC = "description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy."
NEW_DESC = "description: Create new skills, modify and improve existing skills, and measure skill performance. Use whenever the user wants to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or tune a description for better triggering accuracy. Do NOT use it to merely use or invoke an existing skill for a normal task, or for one-off work with no reusable skill as the goal."
assert OLD_DESC in body, "description 원문 미검출"
body = body.replace(OLD_DESC, NEW_DESC)

# ── Reference files 섹션 갱신 (새 참조 등재) ──
OLD_REFSEC = "- `references/schemas.md` — JSON structures for evals.json, grading.json, etc."
NEW_REFSEC = """- `references/schemas.md` — JSON structures for evals.json, grading.json, etc.
- `references/eval-workflow.md` — full running/grading/viewer procedure (moved verbatim from this file)
- `references/description-optimization.md` — full trigger-eval optimization loop (moved verbatim)
- `references/platform-adapters.md` — full GLM.ai / Cowork adaptations (moved verbatim)
- `references/faq.md` — real incident records (症状/原因/解决/复发防止)"""
assert OLD_REFSEC in body, "reference files 섹션 미검출"
body = body.replace(OLD_REFSEC, NEW_REFSEC)

open(SKILL, "w", encoding="utf-8").write(body)
print(f"NEW SKILL.md: {body.count(chr(10)) + 1} lines (이전 485)")
