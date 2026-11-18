/**
 * 2026-11-18 — 지역 이동 부적 목록.
 *
 * 버그: WarpPanel 이 `village`·`CHAPTERS`의 `장+번호`·`r1~15` 만 나열했다.
 * 현재 본편(라일락 월드)의 구역 키는 `lilacworldNxM`, 챕터 마을은 `…v` 라서
 * 방문 기록이 있어도 목록이 비고, 부적을 써도 갈 곳을 고를 수 없었다.
 *
 * 수정: 방문 기록에서 실제로 존재하는 구역(STAGES)을 전부 모은다. 알려진 묶음
 * (마을 → 라일락 월드 장 → 기존 장 → 재림) 순서로 나누고, 어디에도 안 들어간 구역은
 * "그 밖의 구역"에 넣어 다시는 조용히 빠지지 않게 한다.
 */
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
    const keys = Array.from({ length: c.stages }, (_, s) => `${c.key}x${s + 1}`);
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
