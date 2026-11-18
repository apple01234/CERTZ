/**
 * 2026-11-18 — 전진 차원문 위 "다음 구역 미리보기" (레퍼런스: Endless Wander `RoomModelConfig._doorRewardObject`).
 *
 * 원본은 문 위에 다음 방의 종류·보상을 띄워, 들어가기 전에 무엇이 기다리는지 알게 한다.
 * SERTZ 차원문 라벨은 구역 번호(`→ 2-3`)만 보여 줬다. 다음 구역이 보스전인지, 쉬어 갈 마을인지를
 * 같은 라벨에 덧붙여 준비할 시간을 준다. 구역 데이터(STAGES)만 읽는 순수 함수다.
 */
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
