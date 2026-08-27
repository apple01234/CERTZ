"use client";

import { useEffect, useRef, useState } from "react";
import { createGame } from "@/game/PhaserGame";
import type Phaser from "phaser";
import { useGameUi } from "./useGameUi";
import { HUD } from "./HUD";
import { TouchControls } from "./TouchControls";
import { DialogueBox } from "./DialogueBox";
import { TitleScreen, Banner, BossBar, RotatePrompt, EndScreen } from "./Overlays";
import * as audio from "@/game/audio";

/**
 * 게임 루트: Phaser 캔버스 + React UI 오버레이의 합체점
 *  F3: 캔버스는 Scale.FIT으로 부모를 꽉 채우고, UI는 화면 크기에 반응
 */
export default function GameRoot() {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const { state, hud, quest, skills, dialogue, boss, banner, end } = useGameUi();
  const [muted, setMuted] = useState(false);
  const [portraitMobile, setPortraitMobile] = useState(false);

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
                onToggleMute={() => {
                  const next = !muted;
                  setMuted(next);
                  audio.setMuted(next);
                }}
              />
            </div>
            <div className="pointer-events-auto contents">
              <TouchControls skills={skills} />
            </div>
            <Banner text={banner} />
            <BossBar boss={boss} />
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

        <RotatePrompt active={portraitMobile} />
      </div>
    </div>
  );
}
