import { CAMPAIGN_ID } from "./catalog.ts";
import { parseCampaign, type CampaignProgress } from "./progress.ts";
export const STORAGE_KEY = `sertz:${CAMPAIGN_ID}:characters`;
export type CampaignSlots = {
  version: 1;
  capacity?: number;
  activeId: string | null;
  characters: CampaignProgress[];
};
function parseSlots(raw: string | null): CampaignSlots | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      value?.version !== 1 ||
      !Array.isArray(value.characters) ||
      value.characters.length > 12
    )
      return null;
    const characters = value.characters.map(parseCampaign);
    if (
      characters.some((p: CampaignProgress | null) => !p) ||
      new Set(characters.map((p: CampaignProgress) => p.characterId)).size !==
        characters.length
    )
      return null;
    return {
      version: 1,
      capacity: Number(value.capacity) >= 12 ? 12 : 8,
      characters,
      activeId: characters.some(
        (p: CampaignProgress) => p.characterId === value.activeId,
      )
        ? value.activeId
        : (characters[0]?.characterId ?? null),
    };
  } catch {
    return null;
  }
}
export function readSlots(
  storage: Pick<Storage, "getItem"> = localStorage,
): CampaignSlots {
  try {
    return (
      parseSlots(storage.getItem(STORAGE_KEY)) ??
      parseSlots(storage.getItem(`${STORAGE_KEY}:backup`)) ?? {
        version: 1,
        capacity: 8,
        activeId: null,
        characters: [],
      }
    );
  } catch {
    return { version: 1, capacity: 8, activeId: null, characters: [] };
  }
}
export function writeSlots(
  slots: CampaignSlots,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const next = JSON.stringify(slots);
  if (!parseSlots(next)) throw new Error("Invalid campaign slots");
  const previous = storage.getItem(STORAGE_KEY);
  if (previous !== null)
    storage.setItem(
      `${STORAGE_KEY}:${parseSlots(previous) ? "backup" : "unreadable"}`,
      previous,
    );
  storage.setItem(STORAGE_KEY, next);
}
export function putCharacter(
  p: CampaignProgress,
  slots: CampaignSlots,
): CampaignSlots {
  return {
    ...slots,
    activeId: p.characterId,
    characters: [
      ...slots.characters.filter((c) => c.characterId !== p.characterId),
      p,
    ],
  };
}
/** Export original bytes without invoking legacy migration or write hooks. */
export function legacyArchive(
  storage: Pick<Storage, "key" | "getItem" | "length"> = localStorage,
) {
  const entries: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && /^(sertz_save_|sertz_char_|sertz_slots_)/.test(k)) {
      const raw = storage.getItem(k);
      if (raw !== null) entries[k] = raw;
    }
  }
  return { format: "sertz-legacy-archive", readOnly: true, entries };
}

export function savePendingReceipt(
  characterId: string,
  receipt: string,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(
    `sertz:${CAMPAIGN_ID}:receipt:${characterId}`,
    JSON.stringify({ receipt, expiresAt: Date.now() + 3500000 }),
  );
}
export function readPendingReceipt(
  characterId: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): string | null {
  try {
    const value = JSON.parse(
      storage.getItem(`sertz:${CAMPAIGN_ID}:receipt:${characterId}`) ?? "null",
    );
    return typeof value?.receipt === "string" && value.expiresAt > Date.now()
      ? value.receipt
      : null;
  } catch {
    return null;
  }
}
export function clearPendingReceipt(
  characterId: string,
  storage: Pick<Storage, "removeItem"> = localStorage,
) {
  storage.removeItem(`sertz:${CAMPAIGN_ID}:receipt:${characterId}`);
}
