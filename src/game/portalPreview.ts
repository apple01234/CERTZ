/** 전진 차원문 라벨: 다음 구역 이름, 보스전이면 "보스", 마을이면 "휴식". */
import { STAGES, STAGE_SHORT } from "./stages";

export type PortalPreview = { text: string; color: string };

export function portalPreview(nextKey: string | null | undefined): PortalPreview {
  const def = nextKey ? STAGES[nextKey] : undefined;
  if (!nextKey || !def) return { text: "→ 다음 지역", color: "#d8b0ff" };
  const name = STAGE_SHORT[nextKey] ?? def.name ?? nextKey;
  if (def.boss) return { text: `→ ${name} · 보스`, color: "#ff9a9a" };
  if (def.isVillage) return { text: `→ ${name} · 휴식`, color: "#a8f0b8" };
  return { text: `→ ${name}`, color: "#d8b0ff" };
}
