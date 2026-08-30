"use client";

import { useEffect, useRef, useState } from "react";
import { createGame } from "@/game/PhaserGame";
import type Phaser from "phaser";
import { HUD } from "./HUD";
import { TouchControls } from "./TouchControls";
import { DialogueBox } from "./DialogueBox";
import { TitleScreen, Banner, BossBar, RotatePrompt, EndScreen, InteractPrompt, NamePanel } from "./Overlays";
import { GamePanels } from "./Panels";
import { ChatBox } from "./ChatBox";
import { PartyWidget } from "./PartyWidget";
import * as audio from "@/game/audio";
import { useGameUi } from "./useGameUi";
import { loadMuted, writeMuted } from "@/game/config";

/**
 * 게임 루트: Phaser 캔버스 + React UI 오버레이의 합체점
 *  F3: 캔버스는 Scale.FIT으로 부모를 꽉 채우고, UI는 화면 크기에 반응
 */
export default function GameRoot() {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const { state, hud, quest, questLog, skills, dialogue, boss, banner, end, rpg, panel, setPanel } = useGameUi();
  // 클라이언트 전용 컴포넌트(ssr:false)라 localStorage 지연 초기화 안전 — 음소거 설정 복원
  const [muted, setMuted] = useState(() => loadMuted());
  const [portraitMobile, setPortraitMobile] = useState(false);

  // 부팅 시 저장된 음소거를 오디오 시스템에 적용 (BGM 재생 전 무음 유지)
  useEffect(() => {
    audio.setMuted(loadMuted());
  }, []);

  // Phaser 부팅 (1회)
  useEffect(() => {
    if (!parentRef.current || gameRef.current) return;
    gameRef.current = createGame(parentRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // 오디오는 첫 사용자 입력에서 초기화 (브라우저 정책)
  useEffect(() => {
    const init = () => audio.initAudio();
    window.addEventListener("pointerdown", init, { once: true });
    window.addEventListener("keydown", init, { once: true });
    return () => {
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
  }, []);

  // 모바일 세로 감지 → 가로 유도
  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setPortraitMobile(coarse && window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return (
    <div className="game-root fixed inset-0 select-none overflow-hidden bg-[#05070d]">
      {/* Phaser 캔버스가 들어갈 부모 — FIT 스케일이 이 영역을 채움 */}
      <div ref={parentRef} className="absolute inset-0 touch-none" aria-label="게임 화면" />

      {/* 오버레이 UI 레이어 */}
      <div className="pointer-events-none absolute inset-0">
        {state === "playing" && (
          <>
            <div className="pointer-events-auto contents">
              <HUD
                hud={hud}
                quest={quest}
                muted={muted}
                canJob={rpg.canJob}
                jobAvail={(rpg.canJob || rpg.cls !== null) && !panel} /* 클래스 보유 시 언제든 트리 열람·자유전직 */
                onToggleMute={() => {
                  const next = !muted;
                  setMuted(next);
                  audio.setMuted(next);
                  writeMuted(next); // 설정 저장 — 새로고침/APK 재실행 후에도 유지
                }}
                onOpenInv={() => setPanel(panel === "inv" ? null : "inv")}
                onOpenJob={() => setPanel(panel === "job" ? null : "job")}
                onOpenStat={() => setPanel(panel === "stat" ? null : "stat")}
                onOpenQuest={() => setPanel(panel === "quest" ? null : "quest")}
                onOpenOpt={() => setPanel(panel === "opt" ? null : "opt")}
              />
            </div>
            {/* 상호작용 프롬프트 — NPC 대화/상점 (E키·모바일 버튼 공용) */}
            <InteractPrompt />
            {!panel && (
              <div className="pointer-events-auto contents">
                <TouchControls skills={skills} hpPot={rpg.hpPot} mpPot={rpg.mpPot} />
              </div>
            )}
            <Banner text={banner} />
            <BossBar boss={boss} />
            {/* 멀티플레이 전체 채팅 (v1.7) */}
            <ChatBox />
            {/* 파티 위젯 (v2.0 — 파티 & 보스 토벌) */}
            <PartyWidget />
          </>
        )}

        {state === "title" && (
          <div className="pointer-events-auto contents">
            <TitleScreen />
          </div>
        )}

        {dialogue && (
          <div className="pointer-events-auto contents">
            <DialogueBox dialogue={dialogue} />
          </div>
        )}

        {end && (
          <div className="pointer-events-auto contents">
            <EndScreen end={end} />
          </div>
        )}

        {/* 인트로 이름 짓기 패널 */}
        <NamePanel />

        <GamePanels panel={panel} rpg={rpg} hud={hud} questLog={questLog} onClose={() => setPanel(null)} />

        <RotatePrompt active={portraitMobile} />
      </div>
    </div>
  );
}
