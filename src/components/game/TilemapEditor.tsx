"use client";

/**
 * 타일맵 에디터 (지시: "타일맵 에디터 마저 만들어").
 *
 * [설계 원칙]
 *  ① **게임과 같은 로직** — 타일 gid·프롭 배율·격자 스냅·충돌 판정을
 *     `tilemapEditorCore` 에서 가져온다. 에디터에서 본 모습이 게임과 다르면 의미가 없다.
 *  ② **의존성 0** — canvas 2D + React 만 쓴다. Phaser 를 띄우지 않으므로
 *     편집 중 게임 루프·물리·에셋 로딩이 끼어들지 않는다(빠르고 예측 가능).
 *  ③ **검증 내장** — 저장 전에 `validateLayout` 으로 도달 불가 방·막힌 입출구를 잡는다.
 *  ④ **실행 취소** — 모든 편집은 히스토리에 쌓인다(최대 40). 잘못 찍은 벽을 되돌린다.
 *
 * [조작]
 *  좌클릭/드래그 = 칠하기, 우클릭/드래그 = 지우기
 *  도구: 벽 / 길 / 프롭 / 입구 / 출구
 *  Ctrl+Z 실행취소, Ctrl+S 저장(JSON 내려받기)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GROUND_PALETTE, GROUND_SOURCES, GROUND_ROLES,
  createLayout, validateLayout, serializeLayout, deserializeLayout,
  buildLayerData, snapPropScale, propIsSolid,
  type EditorLayerRole, type PropKey, type SavedLayout,
} from "@/game/tilemapEditorCore";
import { groundAtlasOf } from "@/game/tileThemes";

/* ─────────────────────────── 상수 ─────────────────────────── */

const CELL = 36;               // 화면상 셀 크기(px) — 확대/축소는 이 값을 바꾼다
const MIN_ZOOM = 14, MAX_ZOOM = 80;
const HISTORY_MAX = 40;

type Tool = "wall" | "path" | "prop" | "entry" | "exit";

/** 프롭 목록 — 실제 존재하는 에셋만(public/assets). */
const PROPS: PropKey[] = [
  "obj_dungeon_torch", "obj_dungeon_chest", "obj_dungeon_bookshelf", "obj_dungeon_barrel",
  "obj_dungeon_table", "obj_dungeon_throne", "obj_dungeon_anvil", "obj_dungeon_pentagram",
  "obj_dungeon_candle", "obj_dungeon_carpet_v", "obj_dungeon_sign", "obj_dungeon_fence",
  "obj_dungeon_grave", "obj_dungeon_jar", "obj_dungeon_rock_small", "obj_dungeon_stump",
  "obj_dungeon_tree_dead",
  "obj_forest_tree_pink", "obj_forest_tree_orange", "obj_forest_tree_dried",
  "obj_forest_bush", "obj_forest_bush_tall", "obj_forest_rock", "obj_forest_rock_monument",
  "obj_forest_trunk", "obj_forest_sign",
  "obj_town_house_blue", "obj_town_shop_black", "obj_town_stall_stripe", "obj_town_bench",
  "obj_town_barrel", "obj_town_planter", "obj_town_vending", "obj_town_waterfall",
];

/** 테마 프리셋 — `authoredLayouts.THEMES` 와 동일한 조합을 노출한다. */
const THEME_PRESETS = [
  { theme: "library", label: "도서관", ground: "ground_ash", path: "ground_slate", structure: "ground_cavern" },
  { theme: "coast", label: "해안", ground: "ground_sand", path: "ground_dirt", structure: "ground_slate" },
  { theme: "grove", label: "숲", ground: "ground_meadow", path: "ground_dirt", structure: "ground_forest" },
  { theme: "citadel", label: "성채", ground: "ground_ash", path: "ground_violet", structure: "ground_slate" },
  { theme: "town", label: "마을", ground: "ground_meadow", path: "ground_dirt", structure: "ground_ash" },
  { theme: "ruins", label: "폐허", ground: "ground_forest", path: "ground_ash", structure: "ground_cavern" },
  { theme: "conduit", label: "수로", ground: "ground_slate", path: "ground_ash", structure: "ground_violet" },
  { theme: "arena", label: "투기장", ground: "ground_slate", path: "ground_ash", structure: "ground_cavern" },
];

const TIPS = [
  "좌클릭 드래그=칠하기 · 우클릭=지우기",
  "Ctrl+Z 실행취소 · Ctrl+S 저장",
  "입구/출구는 반드시 개방 셀에",
];

/* ─────────────────────────── 상태 타입 ─────────────────────────── */

type Prop = { key: string; cell: number; x: number; y: number; scale: number };

type EdState = {
  cols: number; rows: number; cellW: number; cellH: number;
  open: boolean[]; paths: boolean[];
  entry: number; exit: number;
  theme: string; ground: string; path: string; structure: string; structureTint: number;
  props: Prop[];
};

const clone = (s: EdState): EdState => ({
  ...s,
  open: [...s.open], paths: [...s.paths],
  props: s.props.map((p) => ({ ...p })),
});

export default function TilemapEditor() {
  /* 씬은 15×9 로 시작한다 — 실제 스토리 룸과 같은 규모 */
  const initial = useMemo<EdState>(() => {
    const base = createLayout(15, 9);
    const preset = THEME_PRESETS[0];
    return {
      ...base,
      theme: preset.theme,
      ground: preset.ground, path: preset.path, structure: preset.structure,
      structureTint: 0x967958,
      props: [],
    };
  }, []);

  const [sc, setSc] = useState<EdState>(initial);
  const [tool, setTool] = useState<Tool>("wall");
  const [zoom, setZoom] = useState(CELL);
  const [propKey, setPropKey] = useState<PropKey>("obj_dungeon_torch");
  const [layer, setLayer] = useState<EditorLayerRole>("ground");
  const [status, setStatus] = useState<string>("");
  const [showProps, setShowProps] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const history = useRef<EdState[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const painting = useRef<null | "add" | "del">(null);

  const pushHistory = useCallback((snap: EdState) => {
    history.current.push(clone(snap));
    if (history.current.length > HISTORY_MAX) history.current.shift();
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) { setSc(prev); setStatus("실행취소"); }
    else setStatus("되돌릴 작업이 없습니다");
  }, []);

  /* ── 편집 ── */
  const setCell = useCallback((cell: number, on: boolean) => {
    setSc((prev) => {
      const next = clone(prev);
      if (tool === "path") next.paths[cell] = on;
      else if (tool === "wall") {
        next.open[cell] = on;
        /* 벽으로 만들면 그 위 프롭은 제거 — 벽 안에 뜬 오브젝트 방지 */
        if (!on) next.props = next.props.filter((p) => p.cell !== cell);
      } else if (tool === "entry" && on) {
        next.open[cell] = true;
        next.entry = cell;
      } else if (tool === "exit" && on) {
        next.open[cell] = true;
        next.exit = cell;
      }
      return next;
    });
  }, [tool]);

  const paint = useCallback((cell: number, mode: "add" | "del") => {
    if (cell < 0) return;
    if (tool === "entry" || tool === "exit") { if (mode === "add") setCell(cell, true); return; }
    setCell(cell, mode === "add");
  }, [setCell, tool]);

  /* 프롭 놓기 */
  const placeProp = useCallback((cell: number) => {
    setSc((prev) => {
      if (!prev.open[cell]) { setStatus("벽 위에는 프롭을 놓을 수 없습니다"); return prev; }
      /* 같은 셀의 기존 프롭은 교체 — 겹침 방지 */
      const next = clone(prev);
      next.props = next.props.filter((p) => p.cell !== cell);
      const c = cell % prev.cols, r = Math.floor(cell / prev.cols);
      next.props.push({
        key: propKey,
        cell,
        x: (c + 0.5) * prev.cellW,
        y: (r + 0.5) * prev.cellH,
        scale: 1,
      });
      return next;
    });
    setStatus(`프롭 배치: ${propKey}`);
  }, [propKey]);

  /* ── 캔버스 렌더 ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = sc.cols * zoom, H = sc.rows * zoom;
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    /* 레이어별 타일 데이터를 게임과 같은 함수로 계산 */
    const cw = sc.cellW, ch = sc.cellH;
    const lay = { cols: sc.cols, rows: sc.rows, cellW: cw, cellH: ch, open: sc.open, paths: sc.paths };
    const roleKey = layer === "ground" ? sc.ground : layer === "paths" ? sc.path : sc.structure;
    const atlas = groundAtlasOf(roleKey);
    const data = buildLayerData(lay, layer, roleKey, atlas ? 4 : 0);
    const src = GROUND_SOURCES[roleKey];

    /* 배경(체커) */
    for (let r = 0; r < sc.rows; r++) {
      for (let c = 0; c < sc.cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#1a1d24" : "#15181e";
        ctx.fillRect(c * zoom, r * zoom, zoom, zoom);
      }
    }
    /* 바닥색 힌트 — 텍스처를 못 그리는 환경에서도 지형이 읽히게 */
    const tone: Record<EditorLayerRole, string> = {
      ground: "#2b3440", paths: "#4a3f2c", structures: "#3a2f3f",
    };

    if (!src || !data) {
      /* 규격 미상 — 색으로 대체 */
      for (let r = 0; r < sc.rows; r++) {
        for (let c = 0; c < sc.cols; c++) {
          if (!sc.open[r * sc.cols + c]) continue;
          ctx.fillStyle = tone[layer];
          ctx.fillRect(c * zoom, r * zoom, zoom, zoom);
        }
      }
    } else {
      /* 시뮬레이션: unit 타일을 셀 격자에 그린다(축소 표시) */
      const unitX = (src.unit / cw) * zoom;
      const unitY = (src.unit / ch) * zoom;
      for (let r = 0; r < data.rows; r++) {
        for (let c = 0; c < data.cols; c++) {
          const gid = data.data[r][c];
          if (gid < 0) continue;
          const base = (gid - 1) % (src.size / src.unit);
          const v = Math.floor((gid - 1) / (src.size / src.unit));
          ctx.fillStyle = shade(tone[layer], base, v);
          ctx.fillRect(c * unitX, r * unitY, Math.ceil(unitX), Math.ceil(unitY));
        }
      }
    }

    /* 벽 */
    for (let r = 0; r < sc.rows; r++) {
      for (let c = 0; c < sc.cols; c++) {
        if (sc.open[r * sc.cols + c]) continue;
        ctx.fillStyle = "#0b0d11";
        ctx.fillRect(c * zoom, r * zoom, zoom, zoom);
        ctx.strokeStyle = "#00000055";
        ctx.strokeRect(c * zoom + 0.5, r * zoom + 0.5, zoom - 1, zoom - 1);
      }
    }
    /* 길 */
    for (let r = 0; r < sc.rows; r++) {
      for (let c = 0; c < sc.cols; c++) {
        if (!sc.paths[r * sc.cols + c]) continue;
        ctx.fillStyle = "#a8853a33";
        ctx.fillRect(c * zoom, r * zoom, zoom, zoom);
      }
    }
    /* 프롭 */
    if (showProps) {
      for (const p of sc.props) {
        const c = p.cell % sc.cols, r = Math.floor(p.cell / sc.cols);
        const s = snapPropScale(64, 64, 1, cw, ch, p.key);  // 대표 크기(원본 규격과 무관하게 셀 기준)
        const size = Math.min(zoom * 1.4, zoom * s * 1.2);
        const x = c * zoom + zoom / 2, y = r * zoom + zoom / 2;
        ctx.fillStyle = propIsSolid(p.key) ? "#e0894f" : "#6fb3d2";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3, size / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#00000088";
        ctx.stroke();
        /* 충돌 프롭은 십자 표시 */
        if (propIsSolid(p.key)) {
          ctx.strokeStyle = "#00000066";
          ctx.beginPath();
          ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
          ctx.stroke();
        }
      }
    }
    /* 입구/출구 */
    const mark = (cell: number, color: string, label: string) => {
      if (cell < 0) return;
      const c = cell % sc.cols, r = Math.floor(cell / sc.cols);
      ctx.fillStyle = color;
      ctx.fillRect(c * zoom + 2, r * zoom + 2, zoom - 4, zoom - 4);
      ctx.fillStyle = "#04060a";
      ctx.font = `bold ${Math.max(9, zoom * 0.34)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, c * zoom + zoom / 2, r * zoom + zoom / 2);
    };
    mark(sc.entry, "#7fe3a1", "IN");
    mark(sc.exit, "#ff9d7f", "OUT");

    /* 격자 */
    if (showGrid) {
      ctx.strokeStyle = "#ffffff14";
      ctx.lineWidth = 1;
      for (let c = 0; c <= sc.cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * zoom + 0.5, 0); ctx.lineTo(c * zoom + 0.5, H); ctx.stroke();
      }
      for (let r = 0; r <= sc.rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * zoom + 0.5); ctx.lineTo(W, r * zoom + 0.5); ctx.stroke();
      }
    }
  }, [sc, zoom, layer, showGrid, showProps]);

  /* ── 포인터 ── */
  const cellAt = useCallback((e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / zoom);
    const r = Math.floor((e.clientY - rect.top) / zoom);
    if (c < 0 || r < 0 || c >= sc.cols || r >= sc.rows) return -1;
    return r * sc.cols + c;
  }, [zoom, sc.cols, sc.rows]);

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cell = cellAt(e);
    if (cell < 0) return;
    pushHistory(sc);
    if (tool === "prop") {
      if (e.button === 2) {
        setSc((p) => ({ ...clone(p), props: p.props.filter((x) => x.cell !== cell) }));
        setStatus("프롭 제거");
      } else placeProp(cell);
      return;
    }
    painting.current = e.button === 2 ? "del" : "add";
    paint(cell, painting.current);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return;
    const cell = cellAt(e);
    if (cell >= 0) paint(cell, painting.current);
  };
  const onUp = () => { painting.current = null; };

  /* 저장 — 단축키(Ctrl+S)에서도 참조하므로 선언을 effect 앞에 둔다. */
  const save = useCallback(() => {
    const json = serializeLayout({ ...sc, props: sc.props, name: `map_${Date.now()}` });
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sertz-map-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`저장 완료 · 개방 ${sc.open.filter(Boolean).length}칸 · 프롭 ${sc.props.length}개`);
  }, [sc]);

  /* ── 단축키 ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, save]);

  /* ── 검증/저장/불러오기 ── */
  const check = useMemo(() => validateLayout(sc), [sc]);

  const load = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const parsed = deserializeLayout(JSON.parse(String(rd.result)));
        if (!parsed) { setStatus("불러오기 실패 — 형식이 맞지 않습니다"); return; }
        pushHistory(sc);
        setSc({ ...parsed, props: parsed.props as Prop[] });
        setStatus(`불러옴: ${f.name}`);
      } catch { setStatus("불러오기 실패 — JSON 오류"); }
    };
    rd.readAsText(f);
  };

  /* ── 새 맵 ── */
  const newMap = (cols: number, rows: number) => {
    pushHistory(sc);
    const base = createLayout(cols, rows);
    const preset = THEME_PRESETS.find((t) => t.theme === sc.theme) ?? THEME_PRESETS[0];
    setSc({
      ...base, theme: preset.theme,
      ground: preset.ground, path: preset.path, structure: preset.structure,
      structureTint: sc.structureTint, props: [],
    });
    setStatus(`새 맵 ${cols}×${rows}`);
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-[#0b0d12] text-[#cfd6e4]">
      {/* 상단 바 */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[13px] font-black tracking-wide text-amber-200">SERTZ 맵 에디터</span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
          {sc.cols}×{sc.rows} · {sc.cellW.toFixed(0)}×{sc.cellH.toFixed(0)}px
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => newMap(15, 9)} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">새 15×9</button>
          <button onClick={() => newMap(20, 12)} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">새 20×12</button>
          <label className="cursor-pointer rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">
            불러오기<input type="file" accept=".json" onChange={load} className="hidden" />
          </label>
          <button onClick={save} className="rounded border border-amber-300/50 bg-amber-400/15 px-2 py-1 text-[11px] font-bold text-amber-100 hover:bg-amber-400/25">저장</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 좌: 도구 */}
        <aside className="flex w-[168px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/10 p-2">
          <Section title="도구">
            <div className="grid grid-cols-2 gap-1">
              {([["wall", "벽"], ["path", "길"], ["prop", "프롭"], ["entry", "입구"], ["exit", "출구"]] as [Tool, string][]).map(([t, label]) => (
                <button key={t} onClick={() => setTool(t)}
                  className={`rounded px-2 py-1.5 text-[11px] font-bold ${tool === t ? "bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/50" : "bg-white/5 hover:bg-white/10"}`}>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="레이어">
            <div className="grid grid-cols-1 gap-1">
              {GROUND_ROLES.map((r) => (
                <button key={r.name} onClick={() => setLayer(r.name)}
                  className={`rounded px-2 py-1 text-[11px] ${layer === r.name ? "bg-sky-400/20 text-sky-100 ring-1 ring-sky-300/40" : "bg-white/5 hover:bg-white/10"}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </Section>

          {tool === "prop" && (
            <Section title="프롭 선택">
              <select value={propKey} onChange={(e) => setPropKey(e.target.value as PropKey)}
                className="w-full rounded border border-white/15 bg-[#151922] px-1.5 py-1 text-[10px]">
                {PROPS.map((k) => <option key={k} value={k}>{k.replace(/^obj_/, "")}</option>)}
              </select>
              <p className="mt-1 text-[9px] leading-tight text-white/40">
                주황=충돌 · 파랑=장식
              </p>
            </Section>
          )}

          <Section title="테마">
            <select value={sc.theme}
              onChange={(e) => {
                const p = THEME_PRESETS.find((t) => t.theme === e.target.value);
                if (!p) return;
                pushHistory(sc);
                setSc((prev) => ({ ...prev, theme: p.theme, ground: p.ground, path: p.path, structure: p.structure }));
              }}
              className="w-full rounded border border-white/15 bg-[#151922] px-1.5 py-1 text-[10px]">
              {THEME_PRESETS.map((t) => <option key={t.theme} value={t.theme}>{t.label}</option>)}
            </select>
          </Section>

          <Section title="확대">
            <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-[9px] text-white/40">
              <span>{MIN_ZOOM}</span><span>{zoom}px</span><span>{MAX_ZOOM}</span>
            </div>
          </Section>

          <Section title="표시">
            <label className="flex items-center gap-1.5 text-[10px]">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> 격자
            </label>
            <label className="flex items-center gap-1.5 text-[10px]">
              <input type="checkbox" checked={showProps} onChange={(e) => setShowProps(e.target.checked)} /> 프롭
            </label>
          </Section>

          <button onClick={undo} className="mt-auto rounded border border-white/15 px-2 py-1.5 text-[11px] hover:bg-white/10">
            실행취소 <span className="text-white/40">Ctrl+Z</span>
          </button>
        </aside>

        {/* 중앙: 캔버스 */}
        <main className="min-h-0 flex-1 overflow-auto p-3">
          <canvas ref={canvasRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            onContextMenu={(e) => e.preventDefault()}
            className="rounded border border-white/10 shadow-2xl"
            style={{ touchAction: "none", cursor: "crosshair" }}
          />
          <p className="mt-2 text-[10px] text-white/35">{TIPS.join("　·　")}</p>
          {status && <p className="mt-1 text-[11px] text-amber-200/80">{status}</p>}
        </main>

        {/* 우: 검증 */}
        <aside className="w-[210px] shrink-0 overflow-y-auto border-l border-white/10 p-2">
          <Section title="검증">
            <div className={`rounded px-2 py-1.5 text-[11px] font-bold ${check.ok ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>
              {check.ok ? "통행 가능" : `문제 ${check.errors.length}건`}
            </div>
            {check.errors.map((e, i) => (
              <p key={i} className="mt-1 rounded bg-rose-500/10 px-1.5 py-1 text-[10px] leading-tight text-rose-200">{e}</p>
            ))}
            {check.warnings.map((w, i) => (
              <p key={i} className="mt-1 rounded bg-amber-500/10 px-1.5 py-1 text-[10px] leading-tight text-amber-200">{w}</p>
            ))}
          </Section>

          <Section title="통계">
            <Row k="개방 셀" v={String(sc.open.filter(Boolean).length)} />
            <Row k="벽 셀" v={String(sc.open.filter((v) => !v).length)} />
            <Row k="길 셀" v={String(sc.paths.filter(Boolean).length)} />
            <Row k="프롭" v={String(sc.props.length)} />
            <Row k="충돌 프롭" v={String(sc.props.filter((p) => propIsSolid(p.key)).length)} />
          </Section>

          <Section title="프롭 목록">
            {sc.props.length === 0 && <p className="text-[10px] text-white/35">없음</p>}
            <div className="max-h-[220px] space-y-0.5 overflow-y-auto">
              {sc.props.map((p, i) => (
                <div key={`${p.key}-${p.cell}-${i}`} className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${propIsSolid(p.key) ? "bg-orange-400" : "bg-sky-400"}`} />
                  <span className="truncate">{p.key.replace("obj_dungeon_", "").replace("obj_forest_", "").replace("obj_town_", "")}</span>
                  <button onClick={() => {
                    pushHistory(sc);
                    setSc((prev) => ({ ...clone(prev), props: prev.props.filter((_, j) => j !== i) }));
                  }} className="ml-auto shrink-0 text-rose-300/70 hover:text-rose-200">×</button>
                </div>
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

/* ─────────────────────────── 소품 ─────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/35">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-[10px] text-white/60">
      <span>{k}</span><span className="font-bold text-white/85">{v}</span>
    </div>
  );
}

/** 타일 색 근사 — 실제 텍스처 없이도 레이어 구조가 읽히게 하는 시각 보조. */
function shade(base: string, piece: number, variant: number): string {
  const h = base.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const d = ((piece * 17 + variant * 29) % 21) - 10;
  const cl = (x: number) => Math.max(0, Math.min(255, x + d));
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}
