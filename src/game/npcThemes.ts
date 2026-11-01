/** 기존 SPUM 몸체만 배정한다. 색조 변경·신규 캐릭터 생성 없음. */
export const FIELD_NPC_LOOKS: Record<string, readonly string[]> = {
  forest: ["spum_scout", "spum_forager", "spum_villager_m"],
  kingdom: ["spum_villager_f", "spum_knight", "spum_villager_f"],
  cave: ["spum_miner", "spum_mystic", "spum_miner"],
  niflheim: ["spum_scout", "spum_butler", "spum_mystic"],
  muspelheim: ["spum_miner", "spum_smith", "spum_villager_f"],
  alfheim: ["spum_elf", "spum_mystic", "spum_elf"],
  nidavellir: ["spum_smith", "spum_mystic", "spum_merchant"],
  hel: ["spum_skel", "spum_butler", "spum_devil"],
  abyss: ["spum_scout", "spum_mystic", "spum_fisher"],
};
export function fieldNpcLook(chapter: string, variant: number, fallback: string): string {
  const looks = FIELD_NPC_LOOKS[chapter];
  return looks?.[((variant % looks.length) + looks.length) % looks.length] ?? fallback;
}
