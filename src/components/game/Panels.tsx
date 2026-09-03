"use client";

import { useEffect, useState } from "react";
import { EventBus, type PanelKind, type RpgState, type HudState, type QuestLogState } from "./EventBus";
import {
  ITEMS, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, UPGRADE_MAX, UPGRADE_RATES, upgradeCost, autoAllocPlan,
  starWeaponBonus, starArmorBonus, starTier, STAR_TIER_CSS, UPGRADE_FALLBACK_FROM, starPerStarAtk, starPerStarDef,
  TRADE_PRICES, tradeValue, TRADE_STOCK, STAR_BLESS_RATE, STAR_BLESS_MAX, starAccBonus,
  CHAPTERS, STAGE_SHORT, parseStage, BM_STOCK, sellValue,
  POT_GRADE_META, potLineText, SET_GEAR, POT_STAT_LABEL,
  ENEMIES, BOSS_DEFS, collectionBonus, nextCollectionGoal, COLLECTION_MILESTONES,
  type ItemKey, type ItemTier, type BuffKey, type PetKey, type CosmeticKey, type StageKey, type PotStatKey, type EnemyKey, type BossKey,
} from "@/game/data";
import { CLASS_LIST, CLASSES, FREE_JOB_COST, chainOf, familyOf, jobOptions, freeJobOption, nextJobLevel, type ClassDef } from "@/game/classes";
import { loadKeyMap, applyKeyBinding, resetKeyMap, ACTION_LABELS, ASSIGNABLE_KEYS, type GameAction, type KeyMap } from "@/game/keymap";
import { getPlayerName, loadSave } from "@/game/config"; // v2.4 — 이름 변경 표시 / v2.5 — 방문 구역 기록

/**
 * 2D MMORPG 기본 요소 UI — 상점 / 인벤토리 패널
 *  - 상점: 상인 라고스 근처(F키/버튼)에서 구매 — 물약/장비/장신구 + 장비 강화
 *  - 인벤토리: I키/버튼 — 물약 사용, 장비/장신구 장착
 *  - 게임은 실시간 유지 (MMORPG 관례), ESC/배경 탭으로 닫기
 */

/** 아이템 등급 스타일 (클래식 MMORPG 등급색) */
const TIER_STYLE: Record<ItemTier, { border: string; name: string; label: string }> = {
  common: { border: "border-white/20", name: "text-white", label: "일반" },
  rare: { border: "border-emerald-400/60", name: "text-emerald-200", label: "고급" },
  epic: { border: "border-purple-400/60", name: "text-purple-200", label: "희귀" },
  /* v3.0.6 — 보스 전용 드롭 전용 등급 (금색 발광) */
  legend: { border: "border-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.45)]", name: "text-amber-200", label: "전설" },
};

function useEscClose(close: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
}

/** v3.0.3 (지시 #4) — 보유 아이템 키별 개수 집계 (모든 아이템 겹침) */
function stackEquips(arr: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const k of arr) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()];
}

/** v3.0.15 (#13) — 잠재옵션 라인 표시 (eert 큐브 결과) */
function PotViewLines({ pot }: { pot?: { grade: number; lines: { k: string; v: number }[] } }) {
  if (!pot || !pot.lines || pot.lines.length === 0) return null;
  const meta = POT_GRADE_META[pot.grade] ?? POT_GRADE_META[0];
  return (
    <p className="mt-0.5 text-[10px] leading-snug" style={{ color: meta.color }}>
      [{meta.name}] {pot.lines.map((l) => potLineText(l as never)).join(" · ")}
    </p>
  );
}

function ItemIcon({ icon, size = 34, tier, count, potGrade }: { icon: string; size?: number; tier?: ItemTier; count?: number; potGrade?: number }) {
  const border = tier ? TIER_STYLE[tier].border : "border-white/10";
  /* v3.0.16 — eert 잠재옵션 등급 오라 (레어 파랑/에픽 보라/유니크 골드/레전드 오렌지) */
  const pot = potGrade !== undefined && potGrade >= 0 ? POT_GRADE_META[potGrade] : null;
  return (
    <div
      className={`relative shrink-0 rounded-md border-2 bg-black/40 ${border}`}
      style={{
        padding: 2,
        lineHeight: 0,
        ...(pot ? { borderColor: pot.color, boxShadow: `0 0 7px ${pot.color}88` } : {}),
      }}
    >
      <img
        src={`/assets/${icon}.png`}
        alt=""
        draggable={false}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
      />
      {/* v3.0.3 — 겹침 수량 배지 (2개 이상일 때) */}
      {count !== undefined && count > 1 && (
        <span className="absolute -bottom-1 -right-1 rounded bg-slate-900/95 px-1 text-[8px] font-black leading-[12px] text-white [text-shadow:0_1px_1px_#000]">
          {count}
        </span>
      )}
    </div>
  );
}

function GoldChip({ gold }: { gold: number }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[12px] font-black text-amber-300">
      { }
      <img src="/assets/item_coin.png" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
      {gold} G
    </span>
  );
}

/** v2.9 (#12) — 과금 화폐 에메랄드 배지 (상점 표시용 — 구매 연동은 다음 릴리스) */
function EmeraldChip({ emerald }: { emerald: number }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[12px] font-black text-emerald-300">
      <img src="/assets/item_pendant_arcane.png" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
      {emerald}
    </span>
  );
}

function itemEffect(item: (typeof ITEMS)[ItemKey], up = 0): string {
  if (item.kind === "buff") return BUFF_DEFS[item.key as BuffKey]?.desc ?? "버프";
  if (item.kind === "pet") return PET_DEFS[item.key as PetKey]?.desc ?? "펫";
  if (item.kind === "cosmetic") return COSMETIC_DEFS[item.key as CosmeticKey]?.desc ?? "치장";
  if (item.healFull) return "HP/MP 100% 회복"; // v3.0.20 (#7) — 엘릭서
  if (item.heal) return `HP +${item.heal}`;
  if (item.restore) return `MP +${item.restore}`;
  if (item.atk) {
    if (up <= 0) return `공격력 +${item.atk}`;
    const m = starWeaponBonus(up).atk;
    const ps = starPerStarAtk(item.atk) * up; // v3.0.20 (#8) — 본당 +2+8%
    return `공격력 ${item.atk}+${ps}${m > 0 ? `+${m}` : ""}`;
  }
  if (item.def) {
    if (up <= 0) return `방어력 +${item.def}`;
    const m = starArmorBonus(up).def;
    const ps = starPerStarDef(item.def).def * up; // v3.0.20 (#8)
    return `방어력 ${item.def}+${ps}${m > 0 ? `+${m}` : ""}`;
  }
  if (item.crit) return `크리티컬 +${item.crit}%`;
  if (item.maxHp) return `최대 HP +${item.maxHp}`;
  return "";
}

/** 상점/가방 행의 버튼 라벨 — kind별 보유 판정이 달라서 분리 */
function shopState(rpg: RpgState, k: ItemKey): "equipped" | "owned" | "buyable" | "poor" {
  const item = ITEMS[k];
  const affordable = rpg.gold >= item.price;
  if (item.kind === "consumable" || item.kind === "buff") return affordable ? "buyable" : "poor";
  if (item.kind === "pet") return rpg.pets.includes(k) ? "owned" : affordable ? "buyable" : "poor";
  if (item.kind === "cosmetic") return rpg.cosmetics.includes(k) ? "owned" : affordable ? "buyable" : "poor";
  const owned = rpg.owned.includes(k);
  const equipped = owned && (rpg.weapon === k || rpg.armor === k);
  if (equipped) return "equipped";
  if (owned) return "owned";
  return affordable ? "buyable" : "poor";
}

/** v3.0.24 — 수량 스테퍼 (−/n/+) — 소모품·버프 수량 지정 구매 (유저 지시 #5)
 *  금액 부족 시 자동 클램프는 구매 실패 배너로 처리 — 여기선 1~99 범위만 보장 */
function QtyStepper({
  qty,
  onChange,
}: {
  qty: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-white/20 bg-black/40">
      <button
        aria-label="수량 감소"
        onClick={(e) => {
          e.stopPropagation();
          onChange(Math.max(1, qty - 1));
        }}
        className="h-6 w-6 text-[13px] font-black text-white/80 hover:bg-white/10 active:scale-90"
      >
        −
      </button>
      <span className="w-7 text-center text-[11px] font-black text-white">{qty}</span>
      <button
        aria-label="수량 증가"
        onClick={(e) => {
          e.stopPropagation();
          onChange(Math.min(99, qty + 1));
        }}
        className="h-6 w-6 text-[13px] font-black text-white/80 hover:bg-white/10 active:scale-90"
      >
        +
      </button>
    </div>
  );
}

/** 강화 단계가 반영된 표시명 (v3.0.5 — 스타포스 ★ 표기) */
function displayName(name: string, up: number): string {
  return up > 0 ? `${name} ★${up}` : name;
}


/* ================= v3.0.6 — BM 상점 (지시 #1) + 자동 사용 설정 (지시 #5) =================
 *  에메랄드 전용 상점 — 골드 상점과 분리. 보스 +2 / 정예 +1 / 반복 사이클 +1로 획득.
 *  자동 물약(HP 임계값/MP)과 자동 버프(여러 개)를 여기서 설정한다. */
export function BmShopPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const auto = rpg.autoUse ?? { hpPct: 0, mpPct: 0, mpOn: false, buffs: [] };
  const buffs: BuffKey[] = ["buff_atk", "buff_def", "buff_spd", "buff_exp", "buff_king"];
  const buffNames: Record<string, string> = {
    buff_atk: "분노 (공격+25%)",
    buff_def: "수호 (방어+8)",
    buff_spd: "신속 (이동+25%)",
    buff_exp: "지혜 (경험치+50%)",
    buff_king: "왕의 가호 (올인원)",
  };
  const bmState = (k: ItemKey): "buyable" | "owned" | "equipped" | "poor" => {
    const it = ITEMS[k];
    if (it.kind === "pet") return rpg.pets.includes(k) ? "owned" : rpg.emerald >= (it.bmPrice ?? 0) ? "buyable" : "poor";
    if (it.kind === "cosmetic") return rpg.cosmetics.includes(k) ? "owned" : rpg.emerald >= (it.bmPrice ?? 0) ? "buyable" : "poor";
    if (it.kind === "buff") return rpg.emerald >= (it.bmPrice ?? 0) ? "buyable" : "poor";
    /* v3.0.24 (#버그) — 소모품(eert 큐브)은 누적 구매: owned 포함을 "보유함"으로 판정하던 버그 수정
     *  (기존엔 1개 구매 후 영구히 "보유함" 비활성화 → 두 번 못 사던 버그) */
    if (it.kind === "consumable") return rpg.emerald >= (it.bmPrice ?? 0) ? "buyable" : "poor";
    if (rpg.accessories.includes(k)) return "equipped";
    return rpg.owned.includes(k) ? "owned" : rpg.emerald >= (it.bmPrice ?? 0) ? "buyable" : "poor";
  };
  /* v3.0.24 (#수량) — 소모품/버프 수량 지정 (아이템키별) */
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const qtyOf = (k: string) => qtyMap[k] ?? 1;
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(88svh,640px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-cyan-300/60 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/assets/cos_aurora.png" alt="" className="h-8 w-8" style={{ imageRendering: "pixelated" }} />
            <div>
              <p className="text-sm font-black text-cyan-200">BM 상점</p>
              <p className="text-[10px] text-white/60">에메랄드 전용 — 보스·정예·반복 의뢰에서 획득</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EmeraldChip emerald={rpg.emerald} />
            <button onClick={onClose} aria-label="BM 상점 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">✕</button>
          </div>
        </div>

        {/* BM 아이템 */}
        <div className="flex flex-col gap-1.5">
          {BM_STOCK.map((k) => {
            const item = ITEMS[k as ItemKey];
            const st = bmState(k as ItemKey);
            const price = item.bmPrice ?? 0;
            const stackable = item.kind === "consumable" || item.kind === "buff"; // v3.0.24 — 수량 지정 대상
            const qty = qtyOf(k);
            const showQty = stackable && st === "buyable";
            const total = price * (stackable ? qty : 1);
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.05] px-2.5 py-2">
                <ItemIcon icon={item.icon} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-bold ${TIER_STYLE[item.tier].name}`}>
                    {item.name}
                    {(item.kind === "consumable" && (rpg.owned.filter((o) => o === k).length > 0)) && (
                      <span className="ml-1 text-white/60">×{rpg.owned.filter((o) => o === k).length}</span>
                    )}
                    <span className="ml-1.5 rounded bg-black/50 px-1 py-px text-[9px] font-black text-white/45">{TIER_STYLE[item.tier].label}</span>
                  </p>
                  <p className="text-[11px] text-cyan-200/80">{item.kind === "pet" ? PET_DEFS[k as PetKey]?.desc : item.kind === "buff" ? BUFF_DEFS[k as BuffKey]?.desc : itemEffect(item)}</p>
                </div>
                {showQty && <QtyStepper qty={qty} onChange={(n) => setQtyMap((m) => ({ ...m, [k]: n }))} />}
                <button
                  disabled={st === "owned" || st === "equipped" || st === "poor"}
                  onClick={() => EventBus.emit("rpg:bmBuy", { key: k as ItemKey, qty: stackable ? qty : 1 })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black transition-transform active:scale-95 ${
                    st === "equipped" ? "cursor-default bg-emerald-700/40 text-emerald-300"
                      : st === "owned" ? "cursor-default bg-slate-700/50 text-white/50"
                      : st === "buyable" ? "bg-cyan-400 text-slate-900 hover:bg-cyan-300"
                      : "cursor-not-allowed bg-slate-700/50 text-white/35"
                  }`}
                >
                  {st === "equipped" ? "장착 중" : st === "owned" ? "보유함" : showQty && qty > 1 ? `${total} 💎` : `${price} 💎`}
                </button>
              </div>
            );
          })}
        </div>

        {/* v3.0.15 (#6) — 자동 사용 설정은 가방(인벤토리)으로 이동 */}

        <p className="mt-2 text-center text-[10px] text-white/40">에메랄드 획득: 보스 +2 · 정예 +1 · 반복 의뢰 사이클 +1 · ESC로 닫기</p>
      </div>
    </div>
  );
}

export function ShopPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  /* v3.0.5 — 스타포스 강화 결과 플래시 (성공 금빛 링 / 실패 붉은 흔들림) */
  const [flash, setFlash] = useState<{ slot: "weapon" | "armor"; result: "ok" | "fail"; seq: number } | null>(null);
  /* v3.0.24 (#수량) — 소모품/버프 수량 지정 구매 (아이템키별) */
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const qtyOf = (k: string) => qtyMap[k] ?? 1;
  useEffect(() => {
    let seq = 0;
    const on = (v: { slot: "weapon" | "armor"; result: "ok" | "fail" }) =>
      setFlash({ slot: v.slot, result: v.result, seq: ++seq });
    EventBus.on("rpg:upgradeResult", on);
    return () => {
      EventBus.off("rpg:upgradeResult", on);
    };
  }, []);
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(88svh,640px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-amber-200/60 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            { }
            <img src="/assets/npc_merchant.png" alt="" className="h-8 w-8" style={{ imageRendering: "pixelated" }} />
            <div>
              <p className="text-sm font-black text-amber-200">상인 라고스</p>
              <p className="text-[10px] text-white/60">필요한 걸 골라 보게나~</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GoldChip gold={rpg.gold} />
            <EmeraldChip emerald={rpg.emerald} />
            {/* v3.0.7 — 유저 거래소 진입 (보스 드롭 전용 사고팔기) */}
            <button
              onClick={() => EventBus.emit("ui:panel", { panel: "trade" })}
              className="rounded-md border border-teal-300/60 bg-teal-400/15 px-2 py-1 text-[10px] font-black text-teal-200 hover:bg-teal-400/30"
            >
              거래소
            </button>
            {/* v3.0.6 (지시 #1) — BM 상점 진입 (에메랄드 전용 · 상점과 분리) */}
            <button
              onClick={() => EventBus.emit("ui:panel", { panel: "bmshop" })}
              className="rounded-md border border-cyan-300/60 bg-cyan-400/15 px-2 py-1 text-[10px] font-black text-cyan-200 hover:bg-cyan-400/30"
            >
              BM 상점
            </button>
            <button
              onClick={onClose}
              aria-label="상점 닫기"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 상점 섹션 — 물약·장비 / 버프 / 펫 / 치장 (v1.9 BM) */}
        <div className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {([
            { label: "물약 · 장비", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "consumable" || it.kind === "weapon" || it.kind === "armor" || it.kind === "accessory" },
            { label: "버프 물약", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "buff" },
            { label: "펫", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "pet" },
            { label: "치장", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "cosmetic" },
          ] as const).map((section) => {
            /* v3.0.15 (#11) — 챕터 테마 세트 장비: 해금된 세트만 표시 */
            const unlocked = new Set(rpg.unlockedSets ?? []);
            const isSetGear = (k: string) => k.startsWith("sfw_") || k.startsWith("sfa_") || k.startsWith("sfr_");
            const rows = rpg.shopStock.filter((k) => {
              if (!ITEMS[k as ItemKey] || !section.test(ITEMS[k as ItemKey])) return false;
              if (isSetGear(k)) {
                const ch = k.split("_")[1];
                return unlocked.has(ch);
              }
              return true;
            });
            if (rows.length === 0) return null;
            return (
              <div key={section.label} className="flex flex-col gap-1.5">
                <p className="mt-1 text-[10px] font-black tracking-wide text-white/45">{section.label}</p>
                {rows.map((k) => {
                  const item = ITEMS[k as ItemKey];
                  const st = shopState(rpg, k as ItemKey);
                  const count = item.kind === "buff" ? (rpg.buffItems[k] ?? 0) : undefined;
                  const stackable = item.kind === "consumable" || item.kind === "buff"; // v3.0.24
                  const qty = qtyOf(k);
                  const showQty = stackable && st === "buyable";
                  const total = item.price * (stackable ? qty : 1);
                  return (
                    <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                      <ItemIcon icon={item.icon} tier={item.tier} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] font-bold ${TIER_STYLE[item.tier].name}`}>
                          {item.name}
                          {typeof count === "number" && count > 0 && <span className="ml-1 text-white/60">×{count}</span>}
                          <span className="ml-1.5 rounded bg-black/50 px-1 py-px text-[9px] font-black text-white/45">
                            {TIER_STYLE[item.tier].label}
                          </span>
                        </p>
                        <p className="text-[11px] text-emerald-300/90">{itemEffect(item)}</p>
                      </div>
                      {showQty && <QtyStepper qty={qty} onChange={(n) => setQtyMap((m) => ({ ...m, [k]: n }))} />}
                      <button
                        disabled={st !== "buyable"}
                        onClick={() => EventBus.emit("rpg:buy", { key: k as ItemKey, qty: stackable ? qty : 1 })}
                        className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black transition-transform active:scale-95 ${
                          st === "equipped"
                            ? "cursor-default bg-emerald-700/40 text-emerald-300"
                            : st === "owned"
                              ? "cursor-default bg-slate-700/50 text-white/50"
                              : st === "buyable"
                                ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
                                : "cursor-not-allowed bg-slate-700/50 text-white/35"
                        }`}
                      >
                        {st === "equipped" ? "장착 중" : st === "owned" ? "보유함" : showQty && qty > 1 ? `${total} G` : `${item.price} G`}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* v3.0.5 — 스타포스 강화 (★15 확장 · 마일스톤 보너스 · 결과 연출) */}
        <div className="mt-2 rounded-lg border border-amber-200/25 bg-amber-300/[0.05] p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <img src="/assets/icon_hammer.png" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
            <p className="text-[12px] font-black text-amber-200">스타포스 강화</p>
            <p className="text-[10px] text-white/45">최대 ★{UPGRADE_MAX} · ★{UPGRADE_FALLBACK_FROM} 이상 실패 시 1성 하락</p>
            {/* v3.0.7 — 강화 주문서 충전 현황 */}
            {(rpg.starBless ?? 0) > 0 && (
              <span className="ml-auto rounded-md border border-purple-300/50 bg-purple-400/15 px-1.5 py-0.5 text-[9px] font-black text-purple-200">
                주문서 {(rpg.starBless ?? 0)}장 · +{(rpg.starBless ?? 0) * STAR_BLESS_RATE}%p
              </span>
            )}
          </div>
          {/* 마일스톤 효과 안내 — v3.0.20 (#8): 본당 즉시 상승 + 마일스톤 대폭 상향 */}
          <div className="mb-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 rounded-md bg-white/[0.04] px-2 py-1 text-[9px] leading-relaxed text-white/55">
            <span className="text-white/80">★1마다: 무기 공격+2+무기atk 8% / 방어구 방어+1+def 6%·HP+12</span>
            <span className="text-[#6ff2d8]">★5 무기 공격+8·치명+3% / 방어구 방어+1·HP+80</span>
            <span className="text-[#d29dff]">★10 무기 공격+14·치명+6% / 방어구 방어+3·HP+160</span>
            <span className="text-[#ffd76a]">★15 무기 공격+24·치명+12% / 방어구 방어+6·HP+220</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {(["weapon", "armor"] as const).map((slot) => {
              const key = slot === "weapon" ? rpg.weapon : rpg.armor;
              const item = ITEMS[key as ItemKey];
              if (!item) return null;
              const up = slot === "weapon" ? rpg.upWea : rpg.upArm;
              const maxed = up >= UPGRADE_MAX;
              const cost = upgradeCost(slot, up);
              /* v3.0.7 — 강화 주문서 충전분 성공률 가산 표기 */
              const bless = Math.min(rpg.starBless ?? 0, STAR_BLESS_MAX);
              const rate = (UPGRADE_RATES[up] ?? 0) + bless * STAR_BLESS_RATE;
              const affordable = rpg.gold >= cost;
              const tier = starTier(up);
              const tierCss = STAR_TIER_CSS[tier];
              const flashing = flash && flash.slot === slot ? flash.result : null;
              /* 다음 성 스탯 미리보기 (now → next) */
              const statLine =
                slot === "weapon"
                  ? `${(item.atk ?? 0) + starPerStarAtk(item.atk ?? 0) * up + starWeaponBonus(up).atk} → ${maxed ? "-" : (item.atk ?? 0) + starPerStarAtk(item.atk ?? 0) * (up + 1) + starWeaponBonus(up + 1).atk} 공격력` // v3.0.20 (#8) 본당 +2+8%
                  : `${(item.def ?? 0) + starPerStarDef(item.def ?? 0).def * up + starArmorBonus(up).def} → ${maxed ? "-" : (item.def ?? 0) + starPerStarDef(item.def ?? 0).def * (up + 1) + starArmorBonus(up + 1).def} 방어력`;
              return (
                <div
                  key={slot}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-500 ${
                    flashing === "ok"
                      ? "border-amber-300/90 bg-amber-300/15"
                      : flashing === "fail"
                        ? "animate-[sfshake_0.4s_ease] border-rose-400/70 bg-rose-400/10"
                        : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <ItemIcon icon={item.icon} size={26} tier={item.tier} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>
                      {displayName(item.name, up)}
                      <span className="ml-1 text-[10px] font-normal text-white/40">
                        {slot === "weapon" ? "무기" : "방어구"}
                      </span>
                    </p>
                    {/* v3.0.5 — 성 15칸 바 (티어색) */}
                    <div className="mt-0.5 flex items-center gap-[2px] text-[10px] leading-none">
                      {Array.from({ length: UPGRADE_MAX }, (_, i) => (
                        <span key={i} style={{ color: i < up ? tierCss : "#3b4353" }}>★</span>
                      ))}
                    </div>
                    <p className="mt-0.5 text-[10px] text-emerald-300/90">
                      {itemEffect(item, up)}
                      {!maxed && <span className="ml-1 text-white/35">({statLine})</span>}
                    </p>
                  </div>
                  <button
                    disabled={maxed || !affordable}
                    onClick={() => EventBus.emit("rpg:upgrade", { slot })}
                    className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black transition-transform active:scale-95 ${
                      maxed
                        ? "cursor-default bg-purple-800/40 text-purple-300"
                        : affordable
                          ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
                          : "cursor-not-allowed bg-slate-700/50 text-white/35"
                    }`}
                  >
                    {maxed ? "최대" : `${cost.toLocaleString()} G · ${rate}%${bless > 0 ? ` (+${bless * STAR_BLESS_RATE})` : ""}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-white/40">장비는 구매 시 즉시 장착됩니다 · 반지 4개/펜던트 2개 중복 장착 가능 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ================= v3.0.7 — 유저 거래소 (보스 드롭 9종 전용 사고팔기) =================
 *  보스 드롭은 상점에서 살 수 없다(tradeLock) → 여기서만 에메랄드로 거래.
 *  판매가는 구매가의 60% (수수료). 에메랄드 수급처: 보스 처치 +2 / 정예 +1 / 반복 의뢰 사이클 +1. */
export function TradePanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const ownedBd = TRADE_STOCK.filter((k) => rpg.owned.includes(k));
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(88svh,640px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-teal-200/60 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/assets/item_ring_guard.png" alt="" className="h-8 w-8" style={{ imageRendering: "pixelated" }} />
            <div>
              <p className="text-sm font-black text-teal-200">유저 거래소</p>
              <p className="text-[10px] text-white/60">보스 전용 드롭은 여기서만 사고팔 수 있어요</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EmeraldChip emerald={rpg.emerald} />
            <button
              onClick={onClose}
              aria-label="거래소 닫기"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 내 보유 전설 — 판매 */}
        {ownedBd.length > 0 && (
          <>
            <p className="mb-1 text-[11px] font-bold text-white/50">보유 전설 — 판매</p>
            <div className="mb-3 flex flex-col gap-1.5">
              {ownedBd.map((k) => {
                const item = ITEMS[k];
                const up = rpg.accUp?.[k] ?? 0;
                const worn = rpg.accessories.includes(k);
                return (
                  <div key={k} className="flex items-center gap-2.5 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] px-2.5 py-2">
                    <ItemIcon icon={item.icon} tier={item.tier} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] font-bold ${TIER_STYLE[item.tier].name}`}>
                        {displayName(item.name, up)}
                        <span className="ml-1.5 rounded bg-black/50 px-1 py-px text-[9px] font-black text-white/45">전설</span>
                      </p>
                      <p className="text-[11px] text-emerald-300/90">{itemEffect(item, up)}{worn ? " · 장착 중" : ""}</p>
                    </div>
                    <button
                      onClick={() => EventBus.emit("rpg:tradeSell", { key: k })}
                      className="shrink-0 rounded-md bg-teal-400 px-2.5 py-1.5 text-[11px] font-black text-slate-900 hover:bg-teal-300 active:scale-95"
                    >
                      판매 +{tradeValue(k)}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 구매 목록 — 9종 전체 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">판매 목록 (에메랄드)</p>
        <div className="flex max-h-[38vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {TRADE_STOCK.map((k) => {
            const item = ITEMS[k];
            const price = TRADE_PRICES[k] ?? 0;
            const owned = rpg.owned.includes(k);
            const affordable = rpg.emerald >= price && !owned;
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-bold ${TIER_STYLE[item.tier].name}`}>
                    {item.name}
                    <span className="ml-1.5 rounded bg-black/50 px-1 py-px text-[9px] font-black text-white/45">전설</span>
                  </p>
                  <p className="text-[11px] text-emerald-300/90">{itemEffect(item)}</p>
                </div>
                <button
                  disabled={!affordable}
                  onClick={() => EventBus.emit("rpg:tradeBuy", { key: k })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black transition-transform active:scale-95 ${
                    owned
                      ? "cursor-default bg-emerald-700/40 text-emerald-300"
                      : affordable
                        ? "bg-teal-400 text-slate-900 hover:bg-teal-300"
                        : "cursor-not-allowed bg-slate-700/50 text-white/35"
                  }`}
                >
                  {owned ? "보유함" : `${price} 에메랄드`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-center text-[10px] text-white/40">
          판매가는 구매가의 60%입니다 · 에메랄드 획득: 보스 +2 · 정예 +1 · 반복 의뢰 사이클 +1
        </p>
      </div>
    </div>
  );
}

export function InventoryPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  /* v3.0.15 (#6) — 자동 사용 설정 (BM 상점에서 이동). HUD rpg.autoUse 사용 */
  const auto = rpg.autoUse ?? { hpPct: 0, mpPct: 0, mpOn: false, buffs: [] as BuffKey[] };
  const equips = rpg.owned.filter((k) => {
    const it = ITEMS[k as ItemKey];
    return it && it.kind !== "consumable" && it.kind !== "accessory";
  });
  const accs = rpg.owned.filter((k) => ITEMS[k as ItemKey]?.kind === "accessory");
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(86svh,560px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-sky-200/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-sm font-black text-sky-200">가방</p>
          <div className="flex items-center gap-2">
            <GoldChip gold={rpg.gold} />
            <button
              onClick={onClose}
              aria-label="가방 닫기"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>

        {/* v3.0.15 (#6/#7) — 물약 통합 목록 + 퀵슬롯 장착: 기본/상급 물약 모두 HP/MP 버튼에 지정 가능 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">물약 — [H]는 HP 버튼, [M]은 MP 버튼에 장착</p>
        <div className="mb-3 flex flex-col gap-1.5">
          {(() => {
            const potRows: { k: ItemKey; count: number; use: () => void }[] = [
              { k: "potion_hp", count: rpg.hpPot, use: () => EventBus.emit("rpg:use", { kind: "hp" }) },
              { k: "potion_mp", count: rpg.mpPot, use: () => EventBus.emit("rpg:use", { kind: "mp" }) },
              { k: "potion_hp2", count: rpg.owned.filter((x) => x === "potion_hp2").length, use: () => EventBus.emit("rpg:useItem", { key: "potion_hp2" }) },
              { k: "potion_mp2", count: rpg.owned.filter((x) => x === "potion_mp2").length, use: () => EventBus.emit("rpg:useItem", { key: "potion_mp2" }) },
              { k: "potion_elixir", count: rpg.owned.filter((x) => x === "potion_elixir").length, use: () => EventBus.emit("rpg:useItem", { key: "potion_elixir" }) }, // v3.0.20 (#7)
            ];
            const qp = rpg.quickPots ?? { hp: "potion_hp", mp: "potion_mp" };
            return potRows.map(({ k, count, use }) => {
              const item = ITEMS[k];
              const onHp = qp.hp === k;
              const onMp = qp.mp === k;
              return (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <ItemIcon icon={item.icon} size={26} tier={item.tier} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-white">
                      {item.name} <span className="text-white/60">×{count}</span>
                    </p>
                    <p className="text-[10px] text-emerald-300/90">{itemEffect(item)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => EventBus.emit("rpg:quickpot", { slot: "hp", key: k })}
                      aria-label="HP 버튼에 장착"
                      className={`rounded-md px-1.5 py-1 text-[10px] font-black ${onHp ? "bg-rose-500 text-white" : "border border-white/15 bg-white/[0.04] text-white/50 hover:bg-white/10"}`}
                    >
                      H
                    </button>
                    <button
                      onClick={() => EventBus.emit("rpg:quickpot", { slot: "mp", key: k })}
                      aria-label="MP 버튼에 장착"
                      className={`rounded-md px-1.5 py-1 text-[10px] font-black ${onMp ? "bg-sky-500 text-white" : "border border-white/15 bg-white/[0.04] text-white/50 hover:bg-white/10"}`}
                    >
                      M
                    </button>
                    <button
                      disabled={count <= 0}
                      onClick={use}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-black ${
                        count > 0
                          ? "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-95"
                          : "cursor-not-allowed bg-slate-700/50 text-white/35"
                      }`}
                    >
                      사용
                    </button>
                    {/* v3.0.20 (#7) — 물약 판매 (상점가 40%) */}
                    {count > 0 && sellValue(item) > 0 && (
                      <button
                        onClick={() => EventBus.emit("rpg:sellPotion", { key: k })}
                        aria-label={`${item.name} 판매`}
                        className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1.5 text-[10px] font-black text-white/70 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95"
                      >
                        판매 {sellValue(item)}G
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* 소지품 (v2.5 — 상급 물약/스크롤류, owned 기반) */}
        {(() => {
          const consumables = Object.entries(
            rpg.owned.reduce<Record<string, number>>((acc, k) => {
              if (k === "potion_hp2" || k === "potion_mp2" || k === "scroll_return" || k === "scroll_warp" || k === "scroll_star" || k === "eert_cube") {
                acc[k] = (acc[k] ?? 0) + 1;
              }
              return acc;
            }, {})
          ); /* v3.0.3 (지시 #4) — 같은 소모품은 한 행으로 겹침 (보유 수량 표기) */
          if (consumables.length === 0) return null;
          return (
            <>
              <p className="mb-1 text-[11px] font-bold text-white/50">소지품</p>
              <div className="mb-3 flex flex-col gap-1.5">
                {consumables.map(([k, count]) => {
                  const item = ITEMS[k as ItemKey];
                  const isScroll = k === "scroll_return" || k === "scroll_warp" || k === "scroll_star";
                  const isEertCube = k === "eert_cube";
                  const isStarScroll = k === "scroll_star";
                  const effect = k === "potion_hp2" ? `HP +${item.heal} 회복`
                    : k === "potion_mp2" ? `MP +${item.restore} 회복`
                    : k === "potion_elixir" ? "HP/MP 한 번에 100% 회복"
                    : k === "scroll_return" ? "미드가르드 마을로 즉시 귀환"
                    : k === "scroll_star" ? `다음 강화 성공률 +${STAR_BLESS_RATE}%p (충전 최대 ${STAR_BLESS_MAX}장)`
                    : k === "eert_cube" ? "장비 잠재옵션 재추첨 — 장비 행의 [eert] 버튼으로 사용 (1개 소모)"
                    : "방문한 적 있는 구역으로 이동";
                  return (
                    <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                      <ItemIcon icon={item.icon} size={26} tier={item.tier} count={count} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>{item.name} <span className="text-white/60">×{count}</span></p>
                        <p className="text-[10px] text-emerald-300/90">{effect}</p>
                      </div>
                      {/* v3.0.20 (#9) — eert는 마시는 물약이 아니라 큐브: 장비 행에서 사용 */}
                      {isEertCube ? (
                        <span className="shrink-0 rounded-md border border-orange-300/50 bg-orange-500/15 px-2 py-1.5 text-[10px] font-black text-orange-200">장비에서 사용</span>
                      ) : (
                        <button
                          onClick={() => (isStarScroll ? EventBus.emit("rpg:starScroll") : EventBus.emit("rpg:useItem", { key: k }))}
                          className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black text-white active:scale-95 ${
                            isStarScroll ? "bg-purple-500 hover:bg-purple-400" : "bg-sky-500 hover:bg-sky-400"
                          }`}
                        >
                          {isStarScroll ? "충전" : isScroll ? "사용" : "마시기"}
                        </button>
                      )}
                      {/* v3.0.20 (#7/#9) — 소모품 판매 (엘릭서·eert 5000G 등) */}
                      {sellValue(item) > 0 && (
                        <button
                          onClick={() => EventBus.emit("rpg:sell", { key: k as ItemKey })}
                          aria-label={`${item.name} 판매`}
                          className="shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-2 py-1.5 text-[10px] font-black text-white/70 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95"
                        >
                          판매 {sellValue(item)}G
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* 장비 — v3.0.3 (지시 #4): 아이콘+수량으로 겹침 (×N) */}
        <p className="mb-1 text-[11px] font-bold text-white/50">장비</p>
        <div className="flex flex-col gap-1.5">
          {stackEquips(equips).map(([k, count]) => {
            const item = ITEMS[k as ItemKey];
            if (!item) return null;
            const equipped = rpg.weapon === k || rpg.armor === k;
            const up = item.kind === "weapon" ? rpg.upWea : rpg.upArm;
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} size={26} tier={item.tier} count={count} potGrade={rpg.potentials?.[k]?.grade} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>{displayName(item.name, up)}{count > 1 ? ` ×${count}` : ""}</p>
                  <p className="text-[10px] text-emerald-300/90">{itemEffect(item, up)}</p>
                  <PotViewLines pot={rpg.potentials?.[k]} />
                </div>
                <button
                  disabled={(rpg.eertCube ?? 0) <= 0}
                  onClick={() => EventBus.emit("rpg:eert", { key: k })}
                  aria-label="eert 큐브로 잠재옵션 재추첨"
                  title="eert 큐브 사용 — 잠재옵션 재추첨"
                  className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black ${
                    (rpg.eertCube ?? 0) > 0
                      ? "border-orange-300/60 bg-orange-500/20 text-orange-200 hover:bg-orange-500/35 active:scale-95"
                      : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/25"
                  }`}
                >
                  eert {(rpg.eertCube ?? 0) > 0 ? `×${rpg.eertCube}` : ""}
                </button>
                {equipped ? (
                  <span className="shrink-0 rounded-md bg-emerald-700/40 px-2.5 py-1.5 text-[11px] font-black text-emerald-300">
                    장착 중
                  </span>
                ) : (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => EventBus.emit("rpg:equip", { key: k as ItemKey })}
                      className="rounded-md bg-amber-400 px-2.5 py-1.5 text-[11px] font-black text-slate-900 hover:bg-amber-300 active:scale-95"
                    >
                      장착
                    </button>
                    {/* v3.0.6 (지시 #4) — 아이템 판매 (상점가 40%) */}
                    {sellValue(item) > 0 && (
                      <button
                        onClick={() => EventBus.emit("rpg:sell", { key: k as ItemKey })}
                        className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/70 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95"
                      >
                        판매 {sellValue(item)}G
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* v3.0.16 — 세트 아이템 효과 (메이플 세트 아이템): 동일 챕터 세트 3종 착용 시 활성 */}
        {(() => {
          const as = rpg.activeSet;
          return (
            <div className={`mt-3 rounded-lg border p-2.5 ${as ? "border-amber-300/60 bg-amber-400/[0.08]" : "border-white/15 bg-white/[0.04]"}`}>
              <div className="flex items-center justify-between">
                <p className={`text-[12px] font-black ${as ? "text-amber-200" : "text-white/70"}`}>
                  {as ? `세트 효과 활성 — ${as.title}` : "세트 효과"}
                </p>
                {as && <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-black text-amber-200">ON</span>}
              </div>
              {as ? (
                <p className="mt-1 text-[11px] font-bold text-amber-100/90">{as.lines.join(" · ")}</p>
              ) : (
                <p className="mt-1 text-[10px] leading-snug text-white/45">
                  같은 챕터 테마 장비 세트(무기 + 방어구 + 장신구 반지)를 모두 착용하면 세트 보너스가 활성화됩니다 — 마을 상점에서 챕터 세트 장비를 구매해보세요!
                </p>
              )}
            </div>
          );
        })()}

        {/* v3.0.15 (#6) — 자동 물약/버프 설정 (BM 상점에서 이동) */}
        <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.04] p-2.5">
          <p className="mb-1.5 text-[12px] font-black text-white/80">자동 사용 설정 (전투 중 자동으로 사용)</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-1.5">
              <p className="text-[12px] font-bold text-white/85">자동 HP 물약 — {auto.hpPct === 0 ? "HP 버튼에 장착한 물약" : `${auto.hpPct}% 이하`}</p>
              <button
                onClick={() => EventBus.emit("rpg:autoset", { hpPct: auto.hpPct === 0 ? 30 : auto.hpPct === 30 ? 50 : auto.hpPct === 50 ? 70 : 0 })}
                className="rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-black text-white hover:bg-sky-400 active:scale-95"
              >
                {auto.hpPct === 0 ? "끄기" : `${auto.hpPct}% 이하`}
              </button>
            </div>
            <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-1.5">
              <p className="text-[12px] font-bold text-white/85">자동 MP 물약 — {(auto.mpPct ?? 0) === 0 ? (auto.mpOn ? "25% 이하 (기존 설정)" : "MP 버튼에 장착한 물약") : `${auto.mpPct}% 이하`}</p>
              <button
                /* v3.0.20 (#3) — MP도 % 지정 (기존 켜기/끄기 대체) */
                onClick={() => EventBus.emit("rpg:autoset", { mpPct: (auto.mpPct ?? 0) === 0 ? 30 : auto.mpPct === 30 ? 50 : auto.mpPct === 50 ? 70 : 0, mpOn: false })}
                className="rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-black text-white hover:bg-sky-400 active:scale-95"
              >
                {(auto.mpPct ?? 0) === 0 ? (auto.mpOn ? "25% 이하" : "끄기") : `${auto.mpPct}% 이하`}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-white/45">자동 버프 — 보유 중인 물약을 자동으로 사용 (중복 선택 가능)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["buff_atk", "buff_def", "buff_spd", "buff_exp", "buff_king"] as BuffKey[]).map((b) => {
                const on = (auto.buffs ?? []).includes(b);
                const have = (rpg.buffItems[b] ?? 0) > 0;
                const buffNames: Record<string, string> = {
                  buff_atk: "분노 (공격+25%)",
                  buff_def: "수호 (방어+8)",
                  buff_spd: "신속 (이동+25%)",
                  buff_exp: "지혜 (경험치+50%)",
                  buff_king: "왕의 가호 (올인원)",
                };
                return (
                  <button
                    key={b}
                    onClick={() => EventBus.emit("rpg:autoset", { buffs: on ? (auto.buffs ?? []).filter((x) => x !== b) : [...(auto.buffs ?? []), b] })}
                    className={`rounded-md border px-2 py-1.5 text-[10px] font-bold transition-colors ${
                      on ? "border-amber-300/70 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/[0.03] text-white/55"
                    }`}
                  >
                    {buffNames[b]}
                    {!have && <span className="ml-1 text-white/35">(보유 없음)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 장신구 (v2.9 #8 — 메이플식 슬롯: 반지 4 + 펜던트 2 중복 장착) */}
        <p className="mb-1 mt-2.5 text-[11px] font-bold text-white/50">장신구 슬롯 (반지 4 · 펜던트 2)</p>
        {/* 장착 슬롯 그리드 — 메이플 장비창 감각 */}
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {(() => {
            const worn = [...rpg.accessories]; // 원본 변이 금지 — 복사본에서 순서대로 소비
            return Array.from({ length: 6 }).map((_, i) => {
            const isPendant = i >= 4;
            const slotKind = isPendant ? "pendant" : "ring";
            const wornIdx = worn.findIndex((k) => (ITEMS[k as ItemKey]?.slot ?? "ring") === slotKind);
            const wornKey = wornIdx >= 0 ? (worn.splice(wornIdx, 1)[0] as string) : null;
            const item = wornKey ? ITEMS[wornKey as ItemKey] : null;
            return (
              <button
                key={i}
                title={item ? `${item.name} — 탭하여 해제` : `${isPendant ? "펜던트" : "반지"} 슬롯 (비어 있음)`}
                onClick={() => wornKey && EventBus.emit("rpg:unequip", { key: wornKey as ItemKey })}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border-2 ${
                  item ? "border-amber-300/50 bg-amber-400/10" : "border-dashed border-white/15 bg-white/[0.02]"
                }`}
              >
                {item ? (
                  <ItemIcon icon={item.icon} size={24} tier={item.tier} />
                ) : (
                  <span className="text-[9px] font-bold text-white/30">{isPendant ? "펜던트" : "반지"}</span>
                )}
              </button>
            );
            });
          })()}
        </div>
        <div className="flex flex-col gap-1.5">
          {accs.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-2 text-[11px] text-white/35">
              보유한 장신구가 없습니다 — 상인 라고스에게서 구매할 수 있어요
            </p>
          )}
          {stackEquips(accs).map(([k, ownedN]) => {
            const item = ITEMS[k as ItemKey];
            if (!item) return null;
            /* v2.9 — 중복 장착: 보유 n개 중 장착 m개 (v3.0.3 — count가 보유 n) */
            if (k !== accs.filter((x) => x === k)[0]) return null; // 동일 키 1회만 렌더
            const wornN = rpg.accessories.filter((x) => x === k).length;
            const canWearMore = wornN < ownedN;
            /* v3.0.7 — 장신구 스타포스 표시/강화 버튼 */
            const up = rpg.accUp?.[k] ?? 0;
            const accBonus = starAccBonus(up, item);
            const accMaxed = up >= UPGRADE_MAX;
            const accCost = upgradeCost("weapon", up);
            const accRate = UPGRADE_RATES[up] ?? 0;
            const accAffordable = rpg.gold >= accCost;
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} size={26} tier={item.tier} potGrade={rpg.potentials?.[k]?.grade} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>{displayName(item.name, up)}{ownedN > 1 ? ` ×${ownedN}` : ""}</p>
                  <p className="text-[10px] text-emerald-300/90">
                    {itemEffect(item)}
                    {accBonus.crit > 0 && <span className="ml-1 text-[#d29dff]">+치명 {accBonus.crit}%</span>}
                    {accBonus.hp > 0 && <span className="ml-1 text-[#6ff2d8]">+HP {accBonus.hp}</span>}
                    {wornN > 0 ? ` · 장착 ${wornN}/${ownedN}` : ""}
                  </p>
                  <PotViewLines pot={rpg.potentials?.[k]} />
                  {/* v3.0.7 — 성 바 (장신구 스타포스) */}
                  {up > 0 && (
                    <div className="mt-0.5 flex items-center gap-[2px] text-[9px] leading-none">
                      {Array.from({ length: UPGRADE_MAX }, (_, i) => (
                        <span key={i} style={{ color: i < up ? STAR_TIER_CSS[starTier(up)] : "#3b4353" }}>★</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    disabled={(rpg.eertCube ?? 0) <= 0}
                    onClick={() => EventBus.emit("rpg:eert", { key: k })}
                    title="eert 큐브 사용 — 잠재옵션 재추첨"
                    className={`rounded-md border px-2 py-1 text-[10px] font-black active:scale-95 ${
                      (rpg.eertCube ?? 0) > 0
                        ? "border-orange-300/60 bg-orange-500/20 text-orange-200 hover:bg-orange-500/35"
                        : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/25"
                    }`}
                  >
                    eert {(rpg.eertCube ?? 0) > 0 ? `×${rpg.eertCube}` : ""}
                  </button>
                  {!accMaxed && (
                    <button
                      disabled={!accAffordable}
                      onClick={() => EventBus.emit("rpg:upgradeAcc", { key: k as ItemKey })}
                      className={`rounded-md px-2 py-1 text-[10px] font-black active:scale-95 ${
                        accAffordable ? "bg-amber-400 text-slate-900 hover:bg-amber-300" : "cursor-not-allowed bg-slate-700/50 text-white/35"
                      }`}
                    >
                      강화 {accCost}G · {accRate}%
                    </button>
                  )}
                  {canWearMore ? (
                    <button
                      onClick={() => EventBus.emit("rpg:equip", { key: k as ItemKey })}
                      className="rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-black text-white hover:bg-sky-400 active:scale-95"
                    >
                      장착
                    </button>
                  ) : (
                    <span className="rounded-md bg-emerald-700/40 px-2 py-1 text-center text-[10px] font-black text-emerald-300">장착 중</span>
                  )}
                  {tradeValue(k as ItemKey) > 0 ? (
                    <button
                      onClick={() => EventBus.emit("ui:panel", { panel: "trade" })}
                      className="rounded-md border border-teal-300/40 bg-teal-400/10 px-2 py-1 text-[10px] font-black text-teal-200 hover:bg-teal-400/25 active:scale-95"
                    >
                      거래소 +{tradeValue(k as ItemKey)}
                    </button>
                  ) : sellValue(item) > 0 ? (
                    <button
                      onClick={() => EventBus.emit("rpg:sell", { key: k as ItemKey })}
                      className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white/70 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95"
                    >
                      판매 {sellValue(item)}G
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {/* BM (v1.9): 버프 물약 / 펫 / 치장 */}
        <p className="mb-1 mt-2.5 text-[11px] font-bold text-white/50">버프 물약 (BM)</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(BUFF_DEFS) as BuffKey[]).map((bk) => {
            const def = BUFF_DEFS[bk];
            const count = rpg.buffItems[bk] ?? 0;
            return (
              <div key={bk} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={def.icon} size={26} tier="rare" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">{def.name} <span className="text-white/60">×{count}</span></p>
                  <p className="text-[10px] text-emerald-300/90">{def.desc} · {Math.round(def.duration / 1000)}초</p>
                </div>
                <button
                  disabled={count <= 0}
                  onClick={() => EventBus.emit("rpg:useBuff", { key: bk })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black ${
                    count > 0 ? "bg-sky-500 text-white hover:bg-sky-400 active:scale-95" : "cursor-not-allowed bg-slate-700/50 text-white/35"
                  }`}
                >
                  사용
                </button>
              </div>
            );
          })}
        </div>

        <p className="mb-1 mt-2.5 text-[11px] font-bold text-white/50">펫</p>
        <div className="flex flex-col gap-1.5">
          {rpg.pets.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-2 text-[11px] text-white/35">
              보유한 펫이 없습니다 — 상인 라고스에게서 구매할 수 있어요
            </p>
          )}
          {rpg.pets.map((pk) => {
            const def = PET_DEFS[pk as PetKey];
            if (!def) return null;
            const active = rpg.pet === pk;
            return (
              <div key={pk} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={def.icon} size={26} tier="rare" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">{def.name}</p>
                  <p className="text-[10px] text-emerald-300/90">{def.desc}</p>
                </div>
                <button
                  onClick={() => EventBus.emit("rpg:pet", { key: active ? null : pk })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black active:scale-95 ${
                    active ? "bg-emerald-700/40 text-emerald-300" : "bg-amber-400 text-slate-900 hover:bg-amber-300"
                  }`}
                >
                  {active ? "해제" : "소환"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mb-1 mt-2.5 text-[11px] font-bold text-white/50">치장 (오라)</p>
        <div className="flex flex-col gap-1.5">
          {rpg.cosmetics.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-2 text-[11px] text-white/35">
              보유한 치장이 없습니다 — 상인 라고스에게서 구매할 수 있어요
            </p>
          )}
          {rpg.cosmetics.map((ck) => {
            const def = COSMETIC_DEFS[ck as CosmeticKey];
            if (!def) return null;
            const active = rpg.cosmetic === ck;
            return (
              <div key={ck} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={def.icon} size={26} tier="epic" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">{def.name}</p>
                  <p className="text-[10px] text-emerald-300/90">{def.desc}</p>
                </div>
                <button
                  onClick={() => EventBus.emit("rpg:cosmetic", { key: active ? null : ck })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black active:scale-95 ${
                    active ? "bg-emerald-700/40 text-emerald-300" : "bg-amber-400 text-slate-900 hover:bg-amber-300"
                  }`}
                >
                  {active ? "해제" : "착용"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] text-white/40">Q: HP 물약 · 버프는 사용 즉시 효과 시작 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- v3.0.3 — GM 패널 (사용자 지시 #2: 임시 GM NPC로 자유전직/골드/레벨 수정) ---------- */

const GM_FAM_LABEL: Record<string, string> = {
  warrior: "전사", ranger: "궁수", mage: "마법사", thief: "도적",
};

export function GmPanel({ onClose }: { onClose: () => void }) {
  useEscClose(onClose);
  const tierLabel = (t: number) => (t === 1 ? "1차" : t === 2 ? "2차" : t === 3 ? "3차" : "4차");
  const all = Object.values(CLASSES);
  const byTier = [1, 2, 3, 4].map((t) => all.filter((d) => d.tier === t));
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(88svh,640px)] w-[min(94vw,470px)] overflow-y-auto rounded-xl border-2 border-amber-300/60 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-sm font-black text-amber-300">GM — 운영자 지원 (임시)</p>
          <button
            onClick={onClose}
            aria-label="GM 패널 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 rounded-lg border border-amber-300/25 bg-amber-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/80">
          자유전직은 트리·레벨 조건 없이 즉시 적용됩니다. 스킬 슬롯(3차 3개 / 4차 4개)이 전직 즉시 바뀌고 HP/MP가 재계산됩니다.
        </p>

        {/* 자유전직 — 전체 28 클래스 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">자유 전직 (전 직업 · 전 티어)</p>
        <div className="mb-3 flex flex-col gap-2">
          {byTier.map((list) => (
            <div key={list[0]?.tier}>
              <p className="mb-1 text-[10px] font-bold text-white/35">{tierLabel(list[0]?.tier ?? 1)} ({list.length})</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {list.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => EventBus.emit("rpg:gm", { type: "job", value: d.key })}
                    className="flex flex-col items-start rounded-lg border px-2 py-1.5 text-left transition-transform active:scale-95"
                    style={{ borderColor: `${d.color}44`, background: `linear-gradient(135deg, ${d.color}14, rgba(0,0,0,0.4))` }}
                  >
                    <span className="truncate text-[11px] font-black" style={{ color: d.color }}>{d.name}</span>
                    <span className="w-full truncate text-[9px] text-white/45">
                      {d.tier === 1 ? GM_FAM_LABEL[d.key] ?? "" : d.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 골드/레벨/기타 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">자원 조정</p>
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          {([10000, 100000, 1000000] as const).map((v) => (
            <button
              key={v}
              onClick={() => EventBus.emit("rpg:gm", { type: "gold", value: v })}
              className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-2 py-2 text-[11px] font-black text-amber-200 hover:bg-amber-400/20 active:scale-95"
            >
              +{v >= 1000000 ? "100만" : v >= 10000 ? `${v / 10000}만` : v} G
            </button>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "lv", value: 10 })}
            className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-2 py-2 text-[11px] font-black text-sky-200 hover:bg-sky-400/20 active:scale-95"
          >
            Lv 10
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "lv", value: 100 })}
            className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-2 py-2 text-[11px] font-black text-sky-200 hover:bg-sky-400/20 active:scale-95"
          >
            Lv 100
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "lv", value: 200 })}
            className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-2 py-2 text-[11px] font-black text-sky-200 hover:bg-sky-400/20 active:scale-95"
          >
            Lv 200
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "heal" })}
            className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-2 py-2 text-[11px] font-black text-emerald-200 hover:bg-emerald-400/20 active:scale-95"
          >
            HP/MP 풀회복
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "ap", value: 50 })}
            className="rounded-lg border border-lime-300/40 bg-lime-400/10 px-2 py-2 text-[11px] font-black text-lime-200 hover:bg-lime-400/20 active:scale-95"
          >
            AP +50
          </button>
          {/* v3.0.6 — BM 상점 테스트용 에메랄드 지급 */}
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "em", value: 50 })}
            className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-2 py-2 text-[11px] font-black text-cyan-200 hover:bg-cyan-400/20 active:scale-95"
          >
            에메랄드 +50
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-white/40">ESC로 닫기 · 변경 사항은 즉시 세이브에 반영</p>
      </div>
    </div>
  );
}

/* ================= v3.0.16 — 몬스터 컬렉션 (메이플 몬스터 컬렉션) =================
 *  잡몹 32종 + 보스 9종 도감. 최초 처치 시 등록, 등록 종수가 마일스톤을 채우면 계정 스탯 상승. */
function CollectionPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const kills = rpg.collection?.kills ?? {};
  const registered = rpg.collection?.registered ?? 0;
  const total = rpg.collection?.total ?? Object.keys(ENEMIES).length + Object.keys(BOSS_DEFS).length;
  const bonus = collectionBonus(registered);
  const next = nextCollectionGoal(registered);
  const bonusLines: string[] = [];
  if (bonus.atkPct) bonusLines.push(`공격력 +${bonus.atkPct}%`);
  if (bonus.critAdd) bonusLines.push(`크리티컬 +${bonus.critAdd}%`);
  if (bonus.hpAdd) bonusLines.push(`최대 HP +${bonus.hpAdd}`);
  const mobKeys = Object.keys(ENEMIES) as EnemyKey[];
  const bossKeys = Object.keys(BOSS_DEFS) as BossKey[];
  const card = (id: string, name: string, iconUrl: string) => {
    const n = kills[id] ?? 0;
    const got = n > 0;
    return (
      <div
        key={id}
        title={got ? `${name} — 처치 ×${n}` : "미등록 — 처치하면 등록!"}
        className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 ${
          got ? "border-emerald-300/40 bg-emerald-400/[0.07]" : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <img
          src={iconUrl}
          alt={name}
          draggable={false}
          className={`h-9 w-9 ${got ? "" : "opacity-20 grayscale"}`}
          style={{ imageRendering: "pixelated" }}
        />
        <p className={`w-full truncate text-center text-[8.5px] font-bold leading-tight ${got ? "text-white" : "text-white/30"}`}>
          {got ? name : "???"}
        </p>
        <p className={`text-[8px] font-black ${got ? "text-emerald-300" : "text-white/25"}`}>{got ? `×${n}` : "미등록"}</p>
      </div>
    );
  };
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(88svh,620px)] w-[min(92vw,470px)] overflow-y-auto rounded-xl border-2 border-violet-200/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-violet-200">몬스터 컬렉션</p>
            <p className="text-[10px] text-white/50">몬스터를 처치하면 도감에 등록 — 등록 종수가 늘면 계정 스탯이 상승!</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-violet-500/25 px-2 py-1 text-[12px] font-black text-violet-200">
              {registered} / {total}
            </span>
            <button
              onClick={onClose}
              aria-label="컬렉션 닫기"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>

        {/* v3.0.22 (#43/#44/#50) — 세계수 결정 수집 현황 (챕터마다 다른 결정 + 완전 수집 시 영구 가호) */}
        <div className={`mb-2 rounded-lg border p-2.5 ${rpg.blessing ? "border-sky-300/60 bg-sky-400/[0.1]" : "border-white/15 bg-white/[0.04]"}`}>
          <p className="text-[12px] font-black text-sky-200">
            🌳 세계수 결정 — {rpg.fragFound ?? 0} / {rpg.fragTotal ?? 9} 챕터 수집
            {rpg.blessing ? " · 가호 활성" : ""}
          </p>
          <p className="mt-0.5 text-[10px] font-bold text-white/50">
            {rpg.blessing
              ? "아홉 왕국의 결정이 모두 모였다 — ATK+20 · DEF+8 · HP+200 · 공격 +3% (영구)"
              : "챕터마다 다른 결정이 숨어 있다. 전부 모으면 세계수의 가호를 얻는다 (ATK+20 · DEF+8 · HP+200 · 공격 +3%)"}
          </p>
        </div>

        {/* 보너스 요약 */}
        <div className={`mb-2 rounded-lg border p-2.5 ${bonusLines.length > 0 ? "border-emerald-300/50 bg-emerald-400/[0.08]" : "border-white/15 bg-white/[0.04]"}`}>
          <p className="text-[12px] font-black text-emerald-200">
            {bonusLines.length > 0 ? `컬렉션 보너스 — ${bonusLines.join(" · ")}` : "아직 컬렉션 보너스가 없습니다"}
          </p>
          {next && (
            <p className="mt-0.5 text-[10px] text-white/50">
              다음 목표: <span className="font-bold text-white/80">{next.n}종 등록</span> → {next.label}
            </p>
          )}
          {/* 마일스톤 칩 */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {COLLECTION_MILESTONES.map((m) => {
              const on = registered >= m.n;
              return (
                <span
                  key={m.n}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                    on ? "bg-emerald-500/25 text-emerald-200" : "bg-white/[0.05] text-white/35"
                  }`}
                >
                  {on ? "✓" : m.n}종 {m.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* 잡몹 도감 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">일반 몬스터 ({mobKeys.filter((k) => (kills[k] ?? 0) > 0).length}/{mobKeys.length})</p>
        <div className="mb-3 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {mobKeys.map((k) => card(k, ENEMIES[k].name, `/assets/${k}_idle0.png`))}
        </div>

        {/* 보스 도감 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">보스 몬스터 ({bossKeys.filter((k) => (kills[`boss_${k}`] ?? 0) > 0).length}/{bossKeys.length})</p>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {bossKeys.map((k) => card(`boss_${k}`, BOSS_DEFS[k].name, `/assets/${BOSS_DEFS[k].tex}_idle0.png`))}
        </div>

        <p className="mt-2 text-center text-[10px] text-white/40">M키로 열기 · 등록 보너스는 모든 구역에서 항상 적용됩니다 · ESC로 닫기</p>
      </div>
    </div>
  );
}

export function GamePanels({
  panel,
  rpg,
  hud,
  questLog,
  onClose,
}: {
  panel: PanelKind;
  rpg: RpgState;
  hud: HudState;
  questLog: QuestLogState;
  onClose: () => void;
}) {
  if (panel === "shop") return <ShopPanel rpg={rpg} onClose={onClose} />;
  if (panel === "bmshop") return <BmShopPanel rpg={rpg} onClose={onClose} />; // v3.0.6 — BM 상점
  if (panel === "trade") return <TradePanel rpg={rpg} onClose={onClose} />; // v3.0.7 — 유저 거래소
  if (panel === "inv") return <InventoryPanel rpg={rpg} onClose={onClose} />;
  if (panel === "warp") return <WarpPanel rpg={rpg} onClose={onClose} />;
  if (panel === "job") return <JobPanel rpg={rpg} onClose={onClose} />;
  if (panel === "gm") return <GmPanel onClose={onClose} />; // v3.0.3 — GM NPC
  if (panel === "stat") return <StatPanel rpg={rpg} hud={hud} onClose={onClose} />;
  if (panel === "collection") return <CollectionPanel rpg={rpg} onClose={onClose} />; // v3.0.16 — 몬스터 컬렉션
  if (panel === "quest") return <QuestLogPanel questLog={questLog} rpg={rpg} onClose={onClose} />;
  if (panel === "opt") return <KeymapPanel onClose={onClose} />;
  return null;
}

/* ---------- 지역 이동 패널 (v2.5 — 지시 #7: 방문한 적 있는 구역으로 워프, 부적 1장 소모) ---------- */

export function WarpPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  // 방문 기록 — 세이브에서 직접 조회 (씬이 구역 도착 시 저장)
  const [visited, setVisited] = useState<string[]>(() => loadSave()?.visited ?? []);
  useEffect(() => {
    const t = setInterval(() => {
      const v = loadSave()?.visited ?? [];
      setVisited((cur) => (cur.length === v.length && cur.every((s) => v.includes(s)) ? cur : v));
    }, 600);
    return () => clearInterval(t);
  }, []);

  const hasScroll = rpg.owned.includes("scroll_warp");
  const visitedSet = new Set(visited);
  // 마을 + 챕터별 구역 그룹핑
  const groups: { label: string; stages: { key: StageKey; name: string }[] }[] = [
    { label: "시작 마을", stages: visitedSet.has("village" as StageKey) ? [{ key: "village" as StageKey, name: STAGE_SHORT["village" as StageKey] }] : [] },
  ];
  for (const ch of CHAPTERS) {
    const stages: { key: StageKey; name: string }[] = [];
    for (let sub = 1; sub <= 10; sub++) {
      const key = `${ch.key}${sub}` as StageKey;
      if (visitedSet.has(key)) stages.push({ key, name: STAGE_SHORT[key] ?? key });
    }
    if (stages.length > 0) groups.push({ label: `제${ch.num}장 ${ch.title}`, stages });
  }
  const empty = visited.length === 0 || groups.every((g) => g.stages.length === 0);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(86svh,560px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-violet-200/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-sm font-black text-violet-200">지역 이동 (부적)</p>
          <button
            onClick={onClose}
            aria-label="지역 이동 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        {!hasScroll && (
          <p className="mb-2 rounded-lg border border-amber-300/40 bg-amber-500/10 px-2.5 py-2 text-[11px] font-bold text-amber-200">
            지역 이동 부적이 없습니다 — 상인 라고스에게서 구매할 수 있어요 (120G)
          </p>
        )}

        {empty ? (
          <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-3 text-[11px] text-white/40">
            아직 기록된 방문 구역이 없습니다 — 구역에 한 번이라도 도착하면 여기에 기록되고, 부적으로 이동할 수 있어요.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {groups.map((g) =>
              g.stages.length === 0 ? null : (
                <div key={g.label}>
                  <p className="mb-1 text-[11px] font-bold text-white/50">{g.label}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {g.stages.map((s) => (
                      <button
                        key={s.key}
                        disabled={!hasScroll}
                        onClick={() => EventBus.emit("rpg:warp", { stage: s.key })}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold transition-colors ${
                          hasScroll
                            ? "border-white/15 bg-white/[0.05] text-white hover:border-violet-300/60 hover:bg-violet-500/15 active:scale-95"
                            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
        <p className="mt-2.5 text-center text-[10px] text-white/40">이동 1회당 지역 이동 부적 1장 소모 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- 전직 패널 (v1.8 — 메이플 모험가 구조: 1차 계열 → 2차 세부직업 → 3차 승격 + 자유전직) ---------- */

/** 이번 단계 증분 보너스 라인 */
function statLines(d: ClassDef): string[] {
  const out: string[] = [];
  if (d.atkPct > 0) out.push(`공격력 +${d.atkPct}%`);
  if (d.critAdd > 0) out.push(`크리티컬 +${d.critAdd}%p`);
  if (d.defAdd > 0) out.push(`방어력 +${d.defAdd}`);
  if (d.hpAdd > 0) out.push(`최대 HP +${d.hpAdd}`);
  if (d.mpAdd > 0) out.push(`최대 MP +${d.mpAdd}`);
  if (d.speedPct > 0) out.push(`이동속도 +${d.speedPct}%`);
  if (d.cdMult !== 1) out.push(`스킬 쿨다운 -${Math.round((1 - d.cdMult) * 100)}%`);
  if (d.skillMult !== 1) out.push(`스킬 피해 +${Math.round((d.skillMult - 1) * 100)}%`);
  return out;
}

const TIER_LABEL: Record<number, string> = { 1: "1차 전직", 2: "2차 전직", 3: "3차 전직" };

function JobCard({
  d,
  locked,
  lockText,
  btnText,
  onPick,
  dim,
}: {
  d: ClassDef;
  locked: boolean;
  lockText?: string;
  btnText: string;
  onPick: () => void;
  dim?: boolean;
}) {
  return (
    <div
      className="rounded-lg border bg-white/[0.04] px-3 py-2.5"
      style={{ borderColor: `${d.color}44`, opacity: dim ? 0.55 : 1 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-black" style={{ color: d.color }}>
            {d.name} <span className="text-[10px] font-bold text-white/45">— {d.title}</span>
          </p>
          <p className="mt-0.5 truncate text-[10px] text-white/55">{d.desc}</p>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] font-bold text-emerald-300/90">
            {statLines(d).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </p>
          {locked && lockText ? (
            <p className="mt-1 text-[10px] font-bold text-amber-300/80">🔒 {lockText}</p>
          ) : null}
        </div>
        <button
          disabled={locked}
          onClick={onPick}
          className="shrink-0 rounded-md px-3 py-2 text-[11px] font-black text-slate-900 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: d.color }}
        >
          {btnText}
        </button>
      </div>
    </div>
  );
}

function JobPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const chain = chainOf(rpg.cls);
  const opts = jobOptions(rpg.cls);
  const alt = freeJobOption(rpg.cls);
  const need = nextJobLevel(rpg.cls);
  const locked = !rpg.canJob;
  const fin = chain.length >= 3; // 3차 완료

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="pointer-events-auto max-h-[min(86svh,560px)] w-[min(92vw,470px)] overflow-y-auto rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="전직"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-black text-amber-200">⚔ 전직 — 클래스 트리</h2>
          <button
            onClick={onClose}
            aria-label="전직 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* 현재 경로 — 메이플식 계열 트리 표기 */}
        <p className="mb-3 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-bold text-white/70">
          {chain.length === 0 ? (
            <>현재: <span className="text-white/45">미전직 (평민)</span></>
          ) : (
            <>
              현재: {chain.map((c, i) => (
                <span key={c.key} style={{ color: c.color }}>
                  {i > 0 && " → "}{c.name}
                </span>
              ))}
            </>
          )}
        </p>

        {/* 다음 전직 단계 */}
        {fin ? (
          <p className="mb-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2.5 text-center text-[11px] font-black text-amber-200">
            🏆 최종 전직 완료 — {chain[2].name}의 정점에 섰습니다
          </p>
        ) : locked ? (
          <div className="mb-3 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs font-bold text-white/50">
            <p>{TIER_LABEL[chain.length + 1]}: Lv {need} 달성 시 열립니다
              {chain.length === 1 ? " — 계열 내 세부 직업을 고르세요" : ""}</p>
            {/* v3.0.22 (#38) — 전직 퀘스트 게이트: 레벨과 별개로 스토리 퀘스트 완료가 필요 */}
            {rpg.jobLock ? (
              <p className="mt-1.5 text-[11px] font-black text-amber-300/85">
                📜 전직 퀘스트 미완료 — {rpg.jobLock}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mb-3 text-[11px] font-bold text-white/55">
            {chain.length === 0
              ? "계열을 선택하세요 — 2차 전직 때 같은 계열의 세부 직업을 고릅니다."
              : chain.length === 1
                ? "계열의 세부 직업을 고르세요 — 경로에 따라 3차가 갈립니다."
                : "경로의 최종 클래스로 승격합니다."}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {(chain.length === 0 ? CLASS_LIST : opts).map((d) => (
            <JobCard
              key={d.key}
              d={d}
              locked={locked}
              lockText={`Lv ${need} 필요`}
              btnText={chain.length >= 2 ? "승격" : "전직"}
              onPick={() => {
                EventBus.emit("job:select", { key: d.key });
                onClose();
              }}
            />
          ))}
        </div>

        {/* 자유 전직 — 같은 계열 반대 경로 (2차 이상, 골드 소모) */}
        {alt ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-1.5 text-[11px] font-black text-sky-200/90">
              ⇄ 자유 전직 <span className="ml-1 rounded bg-white/10 px-1 text-[9px] font-black text-white/50">{FREE_JOB_COST}G</span>
            </p>
            <p className="mb-2 text-[10px] text-white/45">
              같은 계열의 반대 길로 갈아탑니다 (메소 대신 골드). 횟수 제한 없음.
            </p>
            <JobCard
              d={alt}
              locked={rpg.gold < FREE_JOB_COST}
              lockText={`${FREE_JOB_COST}G 필요 (보유 ${rpg.gold}G)`}
              btnText="전환"
              onPick={() => {
                EventBus.emit("job:switch", { key: alt.key });
                onClose();
              }}
            />
          </div>
        ) : null}

        <p className="mt-2 text-center text-[10px] text-white/40">K키로 열기 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- 스탯 창 (v1.9 — T키, 메이플식 AP 배분) ---------- */

const STAT_META: { key: "str" | "dex" | "int" | "luk"; label: string; effect: string; color: string }[] = [
  { key: "str", label: "힘 (STR)", effect: "공격력 +0.3/점", color: "#ff8a8a" },
  { key: "dex", label: "민첩 (DEX)", effect: "크리티컬 +0.4%p · 이동속도 +0.5%/점", color: "#9af0c8" },
  { key: "int", label: "지력 (INT)", effect: "최대 MP +4/점", color: "#8fb8ff" },
  { key: "luk", label: "행운 (LUK)", effect: "최대 HP +5/점", color: "#ffe86a" },
];

function StatPanel({ rpg, hud, onClose }: { rpg: RpgState; hud: HudState; onClose: () => void }) {
  useEscClose(onClose);
  const allocate = (stat: "str" | "dex" | "int" | "luk", n: number) =>
    EventBus.emit("rpg:allocate", { stat, n });
  // v2.0 자동 배분 (지시 #18) — 클래스 계열에 맞춰 AP를 비율대로 한 번에 분배
  // v2.3 수정 (지시 #3): 미전직(cls null)이면 familyOf가 null을 반환해 조용히 무시되는 버그
  //  → 전사 비율(힘4:민첩1) 폴백 — 어차피 전사 계열 주스탯이라 초반 효율이 가장 좋다
  const autoAlloc = () => {
    const fam = familyOf(rpg.cls) ?? "warrior";
    if (rpg.ap < 1) return;
    const plan = autoAllocPlan(fam, rpg.ap);
    (Object.entries(plan) as ["str" | "dex" | "int" | "luk", number][]).forEach(([k, n]) => {
      if (n > 0) allocate(k, n);
    });
  };
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(86svh,560px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-lime-200/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-sm font-black text-lime-200">스탯 창</p>
          <button
            onClick={onClose}
            aria-label="스탯 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        {/* v3.0.16 — 몬스터 컬렉션 진입 버튼 (M키 동일) */}
        <button
          onClick={() => EventBus.emit("ui:panel", { panel: "collection" })}
          className="mb-2 flex w-full items-center justify-between rounded-lg border border-violet-300/40 bg-violet-500/15 px-2.5 py-2 text-left transition-colors hover:bg-violet-500/25 active:scale-[0.99]"
        >
          <span className="text-[12px] font-black text-violet-200">📖 몬스터 컬렉션</span>
          <span className="text-[10px] font-bold text-white/60">
            {(rpg.collection?.registered ?? 0)} / {(rpg.collection?.total ?? 43)}종 등록 · 보너스 보기 →
          </span>
        </button>

        {/* 기본 정보 */}
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {[
            { l: "레벨", v: `Lv ${hud.lv}` },
            { l: "경험치", v: `${hud.exp} / ${hud.expNext}` },
            { l: "HP", v: `${hud.hp} / ${hud.maxHp}` },
            { l: "MP", v: `${hud.mp} / ${hud.maxMp}` },
            { l: "공격력", v: `${hud.atkTotal}` },
            { l: "방어력", v: `${hud.defTotal}` },
            { l: "크리티컬", v: `${hud.critRate}%` },
            { l: "이동속도", v: `${hud.speed}` },
          ].map((row) => (
            <div key={row.l} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-white/50">{row.l}</span>
              <span className="text-[12px] font-black text-white">{row.v}</span>
            </div>
          ))}
        </div>
        <p className="mb-2.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] leading-relaxed text-white/45">
          공격력 = 기본 + 무기/강화 + 힘 스탯 + 클래스 경로 보너스 (+ 버프) · 크리티컬 = 기본 + 장신구 + 민첩 + 클래스 · v3.0.24 — 이동속도 = 기본(225) + 민첩 0.5%/점 + 강화 별 합계 0.5%/성 (강화·스텟에 투자하면 빨라진다)
        </p>

        {/* AP 배분 */}
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12px] font-black text-lime-200">AP 배분</p>
          <div className="flex items-center gap-1.5">
            {/* v3.0.15 (#2) — 레벨업 스탯 자동배분 on/off */}
            <button
              onClick={() => EventBus.emit("rpg:autoAlloc", { on: !(rpg.autoAlloc ?? false) })}
              aria-label="레벨업 자동 배분 토글"
              className={`rounded-md border px-2 py-1 text-[10px] font-black transition-colors ${
                rpg.autoAlloc
                  ? "border-lime-300/70 bg-lime-500/25 text-lime-200"
                  : "border-white/15 bg-white/[0.04] text-white/50"
              }`}
            >
              {rpg.autoAlloc ? "레벨업 자동 ON" : "레벨업 자동 OFF"}
            </button>
            <button
              disabled={rpg.ap < 1}
              onClick={autoAlloc}
              aria-label="AP 자동 배분"
              className="rounded-md border border-amber-300/50 bg-amber-500/25 px-2.5 py-1 text-[11px] font-black text-amber-100 enabled:hover:bg-amber-500/40 enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
            >
              ✨ 자동 배분
            </button>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${rpg.ap > 0 ? "bg-lime-500/25 text-lime-200" : "bg-white/10 text-white/40"}`}>
              남은 AP {rpg.ap}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {STAT_META.map((m) => (
            <div key={m.key} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <div className="w-20 shrink-0">
                <p className="text-[12px] font-black" style={{ color: m.color }}>{m.label}</p>
                <p className="text-[9px] text-white/45">{m.effect}</p>
              </div>
              <span className="w-10 text-center text-[15px] font-black text-white">{rpg.stats[m.key]}</span>
              <div className="ml-auto flex gap-1">
                <button
                  disabled={rpg.ap < 1}
                  onClick={() => allocate(m.key, 1)}
                  className="rounded-md bg-lime-500 px-2.5 py-1.5 text-[11px] font-black text-slate-900 enabled:hover:bg-lime-400 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-white/35"
                >
                  +1
                </button>
                <button
                  disabled={rpg.ap < 5}
                  onClick={() => allocate(m.key, 5)}
                  className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white enabled:hover:bg-emerald-500 enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-white/35"
                >
                  +5
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-white/40">레벨업마다 AP +5 지급 · "레벨업 자동 ON"이면 레벨업마다 계열 권장 비율로 즉시 배분 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- 퀘스트 로그 (v1.9 — J키) ---------- */

function QuestLogPanel({ questLog, rpg, onClose }: { questLog: QuestLogState; rpg?: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  /* v3.0.24 (#보스재도전) — 클리어한 챕터 보스 재림판 도전 (스토리판 HP×5 · ATK×2.2) */
  const bossKills = rpg?.collection?.kills ?? {};
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(86svh,560px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-amber-200/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-amber-200">퀘스트 로그</p>
            <p className="text-[10px] text-white/45">{questLog.stageName || "—"}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="퀘스트 로그 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        {/* v3.0.24 (#보스재도전) — 클리어 챕터 보스 재림판 도전 진입점 */}
        {rpg && (
          <div className="mb-2.5 rounded-lg border border-rose-300/35 bg-rose-400/[0.06] p-2.5">
            <p className="text-[12px] font-black text-rose-200">⚔ 보스 재도전 — 재림</p>
            <p className="mt-0.5 text-[10px] leading-snug font-bold text-white/50">
              정복한 챕터의 보스가 다시 태어났다. 스토리판보다 훨씬 강력하다 (HP ×5 · ATK ×2.2)
              · 보상: 골드·경험치 ×3 + 에메랄드 +5
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {CHAPTERS.map((ch) => {
                const bk = ch.boss;
                if (!bk) return null;
                const cleared = (bossKills[`boss_${bk}`] ?? 0) > 0;
                return (
                  <button
                    key={ch.key}
                    disabled={!cleared}
                    title={cleared ? `${BOSS_DEFS[bk].name} 재림판에 도전` : "스토리를 먼저 완료하세요"}
                    onClick={() => EventBus.emit("rpg:bossReplay", { ch: ch.key })}
                    className={`rounded-md border px-1 py-1.5 text-left transition-colors ${
                      cleared
                        ? "border-rose-300/50 bg-rose-500/15 hover:bg-rose-500/30 active:scale-95"
                        : "cursor-not-allowed border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className={`truncate text-[10px] font-black ${cleared ? "text-rose-100" : "text-white/35"}`}>
                      {ch.num}장 {ch.title}
                    </p>
                    <p className={`truncate text-[9px] font-bold ${cleared ? "text-rose-200/90" : "text-white/25"}`}>
                      {cleared ? BOSS_DEFS[bk].name : "스토리 진행 필요"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {questLog.list.map((q, i) => {
            const done = q.state === "done";
            const active = q.state === "active";
            return (
              <div
                key={i}
                className={`rounded-lg border px-2.5 py-2 ${
                  active && q.accepted !== false
                    ? "border-amber-300/50 bg-amber-400/[0.08]"
                    : active
                      ? "border-amber-300/30 border-dashed bg-amber-400/[0.04]"
                      : done
                        ? "border-white/10 bg-white/[0.03] opacity-60"
                        : "border-dashed border-white/10 bg-transparent opacity-45"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black ${active ? "text-amber-300" : done ? "text-emerald-300" : "text-white/35"}`}>
                    {done ? "✓" : active ? "▶" : "🔒"}
                  </span>
                  <p className="truncate text-[12px] font-bold text-white">{q.title}</p>
                </div>
                <p className="mt-0.5 pl-4 text-[10px] leading-snug text-white/55">{q.desc}</p>
                {/* v3.0.15 (#8) — 수락 버튼: 현재 진행 인덱스 && 미수락 */}
                {q.canAccept && (
                  <div className="mt-1.5 pl-4">
                    <button
                      onClick={() => {
                        const cur = questLog.trackedList?.find((t) => t.isCurrent);
                        if (cur) EventBus.emit("rpg:questAccept", { stage: cur.stage });
                      }}
                      className="rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-black text-slate-900 hover:bg-amber-300 active:scale-95"
                    >
                      ▶ 수락하기
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* v3.0.15 (#8) — 수락한 퀘스트 목록 (메이플식: 수락한 퀘스트를 선택해 진행) */}
        {questLog.trackedList && questLog.trackedList.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <p className="mb-1 text-[11px] font-black text-sky-200/90">수락한 퀘스트 — 추적할 퀘스트를 선택하세요</p>
            <div className="flex flex-col gap-1.5">
              {questLog.trackedList.map((t) => (
                <div
                  key={t.stage}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                    t.isTracked ? "border-sky-300/60 bg-sky-400/10" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <span className={`text-[10px] font-black ${t.state === "done" ? "text-emerald-300" : t.isCurrent ? "text-amber-300" : "text-sky-300"}`}>
                    {t.state === "done" ? "✓" : t.isCurrent ? "▶" : "→"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-white">{t.title}</p>
                    <p className="truncate text-[10px] text-white/50">{t.stageName} {t.isCurrent ? "· 현재 구역" : "· 이동해서 진행"}</p>
                  </div>
                  <button
                    onClick={() => EventBus.emit("rpg:questTrack", { stage: t.isTracked ? null : t.stage })}
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black active:scale-95 ${
                      t.isTracked ? "bg-sky-500 text-white hover:bg-sky-400" : "border border-white/15 bg-white/[0.05] text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {t.isTracked ? "추적 중" : "추적"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {questLog.repeat && (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <p className="mb-1 text-[11px] font-black text-sky-200/90">반복 의뢰 (메인 체인 완료 후)</p>
            <div className={`rounded-lg border px-2.5 py-2 ${questLog.repeatActive ? "border-sky-300/25 bg-sky-500/[0.06]" : "border-dashed border-white/15 bg-transparent opacity-60"}`}>
              <p className="text-[12px] font-bold text-sky-100">{questLog.repeat.title}</p>
              <p className="mt-0.5 text-[10px] text-white/55">{questLog.repeat.desc}</p>
              {!questLog.repeatActive && (
                <p className="mt-1 text-[10px] font-bold text-amber-200/90">
                  {questLog.repeatUnlocked
                    ? "수주 완료 — 구역 체인을 모두 끝내면 [반복] 의뢰가 이 퀘스트창에서 진행됩니다"
                    : "🔒 미수주 — 마을 상인 라고스에게 말을 걸어 수주하자 (v3.0.15부터 항상 수주 가능)"}
                </p>
              )}
            </div>
          </div>
        )}
        <p className="mt-2 text-center text-[10px] text-white/40">우측 상단 추적기가 현재 목표를 안내합니다 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- 설정 / 키 매핑 (v1.9 — O키) ---------- */

function KeymapPanel({ onClose }: { onClose: () => void }) {
  useEscClose(onClose);
  const [km, setKm] = useState<KeyMap>(() => loadKeyMap());
  const [recording, setRecording] = useState<GameAction | null>(null);

  // 키 캡처 — 기록 모드에서 아무 키나 누르면 해당 액션에 배정
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const k = e.key.toUpperCase();
      if (k === "ESCAPE") {
        e.stopImmediatePropagation(); // 패널 닫기가 아니라 기록 취소만
        setRecording(null);
        return;
      }
      if (!/^[A-Z]$/.test(k)) return;
      const next = applyKeyBinding(km, recording, k);
      setKm(next);
      EventBus.emit("keymap:changed", next);
      setRecording(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, km]);

  const doReset = () => {
    const next = resetKeyMap();
    setKm(next);
    EventBus.emit("keymap:changed", next);
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(86svh,560px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-sky-200/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-sky-200">설정 — 키 매핑</p>
            <p className="text-[10px] text-white/45">키를 눌러 새 키를 지정 (같은 키는 서로 교체)</p>
          </div>
          <button
            onClick={onClose}
            aria-label="설정 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        {/* v2.4 — 이름 변경 (인트로를 놓친 경우에도 언제든 이름 지정/변경 가능) */}
        <div className="mb-2.5 mt-3 flex items-center gap-2.5 rounded-lg border border-amber-200/30 bg-amber-400/[0.07] px-2.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black text-amber-200">이름 변경</p>
            <p className="truncate text-[10px] text-white/50">현재 이름: {getPlayerName() || "세르츠"}</p>
          </div>
          <button
            onClick={() => {
              onClose(); // 설정 창 닫고 이름 패널 오픈
              EventBus.emit("name:ask");
            }}
            className="shrink-0 rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-black text-slate-900 hover:bg-amber-300 active:scale-95"
          >
            이름 짓기
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {(Object.keys(ACTION_LABELS) as GameAction[]).map((a) => (
            <div key={a} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
              <span className="flex-1 text-[12px] font-bold text-white/80">{ACTION_LABELS[a]}</span>
              <button
                onClick={() => setRecording(recording === a ? null : a)}
                className={`w-16 rounded-md border-2 px-2 py-1.5 text-[12px] font-black transition ${
                  recording === a
                    ? "animate-pulse border-lime-300 bg-lime-500/20 text-lime-200"
                    : "border-white/20 bg-black/50 text-white hover:border-sky-300/60"
                }`}
              >
                {recording === a ? "키 입력…" : km[a]}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
          <p className="text-[10px] leading-relaxed text-white/50">
            이동은 WASD / 방향키 고정 · SPACE는 항상 공격 · ESC는 창 닫기 고정입니다.
            <br />
            모바일은 터치 컨트롤을 사용하므로 영향을 받지 않아요.
          </p>
        </div>
        <button
          onClick={doReset}
          className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[11px] font-black text-white/70 hover:bg-white/10 active:scale-[0.98]"
        >
          기본값으로 초기화
        </button>
        <p className="mt-2 text-center text-[10px] text-white/40">설정은 자동 저장 · ESC로 닫기</p>
      </div>
    </div>
  );
}
