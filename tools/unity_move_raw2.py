#!/usr/bin/env python3
"""
unity_move_raw2.py — Move 스크립트로 바인딩된 MonoBehaviour 만 정확히 골라 스킬 값 추출

앞선 버전(unity_move_raw.py)은 모든 MonoBehaviour 에 Move 레이아웃을 적용해
숫자 쓰레기(정수 필드가 m_Name 자리에 오는 다른 타입)를 대량 포함했다.

이 버전은 m_Script PPtr 의 path_id 가 Move MonoScript 의 path_id 와 일치하는
오브젝트만 읽는다. 이게 정확한 바인딩 조건이다.
"""
import sys, os, struct, json
import UnityPy

MOVE_SCRIPT_PATH_IDS = set()


def u32(b, o): return struct.unpack_from('<I', b, o)[0]
def i32(b, o): return struct.unpack_from('<i', b, o)[0]


def read_string(b, o):
    ln = u32(b, o)
    if ln > 8192:
        raise ValueError(f"len {ln}")
    o += 4
    if o + ln > len(b):
        raise ValueError("eof")
    s = b[o:o + ln].decode('utf-8', errors='replace')
    o += ln
    o += (4 - (ln % 4)) % 4
    return s, o


def parse_move(b):
    o = 12 + 4 + 12          # m_GameObject, m_Enabled+align, m_Script
    name, o = read_string(b, o)       # m_Name
    move_name, o = read_string(b, o)  # MoveName
    desc, o = read_string(b, o)       # Description
    o += 4                            # Type(char u16 + align)
    target = i32(b, o); o += 4
    damage = i32(b, o); o += 4
    learn = i32(b, o); o += 4
    cost = i32(b, o); o += 4
    return dict(objectName=name, MoveName=move_name, Description=desc,
                TargetType=target, Damage=damage, LeartAtLevel=learn,
                ScuffCost=cost)


def script_id_of(raw):
    """m_Script PPtr 의 m_PathID.

    MonoBehaviour 직렬화 헤더: PPtr = m_FileID(i32 4B) + m_PathID(i64 8B)
      offset 0  : m_GameObject.fileID
      offset 4  : m_GameObject.pathID (8B)
      offset 12 : m_Enabled (u8) + align4
      offset 16 : m_Script.fileID   ← 4바이트
      offset 20 : m_Script.pathID   ← 여기가 스크립트 식별자 (하위 32비트)
    """
    return struct.unpack_from('<i', raw, 20)[0]


def main():
    base = sys.argv[1]
    # 1) Move MonoScript path_id 수집
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
                MOVE_SCRIPT_PATH_IDS.add(obj.path_id)
                print(f"[Move MonoScript] {fn} path_id={obj.path_id}")
    if not MOVE_SCRIPT_PATH_IDS:
        print("Move MonoScript 를 찾지 못했습니다.")
        return

    moves, matched, total_mb = [], 0, 0
    for fn in sorted(os.listdir(base)):
        if not fn.endswith('.assets'):
            continue
        try:
            env = UnityPy.load(os.path.join(base, fn))
        except Exception:
            continue
        for obj in env.objects:
            if obj.type.name != 'MonoBehaviour':
                continue
            total_mb += 1
            try:
                raw = obj.get_raw_data()
            except Exception:
                continue
            if not raw or len(raw) < 40:
                continue
            try:
                sid = script_id_of(raw)
            except Exception:
                continue
            if sid not in MOVE_SCRIPT_PATH_IDS:
                continue
            matched += 1
            try:
                rec = parse_move(raw)
            except Exception:
                continue
            rec['_file'] = fn
            moves.append(rec)

    seen, uniq = set(), []
    for m in moves:
        k = (m['MoveName'], m['Damage'], m['ScuffCost'], m['LeartAtLevel'])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(m)
    uniq.sort(key=lambda x: (x['ScuffCost'], x['LeartAtLevel'], -x['Damage']))

    print(f"\nMonoBehaviour total={total_mb}  Move-bound={matched}  unique={len(uniq)}")
    print(f"{'MoveName':26s} {'dmg':>5s} {'lv':>4s} {'cost':>5s} {'tgt':>4s}")
    print('-' * 50)
    for m in uniq:
        print(f"{m['MoveName'][:26]:26s} {m['Damage']:>5d} {m['LeartAtLevel']:>4d} "
              f"{m['ScuffCost']:>5d} {m['TargetType']:>4d}")
    json.dump(uniq, open('/root/.hermes/cache/scratch/drive/moves_bound.json', 'w'),
              indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
