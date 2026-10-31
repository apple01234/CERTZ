"""vc209 — setupInput() 분해 헬퍼.

원칙
  · 원본 블록(lines[a:b])만 잘라 메서드로 옮긴다.
  · 치환은 **블록 내부에서만** 한다 (파일 전체 replace 금지 — 다른 리스너를 망친다).
  · 리스너 참조는 필드로 승격하고, on/off 호출부는 따로 정확한 이벤트명으로 고친다.

사용:
  python3 tools/split_setup_input.py trade
  python3 tools/split_setup_input.py season
  python3 tools/split_setup_input.py barga
"""
import re
import sys
from pathlib import Path

P = Path("/root/workspace/CERTZ/src/game/scenes/WorldScene.ts")
KEY_ANCHOR = "  /** 액션에 배정된 키 객체 (키 매핑 v1.9) */"


def read():
    return P.read_text(encoding="utf-8").split("\n")


def write(lines):
    P.write_text("\n".join(lines), encoding="utf-8")


def find_block(lines, start_marker, end_pred):
    """start_marker 를 포함한 줄부터 end_pred 를 만족하는 줄까지 (1-index 반환)."""
    start = None
    for i, l in enumerate(lines):
        if start_marker in l:
            start = i
            break
    if start is None:
        raise SystemExit(f"시작 마커 없음: {start_marker}")
    for j in range(start, min(start + 800, len(lines))):
        if end_pred(lines[j], j):
            return start, j
    raise SystemExit("끝 마커 없음")


def listener_names(block):
    return [m.group(1) for l in block
            for m in [re.match(r"^    const (on\w+) = ", l)] if m]


def extract(name, method_name, field_anchor, doc):
    lines = read()
    if name == "trade":
        s, e = find_block(
            lines,
            "vc142 (#3) — 1:1 플레이어 거래 ====",
            lambda l, j: l.strip() == 'EventBus.on("rpg:tradeAct", onTradeAct as never);',
        )
    elif name == "season":
        s, e = find_block(
            lines,
            "v4.5.0 — 시즌 패스/구독/광고 확장 (BM 표준화)",
            lambda l, j: l.strip() == "};" and "onAdDrop" not in l and j > 0,
        )
        # onAdDrop 정의의 끝까지만 (다음 구획 주석 직전)
        while "v4.0.0 — 바르가" not in lines[e + 1] and e + 1 < len(lines) - 1:
            # 첫 '};' 이후 계속 진행되면 이미 지나친 것 → 되돌리기
            break
    elif name == "barga":
        s, e = find_block(
            lines,
            "v4.0.0 — 바르가 시스템 커맨드",
            lambda l, j: "v3.0.15 신규 리스너 ===" in l,
        )
        e -= 1  # 주석 줄 제외
    else:
        raise SystemExit("알 수 없는 구획")

    block = lines[s:e + 1]
    names = listener_names(block)
    if not names:
        raise SystemExit("리스너를 찾지 못함 — 경계 확인 필요")

    # --- 블록 내부만 const → this. 치환 ---
    new_block = []
    for l in block:
        m = re.match(r"^    const (on\w+) = ", l)
        if m:
            l = l.replace(f"const {m.group(1)} = ", f"this.{m.group(1)} = ", 1)
        new_block.append(l)

    # --- 원본 교체 ---
    call = f"    this.{method_name}();"
    out = lines[:s] + [call] + lines[e + 1:]

    # --- 필드 선언 추가 (이미 있으면 건너뜀) ---
    src = "\n".join(out)
    field_txt = f"\n  /* vc209 (#ponytail Must #1) — {name} 리스너 참조 ({method_name} 분리) */"
    for n in names:
        field_txt += f"\n  private {n}?: (...args: never[]) => unknown;"
    if f"private {names[0]}?:" not in src:
        if field_anchor not in src:
            raise SystemExit(f"필드 앵커 없음: {field_anchor}")
        src = src.replace(field_anchor, field_anchor + field_txt, 1)

    # --- 메서드 삽입 ---
    method = (f"\n  /** {doc}\n   *  setupInput() 분해 구획 — 동작 변경 0, 순수 이동. */\n"
              f"  private {method_name}() {{\n" + "\n".join(new_block) + "\n  }\n")
    if KEY_ANCHOR not in src:
        raise SystemExit("메서드 앵커 없음")
    src = src.replace(KEY_ANCHOR, method + "\n" + KEY_ANCHOR, 1)

    P.write_text(src, encoding="utf-8")
    print(f"[{name}] {len(block)}줄 추출, 리스너 {len(names)}개 → this.{method_name}();")
    for n in names:
        print(f"    {n}")
    return names


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "trade":
        extract("trade", "wireTradeInput", "  impactFX!: ImpactFX;",
                "1:1 플레이어 거래 배선.")
    elif arg == "season":
        extract("season", "wireSeasonShop", "  private onTradeAct?:",
                "시즌패스/구독/광고 배선.")
    elif arg == "barga":
        extract("barga", "wireBargaCommands", "  private onAdDrop?:",
                "바르가 시스템 커맨드 배선.")
    else:
        print(__doc__)
