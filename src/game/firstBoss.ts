/** First story encounter: the starting sword and unspent AP are a supported lower bound. */
export const FIRST_DIO = {
  hp: 3600, atk: 24, def: 8, defPct: .05, speed: 82,
  chargeWarningMs: 1200, chargeSpeed: 360, recoveryMs: 2000, summonCap: 2,
} as const;
export function isFirstDio(stage: string, boss: string, storyEncounter: boolean): boolean {
  return storyEncounter && stage === "lilacworld2x3" && boss === "dio";
}
