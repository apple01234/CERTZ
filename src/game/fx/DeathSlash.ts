/**
 * vc153 — 도적 계열 제2궁극기 「사(死)의 일섬」 3D 시네마틱
 *
 * 유저 스펙 (그대로 이행):
 *  ① 발동 → 입력/이동 잠금 → 검은 overlay 페이드인 + BGM 순간 감쇠
 *     → 화면 중앙 붉은 한자 「死」 작게 → 폭발 확대 + 붉은 발광/붓터치/잉크번짐/미세 진동
 *     (사무라이 붓글씨 타이포 — 일반 텍스트 아님)
 *  ② Phaser 위에 투명 Three.js 캔버스 → 독립 시네마틱 씬 (GLB 교체 가능 구조)
 *     → 낮은 카메라가 플레이어를 향해 다가감 → 발도·회전 공격 포즈
 *     → 붉은 rim light / 강한 명암 / 검은 실루엣
 *  ③ 초고속 참격: 카메라가 검을 따라감, 붉은 에너지 잔상(CatmullRomCurve3 튜브),
 *     붉은 사선 컷 이펙트, 파티클/궤적, 50~90ms hitstop, 강한 카메라 쉐이크+플래시+충격파
 *  ④ 피해: 즉발 450% 공격력(설정 가능) + 출혈 25% 공격력 / 1초 간격 × 5초(전부 설정 가능)
 *     → 붉은 출혈 VFX, 큰 피해 숫자 + 크리티컬, 생존 시 하드히트(넉백)
 *  ⑤ 복귀: 붉은 검기 소산 → 3D 페이드아웃 → 2D 무단 연결 → 짧은 진동+줌
 *     → 위치/HP/출혈 상태 정확 유지 → 입력 해제 → 재발동 가능
 *
 * 하드 요구사항:
 *  · 기존 전투/HP/사망/상태이상 시스템 재사용 (가짜 HP·적 복제본 금지) — 피해는 콜백으로 위임
 *  · 공격 고유 ID + 일회성 타격 flag (중복 판정 방지)
 *  · 연출과 피해 계산 분리 — 연출 취소/중단돼도 피해 데이터는 이미 확정(불변)
 *  · 비사용 시 렌더 부하 0 (rAF는 시네마틱 중에만, 종료 시 완전 파괴)
 *  · 자원 정리: canvas/렌더러/지오메트리/머티리얼/트윈/타이머 전부 해제
 *  · 예외 복구: 어떤 오류가 나도 검은 화면·입력 잠금이 영구화되지 않는다 (안전 타임아웃 + try/catch)
 */
import * as THREE from "three";

/** ── 유저 스펙 수치 (전부 설정 가능) ───────────────────────── */
export const DEATH_SLASH_CFG = {
  /** 즉발 피해 배율 (×450% 공격력) */
  instantMult: 4.5,
  /** 출혈 틱 배율 (1틱 = ×25% 공격력) */
  bleedMult: 0.25,
  /** 출혈 틱 횟수 (5초 × 1초 간격) */
  bleedTicks: 5,
  /** 출혈 틱 간격 (ms) */
  bleedIntervalMs: 1000,
  /** hitstop 지속 (50~90ms) */
  hitstopMs: 70,
  /** 시네마틱 전체 안전 상한 — 이 시간이 지나면 무조건 복구 */
  safetyTimeoutMs: 12000,
} as const;

/** 시네마틱 대상 최소 인터페이스 (순환 import 회피 — Player가 전달) */
export interface DeathSlashActor {
  x: number;
  y: number;
  scene: {
    cameras: { main: { shake: (d: number, i?: number) => void; flash: (d: number, r?: number, g?: number, b?: number) => void; zoom: number; zoomTo: (z: number, d?: number) => void } };
    add: { text: (x: number, y: number, s: string, cfg: object) => PhaserTextLike };
    tweens: { add: (cfg: never) => unknown; killTweensOf: (t: object) => unknown };
    time: { delayedCall: (d: number, f: () => void) => unknown };
    game: { canvas: HTMLCanvasElement };
  };
  flipX: boolean;
}

interface PhaserTextLike {
  setOrigin: (x?: number, y?: number) => PhaserTextLike;
  setDepth: (d: number) => PhaserTextLike;
  setAlpha: (a: number) => PhaserTextLike;
  setScale: (x: number, y?: number) => PhaserTextLike;
  destroy: () => void;
  alpha: number;
  scale: number;
}

/** 시네마틱 상태 — 중복 발동 방지용 전역 플래그 (공격 고유 ID 발급기 겸용) */
let liveId = 0;
let active = false;
export function deathSlashActive(): boolean {
  return active;
}

/** 3D 모델 교체 지점 — GLB가 준비되면 이 URL에 두고 loadDeathSlashModel()로 로드.
 *  현재는 프리미티브 사무라이 실루엣(몸통+머리+카타나)을 사용 (스펙 허용: 임시 모델). */
export const DEATH_SLASH_GLB_URL: string | null = null;

type Cleanup = () => void;

/**
 * 사(死)의 일섬 — 풀 시네마틱 실행.
 * @param actor 플레이어 (x/y/scene/flipX)
 * @param onStrike 피해 위임 콜백 — 참격 타격 프레임에 1회 호출 (연출과 피해 분리)
 * @returns cleanup 이미 활성 중이면 null (재발동 방지 — 유저 스펙: 해제 후 재발동 가능)
 */
export function runDeathSlashCinematic(
  actor: DeathSlashActor,
  onStrike: (attackId: number) => void,
  onEnd: () => void
): Cleanup | null {
  if (active) return null; // 중복 발동 차단
  active = true;
  const attackId = ++liveId; // 공격 고유 ID — 일회성 타격 flag

  const scene = actor.scene;
  const game = scene.game;
  const parent = game.canvas.parentElement;
  const cleanups: Cleanup[] = [];
  let done = false;

  /* ── 안전 복구 — 검은 화면/입력 잠금이 절대 영구화되지 않는 최후 방어 ── */
  const safety = window.setTimeout(() => { try { finish(); } catch { /* 무시 */ } }, DEATH_SLASH_CFG.safetyTimeoutMs);

  const finish = () => {
    if (done) return;
    done = true;
    try { window.clearTimeout(safety); } catch { /* 무시 */ }
    /* 등록된 역순으로 자원 해제 — 실패해도 다음 정리는 계속 */
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try { cleanups[i](); } catch { /* 정리 실패 무시 — 다음 단계 진행 */ }
    }
    active = false;
    try { onEnd(); } catch { /* 무시 */ }
  };

  try {
    if (!parent) { finish(); return null; }

    /* ═══ 1단계: 검은 overlay + 붉은 「死」 연출 (2D — DOM/Phaser 하이브리드) ═══ */
    const veil = document.createElement("div");
    veil.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:7;background:#000;opacity:0;transition:opacity 260ms ease-out;";
    parent.appendChild(veil);
    requestAnimationFrame(() => { veil.style.opacity = "0.88"; });
    cleanups.push(() => { try { veil.remove(); } catch { /* 무시 */ } });

    /* 사(死) 붓글씨 — 세리프 + 붉은 발광 + 붓터치 느낌의 text-shadow 레이어 */
    const glyph = document.createElement("div");
    glyph.textContent = "死";
    glyph.style.cssText = [
      "position:absolute;left:50%;top:44%;transform:translate(-50%,-50%)",
      "pointer-events:none;z-index:8",
      "font-family:'Noto Serif SC','Noto Serif KR',serif;font-weight:900",
      "font-size:min(40vh,40vw);line-height:1;color:#ff1a1a",
      /* vc154 — 유저 피드백 "한자 블룸이 너무 찐해": 발광 반경 25% 축소 (18/42/90→14/32/64) */
      "text-shadow:0 0 14px #ff2a2a,0 0 32px #c80000,0 0 64px #7a0000,6px 4px 2px #4a0000",
      "opacity:0;transition:none",
      "will-change:transform,opacity",
    ].join(";");
    parent.appendChild(glyph);
    cleanups.push(() => { try { glyph.remove(); } catch { /* 무시 */ } });

    /* 잉크 번짐 — 붉은 원형 방사 그라디언트 (붓터치 보조) */
    const ink = document.createElement("div");
    ink.style.cssText = [
      "position:absolute;left:50%;top:44%;width:min(72vh,72vw);height:min(72vh,72vw);transform:translate(-50%,-50%)",
      "pointer-events:none;z-index:8",
      "background:radial-gradient(circle,rgba(255,26,26,0.5) 0%,rgba(160,0,0,0.22) 42%,rgba(60,0,0,0) 70%)",
      "border-radius:50%;opacity:0",
    ].join(";");
    parent.appendChild(ink);
    cleanups.push(() => { try { ink.remove(); } catch { /* 무시 */ } });

    /* 「死」 작게 → 폭발 확대 + 미세 진동 (유저 스펙 ①) */
    glyph.style.transform = "translate(-50%,-50%) scale(0.22)";
    glyph.style.opacity = "0";
    requestAnimationFrame(() => {
      glyph.style.transition = "transform 620ms cubic-bezier(0.16,1.3,0.3,1), opacity 180ms ease-out";
      glyph.style.opacity = "1";
      /* vc154 — 확대 정점도 1.35→1.22로 절제 (블룸 톤다운 수반) */
      glyph.style.transform = "translate(-50%,-50%) scale(1.22)";
      ink.style.transition = "opacity 700ms ease-out";
      ink.style.opacity = "0.85";
      /* 붓 터치 미세 진동 — 카메라 쉐이크 */
      scene.cameras.main.shake(560, 0.006);
      scene.cameras.main.flash(140, 120, 10, 10);
    });
    /* 확대 후 붓눌러 자리잡기 */
    window.setTimeout(() => {
      glyph.style.transition = "transform 240ms ease-in";
      glyph.style.transform = "translate(-50%,-50%) scale(1.05)";
    }, 640);

    /* ═══ 2단계: Three.js 투명 캔버스 + 시네마틱 씬 ═══ */
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;opacity:0;transition:opacity 320ms ease-out;";
    parent.appendChild(canvas);
    cleanups.push(() => { try { canvas.remove(); } catch { /* 무시 */ } });

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    const size = () => ({ w: parent.clientWidth || window.innerWidth, h: parent.clientHeight || window.innerHeight });
    let { w, h } = size();
    renderer.setSize(w, h, false);
    const onResize = () => {
      const s = size();
      if (s.w === w && s.h === h) return;
      w = s.w; h = s.h;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    cleanups.push(() => { try { window.removeEventListener("resize", onResize); } catch { /* 무시 */ } });

    const s3d = new THREE.Scene();
    s3d.fog = new THREE.Fog(0x050005, 260, 920);
    /* 카메라 — 낮은 기문(低機位) 유저 응시 → 참격 순간 검을 따라 민다 */
    const cam = new THREE.PerspectiveCamera(46, w / h, 0.1, 2000);
    cam.position.set(0, 2.1, 12.5);
    cam.lookAt(0, 1.6, 0);

    /* 조명 — 붉은 rim + 강한 명암 (검은 실루엣) */
    const amb = new THREE.AmbientLight(0x1a0510, 0.55);
    const rim = new THREE.DirectionalLight(0xff2222, 2.6);
    rim.position.set(-3.2, 4.4, -6);
    const keyL = new THREE.PointLight(0xff4444, 30, 26);
    keyL.position.set(2.6, 3.4, 4.2);
    s3d.add(amb, rim, keyL);

    /* 바닥 — 어두운 원판 + 은은한 붉은 반사 */
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 40),
      new THREE.MeshStandardMaterial({ color: 0x0a0208, roughness: 0.55, metalness: 0.35 })
    );
    ground.rotation.x = -Math.PI / 2;
    s3d.add(ground);

    /* ── 사무라이 실루엣 (프리미티브 — GLB 교체 지점: DEATH_SLASH_GLB_URL) ── */
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 0.42, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.05, 6, 14), bodyMat);
    body.position.y = 1.28;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), bodyMat);
    head.position.y = 2.28;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.34, 12), bodyMat);
    shoulder.position.y = 1.86;
    /* 카타나 — 칼날(밝은 강철)+ 손잡이 + 타스키 가드 */
    const katana = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 2.35, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xd8dce8, roughness: 0.14, metalness: 0.96, emissive: 0x300000, emissiveIntensity: 0.4 })
    );
    blade.position.y = 1.34;
    blade.rotation.z = 0.045;
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 14), new THREE.MeshStandardMaterial({ color: 0x1a1a1f, metalness: 0.9, roughness: 0.3 }));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x2a1020, roughness: 0.85 }));
    grip.position.y = -0.22;
    katana.add(blade, guard, grip);
    katana.position.set(0.62, 1.5, 0.28);
    katana.rotation.z = -2.15; // 발도 직전 — 허리 뒤쪽으로 감은 자세
    grp.add(body, head, shoulder, katana);
    s3d.add(grp);

    /* ── 참격 궤적 — CatmullRomCurve3 튜브 (붉은 에너지 잔상) ── */
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const makeTrail = (bend: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const ang = -1.9 + t * 3.4;
        pts.push(new THREE.Vector3(Math.cos(ang) * (3.1 + bend * t), 0.4 + Math.sin(t * Math.PI) * 1.9 + bend * t * 0.7, Math.sin(ang) * 1.5));
      }
      return new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 42, 0.06 + bend * 0.03, 7, false),
        trailMat
      );
    };
    const trails = [makeTrail(0), makeTrail(0.5), makeTrail(-0.45)];
    trails.forEach((t) => s3d.add(t));

    /* ── 참격 파티클 (THREE.Points — 붉은 궤적 불티) ── */
    const P_N = 260;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(P_N * 3);
    const pVel = new Float32Array(P_N * 3);
    for (let i = 0; i < P_N; i++) {
      pPos[i * 3] = 0; pPos[i * 3 + 1] = -99; pPos[i * 3 + 2] = 0;
      pVel[i * 3] = (Math.random() - 0.5) * 9;
      pVel[i * 3 + 1] = Math.random() * 7 + 1.5;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xff3a3a, size: 0.14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(pGeo, pMat);
    s3d.add(points);

    /* ── 충격파 링 ── */
    const shock = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffaaaa, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    shock.rotation.x = -Math.PI / 2;
    shock.position.y = 0.12;
    s3d.add(shock);

    cleanups.push(() => {
      try {
        s3d.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        });
        renderer.dispose();
      } catch { /* 무시 */ }
    });

    /* ═══ 타임라인 (ms) — 유저 스펙 흐름 그대로 ═══
     *    0    검은 veil + 「死」 폭발 확대
     *    900  3D 페이드인 — 카메라 다가옴 + 발도 포즈
     *    1750 참격 3연격 (궤적+파티클) → 1900 hitstop(70ms) → 1970 플래시/충격파/피해
     *    2600 3D 페이드아웃 + 「死」 소산
     *    3150 완전 복구 (입력 해제·재발동 가능) */
    const T_3D_IN = 900, T_SLASH = 1750, T_HITSTOP = 1900, T_DMG = T_HITSTOP + DEATH_SLASH_CFG.hitstopMs, T_OUT = 2600, T_END = 3150;
    const timers: number[] = [];
    const at = (ms: number, f: () => void) => { timers.push(window.setTimeout(() => { try { f(); } catch { /* 한 단계 실패가 전체를 죽이지 않게 */ } }, ms)); };
    cleanups.push(() => timers.forEach((t) => { try { window.clearTimeout(t); } catch { /* 무시 */ } }));

    let rafId = 0;
    let t0 = 0;
    let hitstopUntil = -1;
    let striking = false;

    /* 참격 파라미터 — 카타나 궤적 애니메이션 상태 */
    let slashProg = 0;

    const loop = (now: number) => {
      rafId = 0;
      try {
        if (!t0) t0 = now;
        const el = now - t0;
        /* hitstop — 전체 3D 진행 동결 (50~90ms) */
        if (hitstopUntil > 0 && now < hitstopUntil) {
          renderer.render(s3d, cam);
          rafId = requestAnimationFrame(loop);
          return;
        }
        hitstopUntil = -1;

        /* 카메라 도킹 — 낮은 기문에서 전진 */
        const dolly = Math.min(1, Math.max(0, (el - T_3D_IN) / (T_SLASH - T_3D_IN)));
        cam.position.set(Math.sin(dolly * 0.7) * 0.8, 2.1 - dolly * 0.85, 12.5 - dolly * 8.6);
        /* 참격 순간 검을 따라감 (유저 스펙 ③) */
        if (striking) cam.lookAt(katana.getWorldPosition(new THREE.Vector3()));
        else cam.lookAt(0, 1.55 - dolly * 0.12, 0);

        /* 발도 — 허리 뒤 → 머리 위 대각 (포즈 준비) */
        const ready = Math.min(1, Math.max(0, (el - T_3D_IN) / 620));
        katana.rotation.z = -2.15 + ready * 1.15;
        katana.position.y = 1.5 + ready * 0.5;

        /* 참격 3연격 */
        if (el >= T_SLASH) {
          striking = true;
          const sProg = Math.min(1, (el - T_SLASH) / 620);
          slashProg = sProg;
          katana.rotation.z = 1.0 - sProg * 4.6; // 대각 하향→역방향 3연
          katana.position.set(0.4 - sProg * 0.8, 2.0 - sProg * 0.6, 0.8 - sProg * 0.9);
          trails.forEach((tr, i) => {
            const m = tr.material as THREE.MeshBasicMaterial;
            const win = Math.min(1, Math.max(0, (sProg - i * 0.16) * 2.2)) * (1 - sProg * 0.55);
            m.opacity = Math.max(0, win) * 0.85;
            tr.rotation.z = i * 0.5 - sProg * 1.3;
            tr.rotation.y = (i - 1) * 0.35;
          });
        }

        /* 파티클 — 참격 중 방출 */
        const pm = pMat;
        if (striking && pm.opacity < 1) pm.opacity = Math.min(1, pm.opacity + 0.1);
        const pos = pGeo.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < P_N; i++) {
          let y = pos.getY(i);
          if (y < -90 && striking) { pos.setXYZ(i, (Math.random() - 0.5) * 2, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 1.5); }
          else {
            pos.setXYZ(i,
              pos.getX(i) + pVel[i * 3] * 0.016,
              y + pVel[i * 3 + 1] * 0.016,
              pos.getZ(i) + pVel[i * 3 + 2] * 0.016);
            pVel[i * 3 + 1] -= 0.16;
            if (y < 0.02) { pos.setY(i, -99); }
          }
        }
        pos.needsUpdate = true;

        /* 충격파 확장 */
        const sm = shock.material as THREE.MeshBasicMaterial;
        if (sm.opacity > 0) {
          shock.scale.multiplyScalar(1.075);
          sm.opacity = Math.max(0, sm.opacity - 0.03);
        }

        /* 붉은 키 라이트 — 참격 시 강렬하게 */
        keyL.intensity = striking ? 55 : 26 + Math.sin(now / 190) * 5;

        renderer.render(s3d, cam);
        if (el < T_OUT + 700) rafId = requestAnimationFrame(loop);
      } catch {
        /* 프레임 예외 — 시네마틱은 계속, 자원은 finish에서 해제 */
      }
    };

    at(T_3D_IN, () => {
      canvas.style.opacity = "1";
      glyph.style.transition = "opacity 420ms ease-out";
      glyph.style.opacity = "0.22"; // 「死」는 배경 유령으로 잔존 (무단 연결)
      ink.style.opacity = "0.3";
      rafId = requestAnimationFrame(loop);
      cleanups.push(() => { if (rafId) { try { cancelAnimationFrame(rafId); } catch { /* 무시 */ } rafId = 0; } });
    });

    /* ═══ 3·4단계: hitstop → 피해 (연출과 피해 분리 — 콜백 위임) ═══ */
    at(T_HITSTOP, () => { hitstopUntil = performance.now() + DEATH_SLASH_CFG.hitstopMs; });
    at(T_DMG, () => {
      /* 유저 스펙 ④ — 피해는 이미 확정된 콜백 1회 호출 (공격 고유 ID 전달, 중복 판정 없음) */
      try { onStrike(attackId); } catch (e) { console.warn("[DeathSlash] 피해 콜백 예외 — 연출은 계속", e); }
      /* 강한 카메라 쉐이크 + 플래시 + 충격파 */
      scene.cameras.main.shake(460, 0.024);
      scene.cameras.main.flash(180, 255, 40, 40);
      (shock.material as THREE.MeshBasicMaterial).opacity = 0.95;
      shock.scale.setScalar(1);
      /* 붉은 사선 컷 — 2D DOM 오버레이 (화면 전체를 가르는 사선) */
      for (let i = 0; i < 3; i++) {
        const cut = document.createElement("div");
        const ang = -32 + i * 24 + (actor.flipX ? 180 : 0);
        cut.style.cssText = [
          "position:absolute;left:50%;top:50%",
          `width:${120 + i * 14}vw;height:3px`,
          "pointer-events:none;z-index:8",
          "background:linear-gradient(90deg,rgba(255,40,40,0),#ff5a5a 30%,#ffffff 50%,#ff5a5a 70%,rgba(255,40,40,0))",
          `transform:translate(-50%,-50%) rotate(${ang}deg) scaleX(0)`,
          "opacity:0.95",
        ].join(";");
        parent.appendChild(cut);
        window.setTimeout(() => {
          cut.style.transition = "transform 240ms cubic-bezier(0.1,0.9,0.2,1), opacity 420ms ease-out";
          cut.style.transform = `translate(-50%,-50%) rotate(${ang}deg) scaleX(1)`;
          window.setTimeout(() => { cut.style.opacity = "0"; }, 260);
          window.setTimeout(() => { try { cut.remove(); } catch { /* 무시 */ } }, 760);
        }, 30 + i * 90);
      }
    });

    /* ═══ 5단계: 복귀 — 소산 → 페이드아웃 → 무단 연결 → 입력 해제 ═══ */
    at(T_OUT, () => {
      canvas.style.opacity = "0";
      glyph.style.transition = "opacity 520ms ease-out, transform 520ms ease-out";
      glyph.style.transform = "translate(-50%,-50%) scale(1.5)";
      glyph.style.opacity = "0";
      ink.style.opacity = "0";
      /* vc206 (지시 #1 "카메라 줌 아웃시 스킬이 다 안 끝났는데도 원래대로 돌아오는 버그")
       *  줌 연출은 반드시 camFxUntil 을 선언해야 한다. WorldScene 의 줌 복귀 워치독이
       *  fxActive(=camFxUntil > now) 를 보고 개입 여부를 정하는데, 이 연출이 선언을
       *  빠뜨리면 워치독이 500ms 만에 줌을 기준값으로 끌어내려 스킬이 잘린 것처럼 보였다.
       *  punch 180ms + back 220ms + 여유 120ms = 520ms 를 미리 예약한다. */
      const sc = scene as unknown as { camFxUntil?: number; time: { now: number } };
      sc.camFxUntil = Math.max(sc.camFxUntil ?? 0, sc.time.now + 180 + 220 + 120);
      scene.cameras.main.zoomTo(Math.max(0.9, scene.cameras.main.zoom * 1.06), 180); // 짧은 줌
      scene.time.delayedCall(220, () => scene.cameras.main.zoomTo(scene.cameras.main.zoom / 1.06, 220)); // 되돌리기
    });
    at(T_END, () => finish());

    return () => finish(); /* 호출자가 조기 취소할 수 있는 핸들 */
  } catch (e) {
    console.warn("[DeathSlash] 시네마틱 초기화 실패 — 피해만 적용되게 폴백", e);
    /* 연출 실패 시에도 피해 보장 (연출/피해 분리 유저 스펙) */
    try { onStrike(attackId); } catch { /* 무시 */ }
    finish();
    return null;
  }
}
