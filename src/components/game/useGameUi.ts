"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus, type HudState, type QuestState, type EndState, type RpgState, type PanelKind, type QuestLogState } from "./EventBus";
import { tutorialAllows, type TutorialUiState } from "@/game/tutorialFlow";

type Skills = { mp: number; s1Cd: number; s1Max: number; s2Cd: number; s2Max: number; s3Cd: number; s3Max: number; s4Cd: number; s4Max: number; s3Unlocked: boolean; s4Unlocked: boolean; s5Cd?: number; s5Max?: number; s5Unlocked?: boolean; atkName?: string; s1Name?: string; s2Name?: string; s3Name?: string; s4Name?: string; s5Name?: string; s1Icon?: string; s2Icon?: string; s3Icon?: string; s4Icon?: string; s5Icon?: string; s5bIcon?: string; s5bCd?: number; s5bMax?: number; s5bUnlocked?: boolean; s5bName?: string };

const emptyHud: HudState = {
  hp: 100, maxHp: 100, mp: 60, maxMp: 60, lv: 1, exp: 0, expNext: 60,
  gold: 30, atkTotal: 12, defTotal: 0, critRate: 8, cls: null,
  buffs: [], ap: 0, speed: 230,
};
const emptyQuest: QuestState = { title: "", desc: "", current: 0, target: 0, distance: null };
const emptyRpg: RpgState = {
  gold: 30, hpPot: 2, mpPot: 1, owned: ["weapon_1", "armor_1"],
  weapon: "weapon_1", armor: "armor_1", accessories: [], emerald: 0,
  upWea: 0, upArm: 0, nearShop: false,
  shopStock: [], cls: null, canJob: false,
  buffItems: {}, pets: [], pet: null, cosmetics: [], cosmetic: null,
  stats: { str: 5, dex: 5, int: 5, luk: 5 }, ap: 0,
  autoHunt: false, canAutoHunt: false,
  autoAlloc: false, quickPots: { hp: "potion_hp", mp: "potion_mp" },
  potentials: {}, eertCube: 0, unlockedSets: [],
};
const emptyQuestLog: QuestLogState = { stageName: "", list: [], repeat: null };

export function useGameUi() {
  const [state, setState] = useState<"boot" | "title" | "playing">("boot");
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [quest, setQuest] = useState<QuestState>(emptyQuest);
  const [skills, setSkills] = useState<Skills>({ mp: 60, s1Cd: 0, s1Max: 4000, s2Cd: 0, s2Max: 6000, s3Cd: 0, s3Max: 9000, s4Cd: 0, s4Max: 14000, s3Unlocked: false, s4Unlocked: false, s5Cd: 0, s5Max: 60000, s5Unlocked: false });
  /* vc143 (#10) — choices: 선택형 대화(보스전 퇴장 관리인 등) — DialogueBox가 버튼 렌더 */
  const [dialogue, setDialogue] = useState<{ speaker: string; lines: string[]; choices?: { label: string; id: string }[] } | null>(null);
  const [boss, setBoss] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [rpg, setRpg] = useState<RpgState>(emptyRpg);
  const [panel, setPanelState] = useState<PanelKind>(null);
  const [cinematic, setCinematic] = useState(false);
  const [tutorial, setTutorial] = useState<TutorialUiState>({ active: false, step: null });
  const uiGate = useRef({ cinematic: false, tutorial: { active: false, step: null } as TutorialUiState });
  const [questLog, setQuestLog] = useState<QuestLogState>(emptyQuestLog);

  // 이벤트 요청과 React 버튼 모두 현재 컷씬/실습의 동일한 제한을 따른다.
  const canOpenPanel = useCallback((next: PanelKind) => {
    if (!next) return true;
    const gate = uiGate.current;
    return !gate.cinematic && (!gate.tutorial.active || gate.tutorial.step === null
      || tutorialAllows(gate.tutorial.step, next));
  }, []);
  const setPanel = useCallback((next: PanelKind) => {
    if (canOpenPanel(next)) setPanelState(next);
  }, [canOpenPanel]);

  useEffect(() => {
    const onHud = (v: HudState) => setHud(v);
    const onQuest = (v: QuestState) => setQuest(v);
    const onQuestLog = (v: QuestLogState) => setQuestLog(v);
    const onSkills = (v: Skills) => setSkills(v);
    /* vc211 (#표정연동) — expr/exprByLine 이 있으면 그대로 전달한다.
     *  없으면 DialogueBox 가 문장에서 자동 추론하므로 여기서는 통과만 시킨다. */
    const onDlgShow = (v: {
      speaker: string;
      lines: string[];
      choices?: { label: string; id: string }[];
      expr?: "neutral" | "happy" | "angry";
      exprByLine?: ("neutral" | "happy" | "angry")[];
    }) => setDialogue(v);
    const onDlgHide = () => setDialogue(null);
    const onBossShow = (v: { name: string; hp: number; maxHp: number }) => setBoss(v);
    const onBossUpdate = (v: { hp: number; maxHp: number }) =>
      setBoss((b) => (b ? { ...b, ...v } : b));
    const onBossHide = () => setBoss(null);
    const onBanner = (v: { text: string }) => {
      setBanner(v.text);
      window.setTimeout(() => setBanner(null), 2300);
    };
    const onTitle = () => {
      uiGate.current = { cinematic: false, tutorial: { active: false, step: null } };
      setCinematic(false);
      setTutorial({ active: false, step: null });
      setState("title");
      setBoss(null);
      setEnd(null);
      setPanel(null);
    };
    const onPlaying = () => setState("playing");
    const onEnd = (v: EndState) => {
      setEnd(v);
      setPanel(null);
    };
    const onRespawn = () => setEnd(null);
    const onRpg = (v: RpgState) => setRpg(v);
    const onPanel = (v: { panel: PanelKind }) => {
      if (canOpenPanel(v.panel)) {
        setPanelState((cur) => (v.panel === "inv" ? (cur === "inv" ? null : "inv") : v.panel));
      }
    };
    const onCinematic = (v?: { active?: boolean }) => {
      const active = !!v?.active;
      uiGate.current.cinematic = active;
      setCinematic(active);
      // 패널의 키보드 리스너가 대사 키를 소비하지 않도록 컷씬 진입 시 닫는다.
      if (active) setPanelState(null);
    };
    const onTutorial = (v: TutorialUiState) => {
      uiGate.current.tutorial = v;
      setTutorial(v);
      setPanelState((cur) => canOpenPanel(cur) ? cur : null);
    };

    EventBus.on("hud", onHud);
    EventBus.on("quest", onQuest);
    EventBus.on("questlog", onQuestLog);
    EventBus.on("skills", onSkills);
    EventBus.on("dialogue:show", onDlgShow);
    EventBus.on("dialogue:hide", onDlgHide);
    EventBus.on("boss:show", onBossShow);
    EventBus.on("boss:update", onBossUpdate);
    EventBus.on("boss:hide", onBossHide);
    EventBus.on("banner:show", onBanner);
    EventBus.on("ui:title", onTitle);
    EventBus.on("ui:playing", onPlaying);
    EventBus.on("end", onEnd);
    EventBus.on("respawn", onRespawn);
    EventBus.on("rpg:state", onRpg);
    EventBus.on("ui:panel", onPanel);
    EventBus.on("cinematic:state", onCinematic);
    EventBus.on("tut:state", onTutorial);

    return () => {
      EventBus.off("hud", onHud);
      EventBus.off("quest", onQuest);
      EventBus.off("questlog", onQuestLog);
      EventBus.off("skills", onSkills);
      EventBus.off("dialogue:show", onDlgShow);
      EventBus.off("dialogue:hide", onDlgHide);
      EventBus.off("boss:show", onBossShow);
      EventBus.off("boss:update", onBossUpdate);
      EventBus.off("boss:hide", onBossHide);
      EventBus.off("banner:show", onBanner);
      EventBus.off("ui:title", onTitle);
      EventBus.off("ui:playing", onPlaying);
      EventBus.off("end", onEnd);
      EventBus.off("respawn", onRespawn);
      EventBus.off("rpg:state", onRpg);
      EventBus.off("ui:panel", onPanel);
      EventBus.off("cinematic:state", onCinematic);
      EventBus.off("tut:state", onTutorial);
    };
  }, [canOpenPanel, setPanel]);

  return { state, hud, quest, questLog, skills, dialogue, boss, banner, end, rpg, panel, setPanel, canOpenPanel, cinematic, tutorial };
}

export type { Skills };
