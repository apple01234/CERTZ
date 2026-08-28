"use client";

import { useEffect, useState } from "react";
import { EventBus, type HudState, type QuestState, type EndState, type RpgState, type PanelKind } from "./EventBus";

type Skills = { mp: number; s1Cd: number; s1Max: number; s2Cd: number; s2Max: number };

const emptyHud: HudState = {
  hp: 100, maxHp: 100, mp: 60, maxMp: 60, lv: 1, exp: 0, expNext: 60,
  gold: 30, atkTotal: 12, defTotal: 0, critRate: 8,
};
const emptyQuest: QuestState = { title: "", desc: "", current: 0, target: 0, distance: null };
const emptyRpg: RpgState = {
  gold: 30, hpPot: 2, mpPot: 1, owned: ["weapon_1", "armor_1"],
  weapon: "weapon_1", armor: "armor_1", accessory: null,
  upWea: 0, upArm: 0, nearShop: false,
  shopStock: [],
};

export function useGameUi() {
  const [state, setState] = useState<"boot" | "title" | "playing">("boot");
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [quest, setQuest] = useState<QuestState>(emptyQuest);
  const [skills, setSkills] = useState<Skills>({ mp: 60, s1Cd: 0, s1Max: 4000, s2Cd: 0, s2Max: 6000 });
  const [dialogue, setDialogue] = useState<{ speaker: string; lines: string[] } | null>(null);
  const [boss, setBoss] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [rpg, setRpg] = useState<RpgState>(emptyRpg);
  const [panel, setPanel] = useState<PanelKind>(null);

  useEffect(() => {
    const onHud = (v: HudState) => setHud(v);
    const onQuest = (v: QuestState) => setQuest(v);
    const onSkills = (v: Skills) => setSkills(v);
    const onDlgShow = (v: { speaker: string; lines: string[] }) => setDialogue(v);
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
    const onPanel = (v: { panel: PanelKind }) =>
      setPanel((cur) => (v.panel === "inv" ? (cur === "inv" ? null : "inv") : v.panel));

    EventBus.on("hud", onHud);
    EventBus.on("quest", onQuest);
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

    return () => {
      EventBus.off("hud", onHud);
      EventBus.off("quest", onQuest);
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
    };
  }, []);

  return { state, hud, quest, skills, dialogue, boss, banner, end, rpg, panel, setPanel };
}

export type { Skills };
