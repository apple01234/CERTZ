"use client";

/**
 * v1.0.18 — 유니온 패널 (메이플스토리 유니온 UI 재현)
 *  탭: 배치(그리드 DnD·회전·자동 추천) / 상점(코인) / 버프(시간제) / 아티팩트 / 레이드
 *  로비·인게임 양쪽에서 열 수 있다 (인게임에서는 효과가 즉시 활성 캐릭터에 반영된다)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users, Coins, Zap, Gem, Swords, RotateCw, X, Sparkles, ShoppingBag, Timer, MousePointer2 } from "lucide-react";
import {
  loadUnion, writeUnion, autoArrange, canPlace, occupancy, placedCells, shapeOfChar,
  unionGradeOf, maxPlacedOf, UNION_COLS, UNION_ROWS, UNION_GRADES, familyOfChar, placeGradeOf,
  unionEffects, unionDailyAndLevelup, buyUnionBuff, buySlotExpand, raidClear, raidDoneToday,
  raidPower, spendCoins, addCoins,
  ARTIFACTS, UNION_BUFFS, RAID_DIFFS, type Placement, type RaidDiff,
} from "@/game/union";
import { loadSlots, unionLevelOf, SLOT_EXPAND_COIN, type CharMeta } from "@/game/slots";
import { EventBus } from "./EventBus";

const FAM_LABEL: Record<string, string> = { warrior: "전사", ranger: "궁수", mage: "마법사", thief: "도적" };
const FAM_COLOR: Record<string, string> = { warrior: "#ff8a70", ranger: "#7ddcff", mage: "#c9a0ff", thief: "#a0e8a0" };
const FAM_HEX: Record<string, number> = { warrior: 0xff8a70, ranger: 0x7ddcff, mage: 0xc9a0ff, thief: 0xa0e8a0 };

/* v1.4.3 (작업5) — 유니온 전용 시각 에셋 매핑 (public/assets/ui/union/)
 *  기능만 있고 텍스트 UI만 있던 아티팩트 6종·시간제 버프 4종·레이드 보스 3종에
 *  전용 아이콘/초상을 입히고, 아티팩트는 성장 단계별로 프레임 등급이 변한다. */
const UNION_ASSET = (n: string) => `/assets/ui/union/${n}.png`;
const ART_ICON: Record<string, string> = {
  art_atk: UNION_ASSET("art_atk"), art_hp: UNION_ASSET("art_hp"), art_crit: UNION_ASSET("art_crit"),
  art_gold: UNION_ASSET("art_gold"), art_def: UNION_ASSET("art_def"), art_speed: UNION_ASSET("art_speed"),
};
const BUFF_ICON: Record<string, string> = {
  ub_atk: UNION_ASSET("ub_atk"), ub_gold: UNION_ASSET("ub_gold"), ub_def: UNION_ASSET("ub_def"), ub_exp: UNION_ASSET("ub_exp"),
};
const RAID_PORTRAIT: Record<string, string> = {
  "수문장 거인 베히모스": UNION_ASSET("raid_behemoth"),
  "심연의 감시자 니드호그": UNION_ASSET("raid_nidhogg"),
  "차원의 군주 아비슬로드": UNION_ASSET("raid_abysslord"),
};
/** 아티팩트 성장 단계 등급 — 시각적 차이 (프레임/발광/배지) */
function artGrade(lv: number): { label: string; color: string; glow: string } {
  if (lv >= 9) return { label: "전설", color: "#ffd76a", glow: "0 0 10px rgba(255,215,106,.45), inset 0 0 8px rgba(255,215,106,.25)" };
  if (lv >= 6) return { label: "영웅", color: "#c08aff", glow: "0 0 8px rgba(192,138,255,.4), inset 0 0 6px rgba(192,138,255,.2)" };
  if (lv >= 3) return { label: "희귀", color: "#7ddcff", glow: "0 0 6px rgba(125,220,255,.35)" };
  if (lv >= 1) return { label: "일반", color: "#9fb3d9", glow: "none" };
  return { label: "미 개방", color: "#5a6478", glow: "none" };
}

type Tab = "grid" | "shop" | "buff" | "artifact" | "raid";

/** 유니온 등급 배지 색 → tailwind 스타일 인라인 */
function gradeStyle(color: string) {
  return { borderColor: `${color}88`, background: `${color}1c`, color };
}

export function UnionPanel({ onClose }: { onClose: () => void }) {
  const [, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);
  const [tab, setTab] = useState<Tab>("grid");

  /* 드래그 상태 */
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragRot, setDragRot] = useState(0);
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number; ok: boolean } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  /* 레이드 시뮬 상태 */
  const [raid, setRaid] = useState<{ diff: RaidDiff; hp: number; maxHp: number; dmg: Record<string, number>; done: null | "win" | "lose"; t: number } | null>(null);

  const slots = useMemo(() => loadSlots(), [tab, raid, hoverCell, dragId]); // eslint-disable-line react-hooks/exhaustive-deps
  const u = useMemo(() => loadUnion(), [tab, raid, hoverCell, dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* v1.0.19 (B-2) — 유니온 레벨 = 전체 캐릭터 기여 레벨 합산 (60까지 100% + 초과분 10레벨당 1) */
  const unionLv = useMemo(() => unionLevelOf(slots), [slots]);
  const { idx, grade, next, nextNeed } = useMemo(() => unionGradeOf(unionLv), [unionLv]);
  const cap = maxPlacedOf(idx);
  const roster = useMemo(
    () => Object.values(slots.chars).filter((c) => c.lv >= 60).sort((a, b) => b.lv - a.lv),
    [slots]
  );
  const eff = useMemo(() => unionEffects(u, slots), [u, slots]);
  const placedCount = u.placements.length;

  /* 패널 오픈 시 유니온 레벨업 코인 정산 + 일일 보상 */
  useEffect(() => {
    const r = unionDailyAndLevelup();
    if (r.coins > 0) {
      EventBus.emit("banner:show", { text: `유니온 정산 — 코인 +${r.coins}${r.lvUps > 0 ? ` (유니온 레벨 +${r.lvUps})` : ""}` });
      refresh();
    }
    /* 레벨 60 캐릭터가 생겨 유니온 진입 가능해진 순간 안내 */
    return () => {};
  }, [refresh]);

  /* ---------- 그리드 배치 ---------- */

  const cellPixel = 30; // 모바일 13열 기준 — 390px 폭에서 30px 셀
  const occ = useMemo(() => occupancy(u, slots), [u, slots]);

  const charAt = (c: number, r: number): CharMeta | undefined => {
    const id = occ.get(`${c},${r}`);
    return id ? slots.chars[id] : undefined;
  };

  const placeAt = (charId: string, rot: number, r: number, c: number) => {
    const store = loadUnion();
    const p: Placement = { charId, rot, r, c };
    if (!canPlace(store, loadSlots(), p)) return false;
    store.placements = [...store.placements.filter((x) => x.charId !== charId), p];
    writeUnion(store);
    refresh();
    return true;
  };

  const unplace = (charId: string) => {
    const store = loadUnion();
    store.placements = store.placements.filter((x) => x.charId !== charId);
    writeUnion(store);
    refresh();
  };

  const rotatePlaced = (charId: string) => {
    const store = loadUnion();
    const p = store.placements.find((x) => x.charId === charId);
    if (!p) return;
    const meta = slots.chars[charId];
    for (let t = 1; t <= 4; t++) {
      const cand = { ...p, rot: (p.rot + t) % 4 };
      if (canPlace(store, loadSlots(), cand)) {
        store.placements = store.placements.map((x) => (x.charId === charId ? cand : x));
        writeUnion(store);
        refresh();
        return;
      }
    }
    void meta;
  };

  /** 포인터 기반 드래그앤드롭 (마우스+터치 공용 — Phaser 캔버스 위 React 오버레이) */
  const onGridPointerMove = (e: React.PointerEvent) => {
    if (!dragId || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * UNION_COLS);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * UNION_ROWS);
    const store = loadUnion();
    const meta = slots.chars[dragId];
    const ok = meta ? canPlace(store, loadSlots(), { charId: dragId, rot: dragRot, r, c }) : false;
    setHoverCell({ r, c, ok });
  };

  const onGridPointerUp = () => {
    if (dragId && hoverCell && hoverCell.ok) placeAt(dragId, dragRot, hoverCell.r, hoverCell.c);
    setDragId(null);
    setHoverCell(null);
  };

  const startDrag = (meta: CharMeta) => {
    if (placedCount >= cap && !u.placements.some((p) => p.charId === meta.id)) {
      EventBus.emit("banner:show", { text: `배치 인원이 가득 찼다 (${placedCount}/${cap}) — 등급을 올려 늘려보자` });
      return;
    }
    setDragId(meta.id);
    setDragRot(0);
  };

  /* ---------- 레이드 ---------- */

  const startRaid = (diff: RaidDiff) => {
    const done = raidDoneToday();
    if (done !== null) {
      EventBus.emit("banner:show", { text: "유니온 레이드는 하루 1회 도전할 수 있다" });
      return;
    }
    const store = loadUnion();
    const { power, allies } = raidPower(store, slots);
    if (allies.length < RAID_DIFFS[diff].req) {
      EventBus.emit("banner:show", { text: `배치 캐릭터 ${RAID_DIFFS[diff].req}명 이상 필요 (현재 ${allies.length}명)` });
      setTab("grid");
      return;
    }
    setRaid({ diff, hp: RAID_DIFFS[diff].hp, maxHp: RAID_DIFFS[diff].hp, dmg: {}, done: null, t: 60 });
  };

  /* 레이드 틱 — 배치 캐릭터들이 AI 파티원으로 교대 공격 (600ms 간격) */
  useEffect(() => {
    if (!raid || raid.done) return;
    const iv = window.setInterval(() => {
      setRaid((cur) => {
        if (!cur || cur.done) return cur;
        const store = loadUnion();
        const sl = loadSlots();
        const { allies } = raidPower(store, sl);
        if (allies.length === 0) return cur;
        /* 틱마다 랜덤 파티원이 공격 — 파워 비례 데미지 */
        const attacker = allies[Math.floor(Math.random() * allies.length)];
        const { power } = raidPower(store, sl);
        const dmg = Math.round((power / 26) * (0.8 + Math.random() * 0.5));
        const hp = cur.hp - dmg;
        const t = cur.t - 0.6;
        const ndmg = { ...cur.dmg, [attacker.name]: (cur.dmg[attacker.name] ?? 0) + dmg };
        if (hp <= 0) {
          const { coin } = raidClear(cur.diff);
          window.setTimeout(() => {
            EventBus.emit("banner:show", { text: `유니온 레이드 클리어! 코인 +${coin}` });
            refresh();
          }, 30);
          return { ...cur, hp: 0, dmg: ndmg, done: "win" };
        }
        if (t <= 0) return { ...cur, hp, dmg: ndmg, t: 0, done: "lose" };
        return { ...cur, hp, dmg: ndmg, t };
      });
    }, 600);
    return () => window.clearInterval(iv);
  }, [raid?.diff, raid?.done, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 렌더 ---------- */

  const previewCells = useMemo(() => {
    if (!dragId) return new Set<string>();
    const meta = slots.chars[dragId];
    if (!meta) return new Set<string>();
    const base = hoverCell ? { r: hoverCell.r, c: hoverCell.c } : null;
    if (!base) return new Set<string>();
    return new Set(placedCells(dragRot, base.r, base.c, shapeOfChar(meta)).map(([c, r]) => `${c},${r}`));
  }, [dragId, dragRot, hoverCell, slots]);

  const unplaced = roster.filter((m) => !u.placements.some((p) => p.charId === m.id));

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px]" onPointerDown={onClose}>
      {/* v1.0.20 — 유니온 UI 모바일 짤림 수정: [min(...) 가 in( 로 변조되어 너비/높이 제한이
       *  아예 적용되지 않았다(모바일에서 패널이 화면을 넘어 잘림). 제한 복원 + 게임형 프레임 적용 */}
      <div
        className="game-panel sertz-scroll max-h-[min(94svh,700px)] w-[min(96vw,720px)] overflow-y-auto p-3 sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-amber-300" />
            <p className="text-sm font-black text-amber-100">유니온</p>
            <span className="rounded-md border px-2 py-0.5 text-[10px] font-black" style={gradeStyle(grade.color)}>
              {grade.name} {idx > 0 ? `★${idx}` : ""}
            </span>
            <span className="rounded-md border border-amber-300/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200">
              <Coins size={10} className="mr-0.5 inline" />
              {u.coins.toLocaleString()}
            </span>
          </div>
          <button onClick={onClose} aria-label="유니온 패널 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">
            <X size={14} />
          </button>
        </div>

        {/* 등급 진행 바 */}
        <div className="mb-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-white/60">
            <span>유니온 레벨 <b className="text-amber-200">{unionLv.toLocaleString()}</b> <span className="text-white/40">(캐릭터 레벨 합산 — 60까지 100%·초과분 10레벨당 1)</span></span>
            <span>{next ? `다음 등급 ${next.name} — ${nextNeed.toLocaleString()}` : "최고 등급 달성!"}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/60">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-500" style={{ width: `${next ? Math.min(100, (unionLv / nextNeed) * 100) : 100}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {eff.lines.map((l) => (
              <span key={l.label} className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] font-bold" style={{ color: l.color }}>
                {l.label} · {l.value}
              </span>
            ))}
            <span className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
              합계 — 공격 +{eff.atk.toFixed(0)} · HP +{eff.hp.toFixed(0)} · 방어 +{eff.def.toFixed(0)} · 크리 +{eff.crit.toFixed(1)}%p · 크리뎀 +{eff.critDmg.toFixed(1)}%p · 공격력 +{eff.atkPct.toFixed(1)}% · 골드 +{eff.goldPct.toFixed(1)}% · 이동 +{eff.speedPct.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-[9px] font-bold text-white/35">유니온 효과는 계정의 모든 캐릭터에 즉시 적용된다 · 배치 인원 {placedCount}/{cap} · 등급업 시 그리드 인원 +1</p>
        </div>

        {/* 탭 */}
        <div className="mb-2.5 grid grid-cols-5 gap-1">
          {([
            ["grid", "배치", <Users key="g" size={11} />],
            ["shop", "상점", <ShoppingBag key="s" size={11} />],
            ["buff", "버프", <Timer key="b" size={11} />],
            ["artifact", "아티팩트", <Gem key="a" size={11} />],
            ["raid", "레이드", <Swords key="r" size={11} />],
          ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-black transition-transform active:scale-95 ${tab === id ? "game-tab-on" : "game-tab"}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ===== 배치 탭 ===== */}
        {tab === "grid" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold text-white/50">블록을 드래그해 배치 · 클릭해 해제 · <RotateCw size={9} className="inline" /> 회전</p>
              <button
                onClick={() => { autoArrange(loadUnion(), loadSlots()); refresh(); }}
                className="game-btn-ghost flex items-center gap-1 px-2 py-1 text-[10px] font-black text-amber-200 active:scale-95"
              >
                <Sparkles size={11} />
                자동 추천 배치
              </button>
            </div>
            <div
              ref={gridRef}
              className="relative grid touch-none select-none rounded-lg border-2 border-indigo-300/25 bg-[#0a0e22] p-1"
              style={{ gridTemplateColumns: `repeat(${UNION_COLS}, 1fr)`, aspectRatio: `${UNION_COLS} / ${UNION_ROWS}` }}
              onPointerMove={onGridPointerMove}
              onPointerUp={onGridPointerUp}
              onPointerLeave={() => { setHoverCell(null); }}
            >
              {Array.from({ length: UNION_COLS * UNION_ROWS }, (_, i) => {
                const c = i % UNION_COLS;
                const r = Math.floor(i / UNION_COLS);
                const meta = charAt(c, r);
                const key = `${c},${r}`;
                const preview = previewCells.has(key);
                const previewOk = hoverCell?.ok ?? false;
                const fam = meta ? familyOfChar(meta) : null;
                const shape = meta ? shapeOfChar(meta) : [];
                const isEdge = meta ? shape.some((s) => placedCells(0, 0, 0, shape).length > 0) : false; void isEdge;
                const color = fam ? FAM_COLOR[fam] : "#fff";
                return (
                  <div
                    key={key}
                    className="relative flex items-center justify-center rounded-[3px] border"
                    style={{
                      borderColor: preview ? (previewOk ? "#8fe84a" : "#ff5a5a") : fam ? `${color}55` : "#ffffff0d",
                      background: preview ? (previewOk ? "#8fe84a33" : "#ff5a5a33") : meta ? `${color}22` : "#ffffff08",
                      cursor: meta ? "pointer" : dragId ? "grabbing" : "default",
                    }}
                    onClick={() => { if (meta && !dragId) unplace(meta.id); }}
                    onDoubleClick={() => { if (meta && !dragId) rotatePlaced(meta.id); }}
                  >
                    {meta && r === Math.min(...shape.map((s) => s[1])) + (u.placements.find((p) => p.charId === meta.id)?.r ?? 0) && c === Math.min(...shape.map((s) => s[0])) + (u.placements.find((p) => p.charId === meta.id)?.c ?? 0) && (
                      <span className="pointer-events-none absolute -top-px left-0.5 max-w-full truncate text-[7px] font-black leading-tight" style={{ color }}>
                        {meta.name.replace(/ reinforced/g, "")}·{meta.lv}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* 드래그 중 블록 미리보기 — hoverCell 위치에 계열색 반투명 */}
              {dragId && hoverCell && (
                <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.75 }} />
              )}
            </div>
            {dragId && (
              <button
                onClick={() => setDragRot((v) => (v + 1) % 4)}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-[10px] font-black text-white/75 active:scale-95"
              >
                <RotateCw size={11} />
                블록 회전 (현재 {dragRot * 90}°) — 모바일은 회전 후 원하는 칸 탭
              </button>
            )}
            {/* 배치 가능 캐릭터 목록 */}
            <p className="mt-2 mb-1 text-[10px] font-black text-white/60">배치 대기 캐릭터 (Lv60 이상 · {unplaced.length}명) — 눌러서 배치</p>
            <div className="grid max-h-28 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-6">
              {unplaced.map((m) => {
                const fam = familyOfChar(m) ?? "warrior";
                const pg = placeGradeOf(m.lv);
                return (
                  <button
                    key={m.id}
                    onPointerDown={() => startDrag(m)}
                    className="rounded-md border px-1 py-1 text-left transition-transform active:scale-95"
                    style={{ borderColor: `${FAM_COLOR[fam]}55`, background: `${FAM_COLOR[fam]}14` }}
                  >
                    <p className="truncate text-[9px] font-black" style={{ color: FAM_COLOR[fam] }}>{m.name}</p>
                    <p className="text-[8px] font-bold text-white/45">Lv{m.lv} · {FAM_LABEL[fam]}</p>
                    {/* v1.0.19 (B-2) — 배치 등급 배지 (레벨 구간 → B/A/S/SS, 등급 배율만큼 효과 증폭) */}
                    {pg && <p className="text-[8px] font-black" style={{ color: pg.color }}>{pg.grade}등급 ×{pg.mult}</p>}
                  </button>
                );
              })}
              {unplaced.length === 0 && <p className="col-span-6 py-2 text-center text-[10px] font-bold text-white/35">모든 캐릭터가 배치되어 있다</p>}
            </div>
            {roster.length === 0 && (
              <div className="mt-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-2.5 py-2">
                <p className="text-[11px] font-black text-amber-200">아직 유니온에 참여할 캐릭터가 없다</p>
                <p className="mt-0.5 text-[10px] font-bold leading-relaxed text-white/55">로비에서 캐릭터를 키워 <b>Lv 60</b>을 달성하면 유니온에 참여할 수 있다. 여러 캐릭터를 함께 키워보자!</p>
              </div>
            )}
          </div>
        )}

        {/* ===== 상점 탭 ===== */}
        {tab === "shop" && (
          <div className="grid grid-cols-2 gap-1.5">
            <p className="col-span-2 mb-0.5 text-[10px] font-bold text-white/50">유니온 코인으로 물건을 산다 — 물약·주문서·골드는 현재 플레이 캐릭터에 즉시 지급</p>
            {[
              { id: "potion_hp", name: "HP 물약 ×5", desc: "상급 회복 물약 5개 지급", cost: 4, icon: <Sparkles size={13} className="text-rose-300" />, act: () => EventBus.emit("rpg:unionReward", { kind: "potion_hp", n: 5 }) },
              { id: "potion_mp", name: "MP 물약 ×5", desc: "상급 마나 물약 5개 지급", cost: 4, icon: <Sparkles size={13} className="text-sky-300" />, act: () => EventBus.emit("rpg:unionReward", { kind: "potion_mp", n: 5 }) },
              { id: "scroll", name: "강화 주문서", desc: "스타포스 확률 +15%p 충전", cost: 10, icon: <Zap size={13} className="text-amber-300" />, act: () => EventBus.emit("rpg:unionReward", { kind: "scroll", n: 1 }) },
              { id: "gold", name: "골드 자루", desc: "골드 20,000G 지급", cost: 12, icon: <Coins size={13} className="text-yellow-300" />, act: () => EventBus.emit("rpg:unionReward", { kind: "gold", n: 20000 }) },
              { id: "slot", name: "캐릭터 슬롯 확장권", desc: `계정 캐릭터 슬롯 +1 (${SLOT_EXPAND_COIN} 코인)`, cost: SLOT_EXPAND_COIN, icon: <Users size={13} className="text-indigo-300" />, act: () => { if (buySlotExpand()) EventBus.emit("banner:show", { text: "캐릭터 슬롯이 1개 늘었다!" }); else EventBus.emit("banner:show", { text: "코인이 부족하거나 최대 슬롯이다" }); refresh(); } },
            ].map((it) => (
              <button
                key={it.id}
                onClick={() => {
                  if (it.id === "slot") { it.act(); return; }
                  if (spendCoins(it.cost)) { it.act(); }
                  else EventBus.emit("banner:show", { text: `유니온 코인이 부족하다 (${it.cost} 필요)` });
                  refresh();
                }}
                className="flex items-start gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-left transition-transform active:scale-95"
              >
                <span className="mt-0.5">{it.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <b className="truncate text-[11px] text-white">{it.name}</b>
                    <b className="shrink-0 text-[10px] text-amber-200">{it.cost}C</b>
                  </span>
                  <span className="mt-0.5 block text-[9px] font-bold leading-snug text-white/45">{it.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ===== 버프 탭 ===== */}
        {tab === "buff" && (
          <div className="grid grid-cols-2 gap-1.5">
            {UNION_BUFFS.map((b) => {
              const active = u.buffs.find((x) => x.key === b.key && x.until > Date.now());
              const remainMin = active ? Math.ceil((active.until - Date.now()) / 60000) : 0;
              return (
                <button
                  key={b.key}
                  onClick={() => { const r = buyUnionBuff(b.key); EventBus.emit("banner:show", { text: r ? `${r.name} 발동! ${r.minutes}분간 ${r.desc}` : "코인이 부족하다" }); refresh(); }}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-transform active:scale-95 ${active ? "border-emerald-300/60 bg-emerald-400/10" : "border-white/12 bg-white/[0.04]"}`}
                >
                  {/* v1.4.3 (작업5) — 전용 버프 아이콘 */}
                  <img src={BUFF_ICON[b.key]} alt="" width={40} height={40} className="mt-0.5 shrink-0 rounded-md border border-white/15" draggable={false} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1">
                      <b className="truncate text-[11px] text-white">{b.name}</b>
                      <b className="shrink-0 text-[10px] text-amber-200">{b.cost}C</b>
                    </span>
                    <span className="mt-0.5 block text-[9px] font-bold text-white/45">{b.minutes}분 · {b.desc}</span>
                    {active && <span className="mt-0.5 block text-[9px] font-black text-emerald-300">발동 중 — {remainMin}분 남음 (전 캐릭터 적용)</span>}
                  </span>
                </button>
              );
            })}
            <p className="col-span-2 mt-1 text-[9px] font-bold text-white/35">유니온 버프는 계정의 모든 캐릭터에 적용된다 · 같은 버프 재구매 시 남은 시간에 추가</p>
          </div>
        )}

        {/* ===== 아티팩트 탭 — v1.4.3 (작업5) 전용 아이콘 + 단계별 등급 프레임 ===== */}
        {tab === "artifact" && (
          <div className="grid grid-cols-2 gap-1.5">
            {ARTIFACTS.map((a) => {
              const lv = u.artifacts[a.key] ?? 0;
              const maxed = lv >= a.max;
              const cost = maxed ? 0 : a.cost(lv);
              const gr = artGrade(lv);
              const nextGr = artGrade(Math.min(a.max, lv + 1));
              return (
                <div
                  key={a.key}
                  className="rounded-lg border bg-white/[0.04] px-2.5 py-2"
                  style={{ borderColor: `${gr.color}66`, boxShadow: gr.glow }}
                >
                  <div className="flex items-center gap-2">
                    {/* 전용 아이콘 — 등급 프레임 색 동반 */}
                    <img
                      src={ART_ICON[a.key]}
                      alt={a.name}
                      width={44}
                      height={44}
                      draggable={false}
                      className="shrink-0 rounded-md border-2"
                      style={{ borderColor: `${gr.color}88`, filter: lv > 0 ? "none" : "grayscale(0.55) brightness(0.75)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <b className="truncate text-[11px] text-white">{a.name}</b>
                        <b className="shrink-0 text-[10px] font-black text-violet-200">Lv{lv}/{a.max}</b>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="rounded border px-1 py-px text-[8px] font-black" style={{ borderColor: `${gr.color}88`, color: gr.color, background: `${gr.color}14` }}>{gr.label}</span>
                        {lv > 0 && nextGr.label !== gr.label && (
                          <span className="text-[8px] font-bold text-white/30">→ {nextGr.label} (Lv{lv >= 9 ? 10 : lv >= 6 ? 9 : lv >= 3 ? 6 : 3})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-[9px] font-bold text-white/45">{lv > 0 ? a.desc(lv) : "미 개방 — 성장시켜 계정 영구 보너스 획득"}</p>
                  <button
                    disabled={maxed}
                    onClick={() => {
                      if (maxed) return;
                      if (spendCoins(cost)) {
                        const store = loadUnion();
                        store.artifacts[a.key] = (store.artifacts[a.key] ?? 0) + 1;
                        writeUnion(store);
                        EventBus.emit("banner:show", { text: `${a.name} Lv${lv + 1} 달성!` });
                        refresh();
                      } else EventBus.emit("banner:show", { text: `코인이 부족하다 (${cost} 필요)` });
                    }}
                    className={`mt-1.5 w-full rounded-md px-2 py-1 text-[10px] font-black transition-transform active:scale-95 ${maxed ? "border border-white/10 bg-white/5 text-white/30" : "bg-violet-400 text-slate-900"}`}
                  >
                    {maxed ? "최대 성장" : `성장 — ${cost}C`}
                  </button>
                </div>
              );
            })}
            <p className="col-span-2 mt-1 text-[9px] font-bold text-white/35">아티팩트는 코인으로만 성장하는 계정 단위 영구 성장 요소 — 성장 단계(일반→희귀→영웅→전설)마다 프레임이 변한다</p>
          </div>
        )}

        {/* ===== 레이드 탭 ===== */}
        {tab === "raid" && (
          <div>
            {!raid ? (
              <>
                <p className="mb-1.5 text-[10px] font-bold text-white/50">배치된 캐릭터들이 AI 파티원으로 함께 참전한다 — 하루 1회 · 클리어 시 코인 + 유니온 성장</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {RAID_DIFFS.map((d, i) => {
                    const done = raidDoneToday();
                    const { allies } = raidPower(u, slots);
                    const locked = allies.length < d.req;
                    return (
                      <button
                        key={d.name}
                        onClick={() => startRaid(i as RaidDiff)}
                        className={`rounded-lg border px-2 py-2.5 text-center transition-transform active:scale-95 ${done !== null ? "border-white/10 bg-white/5 opacity-60" : locked ? "border-white/10 bg-white/5" : ""}`}
                        style={done === null && !locked ? { borderColor: `${d.color}88`, background: `${d.color}14` } : undefined}
                      >
                        {/* v1.4.3 (작업5) — 레이드 보스 전용 초상 */}
                        <img
                          src={RAID_PORTRAIT[d.boss]}
                          alt={d.boss}
                          width={64}
                          height={64}
                          draggable={false}
                          className="mx-auto mb-1 rounded-md border object-cover"
                          style={{ borderColor: `${d.color}66`, width: 64, height: 64, filter: locked ? "grayscale(0.7) brightness(0.7)" : "none" }}
                        />
                        <p className="text-[11px] font-black" style={{ color: d.color }}>{d.name}</p>
                        <p className="mt-0.5 truncate text-[9px] font-bold text-white/60">{d.boss}</p>
                        <p className="mt-0.5 text-[8px] font-bold text-white/40">배치 {d.req}명 이상 · 코인 +{d.coin}</p>
                        {done !== null && <p className="mt-0.5 text-[8px] font-black text-emerald-300">금일 클리어</p>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <p className="text-[10px] font-black text-indigo-200">참전 파티 — 총 전투력 {raidPower(u, slots).power.toLocaleString()}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {raidPower(u, slots).allies.map((a) => (
                      <span key={a.name} className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] font-bold" style={{ color: a.color }}>
                        {a.name} Lv{a.lv} ({FAM_LABEL[a.fam ?? "warrior"]})
                      </span>
                    ))}
                    {raidPower(u, slots).allies.length === 0 && <span className="text-[9px] font-bold text-white/35">배치된 캐릭터가 없다 — 배치 탭에서 배치하자</span>}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="mb-2 rounded-lg border-2 px-3 py-3" style={gradeStyle(RAID_DIFFS[raid.diff].color)}>
                  <div className="flex items-center gap-2.5">
                    {/* v1.4.3 (작업5) — 레이드 진행 중 보스 초상 */}
                    <img
                      src={RAID_PORTRAIT[RAID_DIFFS[raid.diff].boss]}
                      alt={RAID_DIFFS[raid.diff].boss}
                      width={52}
                      height={52}
                      draggable={false}
                      className="shrink-0 rounded-md border object-cover"
                      style={{ borderColor: `${RAID_DIFFS[raid.diff].color}88`, width: 52, height: 52 }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black" style={{ color: RAID_DIFFS[raid.diff].color }}>
                        [{RAID_DIFFS[raid.diff].name}] {RAID_DIFFS[raid.diff].boss}
                      </p>
                      <div className="mt-1 h-3 overflow-hidden rounded-full border border-black/70 bg-black/70">
                        <div className="h-full bg-gradient-to-b from-fuchsia-400 to-purple-800 transition-[width] duration-300" style={{ width: `${(raid.hp / raid.maxHp) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-[9px] font-bold text-white/60">
                        남은 HP {raid.hp.toLocaleString()} / {raid.maxHp.toLocaleString()} · 남은 시간 {raid.t.toFixed(0)}초
                      </p>
                    </div>
                  </div>
                </div>
                {/* AI 파티원 공격 로그 */}
                <div className="sertz-scroll mb-2 max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-black/40 px-2.5 py-2">
                  {Object.entries(raid.dmg).sort((a, b) => b[1] - a[1]).map(([name, dmg]) => (
                    <p key={name} className="text-[9px] font-bold text-white/60">
                      <MousePointer2 size={8} className="mr-1 inline text-indigo-300" />
                      {name} — 누적 딜 {dmg.toLocaleString()}
                    </p>
                  ))}
                </div>
                {raid.done && (
                  <div className="rounded-lg border px-3 py-2.5 text-center" style={gradeStyle(raid.done === "win" ? "#8fe84a" : "#ff8a70")}>
                    <p className="text-[13px] font-black" style={{ color: raid.done === "win" ? "#8fe84a" : "#ff8a70" }}>
                      {raid.done === "win" ? `레이드 클리어! 코인 +${RAID_DIFFS[raid.diff].coin}` : "시간 초과 — 파티가 후퇴했다"}
                    </p>
                    <button onClick={() => { setRaid(null); refresh(); }} className="mt-1.5 rounded-md bg-white/10 px-3 py-1 text-[10px] font-black text-white/80 active:scale-95">
                      확인
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 푸터 — 등급 테이블 요약 */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1 border-t border-white/10 pt-2">
          {UNION_GRADES.map((g, i) => (
            <span key={g.name} className={`rounded px-1 py-0.5 text-[8px] font-black ${i === idx ? "ring-1" : ""}`} style={gradeStyle(g.color)}>
              {g.name} {g.need}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
