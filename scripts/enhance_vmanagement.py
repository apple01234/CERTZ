# -*- coding: utf-8 -*-
"""
STEP 4-a: version-management 스킬 패턴 D(참고자료 계층화) + E(장애기록) 적용
- 본문 582줄 → 500줄 이하로: §3.4.2/3.4.3/3.4.4 → references/delivery-variants.md
  §5 meta.json 상세 → references/meta-json-spec.md
- references/faq.md 신설(패턴 E, worklog Task 71 실제 장애 3건)
- 원문 텍스트는 그대로 보존(기존 틀/내용 유지) — 위치만 이동
"""
import os, sys

ROOT = "/home/z/my-project"
SKILL = os.path.join(ROOT, "skills/version-management")
SKILL_MD = os.path.join(SKILL, "SKILL.md")
REF_DIR = os.path.join(SKILL, "references")

os.makedirs(REF_DIR, exist_ok=True)

src = open(SKILL_MD, encoding="utf-8").read()
orig_lines = src.count("\n") + (0 if src.endswith("\n") else 1)

def between(text, start_marker, end_marker, include_end=False):
    i = text.index(start_marker)
    j = text.index(end_marker, i) if not include_end else text.index(end_marker, i) + len(end_marker)
    return text[i:j]

# ---------- 1) §3.4.2~3.4.4 블록 추출 (원문 보존) ----------
m342 = "#### 3.4.2 多入口文件项目（新增规则）"
m35 = "### 3.5 对话流卡片与「基于该版本编辑」"
block_variants = between(src, m342, m35).rstrip().rstrip("-").rstrip()
assert "3.4.4" in block_variants and "3.4.3" in block_variants, "3.4.x block extraction failed"

delivery_md = """# 特殊交付形态规则（delivery-variants）

> 本文件由 SKILL.md §3.4 计量分层（패턴 D）拆出；正文只保留指针与核心规则，完整细则以本文件为准。
> 适用时机：多入口 HTML 项目、prototype 双文件交付、固定图片导出（小红书卡片等）任一场景出现时必读。

## 目录

- §2 多入口文件项目
- §3 Prototype 双文件交付（稳定规则）
- §4 固定图片导出项目（小红书卡片等）

---

## 2. 多入口文件项目（新增规则）

{body_342}

---

## 3. Prototype 双文件交付（稳定规则）

{body_343}

---

## 4. 固定图片导出项目（小红书卡片等，新增规则）

{body_344}
"""

def subsection(block, header):
    i = block.index(header)
    after = i + len(header)  # 자기 자신(접두어 일치) 제외 — 다음 섹션부터 탐색
    js = [block.index(x, after) for x in ("#### 3.4.", "### 3.5") if block.find(x, after) != -1]
    j = min(js) if js else len(block)
    return block[i:j].rstrip()

b342 = subsection(block_variants, "#### 3.4.2").replace("#### 3.4.2 多入口文件项目（新增规则）", "").strip()
b343 = subsection(block_variants, "#### 3.4.3").replace("#### 3.4.3 Prototype 双文件交付（稳定规则）", "").strip()
b344 = block_variants[block_variants.index("#### 3.4.4"):]
b344 = b344.replace("#### 3.4.4 固定图片导出项目（小红书卡片等，新增规则）", "").strip()

open(os.path.join(REF_DIR, "delivery-variants.md"), "w", encoding="utf-8").write(
    delivery_md.format(body_342=b342, body_343=b343, body_344=b344))

# ---------- 2) §5 meta.json 블록 추출 (원문 보존) ----------
m5 = "## 5. meta.json 结构"
m6 = "## 6. 操作速查"
block_meta = between(src, m5, m6).rstrip().rstrip("-").rstrip()
body_meta = block_meta.replace(m5, "").strip()

metaspec_md = """# meta.json 结构规范（meta-json-spec）

> 本文件由 SKILL.md §5 计量分层（패턴 D）拆出；正文只保留核心字段速记，完整示例与逐字段说明以本文件为准。
> 适用时机：创建或更新 meta.json 前必读。

{body}
""".format(body=body_meta)

open(os.path.join(REF_DIR, "meta-json-spec.md"), "w", encoding="utf-8").write(metaspec_md)

# ---------- 3) 본문 치환 ----------
new_34 = """#### 3.4.2 多入口文件项目

项目包含**多个独立入口 HTML 文件**（如 `index.html` + `light.html`、多页面）时：所有入口文件必须在**同一 commit** 中提交；默认只 `send_file` 主入口；**禁止**对项目目录调用 `ext=directory` 吐文件夹。完整规则与示例见 **references/delivery-variants.md** §2。

#### 3.4.3 Prototype 双文件交付（稳定规则）

调用方 Skill 为 `prototype.md` 且版本包含双交付文件（可交互原型 + 流程文档）时：两个 HTML **同版本**提交，并对同一版本号**连续两次** `send_file`（prototype → flow）；禁止打包为目录或只吐其一。完整规则与示例见 **references/delivery-variants.md** §3。

#### 3.4.4 固定图片导出项目（小红书卡片等）

`fixed-image` 输出目标（小红书卡片、封面图、长图）时：HTML 与 `export/` 产物**同目录、同版本（commit）**；先吐 HTML（`web_project`），再吐导出产物（单图用扩展名、多图用 `directory`）。完整规则与示例见 **references/delivery-variants.md** §4。

"""

new_5 = """## 5. meta.json 结构

每个项目一份，记录项目整体状态；通过 `.gitignore` 排除，不进入版本历史。**创建/更新 meta.json 前必读完整示例与逐字段说明：references/meta-json-spec.md**。

核心字段速记：`project_name`（项目名）、`latest_version`（最新版本号）、`versions[]`（`id`／`timestamp`／`based_on`／`summary`；`based_on` 仅在恢复或基于历史版本编辑时有值，普通编辑为 null）。更新顺序固定不变：git commit + tag **全部完成后** → 更新 meta.json → 最后 `send_file`。

"""

src = src.replace(block_variants + "\n\n", new_34)
src = src.replace(block_meta + "\n\n---\n\n", new_5)

# ---------- 4) §8 학습자산 포인터 추가 (기존 §7 뒤) ----------
sec8 = """
---

## 8. 学习资产与回归验证

- 初学者教程（人用学习资产）：**tutorials/** — 索引见 `tutorials/README.md`
- 回归测试集：**evals/evals.json** — 修改本 Skill 后全量重跑，通过率不得下降
- 故障·解决记录：**references/faq.md** — 只记实际发生并解决的故障（禁止臆测性记录）
"""
if "## 8. 学习资产与回归验证" not in src:
    src = src.rstrip() + "\n" + sec8

open(SKILL_MD, "w", encoding="utf-8").write(src)

new_lines = src.count("\n") + (0 if src.endswith("\n") else 1)
print(f"[OK] SKILL.md: {orig_lines} -> {new_lines} lines (limit 500: {'PASS' if new_lines <= 500 else 'FAIL'})")
for f in ("references/delivery-variants.md", "references/meta-json-spec.md"):
    p = os.path.join(SKILL, f)
    n = open(p, encoding="utf-8").read().count("\n") + 1
    print(f"[OK] {f}: {n} lines")
# 원문 보존 검증: 핵심 문구가 분리 파일에 모두 존재하는지
dv = open(os.path.join(REF_DIR, "delivery-variants.md"), encoding="utf-8").read()
ms = open(os.path.join(REF_DIR, "meta-json-spec.md"), encoding="utf-8").read()
checks = [
    ("dv: prototype flow 규칙", "禁止将 `prototype.html + flow.html` 打包为目录一次性吐出" in dv),
    ("dv: fixed-image 규칙", "必须在同一个版本（commit）中" in dv),
    ("dv: 다중 진입 규칙", "禁止遗漏：所有 HTML 文件都必须被 git 追踪" in dv),
    ("ms: based_on 필드", "仅在恢复或基于历史版本编辑时有值" in ms),
    ("ms: JSON 예시", '"latest_version": "v3"' in ms),
]
ok = True
for name, cond in checks:
    print(("[OK] " if cond else "[FAIL] ") + name)
    ok = ok and cond
sys.exit(0 if ok and new_lines <= 500 else 1)
