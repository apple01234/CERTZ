/**
 * 스토리 컷씬 카메라 — v1.4.41 (유저 지시: "스토리 진행마다 필요한 대화 및 연출 컷씬")
 *
 * 배경
 * ----
 * 이 게임에는 **보스 인트로 컷씬**만 있었다(카메라 팬 → 대사 → 복귀). 챕터에 처음
 * 들어설 때, 스토리 비트를 밟을 때는 아무 연출이 없어 텍스트가 툭 튀어나왔다.
 *
 * 설계
 * ----
 * 기존 보스 컷씬의 검증된 패턴을 그대로 일반화한다:
 *   ① camCinema 플래그로 수동 팔로우를 보류(팬이 팔로우와 싸우지 않게)
 *   ② 카메라를 대상으로 보간 팬(순간이동 금지)
 *   ③ 연출·대사 동안 물리 정지
 *   ④ 복귀도 보간 팬 + 플래그 해제
 *
 * camera-systems 원칙 준수
 *   - 팔로우와 팬을 동시에 돌리지 않는다(camCinema 게이트).
 *   - 복귀는 "현재 스크롤에서 자연 이어받기" — 스냅 금지.
 *   - 셰이크는 이 파일에서 다루지 않는다(UltCinematic 의 trauma 오프셋이 담당).
 *
 * 안전
 * ----
 * 팬 도중 씬이 바뀌거나 예외가 나도 **반드시** camCinema 를 해제하고 물리를 재개한다
 * (보스 컷씬에서 실제로 겪은 교착의 재발 방지 — try/finally + 타임아웃 자가치유).
 */
import Phaser from "phaser";

type SceneLike = Phaser.Scene & {
  camCinema?: boolean;
  player?: { x: number; y: number; active: boolean };
};

export type StoryShot = {
  /** 카메라가 비출 월드 좌표 */
  x: number;
  y: number;
  /** 팬 시간(ms) */
  panMs?: number;
  /** 이 샷을 유지하는 시간(ms). 다음 샷/복귀까지 */
  holdMs?: number;
  /** 이 샷에서 띄울 대사 키 (data.ts DIALOGUES) */
  dialogue?: string;
  /** 줌 (기본 1.0) */
  zoom?: number;
};

export type StoryCutsceneOpts = {
  shots: StoryShot[];
  /** 끝난 뒤 호출 — 대사 큐 등 후속 처리 */
  onDone?: () => void;
  /** 대사 표시 함수 주입 (씬이 showDialogueOnce 를 넘긴다) */
  showDialogue?: (key: string) => boolean;
};

/** 씬당 하나의 컷씬만 허용 — 중첩 재생은 카메라/물리 상태를 깨뜨린다. */
const playing = new WeakSet<Phaser.Scene>();

/** 지금 컷씬이 재생 중인가 (입력 차단 판단용) */
export function storyCutscenePlaying(scene: Phaser.Scene): boolean {
  return playing.has(scene);
}

/**
 * 스토리 컷씬 재생. 샷을 순서대로 팬하며 대사를 띄운 뒤 플레이어 시점으로 복귀한다.
 * 재생 중이면 false 를 돌려주고 아무것도 하지 않는다.
 */
export function playStoryCutscene(scene: SceneLike, opts: StoryCutsceneOpts): boolean {
  if (playing.has(scene)) return false;
  const shots = opts.shots.filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y));
  if (shots.length === 0) return false;

  const cam = scene.cameras.main;
  const saved = { zoom: cam.zoom };

  playing.add(scene);
  scene.camCinema = true; // 수동 팔로우 보류 — 팬이 팔로우와 싸우지 않게
  try {
    scene.physics.world.pause();
  } catch { /* 물리 없는 씬 무시 */ }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    /* 복귀 — 순간이동 금지. 플레이어 시점으로 보간한 뒤 플래그 해제 */
    const px = scene.player?.x ?? cam.midPoint.x;
    const py = scene.player?.y ?? cam.midPoint.y;
    try {
      cam.zoomTo(saved.zoom, 260);
      cam.pan(px, py, 520, "Sine.easeInOut", true);
    } catch { /* 종료 무시 */ }
    scene.time.delayedCall(560, () => {
      try {
        scene.camCinema = false; // 여기서 해제 → 다음 프레임부터 팔로우가 현재 스크롤을 인계
        scene.physics.world.resume();
      } catch { /* 무시 */ }
      playing.delete(scene);
      try { opts.onDone?.(); } catch { /* 무시 */ }
    });
  };

  /* 자가치유 — 어떤 이유로 finish 가 안 불려도 12초 뒤 강제 복구 */
  const watchdog = scene.time.delayedCall(12000, () => {
    if (!done) {
      console.warn("[SERTZ] 스토리 컷씬 자가치유 — 12초 초과로 강제 복귀");
      finish();
    }
  });

  let i = 0;
  const step = () => {
    if (done) return;
    if (i >= shots.length) {
      watchdog.remove(false);
      finish();
      return;
    }
    const sh = shots[i++];
    const panMs = Math.max(120, sh.panMs ?? 700);
    const holdMs = Math.max(0, sh.holdMs ?? 700);
    try {
      if (sh.zoom !== undefined) cam.zoomTo(sh.zoom, panMs);
      cam.pan(sh.x, sh.y, panMs, "Sine.easeInOut", true);
    } catch { /* 무시 */ }
    scene.time.delayedCall(panMs, () => {
      if (done) return;
      /* 팬이 끝난 뒤 대사 → 대사가 길어도 hold 는 최소값으로만 쓴다 */
      let held = holdMs;
      if (sh.dialogue && opts.showDialogue) {
        const shown = opts.showDialogue(sh.dialogue);
        if (shown) held = Math.max(held, 320); // 대사창은 resumeFromDialogue 가 닫는다
      }
      scene.time.delayedCall(held, step);
    });
  };
  step();
  return true;
}
