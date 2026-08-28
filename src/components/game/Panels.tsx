"use client";

import { useEffect } from "react";
import { EventBus, type PanelKind, type RpgState } from "./EventBus";
import { ITEMS, type ItemKey } from "@/game/data";

/**
 * 2D MMORPG 기본 요소 UI — 상점 / 인벤토리 패널
 *  - 상점: 상인 라고스 근처(F키/버튼)에서 구매 — 물약/장비
 *  - 인벤토리: I키/버튼 — 물약 사용, 장비 장착
 *  - 게임은 실시간 유지 (MMORPG 관례), ESC/배경 탭으로 닫기
 */

function useEscClose(close: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
}

function ItemIcon({ icon, size = 34 }: { icon: string; size?: number }) {
  return (
     
    <img
      src={`/assets/${icon}.png`}
      alt=""
      draggable={false}
      className="shrink-0"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
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

function itemEffect(item: (typeof ITEMS)[ItemKey]): string {
  if (item.heal) return `HP +${item.heal}`;
  if (item.restore) return `MP +${item.restore}`;
  if (item.atk) return `공격력 +${item.atk}`;
  if (item.def) return `방어력 +${item.def}`;
  return "";
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

        <div className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {rpg.shopStock.map((k) => {
            const item = ITEMS[k as ItemKey];
            if (!item) return null;
            const isEquip = item.kind !== "consumable";
            const ownedEquip = isEquip && rpg.owned.includes(k);
            const equipped = ownedEquip && (rpg.weapon === k || rpg.armor === k);
            const affordable = rpg.gold >= item.price;
            const disabled = equipped || (isEquip && ownedEquip) || !affordable;
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{item.name}</p>
                  <p className="text-[11px] text-emerald-300/90">{itemEffect(item)}</p>
                </div>
                <button
                  disabled={disabled}
                  onClick={() => EventBus.emit("rpg:buy", { key: k as ItemKey })}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black transition-transform active:scale-95 ${
                    equipped
                      ? "cursor-default bg-emerald-700/40 text-emerald-300"
                      : isEquip && ownedEquip
                        ? "cursor-default bg-slate-700/50 text-white/50"
                        : affordable
                          ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
                          : "cursor-not-allowed bg-slate-700/50 text-white/35"
                  }`}
                >
                  {equipped ? "장착 중" : isEquip && ownedEquip ? "보유함" : `${item.price} G`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] text-white/40">장비는 구매 시 즉시 장착됩니다 · ESC로 닫기</p>
      </div>
    </div>
  );
}

export function InventoryPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const equips = rpg.owned.filter((k) => k !== "potion_hp" && k !== "potion_mp");
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
                <ItemIcon icon={item.icon} size={28} />
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
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">{item.name}</p>
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
        <p className="mt-2 text-center text-[10px] text-white/40">Q: HP 물약 · E: MP 물약 · ESC로 닫기</p>
      </div>
    </div>
  );
}

export function GamePanels({ panel, rpg, onClose }: { panel: PanelKind; rpg: RpgState; onClose: () => void }) {
  if (panel === "shop") return <ShopPanel rpg={rpg} onClose={onClose} />;
  if (panel === "inv") return <InventoryPanel rpg={rpg} onClose={onClose} />;
  return null;
}
