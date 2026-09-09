"use client";

import { useEffect, useState } from "react";
import { EventBus, type PanelKind, type RpgState, type HudState, type QuestLogState } from "./EventBus";
import {
  ITEMS, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, UPGRADE_MAX, UPGRADE_RATES, upgradeCost, autoAllocPlan,
  starWeaponBonus, starArmorBonus, starTier, STAR_TIER_CSS, UPGRADE_FALLBACK_FROM, starPerStarAtk, starPerStarDef,
  TRADE_PRICES, tradeValue, TRADE_STOCK, STAR_BLESS_RATE, STAR_BLESS_MAX, starAccBonus,
  CHAPTERS, STAGE_SHORT, parseStage, BM_STOCK, sellValue, dailyDeals, DAILY_DEAL_OFF,
  POT_GRADE_META, potLineText, SET_GEAR, POT_STAT_LABEL,
  ENEMIES, BOSS_DEFS, BOSS_DIFFS, BOSS_DIFF_ORDER, collectionBonus, nextCollectionGoal, COLLECTION_MILESTONES,
  closetThemeOf, CLOSET_THEMES,
  type ItemKey, type ItemTier, type BuffKey, type PetKey, type CosmeticKey, type StageKey, type PotStatKey, type EnemyKey, type BossKey, type BossDiffKey,
} from "@/game/data";
import { CLASS_LIST, CLASSES, FREE_JOB_COST, chainOf, familyOf, jobOptions, freeJobOption, nextJobLevel, type ClassDef } from "@/game/classes";
import { loadKeyMap, applyKeyBinding, resetKeyMap, ACTION_LABELS, ASSIGNABLE_KEYS, type GameAction, type KeyMap } from "@/game/keymap";
import { getPlayerName, loadSave } from "@/game/config"; // v2.4 — 이름 변경 표시 / v2.5 — 방문 구역 기록
import { getBgmVolume, getSfxVolume, setBgmVolume, setSfxVolume } from "@/game/audio"; // v3.1.0 — 볼륨 UI
import { useKeyGate, swallowKeys } from "./inputGate"; // v4.1.0 — 텍스트 입력 단축키 차단 (지시 #5)
import { GEM_SKUS } from "@/game/ads"; // v4.1.0 — 구글 플레이 충전 상품
import { PASS_TRACKS, PASS_PREMIUM_PRICE, PASS_MAX_LV, PASS_LV_XP, SEASON_DAILY_MISSIONS, SEASON_WEEKLY_MISSIONS } from "@/game/pass"; // v4.5.0 — 시즌 패스 + v1.0.1 시즌 미션
import { authMe, marketGet, marketList, marketCancel, marketBuy, marketCollect, cloudSaveUpload, type MarketState, type AuthUser } from "@/game/account"; // v1.0.1 — 유저 거래판 · v1.0.6 등록 전 세이브 선동기화
import { STORE_PACKS } from "@/game/ads"; // v1.0.2 — 현금 패키지
import { STORE_PACK_CONTENTS } from "@/game/data"; // v1.0.7 — 패키지 구성 미리보기
import { chestOdds, eertOdds, POT_PITY_MAX, STAR_PITY_FROM, STAR_PITY_STEP, STAR_PITY_MAX } from "@/game/data"; // v4.5.0 — 확률 공시 (게임산업법) · v1.0.8 천장 공시
import type { BmGrant } from "@/game/data";
import {
  CRAFT_RECIPES, canCraft, ABYSS_SHOP,
  todayTrial, rebirthReqLv, rebirthBonus, REBIRTH_ABYSS, MAT_CHANCES, petEvoStage, petBonus, PET_EVO_NAMES,
} from "@/game/infinite"; // v1.0.8 — 무한 콘텐츠 허브

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

/* ================= v3.1.0 (#판매포기) — 수량 입력 + MAX 전량 판매 =================
 *  유저 지시: "판매할 때 수량 입력하는 박스도 있었으면 좋겠어 + MAX 누르면 다 팔기" */
function SellQtyBox({
  count,
  unitValue,
  ev,
  keyName,
  compact,
}: {
  count: number;
  unitValue: number;
  ev: "rpg:sell" | "rpg:sellPotion";
  keyName: string;
  compact?: boolean;
}) {
  const [qty, setQty] = useState("1");
  const gate = useKeyGate(); // v4.1.0
  const parsed = parseInt(qty || "1", 10);
  const n = Math.max(1, Math.min(Math.max(count, 1), Number.isNaN(parsed) ? 1 : parsed));
  const disabled = count <= 0;
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        ref={gate}
        {...swallowKeys}
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(count, 1)}
        value={disabled ? "" : qty}
        placeholder="0"
        disabled={disabled}
        onChange={(e) => setQty(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="판매 수량"
        className={`w-9 rounded border border-white/20 bg-black/50 px-0.5 py-1 text-center text-[10px] font-black text-white outline-none focus:border-rose-300/60 disabled:opacity-40 ${compact ? "h-6" : ""}`}
      />
      <button
        disabled={disabled}
        onClick={() => setQty(String(count))}
        aria-label="전량 판매 수량 지정"
        className={`rounded border border-amber-300/60 bg-amber-500/20 px-1.5 font-black text-amber-200 hover:bg-amber-500/40 active:scale-95 disabled:opacity-40 ${compact ? "py-0.5 text-[9px]" : "py-1 text-[9px]"}`}
      >
        MAX
      </button>
      <button
        disabled={disabled}
        onClick={() => EventBus.emit(ev, { key: keyName, qty: n })}
        aria-label={`${count > 1 ? `${n}개` : ""} 판매`}
        className={`rounded-md border border-white/15 bg-white/[0.06] font-black text-white/70 hover:bg-rose-500/20 hover:text-rose-200 active:scale-95 disabled:opacity-40 ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"}`}
      >
        판매 {unitValue}G{n > 1 && count > 1 ? ` ×${n}` : ""}
      </button>
    </span>
  );
}

/** v1.0.2 (#자동강화) — 슬롯별 목표 강화 수치 임시 저장 (패널 재렌더에도 유지) */
const autoTargetMap: { current: Record<string, number> } = { current: {} };

/* ================= v3.1.0 (#볼륨UI) — BGM/효과음 개별 볼륨 슬라이더 =================
 *  유저 지시: "BGM보다 효과음이 너무 큼 — BGM과 SFX를 각각 조절할 수 있는 UI".
 *  audio.ts의 setBgmVolume/setSfxVolume에 연결되며 즉시 반영 + localStorage 저장. */
function VolumeSliders() {
  const [bgm, setBgm] = useState(() => Math.round(getBgmVolume() * 100));
  const [sfx, setSfx] = useState(() => Math.round(getSfxVolume() * 100));
  return (
    <div className="mb-3 rounded-lg border border-sky-200/25 bg-sky-400/[0.06] px-2.5 py-2.5">
      <p className="mb-2 text-[12px] font-black text-sky-200">사운드 볼륨</p>
      <label className="mb-2 flex items-center gap-2">
        <span className="w-12 shrink-0 text-[11px] font-bold text-white/75">BGM</span>
        <input
          type="range"
          min={0}
          max={100}
          value={bgm}
          onChange={(e) => {
            const v = Number(e.target.value);
            setBgm(v);
            setBgmVolume(v / 100);
          }}
          aria-label="BGM 볼륨"
          className="h-1.5 flex-1 accent-sky-400"
        />
        <span className="w-9 text-right text-[10px] font-black text-white/60">{bgm}%</span>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-[11px] font-bold text-white/75">효과음</span>
        <input
          type="range"
          min={0}
          max={100}
          value={sfx}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSfx(v);
            setSfxVolume(v / 100);
          }}
          aria-label="효과음 볼륨"
          className="h-1.5 flex-1 accent-emerald-400"
        />
        <span className="w-9 text-right text-[10px] font-black text-white/60">{sfx}%</span>
      </label>
      <p className="mt-1.5 text-[10px] leading-snug text-white/40">설정은 자동 저장 — 효과음이 BGM보다 크게 느껴지면 슬라이더로 균형을 맞춰 보세요</p>
    </div>
  );
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
        src={`/assets/${icon}.webp`}
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
      <img src="/assets/item_coin.webp" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
      {gold} G
    </span>
  );
}

/** v2.9 (#12) — 과금 화폐 에메랄드 배지 (상점 표시용 — 구매 연동은 다음 릴리스) */
function EmeraldChip({ emerald }: { emerald: number }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[12px] font-black text-emerald-300">
      <img src="/assets/item_pendant_arcane.webp" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
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
  const buffs: BuffKey[] = ["buff_atk", "buff_def", "buff_spd", "buff_exp", "buff_king", "buff_crit", "buff_gold", "buff_luck"]; // v4.3.0 — 신규 3종 포함
  const buffNames: Record<string, string> = {
    buff_atk: "분노 (공격+25%)",
    buff_crit: "질풍 (치명+12%)",
    buff_gold: "탐욕 (골드+40%)",
    buff_luck: "행운 (드롭+35%)",
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
  /* v4.3.0 — 일일 특가 (날짜 로테이션 3종 · 30%↓) + 카테고리 탭. WorldScene today()와 동일 로컬 날짜 포맷 */
  const _d = new Date();
  const dayKey = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
  const DEALS = dailyDeals(dayKey);
  const [cat, setCat] = useState("all");
  const [odds, setOdds] = useState(false); // v4.5.0 — 확률 공시 펼침
  const catOf = (k: ItemKey) => (k.startsWith("chest_") || k.startsWith("pack_") ? "gacha" : ITEMS[k].kind);
  /* v1.0.3 (#0르쯔) — 이중 방어: bmPrice(에메랄드 가격)가 없는 아이템은 데이터에 남아있어도 진열하지 않는다 */
  const stock = BM_STOCK.filter((k) => (ITEMS[k]?.bmPrice ?? 0) > 0 && (cat === "all" || catOf(k) === cat));
  const CATS: { id: string; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "gacha", label: "가챠·패키지" },
    { id: "buff", label: "버프" },
    { id: "consumable", label: "소모품" },
    { id: "accessory", label: "장신구" },
    { id: "pet", label: "펫" },
    { id: "cosmetic", label: "치장" },
  ];
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
            <img src="/assets/cos_aurora.webp" alt="" className="h-8 w-8" style={{ imageRendering: "pixelated" }} />
            <div>
              <p className="text-sm font-black text-cyan-200">캐시상점</p>
              <p className="text-[10px] text-white/60">카탈로그 {stock.length}종 — 상자/패키지/큐브/에픽·전설 장신구/펫/치장</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EmeraldChip emerald={rpg.emerald} />
            <button onClick={onClose} aria-label="캐시상점 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">✕</button>
          </div>
        </div>

        {/* v4.5.0 — 시즌 패스 배너 (배틀패스 = 리텐션+수익 듀얼 장치 — BM 문서 표준) */}
        {rpg.pass && (
          <button
            onClick={() => EventBus.emit("ui:panel", { panel: "pass" })}
            className="mb-1.5 flex w-full items-center gap-2 rounded-lg border border-amber-300/40 bg-gradient-to-r from-amber-400/20 to-transparent px-2.5 py-2 text-left hover:from-amber-400/30 active:scale-[0.99]"
          >
            <span className="text-lg leading-none">🎫</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-black text-amber-200">시즌 패스 — {rpg.pass.season} · 남은 {rpg.pass.daysLeft}일</span>
              <span className="block truncate text-[10px] text-white/50">현재 Lv.{rpg.pass.lv}/30 · {rpg.pass.prem ? "프리미엄 보유 중" : `프리미엄 해금 ${30}💎 — 도달분 소급 수령`}</span>
            </span>
            <span className="text-white/40">›</span>
          </button>
        )}

        {/* v4.5.0 — 스타터팩 하이라이트 (미구매 시 — 첫 결제 D0~D3 유도, BM 문서 표준) */}
        {!rpg.starterPackBought && (
          <div className="mb-1.5 rounded-lg border-2 border-amber-300/60 bg-amber-400/10 px-2.5 py-2">
            <p className="text-[12px] font-black text-amber-200">🎒 신규 용사 추천 — 스타터팩</p>
            <p className="mt-0.5 text-[10px] text-white/55">HP 물약 ×5 + 상급 HP ×3 + 엘릭서 ×1 + 골드 2,000G — 첫 성장 한세트</p>
            <button
              onClick={() => EventBus.emit("rpg:bmBuy", { key: "pack_starter" })}
              className="mt-1.5 w-full rounded-lg bg-amber-400 px-3 py-1.5 text-[12px] font-black text-slate-900 hover:bg-amber-300 active:scale-95"
            >
              스타터팩 열기 — {ITEMS.pack_starter.bmPrice ?? 12}💎
            </button>
          </div>
        )}

        {/* v4.3.0 — 일일 특가 스트립 (자정 리셋 — FOMO 루프) */}
        <div className="mb-1.5 rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-2.5 py-2">
          <p className="text-[12px] font-black text-amber-200">⚡ 오늘의 특가 — 30%↓ <span className="ml-1 font-normal text-white/40">매일 자정 교체</span></p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {DEALS.map((k) => {
              const it = ITEMS[k];
              const dp = Math.max(1, Math.round((it.bmPrice ?? 0) * (1 - DAILY_DEAL_OFF)));
              return (
                <button
                  key={k}
                  onClick={() => EventBus.emit("rpg:bmBuy", { key: k })}
                  className="flex flex-col items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-400/10 px-1 py-1.5 hover:bg-amber-400/20 active:scale-95"
                >
                  <ItemIcon icon={it.icon} tier={it.tier} size={26} />
                  <span className="w-full truncate text-center text-[10px] font-bold text-white/85">{it.name}</span>
                  <span className="text-[10px] font-black text-amber-200">{dp} 💎 <s className="font-normal text-white/35">{it.bmPrice}</s></span>
                </button>
              );
            })}
          </div>
        </div>

        {/* v4.3.0 — 카테고리 탭 (BM 카탈로그 {BM_STOCK.length}종) */}
        <div className="mb-1.5 flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-black transition-colors ${cat === c.id ? "bg-cyan-400 text-slate-900" : "border border-white/15 bg-black/40 text-white/65 hover:bg-black/60"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* BM 아이템 */}
        <div className="flex flex-col gap-1.5">
          {stock.map((k) => {
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

        {/* v4.5.0 — 확률 공시 (게임산업법 확률형 아이템 정보 공시 — CHEST_TABLES/가챠 가중치 단일 출처) */}
        <button
          onClick={() => setOdds((v) => !v)}
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] font-black text-white/70 hover:bg-black/60 active:scale-[0.99]"
        >
          {odds ? "▲" : "▼"} 확률형 아이템 확률 정보 (법정 공시)
        </button>
        {odds && (
          <div className="mt-1.5 rounded-lg border border-white/15 bg-black/50 p-2.5">
            <p className="text-[11px] font-black text-cyan-200">확률 정보 — 게임산업법 공시 (2024.3.28 시행)</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-white/40">아래 확률은 게임 로직과 동일한 테이블에서 실시간 계산됩니다. 일일 특가는 표시 가격의 30% 할인이며 확률에는 영향을 주지 않습니다.</p>
            {["chest_iron", "chest_silver", "chest_gold", "chest_legend"].map((k) => (
              <div key={k} className="mt-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                <p className="text-[10px] font-black text-white/75">{ITEMS[k as ItemKey].name}</p>
                {chestOdds(k).map((o) => (
                  <p key={o.label} className="flex justify-between text-[9px] leading-snug text-white/55">
                    <span className="pr-2">{o.label}</span>
                    <span className="shrink-0 font-bold text-white/75">{o.pct}%</span>
                  </p>
                ))}
              </div>
            ))}
            <div className="mt-2 rounded-md bg-white/[0.03] px-2 py-1.5">
              <p className="text-[10px] font-black text-white/75">피규어 가챠 (혜택 — 바르가 원정대)</p>
              {([0, 1, 2, 3] as const).map((g) => (
                <p key={g} className="flex justify-between text-[9px] leading-snug text-white/55">
                  <span>{FIGURE_GRADE_META[g].name}</span>
                  <span className="font-bold text-white/75">{FIGURE_GRADE_META[g].weight}%</span>
                </p>
              ))}
              <p className="mt-1 text-[8px] text-white/35">중복 피규어는 피규어 조각으로 변환됩니다 (노말 5 / 레어 15 / 에픽 40 / 전설 100)</p>
            </div>
            {/* v1.0.8 — eert 큐브 잠재옵션 확률 공시 (메이플 큐브 논란 대응 — 가중치 단일 출처) */}
            <div className="mt-2 rounded-md bg-white/[0.03] px-2 py-1.5">
              <p className="text-[10px] font-black text-white/75">eert 큐브 — 잠재옵션 등급 (장비 1개 기준)</p>
              {eertOdds().map((o) => (
                <p key={o.name} className="flex justify-between text-[9px] leading-snug text-white/55">
                  <span style={{ color: o.color }}>{o.name}</span>
                  <span className="shrink-0 font-bold text-white/75">{o.pct}%</span>
                </p>
              ))}
              <p className="mt-1 text-[8px] leading-snug text-white/35">
                유니크 미달 연속 {POT_PITY_MAX - 1}회 도달 시 다음 추첨은 유니크 이상 확정 (천장).
                강화는 ★{STAR_PITY_FROM} 이상 실패 시 다음 시도 +{STAR_PITY_STEP}%p씩 가산 (최대 +{STAR_PITY_MAX}%p, 성공 시 초기화).
              </p>
            </div>
          </div>
        )}

        {/* v1.0.7 — 성장 패키지 UI 개편: 프리미엄 카드 그리드 (구성 아이콘 칩·등급 배지·CTA 버튼).
            기존 단순 텍스트 버튼 목록을 폐기하고 패키지별 아이덴티티 그라디언트+구성 미리보기로 대폭 상향.
            가격은 여전히 Play Console 상품 기준 — 클라 하드코딩 없음 (결제 위임 구조 유지) */}
        {STORE_PACKS.length > 0 && (
          <div className="mt-2.5 rounded-xl border border-rose-300/25 bg-gradient-to-b from-rose-500/[0.10] to-fuchsia-500/[0.05] p-2">
            <p className="flex items-center gap-1.5 px-0.5 text-[12px] font-black text-rose-100">
              <span className="rounded bg-rose-400/25 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-rose-200">PACKAGE</span>
              현금 패키지 (스토어 결제)
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {STORE_PACKS.map((pk, i) => {
                const contents = STORE_PACK_CONTENTS[pk.id] ?? [];
                /* 패키지별 아이덴티티 — 성장=황금 / 성장+치장=로즈(BEST) / 시즌=청록 */
                const theme = i === 0
                  ? { ring: "border-amber-300/50", bg: "from-amber-400/15 to-amber-500/[0.04]", chip: "bg-amber-400/15 text-amber-100", cta: "from-amber-300 to-amber-500 text-amber-950", badge: "황금 성장" }
                  : i === 1
                    ? { ring: "border-fuchsia-300/50", bg: "from-fuchsia-400/15 to-purple-500/[0.04]", chip: "bg-fuchsia-400/15 text-fuchsia-100", cta: "from-fuchsia-300 to-fuchsia-500 text-fuchsia-950", badge: "BEST" }
                    : { ring: "border-cyan-300/50", bg: "from-cyan-400/15 to-sky-500/[0.04]", chip: "bg-cyan-400/15 text-cyan-100", cta: "from-cyan-300 to-cyan-500 text-cyan-950", badge: "시즌 한정" };
                return (
                  <div key={pk.id} className={`rounded-lg border ${theme.ring} bg-gradient-to-b ${theme.bg} p-2`}>
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{pk.label}</p>
                      <span className={`shrink-0 rounded px-1 py-px text-[8px] font-black tracking-wide ${theme.chip}`}>{theme.badge}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[9px] font-bold text-white/50">{pk.desc}</p>
                    {/* 구성 미리보기 — 아이템 칩 (최대 4개, 아이콘+수량) */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {contents.slice(0, 4).map((g, gi) => {
                        const ic = g.item ? ITEMS[g.item]?.icon : undefined;
                        return (
                          <span key={gi} className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-black ${theme.chip}`}>
                            {ic ? <img src={`/assets/${ic}.webp`} alt="" className="h-3 w-3" style={{ imageRendering: "pixelated" }} /> : null}
                            {g.label}
                          </span>
                        );
                      })}
                      {contents.length > 4 && (
                        <span className={`rounded px-1 py-0.5 text-[9px] font-black ${theme.chip}`}>+{contents.length - 4}개</span>
                      )}
                    </div>
                    <button
                      onClick={() => EventBus.emit("rpg:buyStorePack", { id: pk.id })}
                      className={`mt-1.5 w-full rounded-lg bg-gradient-to-b ${theme.cta} px-2.5 py-1.5 text-[11px] font-black shadow-sm active:scale-[0.98]`}
                    >
                      스토어에서 구매 — 가격 확인
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 px-0.5 text-[9px] font-bold leading-snug text-white/40">결제는 Google Play 결제로 진행됩니다 (웹에서는 스토어 연동 전까지 미지원)</p>
          </div>
        )}

        {/* v4.1.0 — 광고 보상 + 구글 플레이 충전 (유저 지시 #10 — BM 수익 연동) */}
        <div className="mt-2.5 rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-2.5 py-2">
          <p className="text-[12px] font-black text-amber-200">에메랄드 충전소</p>
          <button
            onClick={() => EventBus.emit("rpg:adReward")}
            className="mt-1.5 w-full rounded-lg border-2 border-amber-300/60 bg-amber-400/15 px-3 py-2 text-[12px] font-black text-amber-100 hover:bg-amber-400/25 active:scale-95"
          >
            광고 보고 보상 받기 — 에메랄드 +1 · 골드 +500 (일 5회)
          </button>
          {/* v4.5.0 — 보상형 광고 확장 (무료 상자/버프 물약 — 광고 포인트 3종) */}
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              onClick={() => EventBus.emit("rpg:adChest")}
              className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-2 py-1.5 text-[10px] font-black text-amber-100 hover:bg-amber-400/20 active:scale-95"
            >
              광고 보고 무료 상자 ({rpg.isekai?.daily?.adsChest ?? 0}/3)
            </button>
            <button
              onClick={() => EventBus.emit("rpg:adDrop")}
              className="rounded-lg border border-purple-300/40 bg-purple-400/10 px-2 py-1.5 text-[10px] font-black text-purple-100 hover:bg-purple-400/20 active:scale-95"
            >
              광고 보고 버프 물약 ({rpg.isekai?.daily?.adsDrop ?? 0}/2)
            </button>
          </div>
          <p className="mt-0.5 text-[10px] text-white/40">짧은 광고를 끝까지 보면 바로 지급 — 폰 버전(APK) 기준 · 구독자는 보상 2배+8회</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {GEM_SKUS.map((s) => (
              <button
                key={s.id}
                onClick={() => EventBus.emit("rpg:buyGems", { sku: s.id })}
                className="flex flex-col items-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-1 py-1.5 text-center hover:bg-cyan-400/20 active:scale-95"
              >
                <span className="text-[13px] font-black text-cyan-200">{s.gems}</span>
                <span className="text-[9px] font-bold text-white/55">{s.priceLabel}</span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-white/40">구글 플레이 결제 — Play Console 상품 등록 후 폰 버전에서 구매 가능</p>
          <p className="mt-0.5 text-[10px] text-white/40">웹샵(자체 결제) 오픈 예정 — 웹 결제 시 에메랄드 +10% 보너스</p>
        </div>

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
            <img src="/assets/npc_merchant.webp" alt="" className="h-8 w-8" style={{ imageRendering: "pixelated" }} />
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
            {/* v3.0.6 (지시 #1) — 캐시상점 진입 (에메랄드 전용 · 상점과 분리) · v1.0.3 명칭 변경 */}
            <button
              onClick={() => EventBus.emit("ui:panel", { panel: "bmshop" })}
              className="rounded-md border border-cyan-300/60 bg-cyan-400/15 px-2 py-1 text-[10px] font-black text-cyan-200 hover:bg-cyan-400/30"
            >
              캐시상점
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
            /* v1.0.2 (#물약상점) — 카테고리 세분화: 회복 물약이 15종으로 늘어 "물약·장비" 한 섹션에
             * 섞이면 스크롤 탐색이 어려워져 회복/기타/장비로 분리 (유저 지시 — 이해하기 쉬운 분류) */
            { label: "회복 물약", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "consumable" && !!(it.heal || it.restore || it.healFull) },
            { label: "기타 소모품", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "consumable" && !(it.heal || it.restore || it.healFull) },
            { label: "장비", test: (it: (typeof ITEMS)[ItemKey]) => it.kind === "weapon" || it.kind === "armor" || it.kind === "accessory" },
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
            <img src="/assets/icon_hammer.webp" alt="" className="h-4 w-4" style={{ imageRendering: "pixelated" }} />
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
              /* v3.0.7 — 강화 주문서 충전분 성공률 가산 표기 · v1.0.8 실패 가산(천장) 반영 */
              const bless = Math.min(rpg.starBless ?? 0, STAR_BLESS_MAX);
              const starPity = Math.min(rpg.starPity ?? 0, STAR_PITY_MAX);
              const rate = (UPGRADE_RATES[up] ?? 0) + bless * STAR_BLESS_RATE + starPity;
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
 *  v1.0.1 — 2탭 개편: ①시세판(기존 NPC 에메랄드 시세 유지) ②유저 거래판(계정 연계 실거래 —
 *  서버 /api/market ledger, 판매 정산 시 10% 수수료 = BM 수익, 로그인 유저만 이용) */
export function TradePanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const [tab, setTab] = useState<"npc" | "user">("npc");
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
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/assets/item_ring_guard.webp" alt="" className="h-8 w-8" style={{ imageRendering: "pixelated" }} />
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

        {/* v1.0.1 — 탭 스위처 */}
        <div className="mb-2.5 grid grid-cols-2 gap-1">
          <button
            onClick={() => setTab("npc")}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-black active:scale-95 ${tab === "npc" ? "bg-teal-400 text-slate-900" : "border border-white/10 bg-white/[0.04] text-white/55"}`}
          >
            시세판 (에메랄드)
          </button>
          <button
            onClick={() => setTab("user")}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-black active:scale-95 ${tab === "user" ? "bg-amber-400 text-slate-900" : "border border-white/10 bg-white/[0.04] text-white/55"}`}
          >
            유저 거래판 (골드) NEW
          </button>
        </div>

        {tab === "npc" ? (
          <>
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
          </>
        ) : (
          <MarketBoard rpg={rpg} />
        )}
      </div>
    </div>
  );
}

/* ================= v1.0.1 — 유저 거래판 (계정 연계 실거래 보드) =================
 *  서버 /api/market — 로그인 필수 · 동시 등록 3칸 · 판매 정산 시 10% 수수료.
 *  서버 처리 성공 → EventBus로 WorldScene이 세이브(골드/보유) 반영 → 응답 스냅샷으로 갱신.
 * v1.0.3 (#거래소크래시) — 응답이 JSON이 아니거나(404 HTML/WebView 내부 서버) listings 누락 시
 *  mk.listings.filter에서 앱 전체 크래시(Application error)가 났다 → 스냅샷 검증 헬퍼로 원천 차단. */
/** 서버 응답을 안전하게 MarketState로 변환 — listings 배열 없으면 null (크래시 대신 재조회 안내) */
function takeMarketSnapshot(data: unknown): MarketState | null {
  const d = data as Partial<MarketState> | null;
  if (!d || !Array.isArray(d.listings)) return null;
  return {
    listings: d.listings,
    pending: { gold: Number(d.pending?.gold ?? 0), count: Number(d.pending?.count ?? 0) },
    feePct: Number(d.feePct ?? 10),
    maxListings: Number(d.maxListings ?? 3),
    guest: !!d.guest,
  };
}
function MarketBoard({ rpg }: { rpg: RpgState }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mk, setMk] = useState<MarketState | null>(null);
  const [msg, setMsg] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [me, st] = await Promise.all([authMe(), marketGet()]);
    setUser(me);
    const snap = takeMarketSnapshot(st.state);
    setMk(snap);
    setLoaded(true);
    if (st.error || !snap) setMsg(snap ? st.error ?? "" : "거래판 서버에 연결할 수 없어요 (멀티 서버 설정 확인)");
  };
  useEffect(() => {
    const t = setTimeout(() => { void refresh(); }, 0); // eslint 규칙 대응 — 비동기 조회는 태스크로 분리
    return () => clearTimeout(t);
  }, []);

  /* 등록 가능: 보유 전설 중 미등록·미장착 — v1.0.3 mk/listings 전 접근을 ?./?? 로 방어 */
  const listings = mk?.listings ?? [];
  const mineKeys = listings.filter((l) => l.mine).map((l) => l.itemKey);
  const listable = TRADE_STOCK.filter((k) => rpg.owned.includes(k) && !mineKeys.includes(k) && !rpg.accessories.includes(k));
  const slotsLeft = (mk?.maxListings ?? 3) - mineKeys.length;

  const doList = async (key: string, up: number) => {
    const p = parseInt(prices[key] ?? "", 10);
    if (!Number.isFinite(p) || p < 1) { setMsg("가격을 1G 이상 입력하세요"); return; }
    setBusy(true);
    /* v1.0.6 — 서버가 클라우드 세이브로 실보유를 검증하므로, 등록 직전 최신 세이브를 선업로드
     *  (방금 획득한 보스 드롭도 3분 주기 백업을 기다리지 않고 즉시 등록 가능). 실패해도 계속 진행. */
    try { const save = loadSave(); if (save) await cloudSaveUpload(save); } catch { /* 선동기화 실패 무시 */ }
    const r = await marketList(key, up, p);
    setBusy(false);
    if (!r.ok) { setMsg(String(r.data.error ?? "등록 실패")); return; }
    EventBus.emit("rpg:marketList", { key, up });
    setMk(takeMarketSnapshot(r.data));
    setPrices((s) => ({ ...s, [key]: "" }));
    setMsg("");
  };
  const doCancel = async (id: string, itemKey: string, up: number) => {
    setBusy(true);
    const r = await marketCancel(id);
    setBusy(false);
    if (!r.ok) { setMsg(String(r.data.error ?? "취소 실패")); return; }
    EventBus.emit("rpg:marketCancel", { itemKey, up });
    setMk(takeMarketSnapshot(r.data));
    setMsg("");
  };
  const doBuy = async (l: { id: string; itemKey: string; up: number; price: number }) => {
    if (rpg.gold < l.price) { setMsg("골드가 부족해요"); return; }
    setBusy(true);
    const r = await marketBuy(l.id);
    setBusy(false);
    if (!r.ok) { setMsg(String(r.data.error ?? "구매 실패")); return; }
    EventBus.emit("rpg:marketBuy", { itemKey: l.itemKey, up: l.up, price: l.price });
    setMk(takeMarketSnapshot(r.data));
    setMsg("");
  };
  const doCollect = async () => {
    setBusy(true);
    const r = await marketCollect();
    setBusy(false);
    if (!r.ok) { setMsg(String(r.data.error ?? "수령 실패")); return; }
    EventBus.emit("rpg:marketCollect", { gold: Number(r.data.gold ?? 0) });
    setMk(takeMarketSnapshot(r.data));
    setMsg("");
  };

  if (!loaded) {
    return <p className="py-6 text-center text-[11px] text-white/50">거래판을 불러오는 중…</p>;
  }
  if (!user) {
    return (
      <div className="rounded-lg border border-amber-300/40 bg-amber-400/[0.08] px-3 py-4 text-center">
        <p className="text-[12px] font-black text-amber-200">🔐 계정 로그인이 필요한 서비스</p>
        <p className="mt-1 text-[10px] leading-relaxed text-white/60">
          유저 거래판은 계정 시스템과 연동돼요 — 사기 방지와 정산 보호를 위해<br />로그인한 모험가만 이용할 수 있어요.
        </p>
        <p className="mt-1.5 text-[10px] text-white/45">우측 위 계정 패널에서 회원가입/로그인 (구글·카카오·네이버 지원)</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {/* 정산금 바 */}
      <div className="flex items-center justify-between rounded-lg border border-amber-300/40 bg-amber-400/[0.08] px-2.5 py-2">
        <div>
          <p className="text-[11px] font-black text-amber-200">💰 판매 정산금 — {(mk?.pending.gold ?? 0).toLocaleString()} G</p>
          <p className="text-[9px] text-white/50">판매 성공 시 10% 수수료를 제외한 90%가 적립됩니다</p>
        </div>
        <button
          disabled={busy || (mk?.pending.gold ?? 0) <= 0}
          onClick={doCollect}
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-black active:scale-95 ${(mk?.pending.gold ?? 0) > 0 ? "bg-amber-400 text-slate-900 hover:bg-amber-300" : "cursor-not-allowed bg-white/[0.06] text-white/30"}`}
        >
          수령
        </button>
      </div>

      {/* 등록 섹션 */}
      <p className="text-[11px] font-bold text-white/50">내 전설 등록 — 판매 ({slotsLeft}칸 남음 · 최대 {mk?.maxListings ?? 3})</p>
      {listable.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/40">
          등록 가능한 전설이 없어요 — 보스 전용 드롭을 획득하거나, 장착 중인 장비는 해제하세요
        </p>
      ) : slotsLeft <= 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/40">등록 칸이 가득 찼어요 — 판매/취소 후 다시 등록하세요</p>
      ) : (
        <div className="flex max-h-[22vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {listable.map((k) => {
            const item = ITEMS[k];
            const up = rpg.accUp?.[k] ?? 0;
            const defPrice = (TRADE_PRICES[k] ?? 8) * 5000;
            return (
              <div key={k} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>{displayName(item.name, up)}</p>
                  <input
                    {...swallowKeys}
                    inputMode="numeric"
                    value={prices[k] ?? ""}
                    onChange={(e) => setPrices((s) => ({ ...s, [k]: e.target.value.replace(/[^0-9]/g, "").slice(0, 8) }))}
                    placeholder={`${defPrice.toLocaleString()}G 권장`}
                    className="mt-0.5 w-full rounded border border-white/15 bg-black/40 px-1.5 py-1 text-[10px] font-bold text-white placeholder:text-white/25 focus:border-amber-300/60 focus:outline-none"
                  />
                </div>
                <button
                  disabled={busy || !(parseInt(prices[k] ?? "", 10) >= 1)}
                  onClick={() => doList(k, up)}
                  className={`shrink-0 rounded-md px-2 py-1.5 text-[11px] font-black active:scale-95 ${parseInt(prices[k] ?? "", 10) >= 1 ? "bg-amber-400 text-slate-900 hover:bg-amber-300" : "cursor-not-allowed bg-white/[0.06] text-white/30"}`}
                >
                  등록
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 판매 목록 */}
      <p className="text-[11px] font-bold text-white/50">판매 등록물 {listings.length}건</p>
      {listings.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/40">아직 등록물이 없어요 — 첫 판매자가 되어보세요!</p>
      ) : (
        <div className="flex max-h-[30vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {listings.map((l) => {
            const item = ITEMS[l.itemKey as ItemKey];
            if (!item) return null;
            const seller = l.mine ? "나" : (l.seller ?? "모험가");
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                <ItemIcon icon={item.icon} tier={item.tier} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12px] font-bold ${TIER_STYLE[item.tier].name}`}>
                    {displayName(item.name, l.up)}
                    <span className="ml-1.5 rounded bg-black/50 px-1 py-px text-[9px] font-black text-white/45">{seller}</span>
                  </p>
                  <p className="text-[10px] text-white/50">{itemEffect(item, l.up)}</p>
                </div>
                {l.mine ? (
                  <button
                    disabled={busy}
                    onClick={() => doCancel(l.id, l.itemKey, l.up)}
                    className="shrink-0 rounded-md bg-white/15 px-2 py-1.5 text-[11px] font-black text-white/75 hover:bg-white/25 active:scale-95"
                  >
                    취소
                  </button>
                ) : (
                  <button
                    disabled={busy || rpg.gold < l.price}
                    onClick={() => doBuy(l)}
                    className={`shrink-0 rounded-md px-2 py-1.5 text-[11px] font-black active:scale-95 ${rpg.gold >= l.price ? "bg-teal-400 text-slate-900 hover:bg-teal-300" : "cursor-not-allowed bg-slate-700/50 text-white/35"}`}
                  >
                    {l.price.toLocaleString()}G
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {msg && <p className="rounded-md border border-rose-300/40 bg-rose-400/10 px-2 py-1.5 text-center text-[10px] font-bold text-rose-200">{msg}</p>}
      <p className="text-center text-[10px] text-white/40">
        등록 즉시 보유 목록에서 빠지고, 취소하면 돌아와요 · 수수료 10%는 거래판 운영비입니다
      </p>
    </div>
  );
}

/* ================= v4.4.0 — 메이플 스타일 인벤토리 (컨셉 이미지 반영: "이런 느낌으로 ㄱㄱ") =================
 *  - 타이틀 바 + 장비/캐시/기타/AD 4탭 + 5열 그리드 슬롯 + 수량 배지 + 상세 푸터 + [정리] 바
 *  - 기존 틀 유지: owned 멀티셋 · EventBus 명령어 전부 그대로 (equip/use/useItem/useBuff/pet/cosmetic/
 *    quickpot/autoset/eert/upgradeAcc/sell/sellPotion/starScroll/unequip/adReward/buyGems)
 *  - 모든 기존 기능 보존: H/M 퀵슬롯, 자동 사용 설정, 장신구 스타포스, eert, 거래소, 판매, 세트 효과 */

const TIER_HEX: Record<ItemTier, string> = {
  common: "#9a8d7d",
  rare: "#3ecf8e",
  epic: "#b57de8",
  legend: "#fcce4d",
};

type InvTab = "equip" | "cash" | "etc" | "ad";
type InvSel = { t: "item" | "buff" | "pet" | "cos"; k: string };
type InvSlot = {
  uk: string;
  t: "item" | "buff" | "pet" | "cos";
  k: string;
  icon: string;
  tier: ItemTier;
  count: number;
  wornLabel?: string;
  potGrade?: number;
  quick?: string;
  dim?: boolean;
};

/** 메이플 그리드 칸 — 5열 고정 · 수량 배지 우하단 · 빈 칸까지 렌더 (컨셉 이미지) */
function InvGrid({ slots, sel, onPick, min = 30 }: { slots: InvSlot[]; sel: InvSel | null; onPick: (s: InvSlot) => void; min?: number }) {
  const fill = Math.max(min - slots.length, Math.ceil(slots.length / 5) * 5 - slots.length);
  return (
    <div className="rounded-lg border-2 border-[#211c17] bg-[#2a241e] p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
      <div className="grid grid-cols-5 gap-1">
        {slots.map((s) => {
          const active = !!sel && sel.t === s.t && sel.k === s.k;
          const pot = s.potGrade !== undefined && s.potGrade >= 0 ? POT_GRADE_META[s.potGrade] : null;
          return (
            <button
              key={s.uk}
              onClick={() => onPick(s)}
              aria-label={s.k}
              className={`relative aspect-square rounded-[5px] border-2 transition-colors ${active ? "border-amber-300 bg-[#5e5240]" : ""}`}
              style={active ? undefined : { borderColor: pot ? pot.color : TIER_HEX[s.tier], backgroundColor: "#4a4136" }}
            >
              <img
                src={`/assets/${s.icon}.webp`}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-[10%] h-[80%] w-[80%] object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              {pot && <span className="pointer-events-none absolute inset-0 rounded-[4px]" style={{ boxShadow: `inset 0 0 5px ${pot.color}55, 0 0 6px ${pot.color}66` }} />}
              {s.wornLabel && <span className="absolute left-0.5 top-0.5 rounded-sm bg-emerald-600/95 px-1 text-[8px] font-black leading-[12px] text-white">{s.wornLabel}</span>}
              {s.quick && <span className="absolute right-0.5 top-0.5 rounded-sm bg-sky-600/95 px-1 text-[8px] font-black leading-[12px] text-white">{s.quick}</span>}
              {(s.count > 1 || s.count === 0) && (
                <span className={`absolute bottom-0 right-0 rounded-tl-sm rounded-br-[3px] bg-black/85 px-1 text-[9px] font-black leading-[14px] text-white [text-shadow:0_1px_1px_#000] ${s.dim ? "opacity-70" : ""}`}>
                  {s.count}
                </span>
              )}
              {s.dim && <span className="pointer-events-none absolute inset-0 rounded-[4px] bg-black/40" />}
            </button>
          );
        })}
        {Array.from({ length: Math.max(fill, 0) }, (_, i) => (
          <span key={`blank-${i}`} className="aspect-square rounded-[5px] border border-[#453e34]/80 bg-[#251f1a]/60" />
        ))}
      </div>
    </div>
  );
}

/** 메이플 통통한 액션 버튼 */
/** v1.0.5 — 키맵을 따라가는 물약 사용 키 힌트 (v1.0.4 키 개편 후 H/M 표기가 실제 사용 키와 어긋난 것 해소) */
function QuickKeyHint({ slot }: { slot: "potHp" | "potMp" }) {
  return <>{loadKeyMap()[slot]}</>;
}

function InvBtn({ children, onClick, disabled, tone = "amber", title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "amber" | "sky" | "violet" | "gray"; /** v1.0.5 — 퀵슬롯 장착 버튼 툴팁 */ title?: string }) {
  const tones: Record<string, string> = {
    amber: "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_2px_0_#92400e]",
    sky: "bg-gradient-to-b from-sky-300 to-sky-500 text-slate-900 shadow-[0_2px_0_#075985]",
    violet: "bg-gradient-to-b from-violet-300 to-violet-500 text-slate-900 shadow-[0_2px_0_#4c1d95]",
    gray: "bg-[#57504a] text-white/70 shadow-[0_2px_0_#211c17]",
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-black transition-transform active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:active:translate-y-0 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function InventoryPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const [tab, setTab] = useState<InvTab>("equip");
  const [sel, setSel] = useState<InvSel | null>(null);
  /* v4.6.0 — 가방 스타포스 강화 결과 플래시 (상점 강화와 동일 이벤트 재사용, 2.5초 후 자동 소멸) */
  const [flash, setFlash] = useState<{ slot: "weapon" | "armor"; result: "ok" | "fail"; seq: number } | null>(null);
  useEffect(() => {
    let seq = 0;
    let t: ReturnType<typeof setTimeout> | null = null;
    const on = (v: { slot: "weapon" | "armor"; result: "ok" | "fail" }) => {
      setFlash({ slot: v.slot, result: v.result, seq: ++seq });
      if (t) clearTimeout(t);
      t = setTimeout(() => setFlash(null), 2500);
    };
    EventBus.on("rpg:upgradeResult", on);
    return () => {
      EventBus.off("rpg:upgradeResult", on);
      if (t) clearTimeout(t);
    };
  }, []);
  const auto = rpg.autoUse ?? { hpPct: 0, mpPct: 0, mpOn: false, buffs: [] as BuffKey[] };
  const qp = rpg.quickPots ?? { hp: "potion_hp", mp: "potion_mp" };
  const eertN = rpg.eertCube ?? 0;

  const pick = (t: InvTab) => {
    setTab(t);
    setSel(null);
  };
  const quickTag = (k: string) => [qp.hp === k ? "HP" : "", qp.mp === k ? "MP" : ""].filter(Boolean).join("·") || undefined; // v1.0.5 — H/M→HP/MP (사용 키는 키맵 D/F)

  /* ----- 장비 탭 슬롯 (무기/방어구/장신구 — 장착분 포함, owned 멀티셋 집계) ----- */
  const equipSlots: InvSlot[] = stackEquips(
    rpg.owned.filter((k) => {
      const it = ITEMS[k as ItemKey];
      return it && (it.kind === "weapon" || it.kind === "armor" || it.kind === "accessory");
    })
  ).map(([k, count]) => {
    const it = ITEMS[k as ItemKey];
    const wornN = rpg.accessories.filter((x) => x === k).length;
    return {
      uk: `item:${k}`,
      t: "item" as const,
      k,
      icon: it.icon,
      tier: it.tier,
      count,
      wornLabel: rpg.weapon === k || rpg.armor === k || wornN > 0 ? "장착" : undefined,
      potGrade: rpg.potentials?.[k]?.grade,
    };
  });

  /* 장착 중 장신구 6슬롯 (반지 4 + 펜던트 2 — 메이플 장비창 감각) */
  const accWorn: (string | null)[] = (() => {
    const worn = [...rpg.accessories];
    return Array.from({ length: 6 }, (_, i) => {
      const kind = i >= 4 ? "pendant" : "ring";
      const idx = worn.findIndex((k) => (ITEMS[k as ItemKey]?.slot ?? "ring") === kind);
      return idx >= 0 ? worn.splice(idx, 1)[0] : null;
    });
  })();

  /* ----- 캐시 탭 슬롯 (캐시 전용 버프 + 펫/치장 — 에메랄드 재화 아이템만) -----
   * v1.0.3 (#캐시템분리) — 유저 지시 "일반상점에서 살 수 있는 버프는 캐시템이 아니다":
   *  골드 버프(buff_atk/def/spd/exp/crit/gold/luck)는 기타 탭으로 이동, 캐시 탭에는
   *  캐시 전용 버프(buff_king)만 남긴다. */
  const CASH_BUFFS: BuffKey[] = ["buff_king"];
  const buffSlots: InvSlot[] = (Object.keys(BUFF_DEFS) as BuffKey[])
    .filter((bk) => CASH_BUFFS.includes(bk) && (rpg.buffItems[bk] ?? 0) > 0)
    .map((bk) => ({ uk: `buff:${bk}`, t: "buff" as const, k: bk, icon: BUFF_DEFS[bk].icon, tier: "legend" as ItemTier, count: rpg.buffItems[bk] ?? 0 }));
  const petSlots: InvSlot[] = rpg.pets.map((pk) => ({
    uk: `pet:${pk}`,
    t: "pet" as const,
    k: pk,
    icon: PET_DEFS[pk as PetKey]?.icon ?? "item_coin",
    tier: "rare" as ItemTier,
    count: 1,
    wornLabel: rpg.pet === pk ? "소환" : undefined,
  }));
  const cosSlots: InvSlot[] = rpg.cosmetics.map((ck) => ({
    uk: `cos:${ck}`,
    t: "cos" as const,
    k: ck,
    icon: COSMETIC_DEFS[ck as CosmeticKey]?.icon ?? "item_coin",
    tier: "epic" as ItemTier,
    count: 1,
    /* v1.0.7 — 슬롯별 착용 표기 (오라/코스튬/헤어 독립 슬롯) */
    wornLabel:
      COSMETIC_DEFS[ck as CosmeticKey]?.slot === "outfit" ? (rpg.outfit === ck ? "착용" : undefined)
      : COSMETIC_DEFS[ck as CosmeticKey]?.slot === "hair" ? (rpg.hair === ck ? "착용" : undefined)
      : (rpg.cosmetic === ck ? "착용" : undefined),
  }));

  /* ----- 기타 탭 슬롯 (물약 전 티어 + 스크롤/큐브/책/상자 — 기본 물약은 카운터 가상 슬롯) ----- */
  const consOrder = (k: string) => {
    const m = /^(potion_hp|potion_mp)(\d+)?$/.exec(k);
    if (m) return (m[1] === "potion_hp" ? 0 : 100) + (m[2] ? Number(m[2]) : 0);
    if (k.startsWith("scroll_")) return 200;
    if (k === "eert_cube" || k === "tier_cube") return 300;
    if (k === "exp_book") return 310;
    return 400;
  };
  const etcSlots: InvSlot[] = [
    { uk: "item:potion_hp", t: "item", k: "potion_hp", icon: ITEMS.potion_hp.icon, tier: ITEMS.potion_hp.tier, count: rpg.hpPot, quick: quickTag("potion_hp"), dim: rpg.hpPot <= 0 },
    { uk: "item:potion_mp", t: "item", k: "potion_mp", icon: ITEMS.potion_mp.icon, tier: ITEMS.potion_mp.tier, count: rpg.mpPot, quick: quickTag("potion_mp"), dim: rpg.mpPot <= 0 },
    ...stackEquips(rpg.owned.filter((k) => ITEMS[k as ItemKey]?.kind === "consumable"))
      .sort((a, b) => consOrder(a[0]) - consOrder(b[0]))
      .map(([k, count]) => {
        const it = ITEMS[k as ItemKey];
        return { uk: `item:${k}`, t: "item" as const, k, icon: it.icon, tier: it.tier, count, quick: quickTag(k), dim: count <= 0 };
      }),
    /* v1.0.3 (#캐시템분리) — 골드 버프는 캐시가 아니라 기타 소모품: 기타 탭에서 사용(useBuff) */
    ...(Object.keys(BUFF_DEFS) as BuffKey[])
      .filter((bk) => bk !== "buff_king" && (rpg.buffItems[bk] ?? 0) > 0)
      .map((bk) => ({ uk: `buff:${bk}`, t: "buff" as const, k: bk, icon: BUFF_DEFS[bk].icon, tier: "rare" as ItemTier, count: rpg.buffItems[bk] ?? 0 })),
  ];

  /* 선택 슬롯 해석 — 사용/판매 등으로 사라지면 자동으로 선택 해제 */
  const selSlot: InvSlot | null = sel
    ? [...equipSlots, ...buffSlots, ...petSlots, ...cosSlots, ...etcSlots].find((s) => s.uk === `${sel.t}:${sel.k}`) ?? null
    : null;

  const TABS: { id: InvTab; label: string; on: string }[] = [
    { id: "equip", label: "장비", on: "border-amber-200/80 bg-gradient-to-b from-amber-300 to-orange-500 text-white" },
    { id: "cash", label: "캐시", on: "border-cyan-200/80 bg-gradient-to-b from-cyan-300 to-sky-500 text-white" },
    { id: "etc", label: "기타", on: "border-violet-200/80 bg-gradient-to-b from-violet-300 to-purple-500 text-white" },
    { id: "ad", label: "AD", on: "border-rose-200/80 bg-gradient-to-b from-rose-300 to-red-500 text-white" },
  ];

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="flex max-h-[min(94svh,680px)] w-[min(94vw,444px)] flex-col overflow-hidden rounded-xl border-2 border-[#6b5f52] bg-[#38322b] shadow-[0_0_0_2px_#191512,0_18px_50px_rgba(0,0,0,0.65)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 타이틀 바 (메이플 EQUIPMENT / INVENTORY) */}
        <div className="flex shrink-0 items-center justify-between border-b-2 border-[#211c17] bg-gradient-to-b from-[#4c443a] to-[#3b352d] px-3 py-2">
          <p className="text-[13px] font-black tracking-wide text-amber-100">
            인벤토리
            <span className="ml-1.5 text-[8px] font-bold tracking-[0.2em] text-white/35">EQUIPMENT / INVENTORY</span>
          </p>
          <button onClick={onClose} aria-label="인벤토리 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">
            ✕
          </button>
        </div>

        {/* 탭 행 — 탭마다 고유 색 (장비=주황 · 캐시=청록 · 기타=보라 · AD=장미) */}
        <div className="flex shrink-0 gap-1 border-b-2 border-[#211c17] bg-[#332d26] px-2 pt-1.5">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => pick(tb.id)}
              className={`flex-1 rounded-t-md border-2 border-b-0 px-1 py-1.5 text-[12px] font-black transition-colors ${
                tab === tb.id ? tb.on : "border-[#57504a] bg-[#453f37] text-white/45 hover:text-white/75"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* 본문 — 탭별 콘텐츠 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
          {tab === "equip" && (
            <>
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-100/50">
                장착 슬롯 <span className="font-bold text-white/30">반지 4 · 펜던트 2 — 눌러서 해제</span>
              </p>
              <div className="mb-2 grid grid-cols-6 gap-1">
                {accWorn.map((k, i) => {
                  const it = k ? ITEMS[k as ItemKey] : null;
                  const pendant = i >= 4;
                  return (
                    <button
                      key={i}
                      title={it ? `${it.name} — 탭하여 해제` : `${pendant ? "펜던트" : "반지"} 슬롯 (비어 있음)`}
                      onClick={() => k && EventBus.emit("rpg:unequip", { key: k as ItemKey })}
                      className={`relative flex aspect-square items-center justify-center rounded-[5px] border-2 ${
                        it ? "border-amber-300/50 bg-[#4a4136]" : "border-dashed border-[#5a5248] bg-[#251f1a]/60"
                      }`}
                    >
                      {it ? (
                        <img src={`/assets/${it.icon}.webp`} alt="" draggable={false} className="h-[76%] w-[76%]" style={{ imageRendering: "pixelated" }} />
                      ) : (
                        <span className="text-[8px] font-bold text-white/30">{pendant ? "펜던트" : "반지"}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-100/50">
                장비 <span className="font-bold text-white/30">{equipSlots.length}종 · 무기/방어구/장신구</span>
              </p>
              {equipSlots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-5 text-center text-[11px] text-white/35">
                  장비가 없습니다 — 상인 라고스에게서 구매할 수 있어요
                </p>
              ) : (
                <InvGrid slots={equipSlots} sel={sel} onPick={(s) => setSel({ t: s.t, k: s.k })} />
              )}

              {/* 세트 효과 (v3.0.16 — 유지) */}
              {(() => {
                const as = rpg.activeSet;
                return (
                  <div className={`mt-2 rounded-lg border-2 p-2.5 ${as ? "border-amber-300/60 bg-amber-400/[0.08]" : "border-[#211c17] bg-[#2a241e]"}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] font-black ${as ? "text-amber-200" : "text-white/60"}`}>{as ? `세트 효과 활성 — ${as.title}` : "세트 효과"}</p>
                      {as && <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-black text-amber-200">ON</span>}
                    </div>
                    <p className={`mt-0.5 text-[10px] leading-snug ${as ? "font-bold text-amber-100/90" : "text-white/40"}`}>
                      {as ? as.lines.join(" · ") : "같은 챕터 테마 장비 세트(무기 + 방어구 + 반지)를 모두 착용하면 활성화됩니다"}
                    </p>
                  </div>
                );
              })()}
            </>
          )}

          {tab === "cash" && (
            <>
              <button
                onClick={() => EventBus.emit("ui:panel", { panel: "bmshop" })}
                className="mb-2 w-full rounded-lg border-2 border-cyan-300/50 bg-gradient-to-b from-cyan-400/20 to-sky-500/15 px-3 py-2 text-[12px] font-black text-cyan-100 hover:from-cyan-400/30 active:translate-y-[1px]"
              >
                💎 캐시상점 열기 <span className="font-bold text-white/40">— 에메랄드 상점</span>
              </button>
              {buffSlots.length + petSlots.length + cosSlots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-6 text-center text-[11px] text-white/35">
                  캐시 아이템이 없습니다 — 캐시상점에서 큐브/펫/치장을 구매해보세요
                </p>
              ) : (
                <>
                  {buffSlots.length > 0 && (
                    <>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-100/50">버프 물약 <span className="font-bold text-white/30">{buffSlots.length}종</span></p>
                      <div className="mb-2">
                        <InvGrid slots={buffSlots} sel={sel} onPick={(s) => setSel({ t: s.t, k: s.k })} min={10} />
                      </div>
                    </>
                  )}
                  {petSlots.length > 0 && (
                    <>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-100/50">펫 <span className="font-bold text-white/30">{petSlots.length}종</span></p>
                      <div className="mb-2">
                        <InvGrid slots={petSlots} sel={sel} onPick={(s) => setSel({ t: s.t, k: s.k })} min={10} />
                      </div>
                    </>
                  )}
                  {cosSlots.length > 0 && (
                    <>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-100/50">치장 (오라) <span className="font-bold text-white/30">{cosSlots.length}종</span></p>
                      <InvGrid slots={cosSlots} sel={sel} onPick={(s) => setSel({ t: s.t, k: s.k })} min={10} />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === "etc" && (
            <>
              {/* v4.6.0 — 자동 사용 설정을 기타 탭 최상단(그리드 위)으로 이동:
                  기존엔 소모품 그리드 아래 깊숙이 있어 "자동 물약·버프 어디감?" 제기 → 열자마자 보이는 자리로 */}
              <div className="mb-2 rounded-lg border-2 border-[#211c17] bg-[#2a241e] p-2.5">
                <p className="mb-1.5 text-[11px] font-black text-amber-100/80">
                  ⚙️ 자동 물약 · 버프 <span className="font-bold text-white/35">— 전투 중 자동으로 사용됩니다</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-1.5">
                    <p className="text-[11px] font-bold text-white/80">자동 HP 물약 — {auto.hpPct === 0 ? "HP 버튼 물약" : `${auto.hpPct}% 이하`}</p>
                    <button
                      onClick={() => EventBus.emit("rpg:autoset", { hpPct: auto.hpPct === 0 ? 30 : auto.hpPct === 30 ? 50 : auto.hpPct === 50 ? 70 : 0 })}
                      className="rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-black text-white hover:bg-sky-400 active:scale-95"
                    >
                      {auto.hpPct === 0 ? "끄기" : `${auto.hpPct}% 이하`}
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-1.5">
                    <p className="text-[11px] font-bold text-white/80">자동 MP 물약 — {(auto.mpPct ?? 0) === 0 ? (auto.mpOn ? "25% 이하 (기존)" : "MP 버튼 물약") : `${auto.mpPct}% 이하`}</p>
                    <button
                      onClick={() => EventBus.emit("rpg:autoset", { mpPct: (auto.mpPct ?? 0) === 0 ? 30 : auto.mpPct === 30 ? 50 : auto.mpPct === 50 ? 70 : 0, mpOn: false })}
                      className="rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-black text-white hover:bg-sky-400 active:scale-95"
                    >
                      {(auto.mpPct ?? 0) === 0 ? (auto.mpOn ? "25% 이하" : "끄기") : `${auto.mpPct}% 이하`}
                    </button>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/40">자동 버프 — 보유 중인 물약을 자동으로 사용 (중복 선택 가능)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["buff_atk", "buff_def", "buff_spd", "buff_exp", "buff_king", "buff_crit", "buff_gold", "buff_luck"] as BuffKey[]).map((b) => {
                      const on = (auto.buffs ?? []).includes(b);
                      const have = (rpg.buffItems[b] ?? 0) > 0;
                      const buffNames: Record<string, string> = {
                        buff_atk: "분노 (공격+25%)",
                        buff_def: "수호 (방어+8)",
                        buff_spd: "신속 (이동+25%)",
                        buff_exp: "지혜 (경험치+50%)",
                        buff_king: "왕의 가호 (올인원)",
                        buff_crit: "핵심 (크리+8%)",
                        buff_gold: "부지 (골드+40%)",
                        buff_luck: "행운 (드롭+)",
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

              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-violet-100/50">
                소모품 <span className="font-bold text-white/30">물약은 HP/MP 슬롯 버튼에 장착 — 터치 버튼·<QuickKeyHint slot="potHp"/>/<QuickKeyHint slot="potMp"/> 키로 사용</span>
              </p>
              <InvGrid slots={etcSlots} sel={sel} onPick={(s) => setSel({ t: s.t, k: s.k })} />
            </>
          )}

          {tab === "ad" && (
            <>
              {/* 광고 보상 — 컨셉 이미지의 AD 탭 */}
              <div className="rounded-lg border-2 border-[#211c17] bg-[#2a241e] p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-black text-rose-200">광고 보상</p>
                  <span className="rounded bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-black text-rose-200">오늘 {rpg.isekai?.daily.ads ?? 0}/5</span>
                </div>
                <button
                  onClick={() => EventBus.emit("rpg:adReward")}
                  className="mt-1.5 w-full rounded-lg border-2 border-rose-200/70 bg-gradient-to-b from-rose-400 to-red-500 px-3 py-2.5 text-[13px] font-black text-white shadow-[0_3px_0_#7f1d1d] hover:brightness-110 active:translate-y-[2px] active:shadow-none"
                >
                  ▶ 광고 보고 보상 받기 — 에메랄드 +1 · 골드 +500
                </button>
                <p className="mt-1 text-[10px] text-white/40">짧은 광고를 끝까지 보면 바로 지급 — 폰 버전(APK) 기준 · 일 5회</p>
              </div>

              {/* 에메랄드 충전 (v4.1.0 — 유지) */}
              <div className="mt-2 rounded-lg border-2 border-[#211c17] bg-[#2a241e] p-2.5">
                <p className="text-[12px] font-black text-cyan-200">에메랄드 충전 — 구글 플레이</p>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {GEM_SKUS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => EventBus.emit("rpg:buyGems", { sku: s.id })}
                      className="flex flex-col items-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-1 py-1.5 text-center hover:bg-cyan-400/20 active:scale-95"
                    >
                      <span className="text-[13px] font-black text-cyan-200">{s.gems}</span>
                      <span className="text-[9px] font-bold text-white/55">{s.priceLabel}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-white/40">Play Console 상품 등록 후 폰 버전에서 구매 가능</p>
              </div>

              <div className="mt-2 rounded-lg border-2 border-[#211c17] bg-[#2a241e] p-2.5">
                <p className="text-[11px] font-bold leading-relaxed text-white/55">
                  에메랄드 획득처 — 보스 +2 · 정예 +1 · 반복 의뢰 사이클 +1 · 광고 +1
                </p>
                <button
                  onClick={() => EventBus.emit("ui:panel", { panel: "bmshop" })}
                  className="mt-1.5 w-full rounded-lg border-2 border-cyan-300/50 bg-cyan-400/10 px-3 py-2 text-[12px] font-black text-cyan-100 hover:bg-cyan-400/20 active:scale-[0.98]"
                >
                  💎 캐시상점에서 에메랄드 아이템 보기
                </button>
              </div>
            </>
          )}
        </div>

        {/* 상세 푸터 — 선택 아이템 정보 + 액션 */}
        {tab !== "ad" && (
          <div className="max-h-[34svh] shrink-0 overflow-y-auto border-t-2 border-[#211c17] bg-[#332c25] px-2.5 py-2">
            {selSlot && sel ? (
              (() => {
                const s = selSlot;
                if (s.t === "buff") {
                  const def = BUFF_DEFS[s.k as BuffKey];
                  return (
                    <>
                      <div className="flex items-start gap-2.5">
                        <ItemIcon icon={s.icon} size={40} tier="rare" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13px] font-black text-white">
                            {def?.name ?? s.k}
                            <span className="rounded bg-emerald-400/15 px-1 py-px text-[9px] font-black text-emerald-200">고급</span>
                          </p>
                          <p className="truncate text-[11px] font-bold text-emerald-300/90">
                            {def?.desc} · {def ? Math.round(def.duration / 1000) : 0}초
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <InvBtn tone="sky" disabled={s.count <= 0} onClick={() => EventBus.emit("rpg:useBuff", { key: s.k as BuffKey })}>
                          사용
                        </InvBtn>
                        <span className="text-[10px] font-bold text-white/40">보유 {s.count}개</span>
                      </div>
                    </>
                  );
                }
                if (s.t === "pet") {
                  const def = PET_DEFS[s.k as PetKey];
                  const active = rpg.pet === s.k;
                  return (
                    <>
                      <div className="flex items-start gap-2.5">
                        <ItemIcon icon={s.icon} size={40} tier="rare" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-black text-white">{def?.name ?? s.k}</p>
                          <p className="truncate text-[11px] font-bold text-emerald-300/90">{def?.desc}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <InvBtn tone={active ? "gray" : "amber"} onClick={() => EventBus.emit("rpg:pet", { key: active ? null : (s.k as PetKey) })}>
                          {active ? "해제" : "소환"}
                        </InvBtn>
                      </div>
                    </>
                  );
                }
                if (s.t === "cos") {
                  const def = COSMETIC_DEFS[s.k as CosmeticKey];
                  /* v1.0.7 — 슬롯별 착용 판정 (emit은 기존 rpg:cosmetic 경로 재사용 — Player.setCosmetic이 슬롯 분기) */
                  const slot = def?.slot ?? "aura";
                  const active = slot === "outfit" ? rpg.outfit === s.k : slot === "hair" ? rpg.hair === s.k : rpg.cosmetic === s.k;
                  const slotLabel = slot === "outfit" ? "코스튬" : slot === "hair" ? "헤어" : "오라";
                  return (
                    <>
                      <div className="flex items-start gap-2.5">
                        <ItemIcon icon={s.icon} size={40} tier="epic" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-black text-white">{def?.name ?? s.k}</p>
                          <p className="truncate text-[11px] font-bold text-emerald-300/90">{def?.desc}</p>
                          <span className="mt-0.5 inline-block rounded bg-sky-400/15 px-1 py-px text-[9px] font-black text-sky-200/90">{slotLabel}</span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <InvBtn tone={active ? "gray" : "amber"} onClick={() => EventBus.emit("rpg:cosmetic", { key: active ? null : (s.k as CosmeticKey) })}>
                          {active ? "해제" : "착용"}
                        </InvBtn>
                      </div>
                    </>
                  );
                }
                /* ----- item ----- */
                const it = ITEMS[s.k as ItemKey];
                const tierChip = <span className={`rounded bg-white/10 px-1 py-px text-[9px] font-black ${TIER_STYLE[it.tier].name}`}>{TIER_STYLE[it.tier].label}</span>;
                const isBasicPot = s.k === "potion_hp" || s.k === "potion_mp";
                const isPot = s.k.startsWith("potion_");
                if (it.kind === "weapon" || it.kind === "armor") {
                  const equipped = rpg.weapon === s.k || rpg.armor === s.k;
                  const up = it.kind === "weapon" ? rpg.upWea : rpg.upArm;
                  /* v4.6.0 — 모든 스타포스 강화를 가방에서: 상점 강화와 동일 이벤트(rpg:upgrade)·비용·성공률(주문서 가산 포함) */
                  const eqSlot: "weapon" | "armor" = it.kind === "weapon" ? "weapon" : "armor";
                  const eqCost = upgradeCost(eqSlot, up);
                  /* v1.0.8 — 실패 가산(천장) 포함 실제 성공률 표기 */
                  const eqRate = (UPGRADE_RATES[up] ?? 0) + Math.min(rpg.starBless ?? 0, STAR_BLESS_MAX) * STAR_BLESS_RATE + Math.min(rpg.starPity ?? 0, STAR_PITY_MAX);
                  const eqMaxed = up >= UPGRADE_MAX;
                  const eqFlash = flash && flash.slot === eqSlot ? flash.result : null;
                  return (
                    <>
                      <div className="flex items-start gap-2.5">
                        <ItemIcon icon={s.icon} size={40} tier={it.tier} potGrade={s.potGrade} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13px] font-black text-white">
                            {displayName(it.name, up)} {tierChip}
                          </p>
                          <p className="truncate text-[11px] font-bold text-emerald-300/90">{itemEffect(it, up)}</p>
                          <PotViewLines pot={rpg.potentials?.[s.k]} />
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {equipped ? (
                          <span className="rounded-md bg-emerald-700/50 px-2.5 py-1.5 text-[11px] font-black text-emerald-200">장착 중</span>
                        ) : (
                          <InvBtn onClick={() => EventBus.emit("rpg:equip", { key: it.key })}>장착</InvBtn>
                        )}
                        {equipped && !eqMaxed && (
                          <InvBtn tone="amber" disabled={rpg.gold < eqCost} onClick={() => EventBus.emit("rpg:upgrade", { slot: eqSlot })}>
                            강화 {eqCost}G · {eqRate}%
                          </InvBtn>
                        )}
                        {/* v1.0.2 (#자동강화) — 목표 강화까지 자동 반복 (골드 부족/최고치/목표 도달 시 자동 종료) */}
                        {equipped && !eqMaxed && (
                          <span className="inline-flex items-center gap-1">
                            <select
                              aria-label="목표 강화 수치"
                              defaultValue={Math.min(UPGRADE_MAX, up + 3)}
                              onChange={(e) => { autoTargetMap.current[eqSlot] = Number(e.target.value); }}
                              className="rounded-md border border-white/15 bg-black/40 px-1 py-1 text-[10px] font-black text-white/80"
                            >
                              {Array.from({ length: UPGRADE_MAX - up }, (_, i) => up + i + 1).map((n) => (
                                <option key={n} value={n}>★{n}</option>
                              ))}
                            </select>
                            <InvBtn
                              tone="sky"
                              onClick={() => EventBus.emit("rpg:autoUpgrade", { slot: eqSlot, target: autoTargetMap.current[eqSlot] ?? Math.min(UPGRADE_MAX, up + 3) })}
                            >
                              자동 강화 ▶
                            </InvBtn>
                            <InvBtn tone="gray" onClick={() => EventBus.emit("rpg:autoUpgradeStop")}>정지</InvBtn>
                          </span>
                        )}
                        {equipped && eqMaxed && (
                          <span className="rounded-md bg-amber-400/15 px-2.5 py-1.5 text-[10px] font-black text-amber-200">★{UPGRADE_MAX} 완료</span>
                        )}
                        {/* v1.0.2 (#등급업큐브) — 등급업 큐브 사용 버튼 신설 (기존 로직은 있었으나 진입 UI 부재로 죽은 기능이었다) */}
                        {equipped && it.tier !== "legend" && (rpg.tierCube ?? 0) > 0 && (
                          <InvBtn tone="violet" onClick={() => EventBus.emit("rpg:isekai", { action: "tierUp", slot: eqSlot })}>
                            등급업 ×{(rpg.tierCube ?? 0)}
                          </InvBtn>
                        )}
                        {equipped && it.tier !== "legend" && (rpg.tierCube ?? 0) <= 0 && (
                          <span className="rounded-md bg-violet-400/10 px-2.5 py-1.5 text-[10px] font-bold text-violet-200/60">등급업 큐브 없음</span>
                        )}
                        {!equipped && <span className="rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-white/40">장착 후 가방에서 강화</span>}
                        {eqFlash && (
                          <span className={`text-[11px] font-black ${eqFlash === "ok" ? "text-amber-300" : "text-rose-300"}`}>
                            {eqFlash === "ok" ? "강화 성공!" : "강화 실패…"}
                          </span>
                        )}
                        <InvBtn tone="gray" disabled={eertN <= 0} onClick={() => EventBus.emit("rpg:eert", { key: it.key })}>
                          eert {eertN > 0 ? `×${eertN}` : ""}
                        </InvBtn>
                        {sellValue(it) > 0 && <SellQtyBox compact count={s.count} unitValue={sellValue(it)} ev="rpg:sell" keyName={s.k} />}
                          <span
                            className="rounded-md bg-white/[0.06] px-1.5 py-1.5 text-[9px] font-bold text-amber-200/80"
                            title={`잠재 확률 — ${eertOdds().map((o) => `${o.name} ${o.pct}%`).join(" / ")} · 유니크 미달 연속 ${POT_PITY_MAX - 1}회 시 유니크+ 확정 (현재 ${rpg.potPity ?? 0}회)`}
                          >
                            {POT_GRADE_META[0].name} {eertOdds()[0].pct}% · {POT_GRADE_META[1].name} {eertOdds()[1].pct}% · {POT_GRADE_META[2].name} {eertOdds()[2].pct}% · {POT_GRADE_META[3].name} {eertOdds()[3].pct}%{` · 확정까지 ${Math.max(0, POT_PITY_MAX - 1 - (rpg.potPity ?? 0))}`}
                          </span>
                      </div>
                    </>
                  );
                }
                if (it.kind === "accessory") {
                  const wornN = rpg.accessories.filter((x) => x === s.k).length;
                  const ownedN = s.count;
                  const up = rpg.accUp?.[s.k] ?? 0;
                  const accBonus = starAccBonus(up, it);
                  const accCost = upgradeCost("weapon", up);
                  const accRate = UPGRADE_RATES[up] ?? 0;
                  const accMaxed = up >= UPGRADE_MAX;
                  return (
                    <>
                      <div className="flex items-start gap-2.5">
                        <ItemIcon icon={s.icon} size={40} tier={it.tier} potGrade={s.potGrade} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13px] font-black text-white">
                            {displayName(it.name, up)} {tierChip}
                            {wornN > 0 && <span className="text-[10px] font-bold text-white/45">장착 {wornN}/{ownedN}</span>}
                          </p>
                          <p className="truncate text-[11px] font-bold text-emerald-300/90">
                            {itemEffect(it)}
                            {accBonus.crit > 0 && <span className="ml-1 text-[#d29dff]">+치명 {accBonus.crit}%</span>}
                            {accBonus.hp > 0 && <span className="ml-1 text-[#6ff2d8]">+HP {accBonus.hp}</span>}
                          </p>
                          <PotViewLines pot={rpg.potentials?.[s.k]} />
                          {up > 0 && (
                            <div className="mt-0.5 flex items-center gap-[2px] text-[9px] leading-none">
                              {Array.from({ length: UPGRADE_MAX }, (_, i) => (
                                <span key={i} style={{ color: i < up ? STAR_TIER_CSS[starTier(up)] : "#4a4136" }}>★</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {/* v1.0.3 (#반지중첩) — 같은 장신구 중복 장착 금지: 보유 2개여도 효과는 1벌만 적용.
                         *  기존엔 보유 수만큼 슬롯에 중복 장착돼 스탯이 2배로 쌓이는 버그 (고대왕의 반지 2개 중첩). */}
                        {wornN < 1 ? (
                          <InvBtn onClick={() => EventBus.emit("rpg:equip", { key: it.key })}>장착</InvBtn>
                        ) : (
                          <span className="rounded-md bg-emerald-700/50 px-2.5 py-1.5 text-[11px] font-black text-emerald-200">장착 중</span>
                        )}
                        {wornN >= 1 && ownedN > wornN && (
                          <span className="rounded-md bg-white/[0.06] px-2 py-1.5 text-[10px] font-bold text-white/40">중복 장착 불가 (같은 반지 1개만)</span>
                        )}
                        {!accMaxed && (
                          <InvBtn tone="amber" disabled={rpg.gold < accCost} onClick={() => EventBus.emit("rpg:upgradeAcc", { key: it.key })}>
                            강화 {accCost}G · {accRate}%
                          </InvBtn>
                        )}
                        <InvBtn tone="gray" disabled={eertN <= 0} onClick={() => EventBus.emit("rpg:eert", { key: it.key })}>
                          eert {eertN > 0 ? `×${eertN}` : ""}
                        </InvBtn>
                          <span
                            className="rounded-md bg-white/[0.06] px-1.5 py-1.5 text-[9px] font-bold text-amber-200/80"
                            title={`잠재 확률 — ${eertOdds().map((o) => `${o.name} ${o.pct}%`).join(" / ")} · 유니크 미달 연속 ${POT_PITY_MAX - 1}회 시 유니크+ 확정 (현재 ${rpg.potPity ?? 0}회)`}
                          >
                            {POT_GRADE_META[0].name} {eertOdds()[0].pct}% · {POT_GRADE_META[1].name} {eertOdds()[1].pct}% · {POT_GRADE_META[2].name} {eertOdds()[2].pct}% · {POT_GRADE_META[3].name} {eertOdds()[3].pct}%{` · 확정까지 ${Math.max(0, POT_PITY_MAX - 1 - (rpg.potPity ?? 0))}`}
                          </span>
                        {tradeValue(it.key) > 0 ? (
                          <InvBtn tone="sky" onClick={() => EventBus.emit("ui:panel", { panel: "trade" })}>
                            거래소 +{tradeValue(it.key)}
                          </InvBtn>
                        ) : (
                          sellValue(it) > 0 && <SellQtyBox compact count={ownedN} unitValue={sellValue(it)} ev="rpg:sell" keyName={s.k} />
                        )}
                      </div>
                    </>
                  );
                }
                /* consumable */
                const starScroll = s.k === "scroll_star";
                const usable = isBasicPot || it.healFull || it.heal || it.restore || s.k === "scroll_return" || s.k === "scroll_warp" || starScroll || s.k === "exp_book";
                const useLabel = starScroll ? "충전" : it.healFull || it.heal || it.restore ? "마시기" : "사용";
                const chestLike = s.k.startsWith("chest_") || s.k.startsWith("pack_");
                const eertCubeIt = s.k === "eert_cube";
                return (
                  <>
                    <div className="flex items-start gap-2.5">
                      <ItemIcon icon={s.icon} size={40} tier={it.tier} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-black text-white">
                          {it.name} {tierChip}
                          {s.quick && <span className="rounded bg-sky-500/25 px-1 py-px text-[9px] font-black text-sky-200">{s.quick} 버튼</span>}
                        </p>
                        <p className="truncate text-[11px] font-bold text-emerald-300/90">
                          {s.k === "eert_cube"
                            ? "장비 탭에서 [eert] 버튼으로 잠재옵션 재추첨"
                            : starScroll
                              ? `다음 강화 성공률 +${STAR_BLESS_RATE}%p (충전 최대 ${STAR_BLESS_MAX}장)`
                              : itemEffect(it) || "소모품"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {usable && (
                        <InvBtn
                          tone={starScroll ? "violet" : "sky"}
                          disabled={s.count <= 0}
                          onClick={() =>
                            isBasicPot
                              ? EventBus.emit("rpg:use", { kind: s.k === "potion_hp" ? "hp" : "mp" })
                              : starScroll
                                ? EventBus.emit("rpg:starScroll")
                                : EventBus.emit("rpg:useItem", { key: s.k })
                          }
                        >
                          {useLabel}
                        </InvBtn>
                      )}
                      {isPot && (
                        <>
                          <InvBtn tone={qp.hp === s.k ? "amber" : "gray"} onClick={() => EventBus.emit("rpg:quickpot", { slot: "hp", key: s.k })} title="HP 물약 퀵슬롯에 장착">
                            HP
                          </InvBtn>
                          <InvBtn tone={qp.mp === s.k ? "amber" : "gray"} onClick={() => EventBus.emit("rpg:quickpot", { slot: "mp", key: s.k })} title="MP 물약 퀵슬롯에 장착">
                            MP
                          </InvBtn>
                        </>
                      )}
                      {/* v4.6.0 — 상자/패키지를 가방에서 직접 개봉 (구매 개봉과 동일 가중치 롤) */}
                      {chestLike && (
                        <InvBtn tone="violet" disabled={s.count <= 0} onClick={() => EventBus.emit("rpg:openChest", { key: s.k })}>
                          열기 {s.count > 1 ? `(보유 ${s.count})` : ""}
                        </InvBtn>
                      )}
                      {eertCubeIt && <span className="rounded-md bg-orange-500/15 px-2.5 py-1.5 text-[10px] font-black text-orange-200">장비 탭에서 사용</span>}
                      {sellValue(it) > 0 && (
                        <SellQtyBox
                          compact
                          count={isBasicPot ? (s.k === "potion_hp" ? rpg.hpPot : rpg.mpPot) : s.count}
                          unitValue={sellValue(it)}
                          ev={isBasicPot ? "rpg:sellPotion" : "rpg:sell"}
                          keyName={s.k}
                        />
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="py-4 text-center text-[11px] font-bold text-white/35">아이템을 선택하면 정보와 버튼이 여기에 나타납니다</p>
            )}
          </div>
        )}

        {/* 하단 바 — 재화 + [정리] (컨셉 이미지의 APPROVE 위치) */}
        <div className="flex shrink-0 items-center justify-between border-t-2 border-[#211c17] bg-gradient-to-b from-[#3b352d] to-[#332d26] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <GoldChip gold={rpg.gold} />
            <EmeraldChip emerald={rpg.emerald} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-white/30">ESC 닫기</span>
            <button
              onClick={() => EventBus.emit("rpg:sortInv")}
              className="rounded-md border-2 border-amber-200/70 bg-gradient-to-b from-amber-300 to-orange-500 px-3.5 py-1.5 text-[12px] font-black text-white shadow-[0_2px_0_#92400e] hover:brightness-110 active:translate-y-[2px] active:shadow-none"
            >
              정리
            </button>
          </div>
        </div>
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
          {/* v1.0.2 (#GM아이템) — GM 전용 장비 지급 (일반 유저 획득 경로 전무) */}
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "gmitems" })}
            className="rounded-lg border border-rose-300/40 bg-rose-400/10 px-2 py-2 text-[11px] font-black text-rose-200 hover:bg-rose-400/20 active:scale-95"
          >
            [GM] 장비 지급
          </button>
        </div>

        {/* v3.3.0 (지시 #3/#6) — 5차 전직(임시) + 무릉도장 입장 */}
        <p className="mb-1 mt-3 text-[11px] font-bold text-white/50">5차 전직 (임시) · 훈련장</p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "fifth", value: 1 })}
            className="rounded-lg border border-yellow-300/50 bg-gradient-to-br from-yellow-400/20 to-amber-500/10 px-2 py-2 text-[11px] font-black text-yellow-200 hover:from-yellow-400/30 active:scale-95"
          >
            ⭐ 5차 전직 부여
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "fifth", value: 0 })}
            className="rounded-lg border border-white/25 bg-white/5 px-2 py-2 text-[11px] font-black text-white/70 hover:bg-white/10 active:scale-95"
          >
            5차 각성 해제
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "dojang" })}
            className="rounded-lg border border-orange-300/45 bg-orange-400/10 px-2 py-2 text-[11px] font-black text-orange-200 hover:bg-orange-400/20 active:scale-95"
          >
            🥋 무릉도장 입장
          </button>
        </div>
        <p className="mt-1.5 rounded-lg border border-yellow-300/20 bg-yellow-400/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-yellow-200/70">
          5차 전직 부여 시 전 스킬 ·극 강화 + 세부 직업 고유 궁극기(S) 즉시 해금. 무릉도장은 90초 동안 허수아비에게 누적 피해를 기록하는 훈련장입니다 (최고 기록 저장).
        </p>

        {/* v4.0.0 — 바르가 콘텐츠 입구 */}
        <p className="mb-1 mt-3 text-[11px] font-bold text-white/50">바르가 콘텐츠 (v4.0.0)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "gate" })}
            className="rounded-lg border border-violet-300/50 bg-gradient-to-br from-violet-400/20 to-fuchsia-500/10 px-2 py-2 text-[11px] font-black text-violet-100 hover:from-violet-400/30 active:scale-95"
          >
            🚪 바르가 수비전 입장
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "closet" })}
            className="rounded-lg border border-lime-300/50 bg-gradient-to-br from-lime-400/20 to-emerald-500/10 px-2 py-2 text-[11px] font-black text-lime-100 hover:from-lime-400/30 active:scale-95"
          >
            👕 균열 던전 입장
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "freegacha" })}
            className="rounded-lg border border-purple-300/50 bg-purple-400/10 px-2 py-2 text-[11px] font-black text-purple-100 hover:bg-purple-400/20 active:scale-95"
          >
            🎁 GM 무료 뽑기
          </button>
          <button
            onClick={() => EventBus.emit("rpg:gm", { type: "tickets" })}
            className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-2 py-2 text-[11px] font-black text-sky-200 hover:bg-sky-400/20 active:scale-95"
          >
            🎟 티켓 전량 충전
          </button>
        </div>
        <p className="mt-1.5 rounded-lg border border-violet-300/20 bg-violet-400/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-violet-200/70">
          바르가 수비전 = 웨이브 디펜스 (매일 3회) · 균열 던전 = 60초 파밍 (매일 2회). GM 무료 뽑기는 10분마다 1회. 혜택 패널에서 출석부·일일 퀘스트·쿠폰을 확인하세요.
        </p>

        {/* v4.6.0 — 전 보스 체험: 9챕터 보스를 스토리 스펙 그대로 즉시 체험 */}
        <p className="mb-1 mt-3 text-[11px] font-bold text-white/50">전 보스 체험 (v4.6.0)</p>
        <div className="mb-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {(Object.keys(BOSS_DEFS) as BossKey[]).map((bk) => {
            const d = BOSS_DEFS[bk];
            return (
              <button
                key={bk}
                onClick={() => EventBus.emit("rpg:gm", { type: "boss", value: bk })}
                className="flex flex-col items-start rounded-lg border border-rose-300/35 bg-gradient-to-br from-rose-400/15 to-slate-900/40 px-2 py-1.5 text-left transition-transform active:scale-95 hover:border-rose-300/60"
              >
                <span className="w-full truncate text-[10px] font-black text-rose-100">⚔ {d.name}</span>
                <span className="text-[9px] font-bold text-white/40">HP {d.hp.toLocaleString()} · ATK {d.atk}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 rounded-lg border border-rose-300/20 bg-rose-400/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-rose-200/70">
          보스 구역으로 이동해 스토리 스펙 그대로 즉시 전투합니다. 처치 시 보상 지급 — 스토리 진행/포탈 판정에는 영향이 없습니다.
        </p>
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
          {mobKeys.map((k) => card(k, ENEMIES[k].name, `/assets/${k}_idle0.webp`))}
        </div>

        {/* 보스 도감 */}
        <p className="mb-1 text-[11px] font-bold text-white/50">보스 몬스터 ({bossKeys.filter((k) => (kills[`boss_${k}`] ?? 0) > 0).length}/{bossKeys.length})</p>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {bossKeys.map((k) => card(`boss_${k}`, BOSS_DEFS[k].name, `/assets/${BOSS_DEFS[k].tex}_idle0.webp`))}
        </div>

        <p className="mt-2 text-center text-[10px] text-white/40">M키로 열기 · 등록 보너스는 모든 구역에서 항상 적용됩니다 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ================= v4.5.0 — 시즌 패스 패널 (배틀패스 — BM 문서 표준) =================
 *  "배틀패스의 핵심 가치는 수익보다 리텐션" — 무료/프리미엄 듀얼 트랙 30레벨,
 *  가로 스크롤 트랙 + 수령 가능 보상 앰버 발광 (도파민: 시각적 진행+미수령 가시화). */

/** BmGrant → 트랙 셀 아이콘 (아이템/버프는 실제 아이콘, 재화는 전용 이미지) */
function grantIcon(g: BmGrant, size = 22) {
  if (g.item && ITEMS[g.item]) return <ItemIcon icon={ITEMS[g.item].icon} tier={ITEMS[g.item].tier} size={size} />;
  if (g.buff && ITEMS[g.buff]) return <ItemIcon icon={ITEMS[g.buff].icon} tier={ITEMS[g.buff].tier} size={size} />;
  if (g.emerald) return <img src="/assets/item_pendant_arcane.webp" alt="" style={{ width: size, height: size, imageRendering: "pixelated" }} />;
  if (g.gold) return <img src="/assets/item_coin.webp" alt="" style={{ width: size, height: size, imageRendering: "pixelated" }} />;
  if (g.ticket) return <span className="text-[15px] leading-none">🎟</span>;
  if (g.shard) return <span className="text-[15px] leading-none text-cyan-200">◈</span>;
  return <span className="text-[13px]">?</span>;
}

type PassCellState = "claimed" | "claimable" | "locked" | "needprem";

function PassCell({ g, state, onClick, goldRow }: { g: BmGrant; state: PassCellState; onClick: () => void; goldRow?: boolean }) {
  const base = "relative flex h-11 w-11 flex-col items-center justify-center rounded-lg border-2 transition-colors";
  const style = state === "claimed"
    ? "border-emerald-400/60 bg-emerald-400/15"
    : state === "claimable"
      ? goldRow
        ? "border-amber-300 bg-amber-400/25 shadow-[0_0_10px_rgba(252,211,77,0.5)] animate-pulse"
        : "border-amber-300/80 bg-amber-400/15 shadow-[0_0_8px_rgba(252,211,77,0.35)]"
      : state === "needprem"
        ? "border-amber-300/25 bg-amber-400/[0.04]"
        : "border-white/10 bg-white/[0.03] opacity-45";
  return (
    <button
      onClick={onClick}
      disabled={state !== "claimable"}
      title={g.label}
      className={`${base} ${style} ${state === "claimable" ? "active:scale-90" : "cursor-default"}`}
    >
      {grantIcon(g)}
      {state === "claimed" && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-emerald-900/45 text-[15px] font-black text-emerald-200">✓</span>}
      {state === "needprem" && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 text-[13px]">🔒</span>}
    </button>
  );
}

export function PassPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const p = rpg.pass;
  if (!p) {
    return (
      <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50" onPointerDown={onClose}>
        <div className="rounded-xl border-2 border-amber-300/60 sertz-panel bg-slate-950/95 p-4 text-center text-[12px] text-white/70" onPointerDown={(e) => e.stopPropagation()}>
          월드 진입 후 이용할 수 있다
          <button onClick={onClose} className="mt-2 block w-full rounded-lg bg-amber-400 px-3 py-1.5 text-[12px] font-black text-slate-900">닫기</button>
        </div>
      </div>
    );
  }
  const lvNow = p.lv;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div className="max-h-[min(88svh,660px)] w-[min(94vw,520px)] overflow-y-auto rounded-xl border-2 border-amber-300/60 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-amber-200">🎫 시즌 패스 — {p.season}</p>
            <p className="text-[10px] text-white/50">남은 {p.daysLeft}일 · 매월 1일 새 시즌 개시</p>
          </div>
          <div className="flex items-center gap-2">
            <EmeraldChip emerald={rpg.emerald} />
            <button onClick={onClose} aria-label="시즌 패스 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">✕</button>
          </div>
        </div>

        {/* 진행 카드 */}
        <div className="mb-2 rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-2.5 py-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-black text-amber-100">현재 Lv.{lvNow}<span className="ml-1 text-[10px] font-normal text-white/45">/{PASS_MAX_LV}</span></p>
            <p className="text-[10px] text-white/50">{lvNow >= PASS_MAX_LV ? "시즌 만렙!" : `다음 레벨까지 ${PASS_LV_XP - p.lvXp} XP`}</p>
          </div>
          {/* v1.0.2 (#패스일괄수령) — 도달 레벨의 미수령 보상 전부 지급 (프리미엄은 해금 시에만) */}
          {(() => {
            const claimableN = PASS_TRACKS.reduce((n, tr, i) => {
              const lv = i + 1;
              if (lv > lvNow) return n;
              if (tr.free && !p.claimedF.includes(lv)) n++;
              if (p.prem && tr.prem && !p.claimedP.includes(lv)) n++;
              return n;
            }, 0);
            if (claimableN <= 0) return null;
            return (
              <button
                onClick={() => EventBus.emit("rpg:passClaimAll")}
                className="mt-1.5 w-full rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2 py-1.5 text-[11px] font-black text-slate-900 shadow-[0_2px_0_#92400e] active:translate-y-[2px] active:shadow-none"
              >
                한번에 받기 ({claimableN}건)
              </button>
            );
          })()}
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/50">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 transition-[width]" style={{ width: `${Math.min(100, (p.lvXp / PASS_LV_XP) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[9px] text-white/40">XP 획득: 토벌 +1 · 보스 +30 · 일일 퀘스트 수령 +40 · 게이트 웨이브×2 · 시즌 미션 수령</p>
        </div>

        {/* v1.0.1 — 시즌 미션 (일일/주간 리텐션 보드 — 수령 시 패스 XP) */}
        {p.missions && (
          <div className="mb-2 rounded-lg border border-sky-300/25 bg-sky-400/[0.06] px-2.5 py-2">
            <p className="mb-1 text-[11px] font-black text-sky-200">🎯 시즌 미션 — 완료하면 패스 XP 지급</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {[
                ...SEASON_DAILY_MISSIONS.map((m) => ({ m, prog: p.missions!.d[m.id] ?? 0, claimed: p.missions!.cd.includes(m.id), tag: "일일" })),
                ...SEASON_WEEKLY_MISSIONS.map((m) => ({ m, prog: p.missions!.w[m.id] ?? 0, claimed: p.missions!.cw.includes(m.id), tag: "주간" })),
              ].map(({ m, prog, claimed, tag }) => {
                const reach = prog >= m.target;
                return (
                  <div key={m.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${claimed ? "border-emerald-300/40 bg-emerald-400/[0.07]" : reach ? "border-amber-300/50 bg-amber-400/[0.09]" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-white">
                        <span className={`mr-1 rounded px-1 py-px text-[8px] ${tag === "일일" ? "bg-sky-500/40 text-sky-100" : "bg-violet-500/40 text-violet-100"}`}>{tag}</span>
                        {m.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${reach ? "bg-amber-400" : "bg-sky-400/70"}`} style={{ width: `${Math.min(100, (prog / m.target) * 100)}%` }} />
                        </div>
                        <span className="text-[8px] font-bold text-white/45">{Math.min(prog, m.target)}/{m.target} · +{m.xp}XP</span>
                      </div>
                    </div>
                    <button
                      disabled={claimed || !reach}
                      onClick={() => EventBus.emit("rpg:missionClaim", { kind: tag === "일일" ? "daily" : "weekly", id: m.id })}
                      className={`shrink-0 rounded-md px-1.5 py-1 text-[9px] font-black active:scale-95 ${claimed ? "text-emerald-200" : reach ? "bg-amber-400 text-slate-900 hover:bg-amber-300" : "cursor-not-allowed bg-white/[0.06] text-white/30"}`}
                    >
                      {claimed ? "수령 완료" : "수령"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[9px] text-white/35">일일 미션은 매일 00시 · 주간 미션은 월요일 00시 초기화</p>
          </div>
        )}

        {/* 프리미엄 박스 */}
        {p.prem ? (
          <div className="mb-2 rounded-lg border border-amber-300/50 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-black text-amber-200">✦ 프리미엄 트랙 해금 중 — 아래 금색 줄 보상을 수령하세요</div>
        ) : (
          <div className="mb-2 rounded-lg border-2 border-amber-300/60 bg-amber-400/10 px-2.5 py-2">
            <p className="text-[12px] font-black text-amber-200">프리미엄 트랙 해금 — {PASS_PREMIUM_PRICE}💎</p>
            <p className="mt-0.5 text-[10px] text-white/55">에메랄드·시즌 한정 펫·치장·전설 상자 트랙 + 구매 즉시 도달분 소급 수령</p>
            <button onClick={() => EventBus.emit("rpg:passBuy")} className="mt-1.5 w-full rounded-lg bg-amber-400 px-3 py-1.5 text-[12px] font-black text-slate-900 hover:bg-amber-300 active:scale-95">프리미엄 해금하기</button>
          </div>
        )}

        {/* 트랙 — 30레벨 × 무료/프리미엄 2줄 (가로 스크롤) */}
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-2">
          <div className="flex min-w-max gap-1.5">
            {PASS_TRACKS.map((t, i) => {
              const lv = i + 1;
              const reached = lv <= lvNow;
              return (
                <div key={lv} className="flex w-12 shrink-0 flex-col items-center gap-1">
                  <span className={`text-[9px] font-black ${reached ? "text-amber-200" : "text-white/35"}`}>{lv}</span>
                  {t.free && (
                    <PassCell
                      g={t.free}
                      state={p.claimedF.includes(lv) ? "claimed" : reached ? "claimable" : "locked"}
                      onClick={() => EventBus.emit("rpg:passClaim", { lv, track: "free" })}
                    />
                  )}
                  {t.prem && (
                    <PassCell
                      g={t.prem}
                      goldRow
                      state={p.claimedP.includes(lv) ? "claimed" : reached && p.prem ? "claimable" : reached ? "needprem" : "locked"}
                      onClick={() => EventBus.emit("rpg:passClaim", { lv, track: "prem" })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-white/40">
          <span>위: 무료 트랙 · 아래: 프리미엄 트랙 (금색)</span>
          <span>탭하면 즉시 수령</span>
        </div>
        <p className="mt-2 text-center text-[10px] text-white/40">시즌 종료 시 미수령 보상은 소멸된다 — 매월 1일 리셋 · ESC로 닫기</p>
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
  if (panel === "boss") return <BossReplayPanel rpg={rpg} onClose={onClose} />; // v3.0.25 — 보스 재도전 전용 창 (퀘스트창과 분리)
  if (panel === "isekai") return <IsekaiPanel rpg={rpg} onClose={onClose} />; // v4.0.0 — 바르가 원정대 (피규어/배지/룬/성좌/업적/랭킹)
  if (panel === "benefit") return <BenefitPanel rpg={rpg} onClose={onClose} />; // v4.0.0 — 혜택 (출석부/일일 퀘스트/쿠폰)
  if (panel === "pass") return <PassPanel rpg={rpg} onClose={onClose} />; // v4.5.0 — 시즌 패스 (배틀패스)
  if (panel === "content") return <ContentPanel rpg={rpg} onClose={onClose} />; // v1.0.8 — 무한 콘텐츠 허브
  if (panel === "opt") return <KeymapPanel onClose={onClose} />;
  return null;
}

/* =====================================================================
 * v1.0.8 — 무한 콘텐츠 허브 (5탭)
 *  ① 심연의 탑 (무한 층수) · ② 심층 균열 (무한 티어) · ③ 일일 시련 (수정자 던전)
 *  ④ 연금 제작대 · ⑤ 심연 상점 · ⑥ 환생 + 펫 육성 — 총 10종 신규 무한 콘텐츠의 진입 허브
 * ===================================================================== */
type ContentTab = "tower" | "trial" | "craft" | "abyss" | "rebirth";

export function ContentPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const inf = rpg.inf;
  const [tab, setTab] = useState<ContentTab>("tower");
  const [tierPick, setTierPick] = useState(0);
  if (!inf) {
    return (
      <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50" onPointerDown={onClose}>
        <div className="rounded-xl border-2 border-purple-300/50 sertz-panel bg-slate-950/95 p-4 text-[12px] font-bold text-white/70">게임 시작 후 이용할 수 있어요</div>
      </div>
    );
  }
  const trial = todayTrial();
  const trialCleared = inf.trialDone === (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const TABS: { id: ContentTab; label: string; on: string }[] = [
    { id: "tower", label: "심연의 탑", on: "bg-purple-400 text-slate-900" },
    { id: "trial", label: "시련·균열", on: "bg-rose-400 text-slate-900" },
    { id: "craft", label: "제작대", on: "bg-sky-400 text-slate-900" },
    { id: "abyss", label: "심연 상점", on: "bg-violet-400 text-slate-900" },
    { id: "rebirth", label: "환생·펫", on: "bg-amber-400 text-slate-900" },
  ];
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div className="sertz-scroll max-h-[min(88svh,640px)] w-[min(94vw,470px)] overflow-y-auto rounded-xl border-2 border-purple-300/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black text-purple-200">콘텐츠 허브 — 무한 도전</p>
          <button onClick={onClose} aria-label="콘텐츠 패널 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">✕</button>
        </div>

        {/* 탭 행 */}
        <div className="mb-2.5 grid grid-cols-5 gap-1">
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`rounded-lg px-1 py-1.5 text-[10px] font-black transition-transform active:scale-95 ${tab === tb.id ? tb.on : "border border-white/10 bg-white/[0.04] text-white/55"}`}>{tb.label}</button>
          ))}
        </div>

        {tab === "tower" && (
          <div>
            <div className="mb-2 rounded-lg border border-purple-300/40 bg-purple-400/10 px-2.5 py-2">
              <p className="text-[11px] font-black text-purple-100">심연의 탑 — 무한 층수 등반</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-white/60">층을 오를수록 적이 강해지고 보상도 커진다. 5층마다 보스가 막고, 10층마다 에메랄드 +3. 층 클리어마다 심연 코인 획득!</p>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1.5 text-center">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2">
                <p className="text-[9px] font-bold text-white/45">최고 기록</p>
                <p className="text-base font-black text-purple-200">{inf.towerBest}층</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2">
                <p className="text-[9px] font-bold text-white/45">보유 심연 코인</p>
                <p className="text-base font-black text-violet-200">{inf.abyss.toLocaleString()}</p>
              </div>
            </div>
            <button onClick={() => EventBus.emit("rpg:infTower")} className="w-full rounded-xl border-2 border-purple-200/70 bg-gradient-to-b from-purple-400 to-purple-600 px-4 py-2.5 text-[13px] font-black text-slate-900 shadow-lg transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95">탑 입장 (무료 · 언제든)</button>
            <p className="mt-1.5 text-[9px] text-white/35">복귀 포탈로 중간 퇴장 가능 · 기록은 자동 저장되고 랭킹에 등록된다 (원정대 → 랭킹 탭)</p>
          </div>
        )}

        {tab === "trial" && (
          <div>
            {/* 일일 시련 */}
            <div className="mb-1.5 rounded-lg border px-2.5 py-2" style={{ borderColor: `${trial.color}66`, background: `${trial.color}14` }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black" style={{ color: trial.color }}>오늘의 시련 — {trial.name}</p>
                {trialCleared && <span className="rounded bg-emerald-400/25 px-1.5 py-0.5 text-[8px] font-black text-emerald-100">보상 수령 완료</span>}
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-white/65">{trial.desc}</p>
              <p className="mt-1 text-[9px] text-white/40">60초 생존 — 1일 1회 심연 코인 보상 (재도전 무료, 보상은 내일)</p>
            </div>
            <button onClick={() => EventBus.emit("rpg:infTrial")} className="mb-3 w-full rounded-xl border-2 px-4 py-2 text-[12px] font-black text-slate-900 transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95" style={{ borderColor: `${trial.color}aa`, background: trial.color }}>일일 시련 입장</button>

            {/* 심층 균열 — 무한 티어 */}
            <div className="mb-1.5 rounded-lg border border-violet-300/40 bg-violet-400/10 px-2.5 py-2">
              <p className="text-[11px] font-black text-violet-100">심층 균열 — 무한 티어</p>
              <p className="mt-0.5 text-[10px] text-white/60">티어가 오를수록 적이 강해지고 골드도 무한히 증가한다. 클리어 시 다음 티어 해금! (균열 티켓 소모)</p>
            </div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              {Array.from({ length: Math.min(10, Math.max(1, inf.closetTier)) }).map((_, i) => (
                <button key={i} onClick={() => setTierPick(i)} className={`h-8 w-10 rounded-md border text-[10px] font-black ${tierPick === i ? "border-violet-300 bg-violet-400/30 text-violet-100" : "border-white/10 bg-white/[0.04] text-white/55"}`}>T{i + 1}</button>
              ))}
              {inf.closetTier >= 10 && <span className="text-[9px] font-bold text-violet-300">T{inf.closetTier}+ 해금!</span>}
            </div>
            <button onClick={() => EventBus.emit("rpg:infClosetTier", { tier: tierPick + 1 })} className="w-full rounded-xl border-2 border-violet-200/70 bg-gradient-to-b from-violet-400 to-violet-600 px-4 py-2.5 text-[13px] font-black text-slate-900 transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95">심층 균열 T{tierPick + 1} 입장 (티켓 1장)</button>
            <p className="mt-1.5 text-[9px] text-white/35">현재 해금: T{inf.closetTier}까지 · 기본 균열에서 2,600G 이상 획득 시 T1 해금</p>
          </div>
        )}

        {tab === "craft" && (
          <div>
            {/* 재료 보유 */}
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {MAT_CHANCES.map((m) => (
                <div key={m.key} className="rounded-lg border border-sky-300/25 bg-sky-400/[0.07] px-2 py-1.5 text-center">
                  <p className="text-[9px] font-bold text-white/55">{m.name}</p>
                  <p className="text-sm font-black text-sky-200">{inf.mats[m.key] ?? 0}</p>
                </div>
              ))}
            </div>
            <p className="mb-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[9px] leading-relaxed text-white/50">몬스터를 잡으면 확률로 재료가 드롭된다 (탑·균열에서는 1.6배). 제작한 아이템은 인벤토리에 지급된다.</p>
            <div className="flex flex-col gap-1.5">
              {CRAFT_RECIPES.map((r) => {
                const ok = canCraft(r, inf.mats);
                return (
                  <div key={r.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${ok ? "border-sky-300/40 bg-sky-400/10" : "border-white/10 bg-white/[0.02]"}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-black ${ok ? "text-sky-100" : "text-white/55"}`}>{r.name}</p>
                      <p className="truncate text-[9px] text-white/45">{r.desc}</p>
                    </div>
                    <button onClick={() => EventBus.emit("rpg:infCraft", { id: r.id })} disabled={!ok} className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-black transition-transform active:scale-95 ${ok ? "bg-sky-400 text-slate-900" : "bg-white/10 text-white/35"}`}>제작</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "abyss" && (
          <div>
            <div className="mb-2 flex items-center justify-between rounded-lg border border-violet-300/40 bg-violet-400/10 px-2.5 py-2">
              <p className="text-[11px] font-black text-violet-100">심연 상점</p>
              <p className="text-[11px] font-black text-violet-200">심연 코인 {inf.abyss.toLocaleString()}</p>
            </div>
            <p className="mb-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[9px] leading-relaxed text-white/50">심연 코인은 탑·일일 시련·황금 몬스터·주간 레이드 보스에서 획득. 부여아는 구매할 때마다 영구으로 쌓인다 (제한 없음).</p>
            <div className="flex flex-col gap-1.5">
              {ABYSS_SHOP.map((it) => {
                const cnt = it.id === "rebirth_ess" ? inf.rebirthEss : inf.orbs[it.id] ?? 0;
                return (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-violet-100">{it.name}{cnt > 0 && <span className="ml-1 rounded bg-violet-400/25 px-1 text-[8px] text-violet-100">×{cnt}</span>}</p>
                      <p className="truncate text-[9px] text-white/45">{it.desc}</p>
                    </div>
                    <button onClick={() => EventBus.emit("rpg:infAbyss", { id: it.id })} disabled={inf.abyss < it.cost} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-transform active:scale-95 ${inf.abyss >= it.cost ? "bg-violet-400 text-slate-900" : "bg-white/10 text-white/35"}`}>{it.cost} 코인</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "rebirth" && (
          <div>
            {/* 환생 */}
            <div className="mb-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-amber-100">환생 — 무한 성장 루프</p>
                <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[8px] font-black text-amber-100">{inf.rebirths}회 달성</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-white/60">Lv {rebirthReqLv(inf.rebirthEss)} 달성 시 환생 가능. 레벨/AP는 초기화되지만 영구 보너스가 쌓인다: 스택당 공격 +8% · HP +60 · 골드 +2% + 심연 코인 {REBIRTH_ABYSS}</p>
              {inf.rebirths > 0 && (
                <p className="mt-1 text-[10px] font-black text-amber-200">현재 영구 보너스: 공격 +{rebirthBonus(inf.rebirths).atkPct}% · HP +{rebirthBonus(inf.rebirths).hp} · 골드 +{rebirthBonus(inf.rebirths).goldPct}%</p>
              )}
              {inf.rebirthEss > 0 && <p className="mt-0.5 text-[9px] text-white/45">환생의 정수 ×{inf.rebirthEss} — 요구 레벨 −5씩 감소 (현재 Lv {rebirthReqLv(inf.rebirthEss)})</p>}
            </div>
            <button onClick={() => EventBus.emit("rpg:infRebirth")} className="mb-3 w-full rounded-xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2.5 text-[13px] font-black text-slate-900 shadow-lg transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95">환생하기 (요구 Lv {rebirthReqLv(inf.rebirthEss)})</button>

            {/* 펫 육성 */}
            <div className="mb-1.5 rounded-lg border border-sky-300/40 bg-sky-400/10 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-sky-100">펫 육성 — {PET_EVO_NAMES[petEvoStage(inf.petLv)]}{petEvoStage(inf.petLv) > 0 ? " (진화 완료)" : ""}</p>
                <span className="rounded bg-sky-400/25 px-1.5 py-0.5 text-[8px] font-black text-sky-100">Lv {inf.petLv}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/60">펫을 소환한 상태로 사냥하면 펫이 경험치를 얻는다. 레벨당 내 공격 +0.4% · HP +8 (진화하면 배율 증가, Lv10/20/30 진화)</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/50">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" style={{ width: `${Math.min(100, (inf.petExp / Math.max(1, inf.petExpNeed)) * 100)}%` }} />
              </div>
              <p className="mt-0.5 text-right text-[9px] text-white/40">EXP {inf.petExp}/{inf.petExpNeed} · 현재 보너스 공격 +{petBonus(inf.petLv).atkPct.toFixed(1)}% · HP +{petBonus(inf.petLv).hp}</p>
            </div>
            <p className="text-[9px] text-white/35">심연 상점의 치장 상자·전설 상자도 함께 노려보자 — 주간 레이드 보스(오늘: {rpg.raidBossToday ?? "—"}) 처치 시 보스 드롭 2배!</p>
          </div>
        )}
      </div>
    </div>
  )
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
              ? "계열을 선택하세요 — 선택 즉시 1차 전직 시련(스토리)이 시작되고, 완료 후 전직됩니다."
              : chain.length === 1
                ? "계열의 세부 직업을 고르세요 — 경로에 따라 3차가 갈립니다. (2차 시련 완료 후)"
                : "경로의 최종 클래스로 승격합니다. (3차 시련 완료 후)"}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {(chain.length === 0 ? CLASS_LIST : opts).map((d) => (
            <JobCard
              key={d.key}
              d={d}
              locked={locked}
              lockText={`Lv ${need} 필요`}
              btnText={chain.length >= 2 ? "승격" : chain.length === 0 ? "시련 시작" : "전직"}
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

        {/* v3.0.25 (#창분리) — 보스 재도전은 전용 창으로 분리 (메이플스토리처럼 퀘스트창·보스창 별개) */}
        {rpg && (
          <button
            onClick={() => EventBus.emit("ui:panel", { panel: "boss" })}
            className="mb-2.5 w-full rounded-lg border border-rose-300/35 bg-rose-400/[0.06] px-2.5 py-2 text-left transition-colors hover:bg-rose-400/[0.12] active:scale-[0.99]"
          >
            <p className="text-[12px] font-black text-rose-200">
              ⚔ 보스 재도전 — 재림 <span className="ml-1 text-[10px] font-bold text-white/45">전용 창 열기 ▸</span>
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-white/45">정복한 챕터의 보스가 다시 태어났다 — 스토리판보다 훨씬 강력하다</p>
          </button>
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
            {/* v3.0.26 (#76) — 스토리 미완료 시 이 섹션 자체가 emit되지 않음 (창에서 숨김) */}
            <p className="mb-1 text-[11px] font-black text-sky-200/90">반복 의뢰 (스토리 완료 후)</p>
            <div className={`rounded-lg border px-2.5 py-2 ${questLog.repeatActive ? "border-sky-300/25 bg-sky-500/[0.06]" : "border-dashed border-white/15 bg-transparent opacity-60"}`}>
              <p className="text-[12px] font-bold text-sky-100">{questLog.repeat.title}</p>
              <p className="mt-0.5 text-[10px] text-white/55">{questLog.repeat.desc}</p>
              {!questLog.repeatActive && (
                <p className="mt-1 text-[10px] font-bold text-amber-200/90">
                  {questLog.repeatUnlocked
                    ? "수주 완료 — 구역 체인을 모두 끝내면 [반복] 의뢰가 이 퀘스트창에서 진행됩니다"
                    : "🔒 미수주 — 마을 상인 라고스에게 말을 걸어 수주하자"}
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

/* ---------- v3.0.25 (#창분리) — 보스 재도전 전용 창 (퀘스트 로그에서 분리) ---------- */
/* ---------- v3.0.28 (#보스난이도) — 메이플식 난이도(이지/노말/하드/카오스) 선택 도입 ---------- */

/** 난이도 4버튼 — 재림판/스토리 보스 공용 스타일 */
function BossDiffChips({ value, onPick }: { value: BossDiffKey; onPick: (lv: BossDiffKey) => void }) {
  return (
    <div className="mb-2 grid grid-cols-4 gap-1">
      {BOSS_DIFF_ORDER.map((lv) => {
        const d = BOSS_DIFFS[lv];
        const on = value === lv;
        return (
          <button
            key={lv}
            onClick={() => onPick(lv)}
            aria-pressed={on}
            className={`rounded-md border px-1 py-1.5 text-center transition-colors active:scale-95 ${
              on ? "border-white/40 bg-white/[0.12]" : "border-white/15 bg-white/[0.03] hover:bg-white/[0.07]"
            }`}
          >
            <p className="text-[11px] font-black" style={{ color: d.color }}>
              {d.label}
            </p>
            <p className="text-[8.5px] font-bold leading-tight text-white/45">HP ×{d.hp}</p>
          </button>
        );
      })}
    </div>
  );
}

function BossReplayPanel({ rpg, onClose }: { rpg?: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  /* v3.0.28 — 난이도 선택 상태 (기본 노말) */
  const [diff, setDiff] = useState<BossDiffKey>("normal");
  const bossKills = rpg?.collection?.kills ?? {};
  const dif = BOSS_DIFFS[diff];
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onPointerDown={onClose}
    >
      <div
        className="max-h-[min(86svh,560px)] w-[min(92vw,430px)] overflow-y-auto rounded-xl border-2 border-rose-300/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-rose-200">⚔ 보스 재도전 — 재림</p>
            <p className="text-[10px] text-white/45">정복한 챕터의 보스가 다시 태어났다</p>
          </div>
          <button
            onClick={onClose}
            aria-label="보스 재도전 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70"
          >
            ✕
          </button>
        </div>
        <p className="mb-2 rounded-lg border border-rose-300/25 bg-rose-400/[0.05] px-2.5 py-2 text-[10px] leading-snug font-bold text-white/60">
          재림판은 스토리판보다 훨씬 강력하다 — <span className="text-rose-200">HP ×5 · ATK ×2.2</span> 기준에
          <span className="mx-0.5" style={{ color: dif.color }}>[{dif.label}]</span>가 곱해진다
          <br />
          보상: 골드·경험치 ×3 기준 <span style={{ color: dif.color }}>· 난이도 배율 ×{dif.reward}</span> +{" "}
          <span className="text-emerald-300">에메랄드 +{dif.emerald}</span>
        </p>
        {/* v3.0.28 — 난이도 선택 (메이플식) */}
        <BossDiffChips value={diff} onPick={setDiff} />
        <div className="grid grid-cols-3 gap-1">
          {CHAPTERS.map((ch) => {
            const bk = ch.boss;
            if (!bk) return null;
            const cleared = (bossKills[`boss_${bk}`] ?? 0) > 0;
            return (
              <button
                key={ch.key}
                disabled={!cleared}
                title={cleared ? `${BOSS_DEFS[bk].name} 재림판에 도전` : "스토리를 먼저 완료하세요"}
                onClick={() => EventBus.emit("rpg:bossReplay", { ch: ch.key, lv: diff })}
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
        <p className="mt-2.5 text-center text-[10px] text-white/40">스토리 클리어(토벌)한 챕터의 보스만 도전할 수 있습니다 · ESC로 닫기</p>
      </div>
    </div>
  );
}

/* ---------- v3.1.0 — 스토리 보스전 난이도 선택 패널은 삭제됐다 ----------
 *  유저 지시 "스토리 보스는 전용 난이도를 쓰고, 그 때만 난이도 선택 창이 안 뜨게":
 *  스토리 보스는 노말 상향 고정 난이도로 즉시 스폰된다. 난이도 선택은
 *  보스 재도전 창(BossReplayPanel · 재림판)에서만 노출된다. */

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

        {/* v3.1.0 (#볼륨UI) — BGM/효과음 개별 볼륨 슬라이더 */}
        <VolumeSliders />

        {/* v1.0.8 — 그래픽 효과 모드 (유저 지시 "쉐이더 어디감??" — 셰이더 가시성 제어) */}
        <div className="mt-3 rounded-lg border border-sky-300/25 bg-sky-400/[0.06] px-2.5 py-2.5">
          <p className="text-[12px] font-black text-sky-200">그래픽 효과 (셰이더)</p>
          <p className="mt-0.5 text-[10px] leading-snug text-white/50">
            툰 셰이더·블룸·조명·충격파 셰이더 적용 범위. "자동"은 프레임이 떨어지면 잠시 줄어들 수 있어요.
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {([
              { m: "high", label: "항상 높음", css: "border-emerald-300/70 bg-emerald-500/20 text-emerald-200" },
              { m: "auto", label: "자동 (기본)", css: "border-sky-300/70 bg-sky-500/20 text-sky-200" },
              { m: "low", label: "절전", css: "border-amber-300/70 bg-amber-500/20 text-amber-200" },
            ] as const).map((o) => {
              const cur = (() => { try { return window.localStorage.getItem("sertz_fx_mode") === "high" || window.localStorage.getItem("sertz_fx_mode") === "low" ? window.localStorage.getItem("sertz_fx_mode") : "auto"; } catch { return "auto"; } })();
              const active = cur === o.m;
              return (
                <button
                  key={o.m}
                  onClick={() => EventBus.emit("fx:mode", o.m)}
                  className={`rounded-md border-2 px-1 py-1.5 text-[11px] font-black transition ${active ? o.css : "border-white/15 bg-black/40 text-white/55 hover:border-white/40"}`}
                >
                  {o.label}{active ? " ✓" : ""}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[9px] leading-snug text-white/35">
            셰이더가 사라졌다면 → "항상 높음" 선택. 프레임 보호용 자동 축소가 켜진 것입니다.
          </p>
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
            이동은 방향키 고정 · SPACE는 항상 공격 · ESC는 창 닫기 고정입니다. (v1.0.4 — WASD 이동 제거, 전투 키는 Z X C V + A S D F)
            <br />
            모바일은 터치 컨트롤을 사용하므로 영향을 받지 않아요.
          </p>
        </div>

        {/* v4.1.0 — 긴급 귀환 (유저 지시 #3 — 설정창 배치) */}
        <div className="mt-2.5 rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-2.5 py-2">
          <p className="text-[12px] font-black text-amber-200">긴급 귀환 장치</p>
          <p className="mt-0.5 text-[10px] leading-snug text-white/55">
            막히거나 길을 잃었을 때 — 지금 위치에서 가장 가까운 마을로 즉시 이동한다.
            이벤트 구역(도장/수비전/던전)에서는 도중 정산 후 나가진다.
          </p>
          <button
            onClick={() => {
              EventBus.emit("rpg:escapeHome");
              onClose();
            }}
            className="mt-1.5 w-full rounded-lg border-2 border-amber-300/70 bg-gradient-to-b from-amber-400 to-amber-600 px-3 py-2.5 text-[13px] font-black text-slate-900 shadow-lg transition-transform hover:scale-[1.01] active:scale-95"
          >
            가장 가까운 마을로 귀환 (8초 쿨)
          </button>
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

/* ================= v4.0.0 — 바르가 원정대 (피규어/배지/룬/성좌/업적/랭킹) =================
 *  바르가 수집형 성장 시스템 통합 패널 */
import {
  FIGURES, FIGURE_GRADE_META, BADGES, BADGE_MAP, RUNE_KINDS, RUNE_META, RUNE_SYNTH_COST, RUNE_MAX_TIER,
  runeKey, parseRuneKey, CONSTELLATIONS, CONSTEL_NODE_COST, ACHIEVEMENTS, SHARD_SHOP, ROLE_OF,
  figureBonus, badgeBonus, runeBonus, constellationBonus, cosmeticBonus,
} from "@/game/isekai";
import { netRankTop, netOnRank, type RankEntry, type RankMode } from "@/game/net";

type TabKey = "figure" | "badge" | "rune" | "constel" | "ach" | "rank";

function IsekaiPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const [tab, setTab] = useState<TabKey>("figure");
  /* v1.0.2 (#업적UI) — 업적 필터 (수령 가능한 업적을 한눈에) */
  const [achFilter, setAchFilter] = useState<"all" | "claimable" | "progress" | "done">("all");
  const ik = rpg.isekai;
  const figures = ik?.figures ?? [];
  const shards = ik?.shards ?? 0;
  const tickets = ik?.gachaTickets ?? 0;
  const fBonus = figureBonus(figures);
  const bBonus = badgeBonus(ik?.badgeSlots ?? [null, null, null]);
  const rBonus = runeBonus(ik?.runes ?? {}, ik?.runeSlots ?? [null, null, null, null]);
  const cBonus = constellationBonus(ik?.constel ?? []);
  const TABS: { key: TabKey; label: string }[] = [
    { key: "figure", label: "피규어" },
    { key: "badge", label: "배지" },
    { key: "rune", label: "룬" },
    { key: "constel", label: "성좌" },
    { key: "ach", label: "업적" },
    { key: "rank", label: "랭킹" },
  ];
  const gradeBadge = (g: 0 | 1 | 2 | 3) => (
    <span className={`rounded px-1 py-0.5 text-[8px] font-black ${FIGURE_GRADE_META[g].css}`} style={{ border: `1px solid ${FIGURE_GRADE_META[g].color}66` }}>
      {FIGURE_GRADE_META[g].name}
    </span>
  );
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div className="max-h-[min(88svh,640px)] w-[min(94vw,500px)] overflow-y-auto rounded-xl border-2 border-purple-300/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black text-purple-200">바르가 원정대</p>
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-amber-300/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-black text-amber-200">조각 {shards}</span>
            <span className="rounded border border-sky-300/40 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-black text-sky-200">뽑기권 {tickets}</span>
            <button onClick={onClose} aria-label="바르가 원정대 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">✕</button>
          </div>
        </div>

        {/* 탭 */}
        <div className="mb-2.5 grid grid-cols-6 gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-lg border px-1 py-1.5 text-[10px] font-black transition-colors ${tab === t.key ? "border-purple-300/70 bg-purple-400/20 text-purple-100" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 공용 보너스 요약 */}
        <div className="mb-2.5 rounded-lg border border-purple-300/20 bg-purple-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-white/70">
          <p className="mb-0.5 font-black text-purple-200">수집 보너스 합계 (피규어 {figures.length}/{FIGURES.length} · 배지 {ik?.badgeSlots?.filter(Boolean).length ?? 0}/3 · 룬 {ik?.runeSlots?.filter(Boolean).length ?? 0}/4 · 성좌 {ik?.constel?.length ?? 0}개)</p>
          <p>
            {[
              fBonus.atk + bBonus.atk + rBonus.atk > 0 && `공격 +${fBonus.atk + bBonus.atk + rBonus.atk}`,
              fBonus.atkPct + cBonus.atkPct > 0 && `공격% +${fBonus.atkPct + cBonus.atkPct}`,
              fBonus.def + bBonus.def + rBonus.def + cBonus.def > 0 && `방어 +${fBonus.def + bBonus.def + rBonus.def + cBonus.def}`,
              fBonus.hp + bBonus.hp + rBonus.hp + cBonus.hp > 0 && `HP +${fBonus.hp + bBonus.hp + rBonus.hp + cBonus.hp}`,
              fBonus.crit + bBonus.crit + rBonus.crit + cBonus.crit > 0 && `크리 +${fBonus.crit + bBonus.crit + rBonus.crit + cBonus.crit}%`,
              bBonus.speedPct > 0 && `이속 +${bBonus.speedPct}%`,
              bBonus.goldPct > 0 && `골드 +${bBonus.goldPct}%`,
            ].filter(Boolean).join(" · ") || "보너스 없음 — 수집을 시작하라!"}
          </p>
        </div>

        {/* 피규어 탭 */}
        {tab === "figure" && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold text-white/60">피규어 도감 — 보유만으로 항상 적용 (중복은 조각으로)</p>
              <button
                disabled={tickets <= 0}
                onClick={() => EventBus.emit("rpg:isekai", { action: "gacha" })}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-black active:scale-95 ${tickets > 0 ? "border-purple-300/60 bg-purple-400/20 text-purple-100 hover:bg-purple-400/30" : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/30"}`}
              >
                뽑기 ×1 (보유 {tickets})
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {FIGURES.map((f) => {
                const got = figures.includes(f.key);
                const b = f.bonus;
                const bonusText = [b.atk && `공+${b.atk}`, b.def && `방+${b.def}`, b.hp && `HP+${b.hp}`, b.crit && `크리+${b.crit}`, b.atkPct && `공%+${b.atkPct}`].filter(Boolean).join(" ");
                return (
                  <div key={f.key} title={got ? `${f.desc} — ${bonusText}` : "미보유"} className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-center ${got ? "border-purple-300/40 bg-purple-400/[0.08]" : "border-white/10 bg-white/[0.02] opacity-50"}`}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border text-sm" style={{ borderColor: `${FIGURE_GRADE_META[f.grade].color}55`, background: `${FIGURE_GRADE_META[f.grade].color}18` }}>
                      {got ? "🧸" : "?"}
                    </div>
                    <p className="w-full truncate text-[9px] font-bold text-white">{got ? f.name : "???"}</p>
                    {gradeBadge(f.grade)}
                    <p className="text-[8px] text-white/50">{got ? bonusText : `중복 시 조각 +${FIGURE_GRADE_META[f.grade].shard}`}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-white/40">뽑기권 획득: 출석부 · 일일 퀘스트 · 게이트 정산 · GM 무료 뽑기(10분)</p>
          </div>
        )}

        {/* 배지 탭 */}
        {tab === "badge" && (
          <div>
            <p className="mb-2 text-[11px] font-bold text-white/60">배지 슬롯 — 3개까지 장착 (클릭 해제)</p>
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((s) => {
                const k = ik?.badgeSlots?.[s] ?? null;
                const b = k ? BADGE_MAP[k] : null;
                return (
                  <button key={s} disabled={!b} onClick={() => b && EventBus.emit("rpg:isekai", { action: "badgeUnequip", slot: s })} className={`rounded-lg border px-2 py-2.5 text-center text-[10px] font-bold ${b ? "border-amber-300/50 bg-amber-400/10 text-amber-100" : "border-dashed border-white/15 bg-white/[0.02] text-white/30"}`}>
                    {b ? b.name : `슬롯 ${s + 1}`}
                    {b && <span className="mt-0.5 block text-[8px] text-white/50">{[b.bonus.atk && `공+${b.bonus.atk}`, b.bonus.def && `방+${b.bonus.def}`, b.bonus.hp && `HP+${b.bonus.hp}`, b.bonus.crit && `크리+${b.bonus.crit}`, b.bonus.goldPct && `골드+${b.bonus.goldPct}%`, b.bonus.speedPct && `이속+${b.bonus.speedPct}%`].filter(Boolean).join(" ")}</span>}
                  </button>
                );
              })}
            </div>
            <p className="mb-1 text-[11px] font-bold text-white/60">보유 배지 — 클릭해 장착</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BADGES.map((b) => {
                const owned = (ik?.badges ?? []).includes(b.key);
                const equipped = (ik?.badgeSlots ?? []).includes(b.key);
                return (
                  <button key={b.key} disabled={!owned || equipped} onClick={() => EventBus.emit("rpg:isekai", { action: "badgeEquip", key: b.key, slot: (ik?.badgeSlots ?? [null, null, null]).indexOf(null) })} className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${equipped ? "border-emerald-300/40 bg-emerald-400/10" : owned ? "border-white/15 bg-white/[0.05] hover:border-amber-300/50" : "border-white/10 bg-white/[0.02] opacity-45"}`}>
                    <p className="truncate text-[10px] font-black text-white">{equipped ? "✔ " : ""}{b.name}</p>
                    <p className="truncate text-[8.5px] text-white/45">{owned ? b.desc : `획득: ${b.src}`}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 룬 탭 */}
        {tab === "rune" && (
          <div>
            <p className="mb-2 text-[11px] font-bold text-white/60">룬 슬롯 4개 — 같은 룬 {RUNE_SYNTH_COST}개를 합성하면 상위 티어</p>
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((s) => {
                const k = ik?.runeSlots?.[s] ?? null;
                const p = k ? parseRuneKey(k) : null;
                return (
                  <button key={s} disabled={!p} onClick={() => p && EventBus.emit("rpg:isekai", { action: "runeUnequip", slot: s })} className={`rounded-lg border px-1 py-2 text-center ${p ? "border-white/25 bg-white/[0.06]" : "border-dashed border-white/15 bg-white/[0.02]"}`}>
                    <p className="text-base">{p ? RUNE_META[p.kind].icon : "◇"}</p>
                    <p className="text-[8.5px] font-bold" style={{ color: p ? RUNE_META[p.kind].color : "#ffffff44" }}>{p ? `T${p.tier}` : `슬롯 ${s + 1}`}</p>
                  </button>
                );
              })}
            </div>
            {RUNE_KINDS.map((kind) => {
              const owned = ik?.runes ?? {};
              const tiers: { t: number; n: number }[] = [];
              for (let t = 1; t <= RUNE_MAX_TIER; t++) {
                const n = owned[runeKey(kind, t)] ?? 0;
                if (n > 0) tiers.push({ t, n });
              }
              const canSynth = tiers.some((x) => x.n >= RUNE_SYNTH_COST && x.t < RUNE_MAX_TIER);
              return (
                <div key={kind} className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <span className="text-base">{RUNE_META[kind].icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black" style={{ color: RUNE_META[kind].color }}>{RUNE_META[kind].name} <span className="text-white/40">({RUNE_META[kind].stat === "atk" ? "공격" : RUNE_META[kind].stat === "def" ? "방어" : RUNE_META[kind].stat === "crit" ? "크리" : "HP"})</span></p>
                    <p className="truncate text-[9px] text-white/45">{tiers.length ? tiers.map((x) => `T${x.t}×${x.n}`).join(" · ") : "보유 없음 — 게이트 웨이브 보상/조각 상점"}</p>
                  </div>
                  <button onClick={() => EventBus.emit("rpg:isekai", { action: "runeSynth", key: kind })} className={`rounded-lg border px-2 py-1 text-[10px] font-black active:scale-95 ${canSynth ? "border-purple-300/60 bg-purple-400/20 text-purple-100" : "border-white/10 bg-white/[0.03] text-white/35"}`}>합성</button>
                  <button onClick={() => EventBus.emit("rpg:isekai", { action: "runeEquip", key: kind + "#" + (tiers.length ? Math.max(...tiers.filter((x) => x.n > 0).map((x) => x.t)) : 1), slot: (ik?.runeSlots ?? [null, null, null, null]).indexOf(null) >= 0 ? (ik?.runeSlots ?? []).indexOf(null) : 0 })} className="rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1 text-[10px] font-black text-white/80 active:scale-95">장착</button>
                </div>
              );
            })}
          </div>
        )}

        {/* 성좌 탭 */}
        {tab === "constel" && (
          <div>
            <p className="mb-2 text-[11px] font-bold text-white/60">성좌 — 피규어 조각으로 별을 개방 (순차 해금)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CONSTELLATIONS.map((c) => (
                <div key={c.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <p className="mb-1 text-[10px] font-black text-sky-200">{c.name}</p>
                  <div className="flex gap-1">
                    {c.nodes.map((n, i) => {
                      const id = `${c.key}:${i}`;
                      const got = (ik?.constel ?? []).includes(id);
                      const cost = CONSTEL_NODE_COST[i] ?? 999;
                      const bonusText = [n.atk && `공+${n.atk}`, n.def && `방+${n.def}`, n.hp && `HP+${n.hp}`, n.crit && `크리+${n.crit}`, n.atkPct && `공%+${n.atkPct}`].filter(Boolean).join(" ");
                      return (
                        <button key={id} disabled={got} onClick={() => EventBus.emit("rpg:isekai", { action: "constelUnlock", ck: c.key, idx: i })} title={got ? `${bonusText} 개방됨` : `${bonusText} — 조각 ${cost}`} className={`flex-1 rounded-md border px-1 py-1 text-[9px] font-black active:scale-95 ${got ? "border-amber-300/60 bg-amber-400/20 text-amber-200" : "border-white/15 bg-white/[0.04] text-white/60 hover:border-sky-300/50"}`}>
                          {got ? "★" : `✧${cost}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 업적 탭 */}
        {tab === "ach" && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-white/60">업적 — 달성 시 피규어 조각 지급</p>
            {/* v1.0.2 (#업적UI) — 상태 필터: 수령 가능한 업적이 묻히지 않게 탭으로 분리 */}
            <div className="mb-2 flex flex-wrap gap-1">
              {([
                ["all", "전체"],
                ["claimable", "수령 가능"],
                ["progress", "진행 중"],
                ["done", "수령 완료"],
              ] as const).map(([k, label]) => {
                const n = ACHIEVEMENTS.filter((a) => {
                  const cl = (ik?.achClaimed ?? []).includes(a.id);
                  const pr = ik?.achProg?.find((x) => x.id === a.id)?.prog ?? 0;
                  return k === "all" ? true : k === "done" ? cl : k === "claimable" ? !cl && pr >= a.goal : !cl && pr < a.goal;
                }).length;
                return (
                  <button
                    key={k}
                    onClick={() => setAchFilter(k)}
                    className={`rounded-md border px-2 py-1 text-[10px] font-black active:scale-95 ${achFilter === k ? "border-amber-300/70 bg-amber-400/20 text-amber-100" : "border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"}`}
                  >
                    {label} {n > 0 && <span className={k === "claimable" ? "text-amber-300" : "opacity-60"}>{n}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              {ACHIEVEMENTS.map((a) => {
                const claimed = (ik?.achClaimed ?? []).includes(a.id);
                /* v1.0.2 (#업적UI) — 서버 아닌 상태 페이로드의 진행도(achProg)로 수령 가능 판정 */
                const prog = ik?.achProg?.find((x) => x.id === a.id)?.prog ?? 0;
                const claimable = !claimed && prog >= a.goal;
                const pct = Math.min(100, Math.floor((prog / a.goal) * 100));
                if (achFilter === "claimable" && !claimable) return null;
                if (achFilter === "done" && !claimed) return null;
                if (achFilter === "progress" && (claimed || prog >= a.goal)) return null;
                return (
                  <div key={a.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${claimed ? "border-emerald-300/40 bg-emerald-400/[0.07]" : claimable ? "border-amber-300/70 bg-amber-400/[0.10] shadow-[0_0_8px_rgba(252,211,77,0.25)]" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-black text-white">{a.name} <span className="font-normal text-white/40">— {a.desc}</span></p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50">
                          <div className={`h-full rounded-full ${claimed ? "bg-emerald-400" : claimable ? "bg-gradient-to-r from-amber-400 to-amber-200" : "bg-sky-400/70"}`} style={{ width: `${claimed ? 100 : pct}%` }} />
                        </div>
                        <span className={`shrink-0 text-[9px] font-black ${claimable ? "text-amber-200" : "text-white/50"}`}>{claimed ? "✓ 완료" : `${prog}/${a.goal}`}</span>
                      </div>
                    </div>
                    <button
                      disabled={claimed}
                      onClick={() => EventBus.emit("rpg:isekai", { action: "achClaim", id: a.id })}
                      className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black active:scale-95 ${claimed ? "border-emerald-300/40 text-emerald-200" : claimable ? "border-amber-300 bg-amber-400 text-slate-900 hover:bg-amber-300" : "border-white/15 bg-white/[0.05] text-white/45"}`}
                    >
                      {claimed ? "수령 완료" : claimable ? `보상 받기 +${a.shards}` : `조각 +${a.shards}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 랭킹 탭 */}
        {tab === "rank" && <RankTab ik={ik} />}
      </div>
    </div>
  );
}

function RankTab({ ik }: { ik: NonNullable<RpgState["isekai"]> | undefined }) {
  const [mode, setMode] = useState<RankMode>("gate");
  const [list, setList] = useState<RankEntry[]>([]);
  useEffect(() => {
    netRankTop(mode);
    const off = netOnRank((m, l) => { if (m === mode) setList(l); });
    const t = setInterval(() => netRankTop(mode), 8000);
    return () => { off(); clearInterval(t); };
  }, [mode]);
  const localBest = mode === "gate" ? (ik?.gateBest ?? 0) : mode === "closet" ? (ik?.closetBest ?? 0) : mode === "tower" ? (ik ? (JSON.parse(JSON.stringify(ik)) as { towerBest?: number }).towerBest ?? 0 : 0) : (() => { try { return Number(localStorage.getItem("sertz.dojang.best") ?? "0") || 0; } catch { return 0; } })();
  return (
    <div>
      <div className="mb-2 grid grid-cols-3 gap-1">
        {([["gate", "바르가 수비전"], ["closet", "균열 던전"], ["dojang", "무릉도장"], ["tower", "심연의 탑"]] as [RankMode, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} className={`rounded-lg border px-1 py-1.5 text-[10px] font-black ${mode === k ? "border-sky-300/60 bg-sky-400/20 text-sky-100" : "border-white/10 bg-white/[0.03] text-white/50"}`}>{label}</button>
        ))}
      </div>
      <p className="mb-1.5 rounded-lg border border-sky-300/20 bg-sky-400/5 px-2 py-1.5 text-[10px] text-white/60">내 최고 기록: <span className="font-black text-sky-200">{localBest.toLocaleString()}</span> {mode === "dojang" ? "(누적 피해)" : mode === "gate" ? "(웨이브)" : "(골드)"} · 기록은 멀티 서버에 자동 등록</p>
      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-3 text-[11px] text-white/40">아직 서버 랭킹이 없습니다 — 멀티 서버 접속 후 기록을 세워보자!</p>
      ) : (
        <div className="flex flex-col gap-1">
          {list.map((e, i) => (
            <div key={`${e.name}-${i}`} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${i < 3 ? "border-amber-300/40 bg-amber-400/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
              <span className={`w-6 text-center text-[11px] font-black ${i < 3 ? "text-amber-300" : "text-white/40"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">{e.name}</span>
              <span className="text-[10px] text-white/40">Lv{e.lv}</span>
              <span className="text-[11px] font-black text-sky-200">{e.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= v4.0.0 — 혜택 패널 (출석부/일일 퀘스트/쿠폰/티켓) ================= */
function BenefitPanel({ rpg, onClose }: { rpg: RpgState; onClose: () => void }) {
  useEscClose(onClose);
  const ik = rpg.isekai;
  const [code, setCode] = useState("");
  const gate = useKeyGate(); // v4.1.0 — 쿠폰 입력 중 게임 단축키 차단 (지시 #5)
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const attendCount = ik?.attend?.count ?? 0;
  const attendToday = (ik?.attend?.last ?? "") === today;
  const cycleDay = ((attendCount - 1) % 14 + 14) % 14;
  const daily = ik?.daily;
  const dailyToday = (daily?.date ?? "") === today;
  const hunts = dailyToday ? daily?.hunts ?? 0 : 0;
  const gateRuns = dailyToday ? daily?.gate ?? 0 : 0;
  const closetRuns = dailyToday ? daily?.closet ?? 0 : 0;
  const farms = dailyToday ? daily?.farms ?? 0 : 0; // v1.0.7 — 오늘의 파밍
  const bosses = dailyToday ? daily?.bosses ?? 0 : 0; // v1.0.7 — 보스 사냥
  const claimed = dailyToday ? daily?.claimed ?? [] : [];
  const DAILY_GOALS: { id: string; name: string; desc: string; goal: number; prog: number; reward: string }[] = [
    { id: "hunt", name: "오늘의 토벌", desc: "몬스터 50마리 처치", goal: 50, prog: hunts, reward: "골드 15,000" },
    /* v1.0.7 — 파밍/보스 일일 퀘스트 2종 확장 (3종 → 5종) */
    { id: "farm", name: "오늘의 파밍", desc: "필드 아이템 드롭 40개 수집", goal: 40, prog: farms, reward: "뽑기권 1 + 골드 8,000" },
    { id: "boss", name: "보스 사냥", desc: "보스 1마리 처치 (재림/카오스 포함)", goal: 1, prog: bosses, reward: "골드 20,000 + 에메랄드 3" },
    { id: "gate", name: "게이트 방어", desc: "바르가 수비전 1회 입장", goal: 1, prog: gateRuns, reward: "뽑기권 1 + 골드 5,000" },
    { id: "closet", name: "균열 던전", desc: "균열 던전 1회 입장", goal: 1, prog: closetRuns, reward: "뽑기권 1 + 에메랄드 2" },
  ];
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div className="max-h-[min(88svh,640px)] w-[min(94vw,470px)] overflow-y-auto rounded-xl border-2 border-emerald-300/50 sertz-panel bg-slate-950/95 p-3.5 shadow-2xl sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-sm font-black text-emerald-200">혜택 — 출석부 · 일일 퀘스트 · 쿠폰</p>
          <button onClick={onClose} aria-label="혜택 패널 닫기" className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 hover:bg-black/70">✕</button>
        </div>

        {/* 출석부 */}
        <p className="mb-1 text-[11px] font-bold text-white/60">출석부 (14일 사이클) — {attendToday ? "오늘 출석 완료!" : "접속만 하면 자동 출석!"}</p>
        <div className="mb-2.5 grid grid-cols-7 gap-1">
          {Array.from({ length: 14 }).map((_, i) => {
            const filled = i < cycleDay || (attendToday && i === cycleDay);
            const isToday = attendToday && i === cycleDay;
            return (
              <div key={i} className={`flex h-9 flex-col items-center justify-center rounded-md border text-center ${isToday ? "border-emerald-300 bg-emerald-400/25" : filled ? "border-emerald-300/40 bg-emerald-400/10" : "border-white/10 bg-white/[0.02]"}`}>
                <span className="text-[8px] font-black text-white/50">{i + 1}</span>
                <span className="text-[9px]">{filled ? "✔" : ""}</span>
              </div>
            );
          })}
        </div>

        {/* v4.5.0 — SERTZ 패스 (구독 특전 — 월정액 LTV 루프, BM 문서 표준) */}
        <div className="mb-2.5 rounded-lg border border-violet-300/40 bg-violet-400/10 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black text-violet-200">SERTZ 패스 (구독 특전)</p>
            {rpg.sub?.active ? (
              <span className="rounded bg-violet-400/30 px-1.5 py-0.5 text-[9px] font-black text-violet-100">구독 중 · 잔여 {rpg.sub.left}일</span>
            ) : null}
          </div>
          {rpg.sub?.active ? (
            <ul className="mt-1 text-[10px] leading-relaxed text-white/60">
              <li>· 출석 시 에메랄드 +3 (출석 보상에 자동 합산)</li>
              <li>· 광고 보상 2배 (💎+2 · 골드+1,000)</li>
              <li>· 광고 일일 한도 5 → 8회</li>
            </ul>
          ) : (
            <>
              <ul className="mt-1 text-[10px] leading-relaxed text-white/60">
                <li>· 매일 출석 시 에메랄드 +3 (30일간 총 +90💎)</li>
                <li>· 광고 보상 2배 + 광고 한도 8회</li>
              </ul>
              <button
                onClick={() => EventBus.emit("rpg:subBuy")}
                className="mt-1.5 w-full rounded-lg bg-violet-400 px-3 py-1.5 text-[12px] font-black text-slate-900 hover:bg-violet-300 active:scale-95"
              >
                구독하기 — 50💎 / 30일
              </button>
            </>
          )}
        </div>

        {/* 일일 퀘스트 */}
        <p className="mb-1 text-[11px] font-bold text-white/60">일일 퀘스트 — 매일 초기화</p>
        <div className="mb-2.5 flex flex-col gap-1.5">
          {DAILY_GOALS.map((q) => {
            const done = claimed.includes(q.id);
            const reach = q.prog >= q.goal;
            return (
              <div key={q.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${done ? "border-emerald-300/40 bg-emerald-400/[0.07]" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-white">{q.name} <span className="ml-1 font-normal text-white/40">{q.desc}</span></p>
                  <p className="text-[9px] text-white/50">진행 {Math.min(q.prog, q.goal)}/{q.goal} · 보상 {q.reward}</p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.min(100, (q.prog / q.goal) * 100)}%` }} />
                  </div>
                </div>
                <button disabled={done || !reach} onClick={() => EventBus.emit("rpg:isekai", { action: "dailyClaim", id: q.id })} className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black active:scale-95 ${done ? "border-emerald-300/40 text-emerald-200" : reach ? "border-amber-300/50 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25" : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/30"}`}>{done ? "수령 완료" : "수령"}</button>
              </div>
            );
          })}
        </div>

        {/* 티켓 현황 + 콘텐츠 입구 — v1.0.1 재충전 버튼 추가 */}
        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-violet-300/30 bg-violet-400/10 px-2 py-1.5 text-center">
            <p className="text-[9px] font-bold text-white/50">바르가 수비전 티켓</p>
            <p className="text-sm font-black text-violet-200">{ik?.tickets?.gate ?? 0}/3 남음</p>
            <button
              disabled={(rpg.ticketRefillsLeft ?? 0) <= 0 || rpg.emerald < 3}
              onClick={() => EventBus.emit("rpg:ticketRefill", { kind: "gate" })}
              className={`mt-1 w-full rounded-md px-1.5 py-1 text-[10px] font-black active:scale-95 ${(rpg.ticketRefillsLeft ?? 0) <= 0 || rpg.emerald < 3 ? "cursor-not-allowed bg-white/[0.06] text-white/30" : "bg-violet-400 text-slate-900 hover:bg-violet-300"}`}
            >
              재충전 +1 (3💎 · {(rpg.ticketRefillsLeft ?? 0)}회)
            </button>
          </div>
          <div className="rounded-lg border border-lime-300/30 bg-lime-400/10 px-2 py-1.5 text-center">
            <p className="text-[9px] font-bold text-white/50">균열 던전 티켓</p>
            <p className="text-sm font-black text-lime-200">{ik?.tickets?.closet ?? 0}/2 남음</p>
            <button
              disabled={(rpg.ticketRefillsLeft ?? 0) <= 0 || rpg.emerald < 3}
              onClick={() => EventBus.emit("rpg:ticketRefill", { kind: "closet" })}
              className={`mt-1 w-full rounded-md px-1.5 py-1 text-[10px] font-black active:scale-95 ${(rpg.ticketRefillsLeft ?? 0) <= 0 || rpg.emerald < 3 ? "cursor-not-allowed bg-white/[0.06] text-white/30" : "bg-lime-400 text-slate-900 hover:bg-lime-300"}`}
            >
              재충전 +1 (3💎 · {(rpg.ticketRefillsLeft ?? 0)}회)
            </button>
          </div>
        </div>

        {/* v1.0.1 — 오늘의 균열 테마 + 요일 로테이션 */}
        <div className="mb-2.5 rounded-lg border border-lime-300/30 bg-lime-400/[0.07] px-2.5 py-2">
          <p className="text-[11px] font-black text-lime-200">오늘의 균열 테마 — {closetThemeOf().name}</p>
          <p className="text-[10px] text-white/60">{closetThemeOf().desc}</p>
          <div className="mt-1 flex gap-1 overflow-x-auto">
            {CLOSET_THEMES.map((t) => (
              <span
                key={t.dow}
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${t.dow === closetThemeOf().dow ? "bg-white/20 text-white" : "bg-white/[0.06] text-white/45"}`}
                style={{ color: t.dow === closetThemeOf().dow ? t.color : undefined }}
              >
                {"일월화수목금토"[t.dow]} {t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="mb-2.5 grid grid-cols-3 gap-1.5">
          <button onClick={() => EventBus.emit("ui:panel", { panel: "isekai" })} className="rounded-lg border border-purple-300/50 bg-purple-400/15 px-2 py-2 text-[11px] font-black text-purple-100 hover:bg-purple-400/25 active:scale-95">바르가 원정대 열기</button>
          {/* v1.0.5 — GM 콘텐츠 입장은 관리자 계정에만 노출 (비관리자 유출 — 마을 GM NPC와 동일 기준) */}
          {rpg.admin && <button onClick={() => EventBus.emit("ui:panel", { panel: "gm" })} className="rounded-lg border border-amber-300/50 bg-amber-400/10 px-2 py-2 text-[11px] font-black text-amber-100 hover:bg-amber-400/20 active:scale-95">GM 콘텐츠 입장</button>}
          <button onClick={() => EventBus.emit("ui:panel", { panel: "pass" })} className="rounded-lg border border-amber-300/50 bg-amber-400/15 px-2 py-2 text-[11px] font-black text-amber-100 hover:bg-amber-400/25 active:scale-95">시즌 패스 🎫</button>
        </div>

        {/* 쿠폰 — v4.1.0: 입력 중 게임 단축키/패널 팝업 완전 차단 */}
        <p className="mb-1 text-[11px] font-bold text-white/60">쿠폰 코드 입력</p>
        <div className="flex gap-1.5">
          <input
            ref={gate}
            {...swallowKeys}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: HELLOSERTZ"
            maxLength={20}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-[11px] font-bold text-white placeholder:text-white/25 focus:border-emerald-300/50 focus:outline-none"
          />
          <button onClick={() => { if (code.trim()) { EventBus.emit("rpg:isekai", { action: "coupon", code: code.trim() }); setCode(""); } }} className="shrink-0 rounded-lg border border-emerald-300/60 bg-emerald-400/20 px-3 py-2 text-[11px] font-black text-emerald-100 hover:bg-emerald-400/30 active:scale-95">사용</button>
        </div>
        <p className="mt-1.5 text-[10px] text-white/40">힌트: HELLOSERTZ · GATEOPEN · SERTZV4</p>
        <p className="mt-2 text-center text-[10px] text-white/40">ESC로 닫기 · 출석/수령은 즉시 세이브에 반영</p>
      </div>
    </div>
  );
}
