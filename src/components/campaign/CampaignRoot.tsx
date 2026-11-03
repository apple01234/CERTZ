"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Crown,
  Download,
  Flag,
  FolderArchive,
  Heart,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Users,
  X,
} from "./PixelIcons";
import { io, type Socket } from "socket.io-client";
import { EventBus } from "@/components/game/EventBus";
import {
  authGoogle,
  consumeAuthTokenFromHash,
  authLogin,
  authRegister,
  authLogout,
  authMe,
  getAuthToken,
  type AuthUser,
} from "@/game/account";
import { googleWebSignIn, googleWebRedirectToken } from "@/lib/googleAuth";
import { resolveApiBase } from "@/game/server";
import {
  ACT_NAMES,
  CAMPAIGN_ID,
  CAMPAIGN_TITLE,
  CHAPTERS,
  COSMETICS,
  FAMILIES,
  PAID_PRODUCTS,
  type Family,
  type DialogueLine,
} from "@/game/campaign/catalog";
import {
  advance,
  currentChapter,
  currentObjective,
  newCampaign,
  parseCampaign,
  unlocked,
  type CampaignProgress,
} from "@/game/campaign/progress";
import {
  savePendingReceipt,
  readPendingReceipt,
  clearPendingReceipt,
  readSlots,
  writeSlots,
  putCharacter,
  legacyArchive,
  type CampaignSlots,
} from "@/game/campaign/storage";
import { mountCampaign, type CampaignViewState } from "@/game/campaign/Scene";
import { OathAudio } from "@/game/campaign/audio";
import { FAMILY_ART, guideArt, portraitSource } from "@/game/campaign/assets";
import { purchaseCosmetic, restoreCosmetics } from "@/game/campaign/purchases";
import type { Battle, BattleInput } from "@/game/campaign/battle";
import type {
  CampaignAccount,
  CampaignListing,
  CampaignRecord,
} from "@/lib/campaignStore";
import "./campaign.css";
type Panel = "journal" | "wardrobe" | "online" | "settings" | null;
type Room = {
  code: string;
  chapterId: string;
  mode: "solo" | "coop";
  started: boolean;
  leader: string;
  members: { id: string; name: string; online: boolean }[];
};
type Cloud = {
  account: CampaignAccount | null;
  listings: (CampaignListing & { mine: boolean })[];
  records: CampaignRecord[];
  onlineReady: boolean;
  purchasesReady: boolean;
  realtimeUrl?: string | null;
};
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Portrait({
  family = "warrior",
  size = 48,
  tint,
  art,
}: {
  family?: Family;
  size?: number;
  tint?: number;
  art?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="oath-portrait"
      style={{
        width: size,
        height: size,
        backgroundImage: `url('${portraitSource(art ?? FAMILY_ART[family])}')`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        ...(tint
          ? { filter: `drop-shadow(0 0 6px #${tint.toString(16)})` }
          : {}),
      }}
    />
  );
}
export default function CampaignRoot() {
  const [slots, setSlots] = useState<CampaignSlots>(() => readSlots());
  const [progress, setProgress] = useState<CampaignProgress>(() => {
    const s = readSlots();
    return (
      s.characters.find((p) => p.characterId === s.activeId) ??
      newCampaign("여행자", "warrior", "preview00")
    );
  });
  const progressRef = useRef(progress),
    slotsRef = useRef(slots);
  progressRef.current = progress;
  slotsRef.current = slots;
  const [playing, setPlaying] = useState(false),
    [panel, setPanel] = useState<Panel>(null),
    [name, setName] = useState(""),
    [family, setFamily] = useState<Family>("warrior");
  const [view, setView] = useState<CampaignViewState>({
      nearby: null,
      battle: null,
      hint: "",
    }),
    [dialogue, setDialogue] = useState<{
      lines: DialogueLine[];
      index: number;
      done: () => void;
    } | null>(null);
  const [log, setLog] = useState<DialogueLine[]>([]),
    [showLog, setShowLog] = useState(false),
    [auto, setAuto] = useState(false),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null),
    [loginId, setLoginId] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [cloud, setCloud] = useState<Cloud | null>(null);
  const [room, setRoom] = useState<Room | null>(null),
    [joinCode, setJoinCode] = useState(""),
    [onlineBattle, setOnlineBattle] = useState<Battle | null>(null),
    [receipt, setReceipt] = useState<string | null>(null),
    [challenge, setChallenge] = useState(CHAPTERS.find((c) => c.boss)!.id);
  const socket = useRef<Socket | null>(null),
    host = useRef<HTMLDivElement>(null),
    dialogueRef = useRef(dialogue);
  dialogueRef.current = dialogue;
  const music = useRef<OathAudio | null>(null);
  const [volume, setVolume] = useState(0.12);
  const [saveError, setSaveError] = useState(false);
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const chapter = currentChapter(progress),
    objective = currentObjective(progress),
    done = !objective,
    paused = !playing || !!dialogue || !!panel || showLog;
  const inBattle = !!(onlineBattle ?? view.battle);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const commit = useCallback((next: CampaignProgress) => {
    const nextSlots = putCharacter(next, slotsRef.current);
    try {
      writeSlots(nextSlots);
      setSaveError(false);
    } catch {
      setSaveError(true);
      setNotice("기기 저장에 실패했습니다. 설정에서 저장 파일을 내보내세요.");
    }
    slotsRef.current = nextSlots;
    progressRef.current = next;
    setSlots(nextSlots);
    setProgress(next);
  }, []);
  const apply = useCallback(
    (action: Parameters<typeof advance>[1]) => {
      const prev = progressRef.current,
        next = advance(prev, action);
      if (next !== prev) {
        commit(next);
        if (next.completed.length > prev.completed.length) {
          music.current?.chime();
          setNotice("기억을 새겼습니다 · 서약 주화 +60 · 기억의 결정 +1");
        } else if (
          (action.kind === "interact" || action.kind === "boss-won") &&
          (next.objective > prev.objective ||
            next.targets.length > prev.targets.length)
        ) {
          music.current?.chime();
          setNotice(
            next.objective > prev.objective
              ? `목표 달성 · ${currentObjective(next)?.title ?? "기억을 새겼습니다"}`
              : `${next.targets.length} / ${currentObjective(next)?.targets.length ?? 0} · ${action.kind === "interact" ? action.target : "전선 돌파"}`,
          );
        }
      }
    },
    [commit],
  );
  useEffect(() => {
    if (!host.current) return;
    const game = mountCampaign(host.current, progressRef.current);
    const onReady = () => {
      setReady(true);
      EventBus.emit("campaign:command", {
        progress: progressRef.current,
        paused: pausedRef.current,
      });
    };
    const onView = (v: CampaignViewState) => setView(v);
    const interact = (target: string) => {
      const p = progressRef.current,
        o = currentObjective(p);
      if (!o) return;
      if (o.lines) {
        setDialogue({
          lines: o.lines,
          index: 0,
          done: () => apply({ kind: "interact", target }),
        });
        setLog((l) => [...l, ...o.lines!].slice(-150));
      } else {
        const before = p.targets.length;
        apply({ kind: "interact", target });
        if (
          o.kind === "puzzle" &&
          progressRef.current.targets.length === 0 &&
          before + 1 < o.targets.length
        )
          setNotice("흐름이 끊겼습니다. 목표 안내의 순서대로 다시 연결하세요.");
      }
    };
    const won = () => {
      apply({ kind: "boss-won" });
      setNotice("전선을 돌파했습니다. 동료에게 돌아가세요.");
    };
    const error = (message: string) => setNotice(message);
    EventBus.on("campaign:ready", onReady);
    EventBus.on("campaign:view", onView);
    EventBus.on("campaign:interact", interact);
    EventBus.on("campaign:boss-won", won);
    EventBus.on("campaign:error", error);
    return () => {
      EventBus.off("campaign:ready", onReady);
      EventBus.off("campaign:view", onView);
      EventBus.off("campaign:interact", interact);
      EventBus.off("campaign:boss-won", won);
      EventBus.off("campaign:error", error);
      game.destroy(true);
    };
  }, [apply]);
  useEffect(() => {
    if (ready)
      EventBus.emit("campaign:command", {
        progress,
        paused,
        reducedMotion: reduced,
      });
  }, [progress, paused, ready, reduced]);
  useEffect(() => {
    consumeAuthTokenFromHash();
    let active = true,
      exchanging = false;
    void authMe()
      .then((current) => {
        if (active && !exchanging) setUser(current);
      })
      .catch(() => {});
    void googleWebRedirectToken()
      .then(async (token) => {
        if (!token) return;
        exchanging = true;
        const r = await authGoogle(token);
        if (active) {
          if (r.ok) setUser(r.data.user as AuthUser);
          else setNotice(String(r.data.error ?? "로그인에 실패했습니다."));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      socket.current?.disconnect();
    };
  }, []);
  const nextDialogue = useCallback(() => {
    const d = dialogueRef.current;
    if (!d) return;
    if (d.index + 1 < d.lines.length) setDialogue({ ...d, index: d.index + 1 });
    else {
      setDialogue(null);
      d.done();
    }
  }, []);
  useEffect(() => {
    if (!auto || !dialogue) return;
    const timer = setTimeout(
      nextDialogue,
      Math.max(2600, dialogue.lines[dialogue.index].text.length * 65),
    );
    return () => clearTimeout(timer);
  }, [auto, dialogue, nextDialogue]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (dialogueRef.current && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        nextDialogue();
      } else if (e.code === "Escape") {
        setPanel(null);
        setShowLog(false);
      } else if (e.code === "KeyJ" && !dialogueRef.current) {
        setPanel((v) => (v === "journal" ? null : "journal"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextDialogue]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  async function api(
    action?: string,
    extra: Record<string, unknown> = {},
  ): Promise<any> {
    const token = getAuthToken(),
      headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetch(
      `${resolveApiBase()}/api/campaign${action ? "" : `?campaignId=${CAMPAIGN_ID}`}`,
      {
        method: action ? "POST" : "GET",
        headers: {
          ...headers,
          ...(action ? { "Content-Type": "text/plain;charset=UTF-8" } : {}),
        },
        ...(action
          ? {
              body: JSON.stringify({
                campaignId: CAMPAIGN_ID,
                action,
                ...extra,
              }),
            }
          : {}),
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
    return data;
  }
  async function refresh() {
    try {
      const data = await api();
      setCloud(data);
      return data as Cloud;
    } catch (e) {
      setNotice((e as Error).message);
      return null;
    }
  }
  async function onlineAction(
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    try {
      const data = await api(action, {
        characterId: progressRef.current.characterId,
        revision: cloud?.account?.revision ?? 0,
        ...extra,
      });
      if (data.account) {
        const expanded = { ...slotsRef.current, capacity: data.account.slots };
        slotsRef.current = expanded;
        setSlots(expanded);
        writeSlots(expanded);
        setCloud((c) => ({ ...c!, account: data.account }));
        const saved = data.account.characters[progressRef.current.characterId];
        if (saved) commit(saved);
      }
      setNotice("완료했습니다.");
      await refresh();
      return data;
    } catch (e) {
      setNotice((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function login(register = false) {
    setBusy(true);
    try {
      const result = register
        ? await authRegister(loginId, password, name || progress.name)
        : await authLogin(loginId, password);
      if (!result.ok)
        throw new Error(String(result.data.error ?? "로그인에 실패했습니다."));
      setUser(result.data.user as AuthUser);
      setPassword("");
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loginGoogle() {
    setBusy(true);
    try {
      const { Capacitor } = await import("@capacitor/core");
      let token = "";
      if (Capacitor.isNativePlatform()) {
        const { FirebaseAuthentication } = await import(
          "@capacitor-firebase/authentication"
        );
        token =
          (await FirebaseAuthentication.signInWithGoogle()).credential
            ?.idToken ?? "";
      } else token = await googleWebSignIn();
      if (!token) return;
      const result = await authGoogle(token);
      if (!result.ok)
        throw new Error(String(result.data.error ?? "로그인에 실패했습니다."));
      setUser(result.data.user as AuthUser);
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function start() {
    if (slots.characters.length >= (slots.capacity ?? 8)) {
      setNotice("현재 캐릭터 슬롯이 가득 찼습니다.");
      return;
    }
    const p = newCampaign(name, family, crypto.randomUUID());
    void music.current?.start().catch(() => {});
    commit(p);
    setPlaying(true);
    setPanel(null);
    setLog([]);
  }
  function openPanel(p: Panel) {
    setPanel(p);
    if (p === "online")
      setReceipt(readPendingReceipt(progressRef.current.characterId));
    if (p === "online" || p === "wardrobe") void refresh();
  }
  async function paidPurchase(
    sku: keyof typeof PAID_PRODUCTS,
    restore = false,
  ) {
    if (!user) {
      setNotice("먼저 로그인하세요.");
      return;
    }
    if (!cloud?.purchasesReady) {
      setNotice("아직 유료 상품 판매가 준비되지 않았습니다.");
      return;
    }
    setBusy(true);
    try {
      const transactions = restore
        ? await restoreCosmetics()
        : [await purchaseCosmetic(sku, user.id)];
      for (const tx of transactions) {
        const token = getAuthToken();
        const response = await fetch(
          `${resolveApiBase()}/api/campaign/purchase`,
          {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=UTF-8",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              campaignId: CAMPAIGN_ID,
              sku: tx.productIdentifier,
              purchaseToken: tx.purchaseToken,
            }),
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        const expanded = { ...slotsRef.current, capacity: data.account.slots };
        slotsRef.current = expanded;
        setSlots(expanded);
        writeSlots(expanded);
        const saved = data.account.characters[progressRef.current.characterId];
        if (saved) commit(saved);
      }
      await refresh();
      setNotice(
        transactions.length
          ? "구매한 외형·슬롯을 복원했습니다."
          : "복원할 구매가 없습니다.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connectChallenge(mode: "solo" | "coop", join = false) {
    setBusy(true);
    try {
      const data = await api("ticket", { characterId: progress.characterId });
      const url = process.env.NEXT_PUBLIC_CAMPAIGN_SERVER || cloud?.realtimeUrl;
      if (!url)
        throw new Error(
          "실시간 서버 주소가 아직 설정되지 않았습니다. 본편은 계속 플레이할 수 있습니다.",
        );
      socket.current?.disconnect();
      const s = io(url, {
        auth: { ticket: data.ticket },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 8,
      });
      socket.current = s;
      let reconnectCode = join ? joinCode.trim() : "";
      s.on("connect", () => {
        s.emit(
          reconnectCode ? "campaign:join" : "campaign:create",
          reconnectCode
            ? { code: reconnectCode }
            : { mode, chapterId: challenge },
        );
      });
      s.on("campaign:room", (r: Room) => {
        reconnectCode = r.code;
        setRoom(r);
        if (r.started) {
          setPanel(null);
          EventBus.emit("campaign:command", { online: true });
        }
      });
      s.on("campaign:state", (b: Battle) => {
        setOnlineBattle(b);
        const member = b.players.find(
          (p) => p.id === `${user?.id}:${progressRef.current.characterId}`,
        );
        EventBus.emit("campaign:command", {
          online: true,
          onlineBattle: b,
          onlinePlayerId: member?.id,
        });
      });
      s.on("campaign:receipt", (r: string) => {
        setReceipt(r);
        try {
          savePendingReceipt(progressRef.current.characterId, r);
        } catch {
          setNotice(
            "미수령 보상은 이 화면에서 받아주세요. 기기 보관에 실패했습니다.",
          );
        }
      });
      s.on("campaign:error", (m: string) => setNotice(m));
      s.on("connect_error", (e: Error) => setNotice(e.message));
      const input = (v: BattleInput) =>
        s.connected && s.emit("campaign:input", v);
      EventBus.on("campaign:input", input);
      s.on("disconnect", () => EventBus.off("campaign:input", input));
      s.on("connect", () => {
        EventBus.off("campaign:input", input);
        EventBus.on("campaign:input", input);
      });
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function leaveRoom() {
    socket.current?.emit("campaign:leave");
    socket.current?.disconnect();
    socket.current = null;
    setRoom(null);
    setOnlineBattle(null);
    setReceipt(null);
    EventBus.emit("campaign:command", {
      online: false,
      progress: progressRef.current,
    });
  }
  async function importFile(file: File) {
    try {
      if (file.size > 150000) throw new Error("저장 파일이 너무 큽니다.");
      const p = parseCampaign(JSON.parse(await file.text()));
      if (!p)
        throw new Error(
          "기억의 서약 저장 파일이 아닙니다. 기존 게임은 보관용으로만 유지됩니다.",
        );
      if (
        !slots.characters.some((c) => c.characterId === p.characterId) &&
        slots.characters.length >= (slots.capacity ?? 8)
      )
        throw new Error("캐릭터 슬롯이 가득 찼습니다.");
      commit(p);
      setPlaying(true);
      setPanel(null);
      setNotice(
        "기기 저장을 불러왔습니다. 온라인 자산은 서버 기록을 따릅니다.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function touch(value: Partial<BattleInput> & { interact?: boolean }) {
    EventBus.emit("campaign:touch", value);
  }
  useEffect(() => {
    music.current = new OathAudio();
    const visibility = () => {
      if (document.hidden) music.current?.suspend();
      else if (playingRef.current) void music.current?.start().catch(() => {});
      EventBus.emit("campaign:command", {
        paused: document.hidden || pausedRef.current,
      });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      music.current?.dispose();
    };
  }, []);
  useEffect(() => {
    music.current?.setScene(chapter.theme, inBattle);
    music.current?.setVolume(volume);
    if (playing) void music.current?.start().catch(() => {});
    else music.current?.suspend();
  }, [chapter.theme, volume, playing, inBattle]);
  useEffect(() => {
    const overlay =
      document.querySelector<HTMLElement>(
        '.oath-modal-backdrop [role="dialog"]',
      ) ?? document.querySelector<HTMLElement>(".oath-dialogue");
    if (!overlay) return;
    const previous = document.activeElement;
    const focusables = () => [
      ...overlay.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,select,[tabindex="0"]',
      ),
    ];
    focusables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = focusables(),
        first = list[0],
        last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    overlay.addEventListener("keydown", trap);
    return () => {
      overlay.removeEventListener("keydown", trap);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [panel, showLog, !!dialogue]);
  const nextChapter =
    CHAPTERS[CHAPTERS.findIndex((c) => c.id === chapter.id) + 1];
  const battle = onlineBattle ?? view.battle;
  const me = battle?.players.find(
    (p) =>
      p.id === progress.characterId ||
      p.id === `${user?.id}:${progress.characterId}`,
  );
  return (
    <main className={`oath-app ${reduced ? "oath-reduced" : ""}`}>
      <div
        className="oath-world"
        ref={host}
        aria-label="기억의 서약 탐험 지도"
      />
      {saveError && (
        <div className="oath-storage-warning" role="alert">
          <strong>기기 저장에 실패했습니다</strong>
          <span>현재 진행을 보관하려면 저장 파일을 내보내세요.</span>
          <button onClick={() => openPanel("settings")}>
            저장 파일 보관하기
          </button>
        </div>
      )}
      {!playing ? (
        <section className="oath-title-screen">
          <div className="oath-title-copy">
            <span className="oath-eyebrow">SERTZ · A STORY WE KEEP</span>
            <h1>
              기억의
              <br />
              <em>서약</em>
            </h1>
            <p>
              세계를 되돌려도,
              <br />
              우리가 함께한 기억은 남는다.
            </p>
            <span className="oath-title-line" />
            <small>왕국의 전쟁에서 별 너머의 귀향까지</small>
          </div>
          <div className="oath-start-card">
            <div className="oath-card-heading">
              <Flag size={18} />
              <h2>새로운 여정</h2>
              <span>연합의 동행자</span>
            </div>
            <label>
              당신의 이름
              <input
                aria-label="캐릭터 이름"
                maxLength={12}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="여행자"
              />
            </label>
            <div className="oath-families">
              {(Object.keys(FAMILIES) as Family[]).map((f) => (
                <button
                  key={f}
                  className={family === f ? "selected" : ""}
                  onClick={() => setFamily(f)}
                  title={FAMILIES[f].description}
                >
                  <Portrait family={f} size={40} />
                  <span>{FAMILIES[f].name}</span>
                </button>
              ))}
            </div>
            <p className="oath-small">
              {FAMILIES[family].description} · 이야기를 통해 새로운 힘을
              배웁니다.
            </p>
            <button className="oath-primary" onClick={start} disabled={!ready}>
              서약을 시작하다 <ChevronRight size={18} />
            </button>
            {slots.characters.length > 0 && (
              <div className="oath-continue">
                <span>이어지는 기억</span>
                {slots.characters.map((p) => (
                  <button
                    key={p.characterId}
                    onClick={() => {
                      commit(p);
                      setPlaying(true);
                    }}
                  >
                    <Portrait family={p.family} size={28} />
                    <span>
                      {p.name}
                      <small>{currentChapter(p).title}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            )}
            <div className="oath-title-links">
              <button onClick={() => openPanel("settings")}>
                <FolderArchive size={14} />
                기록 보관함
              </button>
              <button onClick={() => openPanel("online")}>
                <Users size={14} />
                계정
              </button>
            </div>
          </div>
          <footer>34개의 장 · 당신만의 캐릭터 · 하나로 이어지는 이야기</footer>
        </section>
      ) : (
        <>
          <header className="oath-topbar">
            <button className="oath-brand" onClick={() => setPanel("settings")}>
              <span>SERTZ</span>
              <strong>{CAMPAIGN_TITLE}</strong>
            </button>
            <nav aria-label="게임 메뉴">
              <button
                aria-label="수첩"
                onClick={() => openPanel("journal")}
                title="기억 수첩 (J)"
              >
                <BookOpen size={18} />
                <span>수첩</span>
              </button>
              <button aria-label="외형" onClick={() => openPanel("wardrobe")}>
                <Crown size={18} />
                <span>외형</span>
              </button>
              <button aria-label="연합" onClick={() => openPanel("online")}>
                <Users size={18} />
                <span>연합</span>
              </button>
              <button aria-label="설정" onClick={() => openPanel("settings")}>
                <Settings size={18} />
              </button>
            </nav>
          </header>
          <aside className="oath-objective">
            <span className="oath-eyebrow">
              {ACT_NAMES[chapter.act]} · {chapter.episode}장
            </span>
            <h2>{chapter.title}</h2>
            <small className="oath-location">{chapter.location}</small>
            <progress
              className="oath-objective-progress"
              aria-label="현재 장 진행"
              max={chapter.objectives.length}
              value={progress.objective}
            />
            <div>
              <Compass size={16} />
              <span>{objective?.title ?? "기억을 새겼습니다"}</span>
            </div>
            <p>{objective?.hint ?? chapter.memory}</p>
            {view.bearing && !battle && (
              <small className="oath-bearing">
                {view.bearing.direction} {view.bearing.label} ·{" "}
                {view.bearing.distance}걸음
              </small>
            )}
            {objective && objective.targets.length > 1 && (
              <div className="oath-targets">
                {objective.targets.map((t) => (
                  <span
                    key={t}
                    className={progress.targets.includes(t) ? "done" : ""}
                  >
                    {progress.targets.includes(t) ? "✓" : "◇"} {t}
                  </span>
                ))}
              </div>
            )}
          </aside>
          {view.defense && (
            <div className="oath-defense-hud">
              방어선 {view.defense.integrity}% ·{" "}
              {view.defense.remaining.toFixed(1)}초 남음
              <br />
              Space / 공격 버튼으로 접근하는 피조물을 막으세요.
            </div>
          )}
          {!battle && (
            <div className="oath-player-chip">
              <Portrait family={progress.family} size={32} />
              <span>
                {progress.name}
                <small>{FAMILIES[progress.family].name}</small>
              </span>
              <b>✧ {progress.coins}</b>
            </div>
          )}
          {battle && (
            <div className="oath-boss-hud">
              <div>
                <Swords size={16} />
                <strong>
                  {
                    currentChapter({ ...progress, chapterId: battle.chapterId })
                      .boss?.name
                  }
                </strong>
                <span>PHASE {battle.boss.phase}</span>
              </div>
              <meter min={0} max={battle.boss.maxHp} value={battle.boss.hp} />
              <small>
                <Heart size={13} /> {me?.hp ?? 0} / 100　·　공격 Space　원소술
                K　회피 Shift　{battle.mode === "coop" ? "구조 E" : ""}
              </small>
              <div className="oath-cooldowns" aria-label="전투 기술 상태">
                <span>
                  원소술 K{" "}
                  <b>
                    {me && me.skillAt > battle.time
                      ? `${((me.skillAt - battle.time) / 1000).toFixed(1)}초`
                      : "준비"}
                  </b>
                </span>
                <span>
                  회피 Shift{" "}
                  <b>
                    {me && me.dodgeAt > battle.time
                      ? `${((me.dodgeAt - battle.time) / 1000).toFixed(1)}초`
                      : "준비"}
                  </b>
                </span>
              </div>
            </div>
          )}
          {!paused && !battle && view.nearby && (
            <button
              className="oath-interact"
              onClick={() => touch({ interact: true })}
            >
              <kbd>E</kbd>
              {view.nearby === "전투 시작"
                ? "보스에 도전하기"
                : `${view.nearby} · 상호작용`}
              <ChevronRight size={16} />
            </button>
          )}
          {!paused && done && !battle && (
            <section className="oath-chapter-done">
              <Sparkles size={26} />
              <span>기억 {progress.completed.length} / 34</span>
              <h2>
                {nextChapter
                  ? "다음 이야기가 기다립니다"
                  : "우리의 서약은 계속됩니다"}
              </h2>
              <p>{chapter.memory}</p>
              <div className="oath-earned" aria-label="이 장의 최초 완료 보상">
                <span>
                  서약 주화 <b>+60</b>
                </span>
                <span>
                  기억의 결정 <b>+1</b>
                </span>
                <small>최초 완료 보상 · 재방문 시 중복 지급되지 않습니다</small>
              </div>
              <div className="oath-choice">
                <button
                  className={
                    progress.choices[chapter.id] === "remember"
                      ? "selected"
                      : ""
                  }
                  onClick={() => apply({ kind: "choice", value: "remember" })}
                >
                  이 기억을 간직한다
                </button>
                <button
                  className={
                    progress.choices[chapter.id] === "protect" ? "selected" : ""
                  }
                  onClick={() => apply({ kind: "choice", value: "protect" })}
                >
                  남은 사람들을 지킨다
                </button>
              </div>
              {nextChapter ? (
                <button
                  className="oath-primary"
                  onClick={() =>
                    apply({ kind: "travel", chapterId: nextChapter.id })
                  }
                >
                  {nextChapter.title}
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  className="oath-primary"
                  onClick={() => openPanel("online")}
                >
                  연합의 도전으로
                  <ChevronRight size={18} />
                </button>
              )}
            </section>
          )}
          {!paused && battle?.status === "lost" && (
            <section className="oath-chapter-done">
              <Shield size={28} />
              <h2>다시, 일어설 시간</h2>
              <p>
                기억과 보유 아이템은 그대로입니다.
                <br />
                공격 예고를 피하고, 공격 뒤의 빈틈을 노려보세요.
              </p>
              <button
                className="oath-primary"
                onClick={() => {
                  if (onlineBattle) {
                    leaveRoom();
                    openPanel("online");
                  } else EventBus.emit("campaign:command", { retry: true });
                }}
              >
                다시 도전하기
              </button>
            </section>
          )}
          {onlineBattle?.status === "won" && !panel && (
            <section className="oath-chapter-done">
              <Crown />
              <h2>서약을 지켰습니다</h2>
              <p>{(onlineBattle.time / 1000).toFixed(1)}초 · 서버 판정 기록</p>
              <button
                className="oath-primary"
                disabled={!receipt || busy}
                onClick={async () => {
                  const result = await onlineAction("claim", { receipt });
                  if (result) {
                    clearPendingReceipt(progress.characterId);
                    leaveRoom();
                    openPanel("online");
                  }
                }}
              >
                보상과 기록 수령
              </button>
            </section>
          )}
          {!paused && (
            <div className="oath-touch">
              <div className="oath-dpad">
                <button
                  aria-label="위로 이동"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touch({ y: -1 });
                  }}
                  onPointerUp={() => touch({ y: 0 })}
                  onPointerCancel={() => touch({ y: 0 })}
                >
                  ↑
                </button>
                <button
                  aria-label="왼쪽 이동"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touch({ x: -1 });
                  }}
                  onPointerUp={() => touch({ x: 0 })}
                  onPointerCancel={() => touch({ x: 0 })}
                >
                  ←
                </button>
                <button
                  aria-label="아래로 이동"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touch({ y: 1 });
                  }}
                  onPointerUp={() => touch({ y: 0 })}
                  onPointerCancel={() => touch({ y: 0 })}
                >
                  ↓
                </button>
                <button
                  aria-label="오른쪽 이동"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touch({ x: 1 });
                  }}
                  onPointerUp={() => touch({ x: 0 })}
                  onPointerCancel={() => touch({ x: 0 })}
                >
                  →
                </button>
              </div>
              {(battle || view.defense) && (
                <div className="oath-touch-actions">
                  {(["dodge", "skill", "attack", "revive"] as const).map(
                    (key, i) => (
                      <button
                        key={key}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          touch({ [key]: true });
                        }}
                        onPointerUp={() => touch({ [key]: false })}
                        onPointerCancel={() => touch({ [key]: false })}
                      >
                        {["회피", "원소술", "공격", "구조"][i]}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
          {!battle && !dialogue && (
            <div className="oath-controls-hint">
              WASD / 방향키 이동　·　E 상호작용　·　J 기억 수첩
            </div>
          )}
        </>
      )}
      {dialogue && (
        <section
          className="oath-dialogue"
          role="dialog"
          aria-label="이야기 대화"
        >
          <div className="oath-dialogue-portrait">
            <Portrait
              art={guideArt(dialogue.lines[dialogue.index].speaker)}
              family={
                dialogue.lines[dialogue.index].speaker === chapter.guide
                  ? "mage"
                  : progress.family
              }
              size={80}
            />
          </div>
          <div className="oath-dialogue-body">
            <span className="oath-eyebrow">{chapter.location}</span>
            <h3>{dialogue.lines[dialogue.index].speaker}</h3>
            <p>{dialogue.lines[dialogue.index].text}</p>
            <div className="oath-dialogue-footer">
              <div>
                <button onClick={() => setShowLog(true)}>대화 기록</button>
                <button
                  className={auto ? "selected" : ""}
                  onClick={() => setAuto((v) => !v)}
                >
                  자동 {auto ? "켜짐" : "꺼짐"}
                </button>
                <button
                  onClick={() => {
                    const d = dialogue;
                    setDialogue(null);
                    d.done();
                  }}
                >
                  건너뛰기
                </button>
              </div>
              <button onClick={nextDialogue}>
                다음 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}
      {showLog && (
        <div className="oath-modal-backdrop">
          <section className="oath-modal" role="dialog" aria-label="대화 기록">
            <header>
              <h2>함께 나눈 이야기</h2>
              <button aria-label="기록 닫기" onClick={() => setShowLog(false)}>
                <X />
              </button>
            </header>
            <div className="oath-modal-body">
              {log.map((l, i) => (
                <p key={i}>
                  <strong>{l.speaker}</strong>
                  <br />
                  {l.text}
                </p>
              ))}
            </div>
          </section>
        </div>
      )}
      {panel && (
        <div className="oath-modal-backdrop">
          <section
            className="oath-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                journal: "기억 수첩",
                wardrobe: "외형 공방",
                online: "연합의 거점",
                settings: "기록과 설정",
              }[panel]
            }
          >
            <header>
              <h2>
                {
                  {
                    journal: "기억 수첩",
                    wardrobe: "외형 공방",
                    online: "연합의 거점",
                    settings: "기록과 설정",
                  }[panel]
                }
              </h2>
              <button aria-label="창 닫기" onClick={() => setPanel(null)}>
                <X size={22} />
              </button>
            </header>
            <div className="oath-modal-body">
              {panel === "journal" && (
                <>
                  <p className="oath-muted">
                    당신이 잇는 사람들과, 지워지지 않는 기억들.
                  </p>
                  {([1, 2, 3] as const).map((act) => (
                    <section key={act}>
                      <h3>{ACT_NAMES[act]}</h3>
                      <div className="oath-chapters">
                        {CHAPTERS.filter((c) => c.act === act).map((c) => (
                          <button
                            key={c.id}
                            disabled={!unlocked(progress, c.id) || !!room}
                            className={c.id === chapter.id ? "selected" : ""}
                            onClick={() => {
                              apply({ kind: "travel", chapterId: c.id });
                              setPanel(null);
                            }}
                          >
                            <span>
                              {progress.completed.includes(c.id)
                                ? "✓"
                                : unlocked(progress, c.id)
                                  ? "◇"
                                  : "·"}
                            </span>
                            <div>
                              <strong>
                                {c.episode}. {c.title}
                              </strong>
                              <small>{c.location}</small>
                              {progress.memories.includes(c.id) && (
                                <p>{c.memory}</p>
                              )}
                              {progress.choices[c.id] && (
                                <small>
                                  나의 기록:{" "}
                                  {progress.choices[c.id] === "remember"
                                    ? "이 기억을 간직한다"
                                    : "남은 사람들을 지킨다"}
                                </small>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                  <h3>연합의 사람들</h3>
                  <p>
                    엘리아 — 동생의 추억을 품은 태양의 검사
                    <br />
                    루엔 — 고향을 되찾으려는 왕자
                    <br />
                    오르시안 — 시간을 지키는 도사
                    <br />
                    네메아 — 생명의 수호자
                    <br />
                    세리안 — 자신의 과오를 마주하는 여왕
                  </p>
                </>
              )}
              {panel === "wardrobe" && (
                <>
                  <p>
                    외형은 전투 능력에 영향을 주지 않습니다. 네 가지 망토는 본편
                    보상 주화로 제작하고, 별빛 망토는 선택형 외형 상품으로
                    제공합니다.
                  </p>
                  <div className="oath-wardrobe">
                    {COSMETICS.map((c) => (
                      <article key={c.id}>
                        <Portrait
                          family={progress.family}
                          size={64}
                          tint={c.color}
                        />
                        <h3>{c.name}</h3>
                        <p>
                          {c.paid ? "Google Play 외형 상품" : `✧ ${c.cost}`}
                        </p>
                        <button
                          disabled={busy || !user}
                          onClick={() =>
                            c.paid && !progress.cosmetics.includes(c.id)
                              ? paidPurchase("oath_cloak_starlight")
                              : onlineAction("cosmetic", { item: c.id })
                          }
                        >
                          {progress.equipped === c.id
                            ? "착용 중"
                            : progress.cosmetics.includes(c.id)
                              ? "착용하기"
                              : c.paid
                                ? "인앱 구매"
                                : "주화로 제작"}
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="oath-row">
                    <button
                      disabled={busy || !user}
                      onClick={() => paidPurchase("oath_slots_4")}
                    >
                      캐릭터 슬롯 +4 · 인앱 구매
                    </button>
                    <button
                      disabled={busy || !user}
                      onClick={() => paidPurchase("oath_slots_4", true)}
                    >
                      구매 복원
                    </button>
                  </div>
                  <p className="oath-small">
                    로그인 후 캐릭터를 클라우드에 저장하면 제작할 수 있습니다.
                    유료 성장 재화는 판매하지 않습니다.
                  </p>
                </>
              )}
              {panel === "online" && (
                <>
                  {!user ? (
                    <div className="oath-auth">
                      <p>
                        이야기는 게스트로도 끝까지 플레이할 수 있습니다.
                        <br />
                        클라우드·거래·검증된 도전 기록은 계정에 연결됩니다.
                      </p>
                      <button disabled={busy} onClick={loginGoogle}>
                        Google 계정으로 계속하기
                      </button>
                      <label>
                        아이디
                        <input
                          value={loginId}
                          autoComplete="username"
                          onChange={(e) => setLoginId(e.target.value)}
                        />
                      </label>
                      <label>
                        비밀번호
                        <input
                          type="password"
                          value={password}
                          autoComplete="current-password"
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </label>
                      <div className="oath-row">
                        <button
                          disabled={busy}
                          className="oath-primary"
                          onClick={() => login()}
                        >
                          로그인
                        </button>
                        <button disabled={busy} onClick={() => login(true)}>
                          가입하기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="oath-row">
                        <span>{user.name}의 연합 기록</span>
                        <button
                          onClick={async () => {
                            leaveRoom();
                            await authLogout();
                            setUser(null);
                            setCloud(null);
                          }}
                        >
                          <LogOut size={14} />
                          로그아웃
                        </button>
                      </div>
                      <div className="oath-row">
                        <button
                          disabled={busy || !playing}
                          onClick={() =>
                            onlineAction("save", { save: progress })
                          }
                        >
                          현재 캐릭터 클라우드 저장
                        </button>
                        <button disabled={busy} onClick={() => refresh()}>
                          클라우드 새로고침
                        </button>
                      </div>
                      {cloud?.account &&
                        Object.values(cloud.account.characters).map((p) => (
                          <button
                            className="oath-cloud-character"
                            key={p.characterId}
                            onClick={() => {
                              commit(p);
                              setPlaying(true);
                              setPanel(null);
                            }}
                          >
                            {p.name} · {currentChapter(p).title}
                            <Download size={14} />
                          </button>
                        ))}
                    </>
                  )}
                  <hr />
                  <h3>
                    <Swords size={18} /> 솔로 도전 · 3인 협동 보스
                  </h3>
                  <p className="oath-muted">
                    본편에서 완료한 보스의 도전판입니다. 세 봉인을 나누어 맡고
                    쓰러진 동료를 구조하세요.
                  </p>
                  <label>
                    도전할 보스
                    <select
                      value={challenge}
                      onChange={(e) => setChallenge(e.target.value)}
                    >
                      {CHAPTERS.filter((c) => c.boss).map((c) => (
                        <option
                          key={c.id}
                          value={c.id}
                          disabled={!progress.completed.includes(c.id)}
                        >
                          {c.boss!.name}
                          {progress.completed.includes(c.id)
                            ? ""
                            : " · 본편 완료 필요"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {room ? (
                    <>
                      <p>
                        파티 코드 <b>{room.code}</b> · {room.members.length}/
                        {room.mode === "coop" ? 3 : 1}
                      </p>
                      <p>
                        {room.members
                          .map(
                            (m) =>
                              `${m.name} ${m.online ? "●" : "재접속 대기"}`,
                          )
                          .join(" / ")}
                      </p>
                      <div className="oath-row">
                        <button
                          className="oath-primary"
                          onClick={() => socket.current?.emit("campaign:start")}
                        >
                          전투 시작
                        </button>
                        <button onClick={leaveRoom}>파티 나가기</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="oath-row">
                        <button
                          disabled={busy || !user}
                          onClick={() => connectChallenge("solo")}
                        >
                          솔로 도전
                        </button>
                        <button
                          disabled={busy || !user}
                          onClick={() => connectChallenge("coop")}
                        >
                          3인 파티 만들기
                        </button>
                      </div>
                      <div className="oath-row">
                        <input
                          aria-label="파티 코드"
                          placeholder="파티 코드"
                          maxLength={8}
                          value={joinCode}
                          onChange={(e) =>
                            setJoinCode(e.target.value.toUpperCase())
                          }
                        />
                        <button
                          disabled={busy || !user}
                          onClick={() => connectChallenge("coop", true)}
                        >
                          참가
                        </button>
                      </div>
                    </>
                  )}
                  <hr />
                  <h3>연합 거래소</h3>
                  <p>
                    기억의 결정만 거래합니다. 주화·결정은 서버가 보관하며, 판매
                    수수료는 10%입니다.
                  </p>
                  <button
                    disabled={!user || busy}
                    onClick={() =>
                      onlineAction("list", {
                        item: "memory-fragment",
                        quantity: 1,
                        price: 20,
                      })
                    }
                  >
                    기억의 결정 1개 등록 · 20주화
                  </button>
                  {cloud?.listings?.map((l) => (
                    <div className="oath-trade-row" key={l.id}>
                      <span>
                        {l.name} · 기억의 결정 ×{l.quantity} · ✧ {l.price}/개
                      </span>
                      <button
                        disabled={!user || busy}
                        onClick={() =>
                          onlineAction(l.mine ? "cancel" : "buy", {
                            listingId: l.id,
                          })
                        }
                      >
                        {l.mine ? "등록 취소" : "구매"}
                      </button>
                    </div>
                  ))}
                  {!cloud?.listings?.length && (
                    <p className="oath-muted">등록된 물품이 없습니다.</p>
                  )}
                  {receipt && (
                    <div className="oath-row">
                      <span>미수령 도전 보상이 있습니다.</span>
                      <button
                        disabled={!user || busy}
                        onClick={async () => {
                          const result = await onlineAction("claim", {
                            receipt,
                          });
                          if (result) {
                            clearPendingReceipt(progress.characterId);
                            setReceipt(null);
                          }
                        }}
                      >
                        보상 복원
                      </button>
                    </div>
                  )}
                  <hr />
                  <h3>검증된 도전 기록</h3>
                  {(["solo", "coop"] as const).map((mode) => (
                    <section key={mode}>
                      <h3>{mode === "solo" ? "솔로 기록" : "3인 협동 기록"}</h3>
                      {cloud?.records
                        ?.filter(
                          (r) => r.chapterId === challenge && r.mode === mode,
                        )
                        .map((r) => (
                          <div key={r.id} className="oath-trade-row">
                            <span>{r.names.join(" · ")}</span>
                            <b>
                              {(r.time / 1000).toFixed(1)}초 · 사망 {r.deaths}
                            </b>
                          </div>
                        ))}
                    </section>
                  ))}
                  <p className="oath-small">
                    서버가 판정한 전투만 등록됩니다. 기록은 보스·솔로/협동별로
                    구분됩니다.
                  </p>
                </>
              )}
              {panel === "settings" && (
                <>
                  <h3>저장과 보관</h3>
                  <p>
                    새 캠페인과 기존 게임의 기록은 별도 보관합니다. 기존
                    데이터는 변경하지 않습니다.
                  </p>
                  <div className="oath-row">
                    <button
                      onClick={() =>
                        download("memory-oath-save.json", progress)
                      }
                    >
                      <Download size={16} />새 기록 내보내기
                    </button>
                    <label className="oath-file">
                      새 기록 가져오기
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void importFile(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <button
                    onClick={() =>
                      download("sertz-legacy-archive.json", legacyArchive())
                    }
                  >
                    <FolderArchive size={16} />
                    기존 게임 보관 파일 내보내기
                  </button>
                  <h3>음악과 화면</h3>
                  <label>
                    음악 음량
                    <input
                      type="range"
                      min="0"
                      max="0.3"
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                    />
                  </label>
                  <h3>화면과 조작</h3>
                  <label className="oath-row">
                    <input
                      type="checkbox"
                      checked={reduced}
                      onChange={(e) => setReduced(e.target.checked)}
                    />
                    화면 움직임 줄이기
                  </label>
                  <p>
                    이동 WASD / 방향키 · 상호작용 E · 공격 Space · 원소술 K ·
                    회피 Shift · 수첩 J · 닫기 Esc
                  </p>
                  <p>
                    모바일에서는 왼쪽 방향키와 오른쪽 행동 버튼을 사용하세요.
                  </p>
                  <hr />
                  <p className="oath-small">
                    사용자 제공 에셋: SPUM 캐릭터·초상, 기존 숲·마을·던전 소품,
                    Dungeon Crawl Stone Soup 타일·보스(CC0), pixelfx(MIT).
                    인물과 초상은 같은 원본을 사용하고 최근접 픽셀 렌더링을
                    유지합니다.
                  </p>
                  <a
                    href="https://github.com/apple01234/CERTZ"
                    target="_blank"
                    rel="noreferrer"
                  >
                    소스 코드 · AGPL-3.0 라이선스
                  </a>
                  <p className="oath-small">
                    버전 {process.env.NEXT_PUBLIC_APP_VERSION} · {CAMPAIGN_ID}
                  </p>
                  {playing && (
                    <button
                      onClick={() => {
                        leaveRoom();
                        setPanel(null);
                        setPlaying(false);
                      }}
                    >
                      타이틀로 돌아가기
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {notice && (
        <div className="oath-notice" role="status">
          {notice}
        </div>
      )}
    </main>
  );
}
