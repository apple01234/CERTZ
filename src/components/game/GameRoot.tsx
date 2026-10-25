"use client";

import { useEffect, useRef, useState } from "react";
import { createGame } from "@/game/PhaserGame";
import type Phaser from "phaser";
import { HUD } from "./HUD";
import { EventBus } from "./EventBus"; // v1.0.18 — 로비 개폐 이벤트
import { TouchControls } from "./TouchControls";
import { DialogueBox } from "./DialogueBox";
import { TitleScreen, Banner, BossBar, RotatePrompt, EndScreen, InteractPrompt, NamePanel, RewardPopup, GateCardOverlay, GateHud, ExitMenuOverlay, FeatureTutorialOverlay } from "./Overlays";
// v1.4.24 — ServerConnect 제거 (#멀티정리 — 서버주소 설정창 철거)
// import { ServerConnect } from "./ServerConnect";
import { GamePanels, stashPlayerInfo } from "./Panels";
import { Lobby } from "./Lobby"; // v1.0.18 — 캐릭터 선택·생성 로비
import { UnionPanel } from "./UnionPanel"; // v1.0.18 — 유니온 패널
// v1.4.27-w1 (#멀티릴레이) — ChatBox/PartyWidget 복원: socket.io 대신 서버리스 릴레이(net.ts 위임)로 동작.
// ServerConnect(서버주소 설정창)는 철거 유지 — 릴레이는 별도 설정 불필요.
import { ChatBox } from "./ChatBox";
import { PartyWidget } from "./PartyWidget";
/* v1.4.30 (#9 클래스룸) — 수업용 대규모 협동 미니게임 (MQTT 합산 — 서버 불필요) */
import { ClassroomPanel } from "./ClassroomPanel";
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
  const togglePanelSfx = (key: "inv" | "job" | "stat" | "quest" | "boss" | "benefit" | "content" | "opt" | "union" | "trade" | "rank" | "guide") => { // v1.3.0 — +rank · v1.4.12 — +guide
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
   *  인게임 화면 표시"를 충족하려면 닫기 가능해야 한다. **회전하면 해제 상태를 리셋**한다.
   *  v1.0.16 (R5) — 종전엔 effect에서 setRotateDismissed(false)로 리셋했는데 React 19 lint가
   *  지적하는 "effect 불필요" 패턴이었다. React 문서가 권하는 **렌더 중 상태 조정**으로 바꾼다.
   *  (orientation 값만 기억하는 방식은 틀렸다 — 세로에서 닫은 뒤 다시 세로로 오면 여전히
   *   그 값과 일치해 영구히 억제된다. '전환'을 감지해야 하므로 이전 값과 비교한다.) */
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const [prevPortrait, setPrevPortrait] = useState(portraitMobile);
  if (prevPortrait !== portraitMobile) {
    setPrevPortrait(portraitMobile);
    setRotateDismissed(false); // 회전/크기 변화 시 다시 유도
  }
  /* v1.2.1 (#6) — 메뉴 나가기 확인 오버레이 (HUD ☰ 버튼) */
  const [exitMenuOpen, setExitMenuOpen] = useState(false);

  // 부팅 시 저장된 음소거/볼륨을 오디오 시스템에 적용 (v3.1.0 — BGM/SFX 개별 볼륨 복원)
  useEffect(() => {
    audio.loadVolumes();
    audio.setMuted(loadMuted());
    /* v1.1.4 (#개편 접근성) — 저장된 UI 확대 비율을 부팅 시 복원.
     *  설정에서 슬라이더를 움직일 때만 적용하면 새로고침 후 초기화되므로
     *  여기서 루트 폰트 크기를 한 번 더 맞춘다. */
    try {
      const v = parseInt(window.localStorage.getItem("sertz_ui_zoom") ?? "", 10);
      if (!Number.isNaN(v)) {
        document.documentElement.style.fontSize = `${Math.min(140, Math.max(100, v))}%`;
      }
      // v1.1.6 (#개편 B77) — 고대비 모드 복원
      if (window.localStorage.getItem("sertz_contrast") === "high") {
        document.documentElement.setAttribute("data-contrast", "high");
      }
    } catch { /* 저장값 없음/차단 — 기본 100% 유지 */ }
  }, []);

  /* v1.1.6 (#개편 C39) — 세이브 저장 실패 경고.
   *  writeSave가 실패하면 이벤트가 오고, 여기서 배너로 알린다.
   *  같은 경고가 반복되지 않도록 세션당 1회만 띄운다(스테이지 전환마다 저장이 불리므로). */
  const [saveWarn, setSaveWarn] = useState<string | null>(null);
  useEffect(() => {
    let shown = false;
    const onFail = (e: Event) => {
      if (shown) return;
      shown = true;
      const quota = !!(e as CustomEvent<{ quota?: boolean }>).detail?.quota;
      setSaveWarn(
        quota
          ? "저장 공간이 가득 찼습니다 — 진행이 저장되지 않고 있어요. 브라우저 데이터를 정리한 뒤 다시 시도해 주세요."
          : "진행 저장에 실패했습니다 — 잠시 후 다시 시도해 주세요. 계속 실패하면 설정에서 클라우드 백업을 사용하세요.",
      );
      setTimeout(() => setSaveWarn(null), 12000);
    };
    window.addEventListener("sertz:save-failed", onFail);
    return () => window.removeEventListener("sertz:save-failed", onFail);
  }, []);

  /* v1.1.6 (#개편 C62) — 안드로이드 하드웨어 뒤로가기 처리.
   *  @capacitor/app 플러그인이 없어 네이티브 이벤트를 직접 받을 수 없으므로,
   *  히스토리 엔트리를 하나 밀어두고 popstate를 가로채는 웹 표준 방식을 쓴다.
   *  뒤로가기를 누르면 앱이 즉시 종료되는 대신 "메뉴로 나갈까요?" 확인을 띄운다.
   *  (APK WebView에서도 popstate는 동일하게 동작한다.) */
  useEffect(() => {
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      try { window.history.pushState({ sertz: "guard" }, ""); } catch { /* 히스토리 불가 환경 */ }
    };
    arm();
    const onPop = () => {
      // 뒤로가기가 소비됨 — 확인 메뉴를 띄우고 가드를 다시 건다.
      armed = false;
      setExitMenuOpen(true);
      arm();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* v1.0.20 — 크래시 가드: 미처리 예외가 검은 화면 대신 복구 오버레이를 띄우게 한다 */
  useEffect(() => {
    installCrashGuard();
  }, []);

  /* v1.1.0 (#10) — 퀘스트 로그 "게임 시작 시 자동 오픈" 제거 (v3.0.22 #40 로직 폐기).
   *  유저 지시: "컨텐츠마다 NPC UI가 있는 버그 — 작동도 안 하니 없애라".
   *  매 진입마다 퀘스트 로그 패널이 자동으로 떠서 NPC 팝업처럼 보이던 것이 원인.
   *  이제 우상단 퀘스트 버튼/J키로 필요할 때만 연다 (트래커 on/off 버튼은 #2로 신설) */

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

  /* v1.0.13 피드백#12 — 상대 정보창: WorldScene이 쏜 ui:playerInfo(payload)를
   *  패널 라우팅(playerinfo)으로 변환 (trade2와 동일한 ui:panel 패턴).
   *  페이로드는 stash 후 패널이 마운트되며 복원 — 이벤트→마운트 순서 문제 회피. */
  useEffect(() => {
    const onInfo = (v: unknown) => {
      stashPlayerInfo(v);
      setPanel("playerinfo");
    };
    EventBus.on("ui:playerInfo", onInfo);
    return () => {
      EventBus.off("ui:playerInfo", onInfo);
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
                  audio.sfx.uiClick(); // v1.4.8 — 토글 피드백음 (뮤트 전 재생 → 켜기 시 바로 들림)
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
                onOpenTrade={() => togglePanelSfx("trade")} /* v1.2.0 (#2) — 거래소 직접 진입 */
                onOpenRank={() => togglePanelSfx("rank")} /* v1.3.0 (#7) — 랭킹창 */
                onOpenGuide={() => togglePanelSfx("guide")} /* v1.4.12 (#16) — 이그니의 UI 기능 안내 */
                /* v1.3.0 (#2) — onOpenMenu 제거: HUD ☰ 버튼 삭제, 메뉴 나가기는 설정 패널로 */
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
                  s5bName={skills.s5bName}
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
            {/* v1.4.27-w1 (#멀티릴레이) — 채팅/파티 UI 복원: 소켓 없는 ②안 배포에서도
             *  HTTP 릴레이(/api/chat·/api/party 폴링)로 실제 동작한다 (net.ts 위임).
             *  멀티 아이콘·ServerConnect는 철거 유지 — 파티는 더보기 메뉴/Y키. */}
            <ChatBox />
            <PartyWidget />
            {/* v1.4.30 (#9) — 클래스룸 (교실 모드·더보기/L키) */}
            <ClassroomPanel />
            {/* 친구 위젯 (v2.1 — 친구코드·고유번호) */}
            <FriendsWidget />
            {/* 계정 위젯 (v4.9.0 — 자체 회원가입/로그인 + SNS 연동 + 클라우드 세이브) */}
            <AuthPanel />
          </>
        )}

        {state === "title" && (
          <div className="pointer-events-auto contents">
            <TitleScreen />
            {/* v1.4.24 — 서버주소 설정창 제거 (#멀티정리): 멀티서버 중단으로 무용 + "서버주소 = https://sertz.vercel.app/" 표시 보고의 근원이던 UI. 멀티 재개 시 복원.
            <ServerConnect /> */}
            {/* vc147 (#20) — 게임 시작 화면부터 로그인: 타이틀에서 계정 로그인/회원가입 가능.
               로그인하면 클라우드 세이브 자동 백업(90초)이 즉시 시작되고 랭킹에도 등록된다. */}
            <AuthPanel />
            {/* v1.0.13 피드백#9 — 로비가 열려 있으면 버튼 숨김: z-[60] 버튼이 Lobby(z-40) 위로
               떠서 로비 화면 좌상단에 떠 있던 버그. (z-[60] 자체는 타이틀 스크롤 오버레이
               z-40 대응에 필요 — 유지) */}
            {!lobbyOpen && (
              <button
                onClick={() => EventBus.emit("ui:authOpen", {})}
                aria-label="계정 로그인"
                /* vc153 (#신규7) — z-30 → z-[60]: 타이틀 스크롤 오버레이(sertz-scroll z-40)가 버튼을 덮어
                 *  클릭이 전부 오버레이로 흡수돼 "로그인&회원가입 버튼 클릭안됨"(= 123456 로그인 안됨으로 체감) 버그.
                 *  실측 elementsFromPoint: BUTTON(z-30) 위에 DIV.sertz-scroll(z-40)이 깔려 클릭 도달 불능이었다. */
                className="absolute left-2 top-2 z-[60] flex h-9 items-center gap-1.5 rounded-lg border-2 border-amber-200/50 bg-slate-900/85 px-2.5 text-[12px] font-black text-amber-100 shadow-lg transition active:scale-95 hover:border-amber-200/90 sm:left-3 sm:top-3"
              >
                🔑 로그인 / 계정
              </button>
            )}
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
        <FeatureTutorialOverlay />

        <GamePanels panel={panel} rpg={rpg} hud={hud} questLog={questLog} onClose={() => { audio.sfx.uiClose(); setPanel(null); }} />

        {/* v1.0.18 — 유니온 패널 (GamePanels 밖 — 스토어 직접 참조라 rpg 상태 불요) */}
        {panel === "union" && <UnionPanel onClose={() => { audio.sfx.uiClose(); setPanel(null); }} />}

        {/* v1.0.19 (A-2) — 가로 유지 프롬프트: 닫기 가능 (세로 플레이 허용) */}
        <RotatePrompt active={portraitMobile && !rotateDismissed} onDismiss={() => setRotateDismissed(true)} />

        {/* v1.1.6 (#개편 C39) — 세이브 저장 실패 경고. 놓치면 진행이 날아가므로
            화면 하단에 고정하고 12초간 유지한다(탭하면 닫힘). */}
        {saveWarn && (
          <div
            role="alert"
            className="pointer-events-auto absolute inset-x-2 bottom-2 z-[70] mx-auto max-w-[560px] cursor-pointer rounded-lg border border-rose-400/60 bg-rose-950/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            onClick={() => setSaveWarn(null)}
          >
            <p className="text-[12px] font-black text-rose-100">⚠ 저장 경고</p>
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-rose-100/85">{saveWarn}</p>
          </div>
        )}

        {/* v1.2.1 (#6) — 메뉴 나가기 확인 (캐릭터 선택/게임 시작 화면) */}
        <ExitMenuOverlay open={exitMenuOpen} onClose={() => setExitMenuOpen(false)} />

      </div>
    </div>
  );
}

