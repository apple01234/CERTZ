/** The new economy never reads or writes db.saves, db.market, or legacy receipts. */
import {
  CHAPTERS,
  CHAPTER_BY_ID,
  COSMETICS,
  MEMORY_ITEM,
  type Family,
} from "../game/campaign/catalog.ts";
import {
  newCampaign,
  parseCampaign,
  type CampaignProgress,
} from "../game/campaign/progress.ts";
export type CampaignAccount = {
  characters: Record<string, CampaignProgress>;
  revision: number;
  claimed: string[];
  slots: number;
  entitlements?: string[];
};
export type CampaignListing = {
  id: string;
  seller: string;
  characterId: string;
  name: string;
  item: string;
  quantity: number;
  price: number;
};
export type CampaignRecord = {
  id: string;
  chapterId: string;
  mode: "solo" | "coop";
  time: number;
  deaths: number;
  names: string[];
  at: number;
};
export type CampaignStore = {
  accounts: Record<string, CampaignAccount>;
  listings: Record<string, CampaignListing>;
  records: CampaignRecord[];
  settled: Record<string, number>;
  purchases?: Record<string, { uid: string; sku: string }>;
};
export function emptyCampaignStore(): CampaignStore {
  return { accounts: {}, listings: {}, records: [], settled: {} };
}
export function accountOf(store: CampaignStore, uid: string) {
  return (
    store.accounts[uid] ??
    (store.accounts[uid] = {
      characters: {},
      revision: 0,
      claimed: [],
      slots: 8,
    })
  );
}
export type EconomyAction = {
  action: string;
  characterId?: string;
  save?: unknown;
  revision?: number;
  item?: string;
  quantity?: number;
  price?: number;
  listingId?: string;
  name?: string;
  family?: Family;
};
export function applyCampaignAction(
  store: CampaignStore,
  uid: string,
  input: EconomyAction,
): { status: number; error?: string; account?: CampaignAccount } {
  const account = accountOf(store, uid);
  const error = (message: string, status = 400) => ({ status, error: message });
  if (input.revision !== account.revision)
    return error(
      "클라우드 내용이 바뀌었습니다. 먼저 불러온 뒤 다시 시도하세요.",
      409,
    );
  if (input.action === "save") {
    const save = parseCampaign(input.save);
    if (!save) return error("새 캠페인의 올바른 저장 파일이 아닙니다.");
    const prev = account.characters[save.characterId];
    if (!prev && Object.keys(account.characters).length >= account.slots)
      return error("캐릭터 슬롯이 가득 찼습니다.");
    if (prev && (prev.name !== save.name || prev.family !== save.family))
      return error("캐릭터 정체성은 변경할 수 없습니다.");
    if (prev && save.completed.length < prev.completed.length)
      return error("이전 진행으로 덮어쓸 수 없습니다.", 409);
    // Offline chapter rewards have a finite, canonical total; imported money/items are never trusted.
    const delta = save.completed.length - (prev?.completed.length ?? 0);
    const coins = (prev?.coins ?? 0) + delta * 60,
      inventory = { ...(prev?.inventory ?? {}) };
    inventory[MEMORY_ITEM] = (inventory[MEMORY_ITEM] ?? 0) + delta;
    account.characters[save.characterId] = {
      ...save,
      coins,
      inventory,
      cosmetics:
        prev?.cosmetics ??
        (account.entitlements?.includes("oath_cloak_starlight")
          ? ["cloak-starlight"]
          : []),
      equipped:
        save.equipped && prev?.cosmetics.includes(save.equipped)
          ? save.equipped
          : null,
    };
  } else {
    const p = input.characterId
      ? account.characters[input.characterId]
      : undefined;
    if (!p) return error("캐릭터를 먼저 클라우드에 저장하세요.");
    if (input.action === "cosmetic") {
      const item = COSMETICS.find((c) => c.id === input.item);
      if (!item) return error("알 수 없는 외형입니다.");
      if (item.paid && !p.cosmetics.includes(item.id))
        return error("이 외형은 구매 복원으로 지급됩니다.");
      if (p.cosmetics.includes(item.id)) {
        p.equipped = item.id;
      } else {
        if (p.coins < item.cost) return error("서약 주화가 부족합니다.");
        p.coins -= item.cost;
        p.cosmetics.push(item.id);
        p.equipped = item.id;
      }
    } else if (input.action === "list") {
      const q = input.quantity,
        price = input.price;
      if (
        input.item !== MEMORY_ITEM ||
        !Number.isSafeInteger(q) ||
        q! < 1 ||
        q! > 99 ||
        !Number.isSafeInteger(price) ||
        price! < 1 ||
        price! > 10000
      )
        return error("등록 수량 또는 가격이 올바르지 않습니다.");
      if (
        Object.values(store.listings).filter((l) => l.seller === uid).length >=
        3
      )
        return error("동시 등록은 세 건까지 가능합니다.");
      if ((p.inventory[MEMORY_ITEM] ?? 0) < q!)
        return error("보유한 기억의 결정이 부족합니다.");
      const id = `${uid}:${account.revision}`;
      p.inventory[MEMORY_ITEM] -= q!;
      store.listings[id] = {
        id,
        seller: uid,
        characterId: p.characterId,
        name: p.name,
        item: MEMORY_ITEM,
        quantity: q!,
        price: price!,
      };
    } else if (input.action === "buy") {
      const l = store.listings[input.listingId ?? ""];
      if (!l) return error("이미 거래가 끝난 물품입니다.", 409);
      if (l.seller === uid) return error("자신의 물품은 구매할 수 없습니다.");
      const total = l.price * l.quantity;
      if (p.coins < total) return error("서약 주화가 부족합니다.");
      const seller = store.accounts[l.seller],
        recipient = seller?.characters[l.characterId];
      if (!recipient)
        return error("판매자의 저장 정보를 확인할 수 없습니다.", 409);
      p.coins -= total;
      p.inventory[l.item] = (p.inventory[l.item] ?? 0) + l.quantity;
      recipient.coins += Math.floor(total * 0.9);
      seller.revision++;
      delete store.listings[l.id];
    } else if (input.action === "cancel") {
      const l = store.listings[input.listingId ?? ""];
      if (!l || l.seller !== uid || l.characterId !== p.characterId)
        return error("취소할 수 없는 물품입니다.");
      p.inventory[l.item] = (p.inventory[l.item] ?? 0) + l.quantity;
      delete store.listings[l.id];
    } else return error("지원하지 않는 요청입니다.");
  }
  account.revision++;
  return { status: 200, account };
}
export function rankRecords(store: CampaignStore) {
  const counts = new Map<string, number>();
  return [...store.records]
    .sort((a, b) => a.time - b.time || a.deaths - b.deaths)
    .filter((r) => {
      const key = `${r.chapterId}:${r.mode}`,
        count = counts.get(key) ?? 0;
      counts.set(key, count + 1);
      return count < 20;
    });
}
