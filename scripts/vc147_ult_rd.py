#!/usr/bin/env python3
"""vc147 (#18) — useSkill5/useSkill5b 내부 rollDamage 호출을 rd() 래퍼로 치환.
rd(slot)(mult, forceCrit?) → ultSlot 설정 → rollDamage(mult, true, forceCrit) → 슬롯 해제.
두 메서드 범위 안에서만 치환 (기본공격/일반 스킬 무영향)."""
import re

P = "/home/z/my-project/src/game/entities/Player.ts"
src = open(P).read()
lines = src.split("\n")

s5 = next(i for i, l in enumerate(lines) if l.strip() == "useSkill5() {")
s5b = next(i for i, l in enumerate(lines) if l.strip() == "useSkill5b() {")
# useSkill5b 끝 = useSkill5b 이후 등장하는 "  }" 레벨의 다음 메서드 시작
end = None
for i in range(s5b + 1, len(lines)):
    if re.match(r"^  (private |get |static )?[a-zA-Z_#]", lines[i]) and lines[i].rstrip().endswith("{") and i > s5b + 5:
        end = i
        break
assert end, "useSkill5b end not found"
print(f"useSkill5: line {s5+1}, useSkill5b: {s5b+1}, end: {end+1}")

# 치환 대상 범위: s5 본문(~s5b 직전)과 s5b 본문(s5b~end)
def convert(seg):
    seg = re.sub(r"this\.rollDamage\(([^()]*), true, true\)", r"rd(\1, true)", seg)
    seg = re.sub(r"this\.rollDamage\(([^()]*), true\)", r"rd(\1)", seg)
    seg = re.sub(r"this\.rollDamage\(([^()]*)\)", r"rd(\1)", seg)
    return seg

body5 = convert("\n".join(lines[s5:s5b]))
body5b = convert("\n".join(lines[s5b:end]))
tail = "\n".join(lines[end:])
head = "\n".join(lines[:s5])

# rd 헬퍼 삽입: useSkill5는 "const now = this.scene.time.now;" 다음, useSkill5b는 "const info = SKILL5B_INFO[key5];" 다음
anchor5 = "const now = this.scene.time.now;"
assert anchor5 in body5, "anchor5 missing"
body5 = body5.replace(
    anchor5,
    anchor5
    + "\n\n"
    + "    /* vc147 (#18) — 1차 궁극기 피해 ×300% (FIFTH1_MULT): 궁극기 시전 중 rollDamage에\n"
    + "     *  슬롯 계수를 태워 n차 사다리/FIFTH_SKILL_MULT 중복 대신 요구치 그대로 3.0배 단일 배율 적용 */\n"
    + "    const rd = (m: number, forceCrit = false) => { this.ultSlot = 1; const r = this.rollDamage(m, true, forceCrit); this.ultSlot = 0; return r; };",
)
anchor5b = "const info = SKILL5B_INFO[key5];"
assert anchor5b in body5b, "anchor5b missing"
body5b = body5b.replace(
    anchor5b,
    anchor5b
    + "\n\n"
    + "    /* vc147 (#18) — 제2궁극기 피해 ×500% (FIFTH2_MULT) — 1차(rd×300%)와 동일 메커니즘 */\n"
    + "    const rd = (m: number, forceCrit = false) => { this.ultSlot = 2; const r = this.rollDamage(m, true, forceCrit); this.ultSlot = 0; return r; };",
)

out = head + body5 + "\n" + body5b + "\n" + tail
open(P, "w").write(out)
n = out.count("rd(") - out.count("const rd =")
print(f"rd call sites: {n}")
leftover = len(re.findall(r"this\.rollDamage\(", body5 + body5b))
print(f"leftover this.rollDamage in ult bodies: {leftover}")
