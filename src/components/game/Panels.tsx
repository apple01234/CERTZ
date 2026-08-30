"use client";

import { useEffect, useState } from "react";
import { EventBus, type PanelKind, type RpgState, type HudState, type QuestLogState } from "./EventBus";
import {
  ITEMS, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, UPGRADE_MAX, UPGRADE_RATES, upgradeCost, autoAllocPlan,
  type ItemKey, type ItemTier, type BuffKey, type PetKey, type CosmeticKey,
} from "@/game/data";
import { CLASS_LIST, FREE_JOB_COST, chainOf, familyOf, jobOptions, freeJobOption, nextJobLevel, type ClassDef } from "@/game/classes";
import { loadKeyMap, applyKeyBinding, resetKeyMap, ACTION_LABELS, ASSIGNABLE_KEYS, type GameAction, type KeyMap } from "@/game/keymap";

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

function ItemIcon({ icon, size = 34, tier }: { icon: string; size?: number; tier?: ItemTier }) {
  const border = tier ? TIER_STYLE[tier].border : "border-white/10";
  return (
    <div
      className={`shrink-0 rounded-md border-2 bg-black/40 ${border}`}
      style={{ padding: 2, lineHeight: 0 }}
    >
      <img
        src={`/assets/${icon}.png`}
        alt=""
        draggable={false}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
      />
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

function itemEffect(item: (typeof ITEMS)[ItemKey], up = 0): string {
  if (item.kind === "buff") return BUFF_DEFS[item.key as BuffKey]?.desc ?? "버프";
  if (item.kind === "pet") return PET_DEFS[item.key as PetKey]?.desc ?? "펫";
  if (item.kind === "cosmetic") return COSMETIC_DEFS[item.key as CosmeticKey]?.desc ?? "치장";
  if (item.heal) return `HP +${item.heal}`;
  if (item.restore) return `MP +${item.restore}`;
  if (item.atk) return up > 0 ? `공격력 ${item.atk}+${up * 2}` : `공격력 +${item.atk}`;
  if (item.def) return up > 0 ? `방어력 ${item.def}+${up}` : `방어력 +${item.def}`;
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

/** 강화 단계가 반영된 표시명 */
function displayName(name: string, up: number): string {
  return up > 0 ? `${name} +${up}` : name;
}

export function ShopPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="w-[min(92vw,430px)] rounded-xl border-2 border-amber-200/60 bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
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
            const rows = rpg.shopStock.filter((k) => ITEMS[k as ItemKey] && section.test(ITEMS[k as ItemKey]));
            if (rows.length === 0) return null;
            return (
              <div key={section.label} className="flex flex-col gap-1.5">
                <p className="mt-1 text-[10px] font-black tracking-wide text-white/45">{section.label}</p>
                {rows.map((k) => {
                  const item = ITEMS[k as ItemKey];
                  const st = shopState(rpg, k as ItemKey);
                  const count = item.kind === "buff" ? (rpg.buffItems[k] ?? 0) : undefined;
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
                      <button
                        disabled={st !== "buyable"}
                        onClick={() => EventBus.emit("rpg:buy", { key: k as ItemKey })}
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
                        {st === "equipped" ? "장착 중" : st === "owned" ? "보유함" : `${item.price} G`}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 장비 강화 (2D MMORPG 기본 요소 — 골드 싱크홀) */}
        <div className="mt-2 rounded-lg border border-amber-200/25 bg-amber-300/[0.05] p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <img src="/assets/icon_hammer.png" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
            <p className="text-[12px] font-black text-amber-200">장비 강화</p>
            <p className="text-[10px] text-white/45">실패 시 골드만 소모 · 최대 +5</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {(["weapon", "armor"] as const).map((slot) => {
              const key = slot === "weapon" ? rpg.weapon : rpg.armor;
              const item = ITEMS[key as ItemKey];
              if (!item) return null;
              const up = slot === "weapon" ? rpg.upWea : rpg.upArm;
              const maxed = up >= UPGRADE_MAX;
              const cost = upgradeCost(slot, up);
              const rate = UPGRADE_RATES[up] ?? 0;
              const affordable = rpg.gold >= cost;
              return (
                <div key={slot} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
                  <ItemIcon icon={item.icon} size={26} tier={item.tier} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>
                      {displayName(item.name, up)}
                      <span className="ml-1 text-[10px] font-normal text-white/40">
                        {slot === "weapon" ? "무기" : "방어구"}
                      </span>
                    </p>
                    <p className="text-[10px] text-emerald-300/90">{itemEffect(item, up)}</p>
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
                    {maxed ? "최대" : `${cost} G · ${rate}%`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-white/40">장비는 구매 시 즉시 장착됩니다 · 장신구는 1개만 장착 · ESC로 닫기</p>
      </div>
    </div>
  );
}

export function InventoryPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
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
        className="w-[min(92vw,430px)] rounded-xl border-2 border-sky-200/50 bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
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

        {/* 물약 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">소비 아이템</p>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {(["potion_hp", "potion_mp"] as const).map((k) => {
            const item = ITEMS[k];
            const count = k === "potion_hp" ? rpg.hpPot : rpg.mpPot;
            return (
              <div key={k} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} size={26} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">
                    {item.name} <span className="text-white/60">×{count}</span>
                  </p>
                  <p className="text-[10px] text-emerald-300/90">{itemEffect(item)}</p>
                </div>
                <button
                  disabled={count <= 0}
                  onClick={() => EventBus.emit("rpg:use", { kind: k === "potion_hp" ? "hp" : "mp" })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black ${
                    count > 0
                      ? "bg-sky-500 text-white hover:bg-sky-400 active:scale-95"
                      : "cursor-not-allowed bg-slate-700/50 text-white/35"
                  }`}
                >
                  사용
                </button>
              </div>
            );
          })}
        </div>

        {/* 장비 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">장비</p>
        <div className="flex flex-col gap-1.5">
          {equips.map((k) => {
            const item = ITEMS[k as ItemKey];
            if (!item) return null;
            const equipped = rpg.weapon === k || rpg.armor === k;
            const up = item.kind === "weapon" ? rpg.upWea : rpg.upArm;
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} size={26} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>{displayName(item.name, up)}</p>
                  <p className="text-[10px] text-emerald-300/90">{itemEffect(item, up)}</p>
                </div>
                {equipped ? (
                  <span className="shrink-0 rounded-md bg-emerald-700/40 px-2.5 py-1.5 text-[11px] font-black text-emerald-300">
                    장착 중
                  </span>
                ) : (
                  <button
                    onClick={() => EventBus.emit("rpg:equip", { key: k as ItemKey })}
                    className="shrink-0 rounded-md bg-amber-400 px-2.5 py-1.5 text-[11px] font-black text-slate-900 hover:bg-amber-300 active:scale-95"
                  >
                    장착
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 장신구 (RPG 2차 확장) */}
        <p className="mb-1 mt-2.5 text-[11px] font-bold text-white/50">장신구</p>
        <div className="flex flex-col gap-1.5">
          {accs.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-2 text-[11px] text-white/35">
              보유한 장신구가 없습니다 — 상인 라고스에게서 구매할 수 있어요
            </p>
          )}
          {accs.map((k) => {
            const item = ITEMS[k as ItemKey];
            if (!item) return null;
            const equipped = rpg.accessory === k;
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} size={26} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>{item.name}</p>
                  <p className="text-[10px] text-emerald-300/90">{itemEffect(item)}</p>
                </div>
                {equipped ? (
                  <span className="shrink-0 rounded-md bg-emerald-700/40 px-2.5 py-1.5 text-[11px] font-black text-emerald-300">
                    장착 중
                  </span>
                ) : (
                  <button
                    onClick={() => EventBus.emit("rpg:equip", { key: k as ItemKey })}
                    className="shrink-0 rounded-md bg-amber-400 px-2.5 py-1.5 text-[11px] font-black text-slate-900 hover:bg-amber-300 active:scale-95"
                  >
                    장착
                  </button>
                )}
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
  if (panel === "inv") return <InventoryPanel rpg={rpg} onClose={onClose} />;
  if (panel === "job") return <JobPanel rpg={rpg} onClose={onClose} />;
  if (panel === "stat") return <StatPanel rpg={rpg} hud={hud} onClose={onClose} />;
  if (panel === "quest") return <QuestLogPanel questLog={questLog} onClose={onClose} />;
  if (panel === "opt") return <KeymapPanel onClose={onClose} />;
  return null;
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
        className="pointer-events-auto max-h-[86vh] w-[min(92vw,470px)] overflow-y-auto rounded-xl border border-amber-300/30 bg-slate-950/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
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
          <p className="mb-3 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs font-bold text-white/50">
            {TIER_LABEL[chain.length + 1]}: Lv {need} 달성 시 열립니다
            {chain.length === 1 ? " — 계열 내 세부 직업을 고르세요" : ""}
          </p>
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
  { key: "dex", label: "민첩 (DEX)", effect: "크리티컬 +0.4%p/점", color: "#9af0c8" },
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
        className="max-h-[86vh] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-lime-200/50 bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
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
          공격력 = 기본 + 무기/강화 + 힘 스탯 + 클래스 경로 보너스 (+ 버프) · 크리티컬 = 기본 + 장신구 + 민첩 + 클래스
        </p>

        {/* AP 배분 */}
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12px] font-black text-lime-200">AP 배분</p>
          <div className="flex items-center gap-1.5">
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
        <p className="mt-2 text-center text-[10px] text-white/40">레벨업마다 AP +5 지급 · 배분은 즉시 적용 · 자동 배분은 계열 권장 비율 (4:1, 미전직은 힘:민첩) · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- 퀘스트 로그 (v1.9 — J키) ---------- */

function QuestLogPanel({ questLog, onClose }: { questLog: QuestLogState; onClose: () => void }) {
  useEscClose(onClose);
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[86vh] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-amber-200/50 bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
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

        <div className="flex flex-col gap-1.5">
          {questLog.list.map((q, i) => {
            const done = q.state === "done";
            const active = q.state === "active";
            return (
              <div
                key={i}
                className={`rounded-lg border px-2.5 py-2 ${
                  active
                    ? "border-amber-300/50 bg-amber-400/[0.08]"
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
              </div>
            );
          })}
        </div>

        {questLog.repeat && (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <p className="mb-1 text-[11px] font-black text-sky-200/90">반복 의뢰 (메인 체인 완료 후)</p>
            <div className={`rounded-lg border px-2.5 py-2 ${questLog.repeatActive ? "border-sky-300/25 bg-sky-500/[0.06]" : "border-dashed border-white/15 bg-transparent opacity-60"}`}>
              <p className="text-[12px] font-bold text-sky-100">{questLog.repeat.title}</p>
              <p className="mt-0.5 text-[10px] text-white/55">{questLog.repeat.desc}</p>
              {!questLog.repeatActive && (
                <p className="mt-1 text-[10px] font-bold text-amber-200/90">🔒 미수주 — 마을 상인 라고스에게 말을 걸어 수주하자</p>
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
        className="max-h-[86vh] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-sky-200/50 bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
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
