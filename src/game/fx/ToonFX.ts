/**
 * v1.0.2 (#툰셰이더) — 캐릭터/보스 툰 스타일 보강 (Phaser 4 Filters 시스템)
 *
 * 목표(유저 지시): 명확한 명암 단계 · 캐릭터 실루엣 강조 · 적/보스 구분 · 환경과의 시각 분리 ·
 * 과도한 후처리 방지 · 모바일 성능 유지.
 *
 * 구현: 화면 전체 후처리 대신 **플레이어/보스 스프라이트에만** 외부 필터 2종 부착
 *  1) ColorMatrix — 대비/채도 소폭 상향 (Base Color 위 툰 셀룰룩 명암 체감)
 *  2) Glow(외곽선) — 지정색 림라이트(soft outline)로 배경에서 캐릭터를 분리
 *
 * 비용: 스프라이트 2~3개에만 적용되는 저예산 필터. fxLevel 0(적응형 저사양)에서는 생략/해제.
 * Canvas 폴백(비 WebGL)은 filters 자체가 없어 자동 스킵 — 기존 렌더와 동일.
 */
import type Phaser from "phaser";
import { loadFx } from "../config"; // vc145 (#11) — 셰이더 강도 조절바 값을 툰 파이프라인에 연결

type ColorMatrixCtrl = { colorMatrix: { contrast: (v: number, m?: boolean) => unknown; saturate: (v: number, m?: boolean) => unknown } };
type FilteredList = { addColorMatrix: () => ColorMatrixCtrl; addGlow: (cfg: Record<string, unknown>) => unknown; clear: () => void };

export type ToonOpts = {
  /** 림라이트 색 (기본: 하늘색 — 플레이어, 보스는 오브색 권장) */
  rim?: number;
  /** 외곽선 강도 */
  rimStrength?: number;
  /** 대비 (기본 1.06 — 과하지 않게) */
  contrast?: number;
  /** 채도 (기본 1.18) */
  saturate?: number;
};

type Filterable = { filters?: { external?: FilteredList } | null; enableFilters?: () => unknown } | null;

/** 스프라이트에 툰 스타일 부착 — 실패/미지원 시 null (기존 렌더 유지)
 *  v1.0.8 버그 수정: Phaser 4의 오브젝트 필터는 opt-in — enableFilters()를 호출해야
 *  filters 게터가 null에서 FilterList로 전환된다. 미호출 시 본 함수가 조용히 null을 반환해
 *  툰 셰이더가 플레이어/보스에 "한 번도" 붙지 않았다 (유저 리포트 "쉐이더 어디감??"의 정체). */
export function applyToonStyle(obj: Filterable, opts: ToonOpts = {}): unknown[] | null {
  const o = obj as { filters?: { external?: FilteredList } | null; enableFilters?: () => unknown } | null;
  if (o && !o.filters && typeof o.enableFilters === "function") {
    try { o.enableFilters(); } catch { /* WebGL 미지원/파괴됨 — 스킵 */ }
  }
  const list = o?.filters?.external;
  if (!list?.addColorMatrix || !list.addGlow) return null;
  const created: unknown[] = [];
  try {
    const cm = list.addColorMatrix();
    /* vc147 (#1 툰 효과 강화) — 스프라이트 림라이트도 기본 강화 (vc145 완화분 되돌림+증폭) */
    cm.colorMatrix.contrast(opts.contrast ?? 1.07);
    cm.colorMatrix.saturate(opts.saturate ?? 1.16);
    created.push(cm);
  } catch {
    return created.length ? created : null;
  }
  try {
    const glow = list.addGlow({
      color: opts.rim ?? 0x9fd8ff,
      outerStrength: opts.rimStrength ?? 2.0,
      innerStrength: 0.5,
      distance: 9,
      quality: 4, // 모바일 예산 — 낮은 품질 고정
    });
    created.push(glow);
  } catch { /* Glow 실패 시 ColorMatrix만이라도 유지 */ }
  return created.length ? created : null;
}

/** 부착된 툰 필터 해제 — 해당 리스트의 외부 필터 전부 제거(대상은 전용 스프라이트만) */
export function clearToonStyle(obj: Filterable) {
  try {
    (obj as Filterable | undefined)?.filters?.external?.clear?.();
  } catch { /* 무시 */ }
}

/* ================= vc142 (#11) — 화면 전체 툰 셰이딩 파이프라인 =================
 *  유저 지시: "내가 준 에셋에서 Toon 쉐이더 관련 에셋이 있거든? 그거를 바탕으로 이 게임에 쉐이더 적용해"
 *  Toon Shaders Pro는 Unity HLSL이라 직접 이식 불가 → 동일한 툰 렌더링 결과를 Phaser 4 내장
 *  필터 조합으로 재현한다 (커스텀 셰이더 리스크 0, 모바일 성능 안전):
 *   1) Blocky(size 2)  — 프레임 버퍼를 2px 블록 단위로 평탄화 = 포스터라이즈(셀룰룩 색 단계)
 *   2) ColorMatrix     — 대비/채도 상향 = 명암 단계 강조 (툰 셰이딩의 이2단계 톤 체감)
 *   3) (스프라이트) Glow 림라이트 — applyToonStyle이 기존에 담당 (캐릭터/보스 외곽선)
 *  설정: localStorage "sertz_toon" (기본 켬 — fxLevel 0(적응형 저사양)/Canvas에서는 자동 해제) */

const TOON_KEY = "sertz_toon";

export function toonEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TOON_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setToonEnabled(on: boolean) {
  try {
    window.localStorage.setItem(TOON_KEY, on ? "1" : "0");
  } catch { /* 무시 */ }
}

type CamFilterable = { filters?: { external?: FilteredList & { addBlocky?: (cfg?: Record<string, unknown>) => unknown } } | null; enableFilters?: () => unknown } | null;

/** 메인 카메라에 툰 셰이딩 부착 — 실패 시 null (기존 렌더 유지)
 *  vc145 (#3 강도 완화 + #11 조절바 연동):
 *  - 설정 "효과 강도" 슬라이더(loadFx().intensity 0~100)가 툰 후처리 강도를 결정한다 (기존엔 무시 → 조절바 무반응 버그)
 *  - 강도 0 = 셰이더 완전 끔 → 부착하지 않음 (패널 문구와 동일 동작)
 *  vc147 (#1/#2): 밝기 감광 폐지(기본 1.0 복원) + 대비/채도/밝기 전부 정방향 강화 —
 *  슬라이더를 올리면 더 밝고 더 툰닝된다 (기본 55 기준 대비 1.09·채도 1.22). */
export function applyToonCamera(camera: unknown): unknown[] | null {
  const intensity = loadFx().intensity;
  if (intensity <= 0) return null; // 슬라이더 0 = 셰이더 완전 끔
  const k = Math.max(0.2, Math.min(1.6, intensity / 55)); // 55 기준 1.0 배율, 100에서 1.6 상한
  const cam = camera as CamFilterable;
  if (cam && !cam.filters && typeof cam.enableFilters === "function") {
    try { cam.enableFilters(); } catch { /* WebGL 미지원 */ }
  }
  const list = cam?.filters?.external;
  if (!list) return null;
  const created: unknown[] = [];
  try {
    /* Blocky(포스터라이즈)는 강도 낮을 땐 생략 — 픽셀 뭉개짐 최소화 */
    if (list.addBlocky && k >= 0.45) {
      const blocky = list.addBlocky({ size: 2 });
      created.push(blocky);
    }
  } catch { /* Blocky 미지원 — ColorMatrix만이라도 */ }
  try {
    const cm = list.addColorMatrix();
    /* vc147 (#1 툰 강화 + #2 역방향 수정):
     *  - vc146의 `brightness(1-0.22k)`는 슬라이더를 올릴수록 화면이 "더 어두워지는"
     *    역방향 동작이었다(유저 제보 "쉐이더 강도 조절기능 반대로 되있음"의 근원).
     *  - 이제 밝기/대비/채도 전부 정방향(강도↑ = 더 밝고 더 툰닝)이며 기본 밝기 1.0 복원.
     *  - 툰 체감 강화: 대비 1+0.09k(기본 1.09)·채도 1+0.22k(기본 1.22). */
    cm.colorMatrix.contrast(1 + 0.09 * k);
    cm.colorMatrix.saturate(1 + 0.22 * k);
    (cm.colorMatrix as unknown as { brightness: (v: number, m?: boolean) => unknown }).brightness(
      Math.min(1.08, 0.94 + 0.06 * k),
    );
    created.push(cm);
  } catch {
    return created.length ? created : null;
  }
  return created.length ? created : null;
}
