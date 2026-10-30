#!/usr/bin/env python3
"""
gen_class_lineage.py — 직업 계통표 자동 생성 (지시서 #4)

유저 원문: "같은 텍스트 색깔의 직업은 같은 직업이야 (전직 차수가 올라가는 거뿐임)"

`src/game/classes.ts` 의 CLASS_DEFS 에서 key/tier/parent/color/hex/name 을 읽어
부모 관계로 트리를 만들고, 색 계열과 부모가 일치하는지 교차 검증한다.
불일치는 "미확정"으로 표시하고 이유를 남긴다.
"""
import re, os, json
from collections import defaultdict

SRC = "/root/workspace/CERTZ/src/game/classes.ts"
OUT = "/root/workspace/CERTZ/docs/CLASS_LINEAGE.md"


def parse_defs():
    s = open(SRC, encoding="utf-8").read()
    # 각 직업 블록: key: "x", tier: n, parent: "y"|null, ... name: "...", color: "#..." hex
    defs = {}
    for m in re.finditer(
        r'key:\s*"(\w+)",\s*tier:\s*(\d+),\s*parent:\s*(?:"(\w+)"|null),', s):
        key, tier, parent = m.group(1), int(m.group(2)), m.group(3)
        # 이 블록 다음 900자 내에서 name/color/hex 추출
        seg = s[m.end(): m.end() + 1600]
        nm = re.search(r'name:\s*"([^"]+)"', seg)
        col = re.search(r'color:\s*"(#[0-9a-fA-F]{6})"', seg)
        hx = re.search(r'hex:\s*(0x[0-9a-fA-F]{6})', seg)
        defs[key] = dict(key=key, tier=tier, parent=parent,
                         name=nm.group(1) if nm else key,
                         color=col.group(1) if col else "",
                         hex=hx.group(1) if hx else "")
    return defs


def main():
    defs = parse_defs()
    roots = [d for d in defs.values() if d["parent"] is None]
    print(f"직업 {len(defs)}개 / 1차(부모없음) {len(roots)}개")

    # 트리 구성
    children = defaultdict(list)
    for d in defs.values():
        if d["parent"]:
            children[d["parent"]].append(d["key"])
    for k in children:
        children[k].sort(key=lambda x: (defs[x]["tier"], x))

    lines = ["# SERTZ 직업 계통표 (지시서 #4)", "",
             "> 생성: `tools/gen_class_lineage.py` — `src/game/classes.ts` 에서 직접 추출.",
             "> 근거: 유저 지시 *\"같은 텍스트 색깔의 직업은 같은 직업이야 (전직 차수가 올라가는 거뿐임)\"*.",
             "> 따라서 35개 직업은 독립 직업이 아니라 **전직 계통(lineage)** 이다.", ""]

    lines.append("## 계통 목록")
    lines.append("")
    lines.append("| 계통 | 1차 | 2차 | 3차 | 4차 | 색 |")
    lines.append("|---|---|---|---|---|---|")
    for r in sorted(roots, key=lambda x: x["key"]):
        def chain(k):
            return [k] + [c for c in children.get(k, [])]
        # 2차 -> 3차 -> 4차 재귀 경로 중 최장
        def deepest(k):
            best = [k]
            for c in children.get(k, []):
                p = deepest(c)
                if len(p) + 1 > len(best):
                    best = [k] + p
            return best
        path = deepest(r["key"])
        cells = []
        for t in range(1, 5):
            ks = [defs[k]["name"] for k in path if defs[k]["tier"] == t]
            cells.append("<br>".join(ks) if ks else "—")
        lines.append(f"| **{r['name']}** | " + " | ".join(cells) + f" | `{r['color']}` |")
    lines.append("")

    lines.append("## 전체 직업 상세")
    lines.append("")
    lines.append("| key | 이름 | 차수 | 부모 | 색 | hex | 자식 |")
    lines.append("|---|---|---|---|---|---|---|")
    for k in sorted(defs, key=lambda x: (defs[x]["tier"], x)):
        d = defs[k]
        ch = ", ".join(children.get(k, [])) or "—"
        lines.append(f"| `{d['key']}` | {d['name']} | {d['tier']} | "
                     f"{('`'+d['parent']+'`') if d['parent'] else '—'} | `{d['color']}` | "
                     f"`{d['hex']}` | {ch} |")
    lines.append("")

    # 검증: 부모-자식 색 계열 유사도
    lines.append("## 검증 — 부모·자식 색 계열 일치")
    lines.append("")
    lines.append("부모와 자식의 색이 같은 계통이면 색상 거리가 가까워야 한다. "
                 "HSL 색상환 거리(0~180) 기준 40도 이내면 같은 계열로 본다.")
    lines.append("")
    lines.append("| 자식 | 부모 | 거리(도) | 판정 |")
    lines.append("|---|---|---|---|")

    import colorsys

    def hue(hexcol):
        if not hexcol:
            return None
        h = hexcol.lstrip("#")
        r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
        hh, _, _ = colorsys.rgb_to_hls(r, g, b)
        return hh * 360

    def dist(a, b):
        if a is None or b is None:
            return None
        d = abs(a - b)
        return min(d, 360 - d)

    mism = []
    for k, d in defs.items():
        if not d["parent"] or d["parent"] not in defs:
            continue
        a, b = hue(d["color"]), hue(defs[d["parent"]]["color"])
        dd = dist(a, b)
        ok = dd is not None and dd <= 40
        if not ok:
            mism.append((k, d["parent"], dd))
        lines.append(f"| `{k}` | `{d['parent']}` | {dd:.0f} | {'OK' if ok else '★계열 다름'} |")
    lines.append("")
    lines.append(f"**불일치 {len(mism)}건** — 부모 관계는 맞지만 색이 계열에서 벗어난 경우. "
                 "색을 부모 계열로 맞추거나, 부모 관계를 재검토해야 한다(미확정).")
    for m in mism:
        lines.append(f"- `{m[0]}` (부모 `{m[1]}`, 거리 {m[2]:.0f}도)")
    lines.append("")

    # 차수 분포
    bytier = defaultdict(int)
    for d in defs.values():
        bytier[d["tier"]] += 1
    lines.append("## 차수 분포")
    lines.append("")
    for t in sorted(bytier):
        lines.append(f"- {t}차: {bytier[t]}개")
    lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(lines))
    print(f"저장: {OUT}  ({len(lines)}줄)")
    print(f"계통(1차) {len(roots)}개, 색 불일치 {len(mism)}건")
    for m in mism[:8]:
        print(f"   ★ {m[0]} <- {m[1]}  거리 {m[2]:.0f}도")


if __name__ == "__main__":
    main()
