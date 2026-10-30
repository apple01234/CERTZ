#!/usr/bin/env python3
"""
unity_move_raw.py — TypeTree 가 stripped 된 Unity 빌드에서 Move(스킬) 값을 raw 파싱

왜 raw 파싱인가
---------------
이 게임의 .assets 는 TypeTree 가 없다(빌드에서 stripped). 그래서 UnityPy 의
read_typetree() 는 m_Name 까지만 돌려주고 커스텀 필드는 못 읽는다.

대신 레이아웃을 정확히 알고 있다:
  REA inspect-managed-members 로 얻은 Move 클래스 선언 순서
    MoveName:string Description:string Type:char(u16) TargetType:i4
    Damage:i4 LeartAtLevel:i4 ScuffCost:i4 isItem:bool(u8)
    SFX:PPtr EffectAppliedToTarget:PPtr EffectAppliedToHost:PPtr Animation:PPtr

MonoBehaviour 직렬화 헤더
    m_GameObject:PPtr(12) m_Enabled:u8+align4 m_Script:PPtr(12) m_Name:string

따라서 m_Name 뒤에서 위 순서대로 읽으면 된다.
문자열 = u32 길이 + UTF-8 + 4바이트 정렬 패딩.
"""
import sys, os, struct, json
import UnityPy

ALIGN = 4


def u32(b, o):
    return struct.unpack_from('<I', b, o)[0]


def i32(b, o):
    return struct.unpack_from('<i', b, o)[0]


def read_string(b, o):
    """Unity string: u32 len + utf8 + pad4. 반환 (문자열, 다음 오프셋)."""
    if o + 4 > len(b):
        raise ValueError("eof")
    ln = u32(b, o)
    if ln > 4096:
        raise ValueError(f"string too long {ln}")
    o += 4
    if o + ln > len(b):
        raise ValueError("eof body")
    s = b[o:o + ln].decode('utf-8', errors='replace')
    o += ln
    pad = (ALIGN - (ln % ALIGN)) % ALIGN
    o += pad
    return s, o


def parse_move(b):
    """MonoBehaviour raw 바이트에서 Move 필드를 꺼낸다."""
    o = 0
    o += 12          # m_GameObject PPtr
    o += 4           # m_Enabled u8 + align4
    o += 12          # m_Script PPtr
    name, o = read_string(b, o)          # m_Name
    move_name, o = read_string(b, o)     # MoveName
    desc, o = read_string(b, o)          # Description
    o += 2                               # Type (char → u16)
    o += 2                               # align4
    target = i32(b, o); o += 4
    damage = i32(b, o); o += 4
    learn = i32(b, o); o += 4
    cost = i32(b, o); o += 4
    o += 1                               # isItem bool
    o += 3                               # align4
    return dict(objectName=name, MoveName=move_name, Description=desc,
                TargetType=target, Damage=damage, LeartAtLevel=learn,
                ScuffCost=cost)


def main():
    base = sys.argv[1]
    # Move 스크립트 path_id 를 MonoScript 에서 찾는다
    env0 = None
    script_ids = set()
    for fn in sorted(os.listdir(base)):
        if not fn.endswith('.assets'):
            continue
        try:
            env = UnityPy.load(os.path.join(base, fn))
        except Exception:
            continue
        for obj in env.objects:
            if obj.type.name != 'MonoScript':
                continue
            try:
                ms = obj.read()
                cls = getattr(ms, 'm_ClassName', None) or getattr(ms, '_m_ClassName', None)
            except Exception:
                continue
            if cls == 'Move':
                script_ids.add((fn, obj.path_id))
                print(f"[Move MonoScript] {fn} path_id={obj.path_id}")

    moves, errors = [], []
    for fn in sorted(os.listdir(base)):
        if not fn.endswith('.assets'):
            continue
        path = os.path.join(base, fn)
        try:
            env = UnityPy.load(path)
        except Exception as e:
            errors.append(f"{fn}: {e}")
            continue
        for obj in env.objects:
            if obj.type.name != 'MonoBehaviour':
                continue
            try:
                raw = obj.get_raw_data()
            except Exception:
                continue
            if raw is None:
                continue
            try:
                rec = parse_move(raw)
            except Exception:
                continue
            # 검증: MoveName 이 비어있지 않은 사람이 읽는 문자열이고,
            # 데미지/코스트가 합리 범위일 때만 Move 로 인정
            n = rec['MoveName'] or ''
            if not (2 <= len(n) <= 40):
                continue
            if not all(32 <= ord(c) < 127 or ord(c) > 0x2000 for c in n):
                continue
            if not (0 <= rec['Damage'] <= 9999):
                continue
            if not (0 <= rec['ScuffCost'] <= 999):
                continue
            if not (0 <= rec['LeartAtLevel'] <= 99):
                continue
            if not (0 <= rec['TargetType'] <= 20):
                continue
            rec['_file'] = fn
            moves.append(rec)

    # 중복 제거(같은 스킬이 여러 프리팹에 복제되는 경우)
    seen, uniq = set(), []
    for m in moves:
        k = (m['MoveName'], m['Damage'], m['ScuffCost'], m['LeartAtLevel'])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(m)
    uniq.sort(key=lambda x: (x['LeartAtLevel'], x['ScuffCost'], -x['Damage']))

    print(f"\nmove-like records: {len(uniq)}")
    if uniq:
        print(f"{'MoveName':26s} {'dmg':>5s} {'lv':>4s} {'cost':>5s} {'tgt':>4s}")
        print('-' * 50)
        for m in uniq:
            print(f"{m['MoveName'][:26]:26s} {m['Damage']:>5d} {m['LeartAtLevel']:>4d} "
                  f"{m['ScuffCost']:>5d} {m['TargetType']:>4d}")
    json.dump({"moves": uniq, "errors": errors},
              open('/root/.hermes/cache/scratch/drive/moves.json', 'w'),
              indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
