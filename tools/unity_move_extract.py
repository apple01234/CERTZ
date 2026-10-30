#!/usr/bin/env python3
"""
unity_move_extract.py — Unity 자산에서 Move(스킬) MonoBehaviour 실측값 추출

REA(inspect-managed-members)로 확인한 Move 클래스 필드 순서:
  MoveName:string  Description:string  Type:char  TargetType:int
  Damage:int  LeartAtLevel:int  ScuffCost:int  isItem:bool
  SFX:PPtr  EffectAppliedToTarget:PPtr  EffectAppliedToHost:PPtr  Animation:PPtr

UnityPy 로 MonoBehaviour 를 읽어 위 필드를 순서대로 꺼낸다.
읽기 실패한 레코드는 버리지 않고 errors 로 보고한다.
"""
import sys, os, json
import UnityPy

MOVE_FIELDS = ["MoveName", "Description", "Type", "TargetType",
               "Damage", "LeartAtLevel", "ScuffCost", "isItem"]


def read_move(obj):
    try:
        tree = obj.read_typetree()
    except Exception as e:
        return None, f"typetree: {e}"
    if not isinstance(tree, dict):
        return None, "typetree not dict"
    if "MoveName" not in tree and "Damage" not in tree:
        return None, "no Move fields"

    def g(k, d=None):
        return tree.get(k, d)

    rec = {
        "MoveName": g("MoveName"),
        "Description": g("Description"),
        "Type": g("Type"),
        "TargetType": g("TargetType"),
        "Damage": g("Damage"),
        "LeartAtLevel": g("LeartAtLevel"),
        "ScuffCost": g("ScuffCost"),
        "isItem": g("isItem"),
    }
    # 최소 검증: 이름이 문자열이고 데미지가 정수
    if not isinstance(rec["MoveName"], str):
        return None, "MoveName not str"
    if not isinstance(rec["Damage"], int):
        return None, "Damage not int"
    return rec, None


def main():
    base = sys.argv[1]
    moves, errors, scanned = [], [], 0
    for fn in sorted(os.listdir(base)):
        if not fn.endswith(".assets"):
            continue
        path = os.path.join(base, fn)
        try:
            env = UnityPy.load(path)
        except Exception as e:
            errors.append(f"{fn}: load {e}")
            continue
        for obj in env.objects:
            if obj.type.name != "MonoBehaviour":
                continue
            scanned += 1
            rec, err = read_move(obj)
            if rec:
                rec["_file"] = fn
                rec["_pathid"] = getattr(obj, "path_id", None)
                moves.append(rec)
            elif err and err not in ("no Move fields",):
                errors.append(f"{fn}#{getattr(obj,'path_id','?')}: {err}")

    print(f"scanned MonoBehaviour: {scanned}")
    print(f"Move records:          {len(moves)}")
    if moves:
        print(f"\n{'MoveName':28s} {'dmg':>5s} {'lv':>4s} {'cost':>5s} {'tgt':>4s} file")
        print("-" * 72)
        for m in sorted(moves, key=lambda x: (x["LeartAtLevel"] or 0, x["ScuffCost"] or 0)):
            print(f"{str(m['MoveName'])[:28]:28s} {m['Damage']:>5d} {m['LeartAtLevel']:>4d} "
                  f"{m['ScuffCost']:>5d} {str(m['TargetType']):>4s} {m['_file']}")
    if errors:
        print(f"\nerrors ({len(errors)}):")
        for e in errors[:10]:
            print("  ", e[:120])
    json.dump({"moves": moves, "errors": errors},
              open("/root/.hermes/cache/scratch/drive/moves.json", "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
