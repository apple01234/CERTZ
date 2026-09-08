#!/usr/bin/env python3
"""v4.4.0 — Panels.tsx의 구형 InventoryPanel을 메이플 스타일 신형으로 교체 (스플라이스)"""
import sys

PANELS = "/home/z/my-project/src/components/game/Panels.tsx"
NEW = "/home/z/my-project/scripts/new_inventory_panel.tsx"

START = "export function InventoryPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {"
END = "/* ---------- v3.0.3 — GM 패널"

with open(PANELS, encoding="utf-8") as f:
    src = f.read()
with open(NEW, encoding="utf-8") as f:
    new_block = f.read().rstrip() + "\n\n"

i = src.find(START)
j = src.find(END)
assert i >= 0, "start anchor not found"
assert j >= 0, "end anchor not found"
assert i < j, "anchor order wrong"

replaced = src[i:j]
out = src[:i] + new_block + src[j:]
with open(PANELS, "w", encoding="utf-8") as f:
    f.write(out)

old_lines = replaced.count("\n")
new_lines = new_block.count("\n")
print(f"OK — replaced {old_lines} lines with {new_lines} lines (new InventoryPanel)")
