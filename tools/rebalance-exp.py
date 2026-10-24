#!/usr/bin/env python3
"""적 EXP 재배분 — HP/EXP 비율 수렴 + 총합 보존

사용법: python3 tools/rebalance-exp.py [--apply]
  (--apply 없으면 계획만 출력)

왜 필요한가:
  적마다 HP 대비 주는 EXP가 달라서, 같은 시간 사냥해도 효율이 2배 차이 났다
  (실측: HP/EXP 1.55~3.33, 편차 2.15배). 유저는 효율 좋은 한 사냥터에만 붙는다.

왜 총합을 보존하는가:
  EXP 총합이 늘면 전체 레벨업 곡선이 빨라져 expTable.ts의 설계와 어긋난다.
  그래서 비율만 고르게 하고 총량은 원래대로 되돌린다(배율 보정 + 반올림 오차 흡수).
"""
import re, sys, statistics

PATH = "src/game/stages.ts"
PAT = (r'key: "(\w+)", name: "([^"]+)", hp: (\d+), atk: (\d+), speed: (\d+), '
       r'aggro: (\d+), exp: (\d+), gold: \[(\d+), (\d+)\]')


def main(apply: bool):
    s = open(PATH, encoding="utf-8").read()
    rows = []
    for m in re.finditer(PAT, s):
        k, name, hp, atk, spd, agg, exp, g0, g1 = m.groups()
        rows.append(dict(key=k, name=name, hp=int(hp), atk=int(atk),
                         spd=int(spd), agg=int(agg), exp=int(exp), g0=g0, g1=g1))
    if not rows:
        sys.exit("적 데이터를 찾지 못했습니다")

    base = statistics.median(r["hp"] / r["exp"] for r in rows)
    total = sum(r["exp"] for r in rows)

    targets = {r["key"]: max(1, round(r["hp"] / base)) for r in rows}
    scale = total / sum(targets.values())
    final = {k: max(1, round(v * scale)) for k, v in targets.items()}

    # 반올림 오차를 가장 큰 항목에서 흡수해 총합을 정확히 일치시킨다
    diff = total - sum(final.values())
    if diff:
        kmax = max(final, key=lambda k: final[k])
        final[kmax] = max(1, final[kmax] + diff)

    changes = [(r["key"], r["exp"], final[r["key"]]) for r in rows if final[r["key"]] != r["exp"]]
    ratios = [r["hp"] / final[r["key"]] for r in rows]
    before = [r["hp"] / r["exp"] for r in rows]

    print(f"기준 HP/EXP = {base:.2f} (중앙값)")
    print(f"총합 보존: {total} → {sum(final.values())}")
    print(f"편차: {max(before)/min(before):.2f}배 → {max(ratios)/min(ratios):.2f}배")
    print(f"변경 {len(changes)}종")
    for k, a, b in sorted(changes, key=lambda x: -abs(x[2] - x[1]))[:12]:
        print(f"  {k:18s} {a:4d} → {b:4d} ({b-a:+d})")

    if not apply:
        print("\n(--apply 로 실제 반영)")
        return

    def repl(m):
        k, name, hp, atk, spd, agg, exp, g0, g1 = m.groups()
        new = final[k]
        return (f'key: "{k}", name: "{name}", hp: {hp}, atk: {atk}, speed: {spd}, '
                f'aggro: {agg}, exp: {new}, gold: [{g0}, {g1}]')

    open(PATH, "w", encoding="utf-8").write(re.sub(PAT, repl, s))
    print("\n반영 완료")


if __name__ == "__main__":
    main("--apply" in sys.argv)
