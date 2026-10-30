"""Holo Dungeon — Move ScriptableObject 추출 (Unity 2019.4 raw MonoBehaviour 파싱).

왜 raw 파싱인가
  Unity 2019.4 빌드는 TypeTree 가 stripped 라, UnityPy 의 read_typetree() 가
  m_GameObject/m_Enabled/m_Script/m_Name 만 돌려준다. 필드를 얻으려면
  디컴파일 소스(out_holo/Move.cs)의 선언 순서대로 원시 바이트를 직접 읽어야 한다.

Move 필드 선언 순서 (Move.cs 실측)
  string MoveName; string Description; char Type; int TargetType;
  int Damage; int LeartAtLevel; int ScuffCost; bool isItem;
  PPtr SFX; PPtr EffectAppliedToTarget; PPtr EffectAppliedToHost; PPtr Animation;

확정된 오프셋 (실측)
  +0   m_GameObject.fileID (u32)     +4   m_GameObject.pathID (i64)
  +12  m_Enabled (u8) + align4
  +16  m_Script.fileID (u32)         +20  m_Script.pathID (i64)   ← Move 판별 키
  +28  m_Name      [i32 len][bytes][align4]
       MoveName    [i32 len][bytes][align4]
       Description [i32 len][bytes][align4]
       Type        u16
       **(align4)**   ← 이 패딩을 빠뜨리면 이후 수치가 전부 65536배로 튄다
       TargetType / Damage / LearAtLevel / ScuffCost  (i32 × 4)
       isItem      u8 + align4
       SFX / EffectTarget / EffectHost / Animation    (PPtr 12B × 4)

사용:
  python3 tools/unity_move_extract2.py "<Holo Dungeon_Data 경로>"
출력: 요약 표 + /root/.hermes/cache/scratch/holo_moves.json
"""
import glob
import json
import os
import struct
import sys
from collections import Counter
from pathlib import Path

try:
    import UnityPy
except ImportError:
    print("UnityPy 필요: pip install UnityPy==1.10.18 --break-system-packages")
    sys.exit(1)

OUT_PATH = Path("/root/.hermes/cache/scratch/holo_moves.json")


def rd_str(b, off):
    """Unity 직렬화 문자열: [i32 len][bytes][align4]."""
    if off + 4 > len(b):
        return None, off + 4
    n = struct.unpack_from("<i", b, off)[0]
    if not (0 <= n <= 512) or off + 4 + n > len(b):
        return None, off + 4
    raw = b[off + 4:off + 4 + n]
    off += 4 + n
    off = (off + 3) & ~3
    return raw.decode("utf-8", "replace"), off


def parse_move(b):
    off = 28  # 헤더: m_GameObject(12) + m_Enabled+align(4) + m_Script(12)
    asset, off = rd_str(b, off)
    name, off = rd_str(b, off)
    if not name:
        return None
    desc, off = rd_str(b, off)
    if off + 2 > len(b):
        return None
    typ = struct.unpack_from("<H", b, off)[0]
    off += 2
    off = (off + 3) & ~3  # char 뒤 정렬 — 필수
    if off + 16 > len(b):
        return None
    tt, dmg, lv, scuff = struct.unpack_from("<4i", b, off)
    off += 16
    is_item = b[off] if off < len(b) else 0
    return {
        "asset": asset,
        "name": name,
        "desc": desc,
        "type": chr(typ) if 32 <= typ < 127 else str(typ),
        "targetType": tt,
        "damage": dmg,
        "learnLv": lv,
        "scuffCost": scuff,
        "isItem": bool(is_item),
    }


def find_move_script_pid(data_dir):
    """Move MonoScript 의 pathID 를 찾는다 (보통 globalgamemanagers.assets)."""
    for p in sorted(glob.glob(str(data_dir / "*.assets"))):
        try:
            env = UnityPy.load(p)
        except Exception:
            continue
        for o in env.objects:
            if o.type.name != "MonoScript":
                continue
            try:
                d = o.read()
            except Exception:
                continue
            if getattr(d, "m_ClassName", None) == "Move":
                return o.path_id, Path(p).name
    return None, None


def main():
    data_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "/root/.hermes/cache/scratch/drive/games/holodungeon-windows-1.3.1/"
        "holodungeon-windows-1.3.1/Holo Dungeon_Data"
    )
    if not data_dir.exists():
        print(f"없음: {data_dir}")
        return 1

    tpid, src = find_move_script_pid(data_dir)
    if not tpid:
        print("Move MonoScript 를 찾지 못했습니다.")
        return 1
    print(f"Move MonoScript: {src} pathID={tpid}")

    rows = []
    scanned = 0
    for f in sorted(glob.glob(str(data_dir / "*.assets"))):
        try:
            env = UnityPy.load(f)
        except Exception:
            continue
        for o in env.objects:
            if o.type.name != "MonoBehaviour":
                continue
            scanned += 1
            try:
                raw = o.get_raw_data()
            except Exception:
                continue
            if len(raw) < 28:
                continue
            if struct.unpack_from("<i", raw, 20)[0] != tpid:
                continue
            r = parse_move(raw)
            if r:
                r["src"] = Path(f).name
                rows.append(r)

    print(f"MonoBehaviour 스캔 {scanned:,}개 → Move {len(rows)}개\n")
    if not rows:
        return 1

    print(f"{'MoveName':26s} {'T':>2} {'Tgt':>3} {'Dmg':>5} {'Lv':>4} {'Scuff':>5} {'Item':>5}")
    for r in rows[:34]:
        print(f"{r['name'][:26]:26s} {r['type']:>2} {r['targetType']:>3} {r['damage']:>5} "
              f"{r['learnLv']:>4} {r['scuffCost']:>5} {str(r['isItem']):>5}")
    if len(rows) > 34:
        print(f"... 외 {len(rows)-34}개")

    skills = [r for r in rows if not r["isItem"]]
    dmg = [r["damage"] for r in skills if 0 < r["damage"] < 10000]
    print(f"\n스킬 {len(skills)} / 아이템 {len(rows)-len(skills)}")
    if dmg:
        print(f"데미지 {min(dmg)}~{max(dmg)} (평균 {sum(dmg)/len(dmg):.1f}, n={len(dmg)})")
    print("Type:", dict(Counter(r["type"] for r in rows).most_common(6)))
    print("TargetType:", dict(Counter(r["targetType"] for r in rows).most_common(6)))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n저장: {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
