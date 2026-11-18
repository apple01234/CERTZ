/** Art bindings only: stable enemy IDs still own stats, quests, drops and saves. */
import type { EnemyProfile } from "./stages";
export const STORY_ENEMY_ROLES = {
  thought: { name: "사념체", canon: "1.txt:84-137" },
  dokkaebi: { name: "도깨비 산적", canon: "2.txt:35-45" },
  deckhand: { name: "저주받은 선원", canon: "2.txt:109-110" },
  virus: { name: "우주의 감염체", canon: "8.txt:37-65" },
  drone: { name: "전투 드론", canon: "8.txt:173-196" },
  robot: { name: "전투 로봇", canon: "8.txt:173-245" },
  jadeclone: { name: "제이드의 에너지 분신", canon: "8.txt:131-140" },
} as const;
export type StoryEnemyRole = keyof typeof STORY_ENEMY_ROLES;
export const STORY_ENEMY_TEXTURES = Object.keys(STORY_ENEMY_ROLES).map(role => `storymob_${role}`);

/** Shape/text accompany color so shared faction art still communicates the actual attack. */
export function storyEnemyStyle(profile?: EnemyProfile): { label: string; mark: string; color: string } {
  if (profile?.ranged) return { label: "원거리", mark: "◎", color: "#a6dcff" };
  if (profile?.charge) return { label: "돌진", mark: "▲", color: "#ffd09a" };
  if (profile?.apply?.kind === "poison" || profile?.fieldOnDeath?.kind === "poison") return { label: "맹독", mark: "✚", color: "#b6f58a" };
  return { label: "근접", mark: "◆", color: "#f2d7c7" };
}

export function storyEnemyRole(stage: string, key: string): StoryEnemyRole | null {
  const lilac = /^lilacworld(\d+)x(\d+)$/.exec(stage);
  if (lilac) {
    const ch = Number(lilac[1]), sub = Number(lilac[2]);
    if (ch === 7 && sub === 2) return "deckhand";
    if (ch === 2 || ch === 5 || (ch === 6 && sub === 3) || (ch >= 7 && ch <= 14)) return "thought";
    if (ch === 3 && sub <= 2) return "dokkaebi";
  }
  if (/^dlcstargate\d+$/.test(stage)) return "virus";
  if (/^dlcprisma\d+$/.test(stage)) return key === "runegolem" ? "jadeclone" : "robot";
  if (/^dlcreverse\d+$/.test(stage)) return ["minion", "wraith", "x2_bat", "ll_flyingeye"].includes(key) ? "drone" : "robot";
  return null;
}
