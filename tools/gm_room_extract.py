"""GameMaker data.win → 맵(ROOM) 구조 추출 — 실측 확정 포맷.

확정된 포맷 (3개 게임에서 검증: Vampire_NoSurvivors / SangTDB / flooded_burials):
  청크   : 'FORM' + total(8B) 뒤 [name 4][size 4][data size] 반복
  STRG   : [count u32][ptr u32 × count][문자열 블록]
           ptr = **절대 파일 오프셋**, 그 지점에 [len u32][bytes]
  ROOM   : [count u32][roomPtr u32 × count]   ← roomPtr 은 **절대 파일 오프셋**
           room@ptr : [nameRef][captionRef][width][height] ... (모두 u32)
           nameRef 는 문자열 **끝**(또는 끝±1)을 가리킨다 → 앞쪽 [len][ascii] 역산.

핵심 함정 (모두 실측으로 확인)
  · STRG ptr 을 "STRG 청크 시작 기준"으로 읽으면 4바이트 어긋나 쓰레기가 나온다.
  · roomPtr 을 "ROOM 청크 시작 기준"으로 읽으면 첫 항목만 우연히 맞는다.
  · nameRef 를 그대로 [len u32] 로 읽으면 안 된다 — 역산해야 한다.

사용:
  python3 tools/gm_room_extract.py <data.win> [...]
출력: 요약 표 + /root/.hermes/cache/scratch/gm_final.json
"""
import json
import struct
import sys
from pathlib import Path

OUT_PATH = Path("/root/.hermes/cache/scratch/gm_final.json")


def load_chunks(path):
    b = Path(path).read_bytes()
    chunks = {}
    off = 8
    order = []
    while off + 8 <= len(b) and len(order) < 64:
        name = b[off:off + 4].decode("latin1", "replace")
        if not name.isprintable():
            break
        size = struct.unpack_from("<I", b, off + 4)[0]
        chunks[name] = (off + 8, size)
        order.append(name)
        off += 8 + size
    return b, chunks


def probe_name(b, ref):
    """nameRef 주변을 훑어 [len u32][ascii] 패턴을 찾아 문자열을 복원한다.

    nameRef 가 문자열 끝을 가리키므로 ref-72 .. ref 범위에서
    'pos + len 이 ref 근처에서 끝나는' 후보 중 가장 긴 것을 고른다.
    """
    best = None
    for pos in range(max(4, ref - 72), ref + 1):
        if pos < 4:
            continue
        ln = struct.unpack_from("<I", b, pos - 4)[0]
        if not (2 <= ln <= 64):
            continue
        s = b[pos:pos + ln]
        if len(s) != ln or not all(32 <= c < 127 for c in s):
            continue
        if pos + ln >= ref - 1 and (best is None or ln > len(best)):
            best = s.decode("ascii")
    return best


def extract(path):
    b, chunks = load_chunks(path)
    if "ROOM" not in chunks:
        return None
    base, _size = chunks["ROOM"]
    n = struct.unpack_from("<I", b, base)[0]
    if n > 5000:
        return None
    ptrs = struct.unpack_from("<%dI" % n, b, base + 4)

    rooms = []
    for i, p in enumerate(ptrs):
        if p + 16 > len(b):
            continue
        name_ref, _cap, w, h = struct.unpack_from("<4I", b, p)
        if not (16 <= w <= 4096 and 16 <= h <= 4096):
            continue
        rooms.append({
            "idx": i,
            "name": probe_name(b, name_ref),
            "w": w, "h": h,
            "tile32": (w // 32) * (h // 32),
        })

    areas = [r["w"] * r["h"] for r in rooms]
    return {
        "game": Path(path).parent.name,
        "size": len(b),
        "roomCount": n,
        "valid": len(rooms),
        "named": sum(1 for r in rooms if r["name"]),
        "maxArea": max(areas) if areas else 0,
        "totalArea": sum(areas),
        "rooms": rooms,
    }


def main():
    paths = sys.argv[1:]
    if not paths:
        print("사용: python3 tools/gm_room_extract.py <data.win> [...]")
        return 1

    results = []
    for t in paths:
        if not Path(t).exists():
            print(f"[SKIP] 없음: {t}")
            continue
        try:
            s = extract(t)
        except Exception as e:
            print(f"[ERR] {t}: {e}")
            continue
        if not s:
            print(f"[SKIP] ROOM 없음/비정상: {t}")
            continue
        results.append(s)
        print(f"\n{'=' * 66}")
        print(f"{s['game']}   {s['size']:,} bytes")
        print(f"  ROOM {s['roomCount']} → 유효 {s['valid']} · 이름 {s['named']}")
        print(f"  최대 {s['maxArea']:,} px² · 합계 {s['totalArea']:,} px²")
        print(f"  {'#':>3} {'이름':26s} {'w':>5} {'h':>5} {'타일':>7}")
        for r in s["rooms"][:15]:
            print(f"  {r['idx']:>3} {(r['name'] or '?')[:26]:26s} "
                  f"{r['w']:>5} {r['h']:>5} {r['tile32']:>7,}")
        if len(s["rooms"]) > 15:
            print(f"  ... 외 {len(s['rooms']) - 15}개")

    if results:
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n저장: {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
