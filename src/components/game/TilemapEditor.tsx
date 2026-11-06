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
  type EditorLayerRole, type SavedLayout,
} from "@/game/tilemapEditorCore";
import { groundAtlasOf } from "@/game/tileThemes";
import { HOWLRSTONE_CHAPTERS } from "@/game/howlrstone";
import { EDITOR_ASSETS } from "@/game/editorAssetManifest";
import AssetBrowser, { type ImportedAsset } from "./AssetBrowser";

/* ─────────────────────────── 상수 ─────────────────────────── */

const CELL = 36;               // 화면상 셀 크기(px) — 확대/축소는 이 값을 바꾼다
const MIN_ZOOM = 14, MAX_ZOOM = 80;
const HISTORY_MAX = 40;

type Tool = "wall" | "path" | "prop" | "entry" | "exit";

/**
 * 반영 가능한 스테이지 시드 — `authoredLayouts` 가 실제로 인식하는 키만.
 *
 * [vc236] 종전엔 이 목록을 손으로 적어 두었고, howlrstone 9장까지만 있어
 *  10~15장은 에디터에서 아예 고를 수 없었다(코드가 아니라 목록이 낡아서 생긴 누락).
 *  이제 `HOWLRSTONE_CHAPTERS` 의 `stages`(챕터별 실제 구역 수)에서 **유도**한다 —
 *  챕터를 늘리면 에디터 목록도 자동으로 따라온다.
 *
 * [중요] 게임은 `howlrstone{장}x{구역}` 형식만 authored 로 처리한다.
 *  목록에 없는 seed 를 저장하면 게임이 무시하므로, 반영 가능한 것만 노출한다.
 */
const STAGE_SEEDS: { seed: string; label: string }[] = HOWLRSTONE_CHAPTERS.flatMap((c) => {
  const no = Number(c.key.replace("howlrstone", ""));
  return Array.from({ length: c.stages }, (_, i) => ({
    seed: `${c.key}x${i + 1}`,
    label: `${no}장 ${i + 1}구역`,
  }));
});

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
  const [propKey, setPropKey] = useState<string>("obj_dungeon_torch");
  const [layer, setLayer] = useState<EditorLayerRole>("ground");
  const [status, setStatus] = useState<string>("");
  const [showProps, setShowProps] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  /* vc236 — 브러시 크기(1·2·3). 3×3 은 큰 방을 칠할 때 클릭 수를 9분의 1로 줄인다. */
  const [brush, setBrush] = useState(1);
  /* vc236 — 반영 대상 스테이지 — 저장/반영 시 이 시드로 게임에 알린다. */
  const [seed, setSeed] = useState<string>("howlrstone1x2");

  /* vc236 — undo/redo. SkillEditor 와 같은 HISTORY_MAX 규칙을 쓴다.
   *  `redo` 는 실행취소로 꺼낸 상태를 다시 밀어넣을 자리다 — 새 편집이 생기면 비운다
   *  (그렇지 않으면 "되돌리기 → 다른 작업 → 다시 실행" 이 엉뚱한 가지로 뻗는다). */
  const history = useRef<EdState[]>([]);
  const redoStack = useRef<EdState[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const painting = useRef<null | "add" | "del">(null);

  const pushHistory = useCallback((snap: EdState) => {
    history.current.push(clone(snap));
    if (history.current.length > HISTORY_MAX) history.current.shift();
    redoStack.current.length = 0; // 새 편집 = 새 가지
  }, []);

  const [canRedo, setCanRedo] = useState(false);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      redoStack.current.push(clone(sc));
      setCanRedo(true);
      setSc(prev);
      setStatus("실행취소");
    } else setStatus("되돌릴 작업이 없습니다");
  }, [sc]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (next) {
      history.current.push(clone(sc));
      setCanRedo(redoStack.current.length > 0);
      setSc(next);
      setStatus("다시 실행");
    } else setStatus("다시 실행할 작업이 없습니다");
  }, [sc]);

  /* ── 편집 ── */
  /* [vc258 버그 수정] 벽 도구의 의미가 반전돼 있었다.
   *  종전엔 `wall + add` 가 `open[cell] = true` 로 **셀을 열었다**. 새 맵은 내부가
   *  전부 개방 상태라, 벽 도구로 클릭해도 아무 변화가 없었다(브라우저 실측: 4회 클릭 후
   *  개방 91 / 벽 44 그대로). 도구 이름과 동작이 반대였던 것.
   *  이제 `mode` 를 그대로 받아 도구별로 해석한다:
   *    wall  : add → 벽으로 막기(open=false), del → 열기(open=true)
   *    path  : add → 길 칠하기, del → 지우기
   *    entry/exit : add → 그 셀을 입구/출구로 */
  const paintCell = useCallback((cell: number, mode: "add" | "del") => {
    setSc((prev) => {
      const next = clone(prev);
      if (tool === "wall") {
        next.open[cell] = mode === "del";
        /* 벽으로 만들면 그 위 프롭은 제거 — 벽 안에 뜬 오브젝트 방지 */
        if (mode === "add") next.props = next.props.filter((p) => p.cell !== cell);
      } else if (tool === "path") {
        next.paths[cell] = mode === "add";
      } else if (tool === "entry" && mode === "add") {
        next.open[cell] = true;
        next.entry = cell;
      } else if (tool === "exit" && mode === "add") {
        next.open[cell] = true;
        next.exit = cell;
      }
      return next;
    });
  }, [tool]);

  /* vc236 — 브러시 확장. 기준 셀에서 n×n 으로 퍼뜨린다.
   *  `n=1` 이면 종전과 완전히 같은 동작(기준 셀만). */
  const paint = useCallback((cell: number, mode: "add" | "del") => {
    if (cell < 0) return;
    if (brush <= 1) { paintCell(cell, mode); return; }
    const c0 = cell % sc.cols, r0 = Math.floor(cell / sc.cols);
    const half = Math.floor(brush / 2);
    for (let dr = -half; dr <= brush - 1 - half; dr++) {
      for (let dc = -half; dc <= brush - 1 - half; dc++) {
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= sc.cols || r >= sc.rows) continue;
        paintCell(r * sc.cols + c, mode);
      }
    }
  }, [brush, paintCell, sc.cols, sc.rows]);

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
  /* vc236 — 프롭 썸네일 캐시. 캔버스는 <img> 를 못 쓰므로 Image 를 직접 만든다.
   *  프롭 key → Image 를 캐시해 두고, 로드가 끝나면 한 번만 다시 그린다
   *  (매 프레임 new Image() 하면 리스너가 쌓인다). */
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map<string, HTMLImageElement>());
  const [imgTick, setImgTick] = useState(0);
  useEffect(() => {
    let dirty = false;
    for (const p of sc.props) {
      if (imgCache.current.has(p.key)) continue;
      const meta = EDITOR_ASSETS.find((a) => a.name === p.key);
      const src = meta?.url ?? `/assets/objects/${p.key.startsWith("obj_") ? p.key.split("_")[1] : "dungeon"}/${p.key}.png`;
      const img = new Image();
      img.onload = () => { dirty = true; setImgTick((n) => n + 1); };
      img.onerror = () => imgCache.current.delete(p.key); // 실패는 캐시하지 않는다(경로가 틀렸을 수 있음)
      img.src = src;
      imgCache.current.set(p.key, img);
    }
    void dirty;
  }, [sc.props]);

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
        const img = imgCache.current.get(p.key);
        if (img && img.complete && img.naturalWidth > 0) {
          /* vc236 — 실제 썸네일로 그린다. 종전엔 색 점뿐이라 "무엇을 놓았는지" 알 수 없었다.
           *  셀 안에 비율을 유지해 맞춘다(늘리면 픽셀아트가 뭉개진다). */
          const k = Math.min(zoom / img.naturalWidth, zoom / img.naturalHeight) * 0.92;
          const w = img.naturalWidth * k, h = img.naturalHeight * k;
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.95;
          ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = propIsSolid(p.key) ? "#e0894f" : "#6fb3d2";
          ctx.beginPath();
          ctx.arc(x, y, Math.max(3, size / 2), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#00000088";
          ctx.stroke();
        }
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
  }, [sc, zoom, layer, showGrid, showProps, imgTick]);

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
  /* ── 게임 스테이지에 반영 ──
   * [왜 필요한가] 에디터가 JSON 다운로드만 하면 "에디터에서 만들고 게임에서 확인"이
   *  한 흐름이 되지 않는다. "맵메이커 최종 완성"은 저장 → 게임 반영이 이어져야 완성이다.
   *  서버가 읽기 전용인 배포(서버리스)에서는 503 이 오므로, 그때는 다운로드로 폴백한다. */
  const publish = useCallback(async () => {
    if (!seed) { setStatus("반영할 스테이지를 먼저 고르세요"); return; }
    const c = validateLayout(sc);
    if (!c.ok) { setStatus(`반영 불가 — ${c.errors[0]}`); return; }
    const doc = serializeLayout({ ...sc, props: sc.props, name: seed });
    try {
      const res = await fetch("/api/maps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ seed, map: doc }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(`반영 실패(${res.status}): ${body.error ?? "알 수 없는 오류"}`);
        return;
      }
      setStatus(`${seed} 에 반영 완료 · ${body.bytes ?? 0}B · 총 ${body.total ?? "?"}개 맵`);
    } catch (e) {
      setStatus(`반영 실패: ${String((e as Error).message).slice(0, 80)}`);
    }
  }, [sc, seed]);

  /* 저장 — 단축키(Ctrl+S)에서도 참조하므로 선언을 effect 앞에 둔다. */
  const save = useCallback(() => {
    const json = serializeLayout({ ...sc, props: sc.props, name: seed || `map_${Date.now()}` });
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${seed || "sertz-map"}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`저장 완료 · 개방 ${sc.open.filter(Boolean).length}칸 · 프롭 ${sc.props.length}개`);
  }, [sc, seed]);

  /* ── 단축키 ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        /* vc236 — Shift+Ctrl+Z 는 다시 실행(윈도우 관례). */
        if (e.shiftKey) redo(); else undo();
      } else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, save]);

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
          <button onClick={save} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">JSON 저장</button>
          <button onClick={publish} className="rounded border border-emerald-300/50 bg-emerald-400/15 px-2 py-1 text-[11px] font-bold text-emerald-100 hover:bg-emerald-400/25">게임에 반영</button>
        </div>
        {/* 반영 대상 스테이지 — 게임이 인식하는 시드만 노출한다 */}
        <div className="flex w-full items-center gap-1.5 border-t border-white/5 pt-1.5">
          <span className="text-[10px] font-bold text-white/40">반영 스테이지</span>
          <select value={seed} onChange={(e) => setSeed(e.target.value)}
            className="rounded border border-white/15 bg-[#151922] px-1.5 py-0.5 text-[10px]">
            {STAGE_SEEDS.map((s) => <option key={s.seed} value={s.seed}>{s.label} ({s.seed})</option>)}
          </select>
          <span className="text-[9px] text-white/30">
            저장 후 게임을 새로고침하면 이 구역 레이아웃이 바뀝니다
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 좌: 도구 */}
        {/* vc236 — 168 → 224px. 에셋 브라우저(썸네일 4열 + 카테고리/검색)를 넣으면
         *  168px 에서는 썸네일이 잘려 "보이게 하기" 가 반만 달성된다. */}
        <aside className="flex w-[224px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/10 p-2">
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
              {/* vc236 — 손으로 적은 PROPS 목록을 실제 에셋 브라우저로 교체.
               *  생성 파일(editorAssetManifest)에서 오므로 디스크와 어긋나지 않는다. */}
              <p className="truncate text-[9px] leading-tight text-white/50">
                선택: <span className="font-mono text-amber-200/80">{propKey}</span>
              </p>
              <p className="mt-0.5 text-[9px] leading-tight text-white/40">
                주황=충돌 · 파랑=장식
              </p>
            </Section>
          )}

          {/* vc236 — 에셋 브라우저는 **항상 보인다**.
           *  종전엔 프롭 도구를 골라야만 목록이 나타나서, 기본 화면(벽 도구)에서는
           *  에셋이 하나도 안 보였다. "에셋 보이게 하기" 요구를 만족하려면 도구와
           *  무관하게 노출돼야 한다. 프롭이 아닌 도구일 때는 클릭 시 프롭 도구로 전환한다. */}
          <Section title="에셋 브라우저">
            <AssetBrowser
              compact
              initialCategory="objects"
              onPick={(a) => {
                /* 데코 파일명이 곧 PropKey — 확장자를 뗀 name 을 그대로 쓴다. */
                setPropKey(a.name);
                setTool("prop"); // 고르면 바로 놓을 수 있게 도구도 전환
                setStatus(`프롭 선택: ${a.name}`);
              }}
            />
          </Section>

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

          {/* vc236 — 브러시 크기. 벽/길 도구에서만 의미가 있다. */}
          <Section title="브러시">
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setBrush(n)}
                  disabled={tool === "prop" || tool === "entry" || tool === "exit"}
                  className={`rounded px-1 py-1 text-[10px] font-bold disabled:opacity-30 ${
                    brush === n ? "bg-sky-400/25 text-sky-100 ring-1 ring-sky-300/50" : "bg-white/5 hover:bg-white/10"
                  }`}>
                  {n}×{n}
                </button>
              ))}
            </div>
          </Section>

          <div className="mt-auto grid grid-cols-2 gap-1">
            <button onClick={undo} className="rounded border border-white/15 px-1 py-1.5 text-[10px] hover:bg-white/10">
              실행취소
            </button>
            <button onClick={redo} disabled={!canRedo}
              className="rounded border border-white/15 px-1 py-1.5 text-[10px] hover:bg-white/10 disabled:opacity-35">
              다시 실행
            </button>
          </div>
          <p className="text-center text-[8px] leading-tight text-white/25">Ctrl+Z · Ctrl+Shift+Z</p>
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
