/** 지역 이동 부적 목록. 방문한 구역을 마을 → 라일락 월드 장 → 기존 장 → 재림 순으로 묶고,
 *  어디에도 안 들어가는 구역은 "그 밖의 구역"에 넣는다. */
import { CHAPTERS, STAGES, STAGE_SHORT } from "./stages";
import { LILACWORLD_CHAPTERS } from "./lilacworld";

export type WarpStage = { key: string; name: string };
export type WarpGroup = { label: string; stages: WarpStage[] };

export function warpGroups(visited: Iterable<string>): WarpGroup[] {
  const seen = new Set<string>();
  const want = new Set([...visited].filter((k) => k in STAGES));
  const pick = (keys: string[]): WarpStage[] =>
    keys
      .filter((k) => want.has(k) && !seen.has(k))
      .map((k) => {
        seen.add(k);
        return { key: k, name: STAGE_SHORT[k] ?? STAGES[k]?.name ?? k };
      });

  const groups: WarpGroup[] = [{ label: "시작 마을", stages: pick(["village"]) }];
  LILACWORLD_CHAPTERS.forEach((c, i) => {
    const keys = [`${c.key}v`, ...Array.from({ length: c.stages }, (_, s) => `${c.key}x${s + 1}`)];
    groups.push({ label: `라일락 월드 ${i + 1}장 ${c.title}`, stages: pick(keys) });
  });
  for (const ch of CHAPTERS) {
    const keys = [`${ch.key}v`, ...Array.from({ length: 10 }, (_, s) => `${ch.key}${s + 1}`)];
    groups.push({ label: `제${ch.num}장 ${ch.title}`, stages: pick(keys) });
  }
  groups.push({ label: "재림의 땅", stages: pick(Array.from({ length: 15 }, (_, i) => `r${i + 1}`)) });
  groups.push({ label: "그 밖의 구역", stages: pick([...want]) });
  return groups.filter((g) => g.stages.length > 0);
}
