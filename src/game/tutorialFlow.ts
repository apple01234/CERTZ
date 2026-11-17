/** The existing tutorial owns progress; these values also gate keyboard, touch and panels. */
export const TUTORIAL_VERSION = 2;
export const TUTORIAL_STEPS = [
  { id: "opening", title: "절벽의 약속", desc: "라일락의 이야기를 듣고 대답하세요." },
  { id: "move", title: "첫걸음", desc: "목표 표시를 따라 걸어가세요." },
  { id: "talk", title: "라일락과의 약속", desc: "라일락에게 다가가 말을 거세요." },
  { id: "training", title: "레지스터의 수련", desc: "약속을 품고 기초 수련을 시작합니다." },
  { id: "attack", title: "검을 맞히기", desc: "수련 표적 가까이에서 표적을 향해 공격하세요." },
  { id: "evade", title: "공격 예고 피하기", desc: "수련용 쥐에게 다가가 공격 예고를 기다리세요." },
  { id: "skill", title: "기본 검술", desc: "가까이에서 수련 표적에 첫 스킬을 맞히세요." },
  { id: "pickup", title: "수련 보급품", desc: "물약 위를 걸어가면 자동으로 주워요." },
  { id: "inventory", title: "가방 확인", desc: "가방에서 물약을 확인하고 닫으세요." },
  { id: "accept", title: "첫 의뢰", desc: "레지스터와 대화한 뒤 ‘의뢰 받기’를 선택하세요." },
  { id: "mission", title: "의뢰 수행", desc: "수련용 쥐 한 마리를 처치하세요." },
  { id: "reward", title: "수련 보고", desc: "레지스터에게 돌아가 보상을 받으세요." },
  { id: "ending", title: "모험의 시작", desc: "배운 것을 가지고 자유롭게 모험하세요." },
] as const;
export type TutorialStepId = typeof TUTORIAL_STEPS[number]["id"];
export type TutorialUiState = { active: boolean; step: TutorialStepId | null };
export type TutorialSave = { tutorialVersion?: number; tutorialDone?: boolean; tutStep?: number; introSeen?: boolean };
const actions: Record<TutorialStepId, readonly string[]> = {
  opening: [], move: ["move", "dash"], talk: ["move", "dash", "interact"], training: [],
  attack: ["move", "dash", "attack"], evade: ["move", "dash"], skill: ["move", "dash", "skill1"], pickup: ["move", "dash"],
  inventory: ["move", "dash", "inv"], accept: ["move", "dash", "interact"],
  mission: ["move", "dash", "attack", "skill1", "quest"], reward: ["move", "dash", "interact", "quest"], ending: [],
};
export function tutorialAllows(step: TutorialStepId | null, action: string): boolean {
  return step === null || ["close", "skip", "choice"].includes(action) || actions[step].includes(action);
}
export function tutorialResume(save?: TutorialSave | null): number | null {
  if (save?.tutorialDone) return null;
  if (save?.tutorialVersion === TUTORIAL_VERSION) return Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Math.floor(Number.isFinite(save.tutStep) ? save.tutStep! : 0)));
  // Legacy saves never get forced back into the opening. Explicitly fresh characters do.
  return !save || save.introSeen === false ? 0 : null;
}
export function tutorialStage(step: number): string {
  return step < 3 ? "lilacworld1x1" : "lilacworld1x2";
}
