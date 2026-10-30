#!/usr/bin/env python3
"""
ult_dedup.py — 궁극기 직업별 호출 시퀀스 추출 + 마무리 중복 분석 (지시서 #10)

유저 지적: "궁극기가 뒤에 부분 바뀐게 다 똑같잖아"

`Player.ts` 의 `switch (key5)` 블록에서 직업별로 호출되는
FX/연출 함수 시퀀스를 뽑아낸다. 그 다음:
  · 각 직업의 **마지막 3개 호출**을 "마무리"로 정의
  · 쌍별 마무리 조합이 완전히 같은 쌍을 찾는다 (지시서 완료 기준: 중복 0쌍)

한계(정직하게 기록): 정적 파싱이라 조건문 안의 호출도 순서대로 센다.
실제 재생 여부는 런타임 조건에 달렸지만, "같은 함수를 같은 순서로 부른다"는
중복 판정에는 충분하다.
"""
import re, os, json, itertools
from collections import defaultdict

SRC = "/root/workspace/CERTZ/src/game/entities/Player.ts"
OUT = "/root/workspace/CERTZ/docs/ULT_DEDUP.md"

# 연출로 볼 호출 이름 패턴 (데미지/상태 계산은 제외)
FX_PAT = re.compile(
    r"\b(spawn\w+|play\w+|cine3d|sfx\w+|doShake|flash|shake|add\.\w+|tweens\.add|"
    r"cameras\.main\.\w+)\s*\("
)


def extract():
    s = open(SRC, encoding="utf-8").read()
    # useSkill5 내부의 switch (key5) 블록
    i = s.find("switch (key5)")
    if i < 0:
        raise SystemExit("switch (key5) 를 찾지 못했습니다")
    # 중괄호 매칭으로 블록 끝 찾기
    j = s.find("{", i)
    depth, k = 0, j
    while k < len(s):
        if s[k] == "{":
            depth += 1
        elif s[k] == "}":
            depth -= 1
            if depth == 0:
                break
        k += 1
    block = s[j:k + 1]

    # case "직업": ... (다음 case 까지)
    cases = {}
    parts = re.split(r'\n\s*case\s+"([\w]+)"\s*:', block)
    # parts = ['...', 'warbringer', '...', 'crusader', '...', ...]
    for n in range(1, len(parts) - 1, 2):
        name = parts[n]
        body = parts[n + 1]
        calls = []
        for m in FX_PAT.finditer(body):
            fn = m.group(1)
            # 최소 호출 이름만 (add./tweens.add 는 대상이 다양해 이름 보강)
            if fn.startswith("add.") or fn.startswith("cameras") or fn == "tweens.add":
                continue
            calls.append(fn)
        cases[name] = calls
    return cases


def main():
    cases = extract()
    print(f"직업 {len(cases)}개 추출")

    # 마무리 = 마지막 3개 호출
    fin = {k: v[-3:] for k, v in cases.items()}

    lines = [
        "# 궁극기 마무리 중복 분석 — 지시서 #10", "",
        "> 유저 지적: *\"궁극기가 뒤에 부분 바뀐게 다 똑같잖아 ㅅ1ㅂ 똑바로 안만듬???\"*", "",
        "생성: `tools/ult_dedup.py` — `src/game/entities/Player.ts` 의 `switch (key5)` 를",
        "정적 파싱해 직업별 연출 호출 시퀀스를 뽑고, **마지막 3개 호출을 \"마무리\"로 정의**해",
        "쌍별 완전 중복을 찾는다.", "",
        "## 직업별 연출 호출 시퀀스", "",
        "| 직업 | 호출 수 | 마무리 3개 |", "|---|---|---|",
    ]
    for k in sorted(cases):
        f = " → ".join(fin[k]) if fin[k] else "—"
        lines.append(f"| `{k}` | {len(cases[k])} | {f} |")

    # 쌍별 마무리 중복
    lines += ["", "## 마무리 완전 중복 쌍", ""]
    dup = []
    for a, b in itertools.combinations(sorted(fin), 2):
        if fin[a] and fin[a] == fin[b]:
            dup.append((a, b, fin[a]))
    if not dup:
        lines.append("**중복 0쌍** — 모든 직업의 마무리 호출 조합이 서로 다르다.")
    else:
        lines.append(f"**중복 {len(dup)}쌍**")
        lines.append("")
        lines.append("| A | B | 공통 마무리 |")
        lines.append("|---|---|---|")
        for a, b, f in dup:
            lines.append(f"| `{a}` | `{b}` | {' → '.join(f)} |")

    # 부분 겹침(마지막 1개라도 같으면) — 참고용
    lines += ["", "## 마지막 호출 1개 기준 겹침 (참고)", ""]
    by_last = defaultdict(list)
    for k, f in fin.items():
        if f:
            by_last[f[-1]].append(k)
    for fn, ks in sorted(by_last.items(), key=lambda x: -len(x[1])):
        if len(ks) > 1:
            lines.append(f"- `{fn}` ← {', '.join('`'+k+'`' for k in ks)}")
    if all(len(v) == 1 for v in by_last.values()):
        lines.append("겹침 없음 — 마지막 호출이 직업마다 고유하다.")

    # 공통 인트로(모든 직업이 공유) — 이건 별개로 기록
    lines += ["", "## 공통 인트로 (모든 직업 공유 — 마무리와 무관)", "",
              "`spawnUltIntroSig` · `cine3d().play` · `spawnUltFlourish` · `playUltLayers` ·",
              "`playUltCinematic` 은 직업 무관 공통 인트로/레이어다. 유저가 지적한",
              "\"뒷부분\"은 **마무리**이므로 이 공통부는 유지한다.", ""]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(lines))

    json.dump(cases, open("/root/.hermes/cache/scratch/deploy/ult_calls.json", "w"),
              ensure_ascii=False, indent=1)

    print(f"\n직업별 호출 수:")
    for k in sorted(cases):
        print(f"  {k:14s} {len(cases[k]):3d}개  마무리: {' → '.join(fin[k]) or '—'}")
    print(f"\n마무리 완전 중복: {len(dup)}쌍")
    for d in dup:
        print(f"  ★ {d[0]} == {d[1]}: {' → '.join(d[2])}")
    print(f"\n저장: {OUT}")


if __name__ == "__main__":
    main()
