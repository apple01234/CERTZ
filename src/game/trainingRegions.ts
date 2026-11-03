/** Old map IDs remain valid for saves and equipment travel; their retired story does not. */
export const TRAINING_REGIONS: Record<string, string> = {
  forest: "숲길", kingdom: "늪지", alfheim: "정원", muspelheim: "화산",
  niflheim: "설원", cave: "동굴", nidavellir: "공방", hel: "폐허", abyss: "심층",
};
export function isTrainingStage(stage: string) {
  return Object.keys(TRAINING_REGIONS).some(key => new RegExp(`^${key}(?:v|[1-9]|10)$`).test(stage));
}
