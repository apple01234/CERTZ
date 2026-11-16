/** Art bindings only: stable enemy IDs still own stats, quests, drops and saves. */
export const STORY_ENEMY_ROLES = {
  thought: { name: "사념체", canon: "1.txt:84-137" },
  dokkaebi: { name: "도깨비 산적", canon: "2.txt:35-45" },
  deckhand: { name: "저주받은 선원", canon: "2.txt:59-71" },
  virus: { name: "우주의 감염체", canon: "8.txt:37-65" },
  drone: { name: "전투 드론", canon: "8.txt:173-196" },
  robot: { name: "전투 로봇", canon: "8.txt:173-245" },
  jadeclone: { name: "제이드의 에너지 분신", canon: "8.txt:131-140" },
} as const;
export type StoryEnemyRole = keyof typeof STORY_ENEMY_ROLES;
export const STORY_ENEMY_TEXTURES = Object.keys(STORY_ENEMY_ROLES).map(role => `storymob_${role}`);

export function storyEnemyRole(stage: string, key: string): StoryEnemyRole | null {
  const lilac = /^lilacworld(\d+)x(\d+)$/.exec(stage);
  if (lilac) {
    const ch = Number(lilac[1]), sub = Number(lilac[2]);
    if (ch === 2 || (ch === 6 && sub === 3) || (ch >= 7 && ch <= 14)) return "thought";
    if (ch === 3 && sub <= 2) return "dokkaebi";
    if (ch === 5) return "deckhand";
  }
  if (/^dlcstargate\d+$/.test(stage)) return "virus";
  if (/^dlcprisma\d+$/.test(stage)) return key === "runegolem" ? "jadeclone" : "robot";
  if (/^dlcreverse\d+$/.test(stage)) return ["minion", "wraith", "x2_bat", "ll_flyingeye"].includes(key) ? "drone" : "robot";
  return null;
}
