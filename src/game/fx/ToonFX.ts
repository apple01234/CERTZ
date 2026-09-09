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

type Filterable = { filters?: { external?: FilteredList } } | null;

/** 스프라이트에 툰 스타일 부착 — 실패/미지원 시 null (기존 렌더 유지) */
export function applyToonStyle(obj: Filterable, opts: ToonOpts = {}): unknown[] | null {
  const list = (obj as Filterable | undefined)?.filters?.external;
  if (!list?.addColorMatrix || !list.addGlow) return null;
  const created: unknown[] = [];
  try {
    const cm = list.addColorMatrix();
    cm.colorMatrix.contrast(opts.contrast ?? 1.06);
    cm.colorMatrix.saturate(opts.saturate ?? 1.18);
    created.push(cm);
  } catch {
    return created.length ? created : null;
  }
  try {
    const glow = list.addGlow({
      color: opts.rim ?? 0x9fd8ff,
      outerStrength: opts.rimStrength ?? 2.2,
      innerStrength: 0.5,
      distance: 10,
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
