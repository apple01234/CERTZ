"use client";

import { useEffect, useRef, useState } from "react";
import { createGame } from "@/game/PhaserGame";
import type Phaser from "phaser";
import { HUD } from "./HUD";
import { EventBus } from "./EventBus"; // v1.0.18 — 로비 개폐 이벤트
import { TouchControls } from "./TouchControls";
import { DialogueBox } from "./DialogueBox";
import { TitleScreen, Banner, BossBar, RotatePrompt, EndScreen, InteractPrompt, NamePanel, RewardPopup, GateCardOverlay, GateHud } from "./Overlays";
import { ServerConnect } from "./ServerConnect";
import { GamePanels } from "./Panels";
import { Lobby } from "./Lobby"; // v1.0.18 — 캐릭터 선택·생성 로비
import { UnionPanel } from "./UnionPanel"; // v1.0.18 — 유니온 패널
import { ChatBox } from "./ChatBox";
import { PartyWidget } from "./PartyWidget";
import { FriendsWidget } from "./FriendsWidget";
import { AuthPanel } from "./AuthPanel"; // v4.9.0 — 자체/SNS 계정 + 클라우드 세이브
import * as audio from "@/game/audio";
import { useGameUi } from "./useGameUi";
import { loadMuted, writeMuted } from "@/game/config";
import { installCrashGuard } from "./crashGuard"; // v1.0.20 — 크래시 가드 (검은 화면 → 복구 오버레이)

/**
 * 게임 루트: Phaser 캔버스 + React UI 오버레이의 합체점
 *  F3: 캔버스는 Scale.FIT으로 부모를 꽉 채우고, UI는 화면 크기에 반응
 */
export default function GameRoot() {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const { state, hud, quest, questLog, skills, dialogue, boss, banner, end, rpg, panel, setPanel } = useGameUi();
  /* v4.1.7 — 패널 개폐 UI음 (유니티 에셋스토어 유료 SFX): HUD 버튼 토글 클릭음 + 열림 사운드 */
  const togglePanelSfx = (key: "inv" | "job" | "stat" | "quest" | "boss" | "benefit" | "content" | "opt" | "union") => {
    audio.sfx.uiClick();
    const opening = panel !== key;
    setPanel(opening ? key : null);
    if (opening) audio.sfx.uiOpen();
  };
  // 클라이언트 전용 컴포넌트(ssr:false)라 localStorage 지연 초기화 안전 — 음소거 설정 복원
  const [muted, setMuted] = useState(() => loadMuted());
  const [portraitMobile, setPortraitMobile] = useState(false);
  /* v1.0.19 (A-2 반응형) — 가로 유도 프롬프트를 유저가 닫으면 세로로도 플레이 허용.
   *  기존엔 세로 모바일을 강제로 가렸지만(Scale.FIT이라 실제로는 플레이 가능) AC "375×812에서
   *  인게임 화면 표시"를 충족하려면 닫기 가능해야 한다. 회전하면 해제 상태 리셋. */
  const [rotateDismissed, setRotateDismissed] = useState(false);
  useEffect(() => {
    setRotateDismissed(false); // 회전/크기 변화 시 다시 유도
  }, [portraitMobile]);

  // 부팅 시 저장된 음소거/볼륨을 오디오 시스템에 적용 (v3.1.0 — BGM/SFX 개별 볼륨 복원)
  useEffect(() => {
    audio.loadVolumes();
    audio.setMuted(loadMuted());
  }, []);

  /* v1.0.20 — 크래시 가드: 미처리 예외가 검은 화면 대신 복구 오버레이를 띄우게 한다 */
  useEffect(() => {
    installCrashGuard();
  }, []);

  /* v3.0.22 (#40) — 퀘스트 창 기본 열림: 게임 시작 시 1회 자동 오픈.
   *  평소에는 열어두고, 유저가 직접 닫으면 그때부터 닫힌 상태를 유지한다 */
  const questAutoOpened = useRef(false);
  useEffect(() => {
    if (state === "playing" && !questAutoOpened.current) {
      questAutoOpened.current = true;
      setPanel("quest");
    }
  }, [state, setPanel]);

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

  /* v1.0.18 — 로비 (캐릭터 선택·생성) — 타이틀의 시작 버튼이 로비를 연다 */
  const [lobbyOpen, setLobbyOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setLobbyOpen(true);
    const onTitle = () => setLobbyOpen(false);
    EventBus.on("lobby:open", onOpen);
    EventBus.on("ui:title", onTitle);
    return () => {
      EventBus.off("lobby:open", onOpen);
      EventBus.off("ui:title", onTitle);
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
                canAutoHunt={rpg.canAutoHunt}
                autoHunt={rpg.autoHunt}
                onToggleMute={() => {
                  const next = !muted;
                  setMuted(next);
                  audio.setMuted(next);
                  writeMuted(next); // 설정 저장 — 새로고침/APK 재실행 후에도 유지
                }}
                onOpenInv={() => togglePanelSfx("inv")}
                onOpenJob={() => togglePanelSfx("job")}
                onOpenStat={() => togglePanelSfx("stat")}
                onOpenQuest={() => togglePanelSfx("quest")}
                onOpenBoss={() => togglePanelSfx("boss")}
                onOpenBenefit={() => togglePanelSfx("benefit")}
                onOpenContent={() => togglePanelSfx("content")}
                onOpenOpt={() => togglePanelSfx("opt")}
                onOpenUnion={() => togglePanelSfx("union")}
              />
            </div>
            {!panel && (
              <div className="pointer-events-auto contents">
                <TouchControls
                  skills={skills}
                  hpPot={rpg.hpPot}
                  mpPot={rpg.mpPot}
                  quickPots={rpg.quickPots}
                  potCount={(k) => (k === "potion_hp" ? rpg.hpPot : k === "potion_mp" ? rpg.mpPot : rpg.owned.filter((x) => x === k).length)}
                  atkName={skills.atkName}
                  s1Name={skills.s1Name}
                  s2Name={skills.s2Name}
                  s3Name={skills.s3Name}
                  s4Name={skills.s4Name}
                  s5Name={skills.s5Name}
                  canAutoHunt={rpg.canAutoHunt}
                  autoHunt={rpg.autoHunt}
                />
              </div>
            )}
            {/* 상호작용 프롬프트 — NPC 대화/상점 (E키·모바일 버튼 공용)
                v3.0.5 — TouchControls보다 위에 렌더링 (조이스틱 레이어가 칩을 덮는 문제 수정) */}
            {/* v3.0.16 — 퀘스트 보상 수령 팝업 (메이플식 보상 내역 창) */}
            <RewardPopup />
            {/* v4.0.0 — 이세카이 게이트 오버레이 (카드 선택/실버 상점 + 상단 게이트 HUD) */}
            <GateHud />
            <GateCardOverlay />
            <InteractPrompt />
            <Banner text={banner} />
            <BossBar boss={boss} />
            {/* 멀티플레이 전체 채팅 (v1.7) */}
            <ChatBox />
            {/* 파티 위젯 (v2.0 — 파티 & 보스 토벌) */}
            <PartyWidget />
            {/* 친구 위젯 (v2.1 — 친구코드·고유번호) */}
            <FriendsWidget />
            {/* 계정 위젯 (v4.9.0 — 자체 회원가입/로그인 + SNS 연동 + 클라우드 세이브) */}
            <AuthPanel />
          </>
        )}

        {state === "title" && (
          <div className="pointer-events-auto contents">
            <TitleScreen />
            {/* APK 전용 — 멀티플레이 서버 주소 설정 (웹에서는 미렌더링) */}
            <ServerConnect />
            {/* v1.0.18 — 캐릭터 선택·생성 로비 (타이틀 위에 표시) */}
            {lobbyOpen && <Lobby onExit={() => setLobbyOpen(false)} />}
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

        <GamePanels panel={panel} rpg={rpg} hud={hud} questLog={questLog} onClose={() => { audio.sfx.uiClose(); setPanel(null); }} />

        {/* v1.0.18 — 유니온 패널 (GamePanels 밖 — 스토어 직접 참조라 rpg 상태 불요) */}
        {panel === "union" && <UnionPanel onClose={() => { audio.sfx.uiClose(); setPanel(null); }} />}

        {/* v1.0.19 (A-2) — 가로 유지 프롬프트: 닫기 가능 (세로 플레이 허용) */}
        <RotatePrompt active={portraitMobile && !rotateDismissed} onDismiss={() => setRotateDismissed(true)} />

      </div>
    </div>
  );
}

