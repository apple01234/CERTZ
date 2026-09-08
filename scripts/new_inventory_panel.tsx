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
function InvBtn({ children, onClick, disabled, tone = "amber" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "amber" | "sky" | "violet" | "gray" }) {
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
  const auto = rpg.autoUse ?? { hpPct: 0, mpPct: 0, mpOn: false, buffs: [] as BuffKey[] };
  const qp = rpg.quickPots ?? { hp: "potion_hp", mp: "potion_mp" };
  const eertN = rpg.eertCube ?? 0;

  const pick = (t: InvTab) => {
    setTab(t);
    setSel(null);
  };
  const quickTag = (k: string) => [qp.hp === k ? "H" : "", qp.mp === k ? "M" : ""].filter(Boolean).join("·") || undefined;

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

  /* ----- 캐시 탭 슬롯 (버프/펫/치장 — BM 재화 아이템) ----- */
  const buffSlots: InvSlot[] = (Object.keys(BUFF_DEFS) as BuffKey[])
    .filter((bk) => (rpg.buffItems[bk] ?? 0) > 0)
    .map((bk) => ({ uk: `buff:${bk}`, t: "buff" as const, k: bk, icon: BUFF_DEFS[bk].icon, tier: "rare" as ItemTier, count: rpg.buffItems[bk] ?? 0 }));
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
    wornLabel: rpg.cosmetic === ck ? "착용" : undefined,
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
                💎 BM 상점 열기 <span className="font-bold text-white/40">— 에메랄드 상점</span>
              </button>
              {buffSlots.length + petSlots.length + cosSlots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 px-2.5 py-6 text-center text-[11px] text-white/35">
                  캐시 아이템이 없습니다 — BM 상점에서 버프/펫/치장을 구매해보세요
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
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-violet-100/50">
                소모품 <span className="font-bold text-white/30">물약은 [H]/[M] 버튼에 장착 가능</span>
              </p>
              <InvGrid slots={etcSlots} sel={sel} onPick={(s) => setSel({ t: s.t, k: s.k })} />

              {/* 자동 사용 설정 (v3.0.15 — 유지, 기타 탭으로 이동) */}
              <div className="mt-2 rounded-lg border-2 border-[#211c17] bg-[#2a241e] p-2.5">
                <p className="mb-1.5 text-[11px] font-black text-amber-100/80">
                  자동 사용 설정 <span className="font-bold text-white/35">— 전투 중 자동으로 사용</span>
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
                  💎 BM 상점에서 에메랄드 아이템 보기
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
                  const active = rpg.cosmetic === s.k;
                  return (
                    <>
                      <div className="flex items-start gap-2.5">
                        <ItemIcon icon={s.icon} size={40} tier="epic" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-black text-white">{def?.name ?? s.k}</p>
                          <p className="truncate text-[11px] font-bold text-emerald-300/90">{def?.desc}</p>
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
                        <InvBtn tone="gray" disabled={eertN <= 0} onClick={() => EventBus.emit("rpg:eert", { key: it.key })}>
                          eert {eertN > 0 ? `×${eertN}` : ""}
                        </InvBtn>
                        {sellValue(it) > 0 && <SellQtyBox compact count={s.count} unitValue={sellValue(it)} ev="rpg:sell" keyName={s.k} />}
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
                        {wornN < ownedN ? (
                          <InvBtn onClick={() => EventBus.emit("rpg:equip", { key: it.key })}>장착</InvBtn>
                        ) : (
                          <span className="rounded-md bg-emerald-700/50 px-2.5 py-1.5 text-[11px] font-black text-emerald-200">장착 중</span>
                        )}
                        {!accMaxed && (
                          <InvBtn tone="amber" disabled={rpg.gold < accCost} onClick={() => EventBus.emit("rpg:upgradeAcc", { key: it.key })}>
                            강화 {accCost}G · {accRate}%
                          </InvBtn>
                        )}
                        <InvBtn tone="gray" disabled={eertN <= 0} onClick={() => EventBus.emit("rpg:eert", { key: it.key })}>
                          eert {eertN > 0 ? `×${eertN}` : ""}
                        </InvBtn>
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
                          <InvBtn tone={qp.hp === s.k ? "amber" : "gray"} onClick={() => EventBus.emit("rpg:quickpot", { slot: "hp", key: s.k })}>
                            H
                          </InvBtn>
                          <InvBtn tone={qp.mp === s.k ? "amber" : "gray"} onClick={() => EventBus.emit("rpg:quickpot", { slot: "mp", key: s.k })}>
                            M
                          </InvBtn>
                        </>
                      )}
                      {chestLike && <span className="rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-white/45">구매 시 자동 개봉</span>}
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
