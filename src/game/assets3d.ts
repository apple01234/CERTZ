/**
 * vc180 — 3D 에셋 카탈로그 + 로더.
 *
 * 사용자 지시: "블랜더 깔아 (2d로 절대 변환시키지 마)"
 *  → Blender 3.4.1(arm64) 설치, FBX 76종 중 70종을 **GLB(3D)** 로 익스포트했다.
 *    스프라이트시트로 굽지 않는다. GLB는 표준 3D 포맷이라 three.js·Babylon·모델뷰어
 *    어디서든 그대로 열린다.
 *
 * 이 모듈은 게임 런타임과 QA 도구가 같은 목록을 보게 한다(이중 관리 금지).
 * Phaser는 2D 엔진이라 GLB를 직접 그리지 못하므로, 인게임 사용은
 *  ① 별도 3D 레이어(three.js)로 얹거나
 *  ② 에셋 검수/프리뷰 화면에서 쓰는 것을 전제로 한다.
 */

export type Asset3D = {
  /** 게임에서 부를 키 (확장자 제외) */
  key: string;
  /** 실제 파일명 */
  file: string;
  /** 원본 팩 (uni / sertz) */
  pack: string;
  verts: number;
  polys: number;
  /** 애니메이션 클립 이름 (없으면 빈 배열) */
  actions: string[];
  bytes: number;
};

/** public/assets3d/_report.json 을 그대로 읽어 카탈로그로 쓴다.
 *  빌드 타임에 정적 import 하면 번들이 커지므로 fetch로 받는다. */
export const ASSET3D_BASE = "assets3d";

export async function loadAsset3DCatalog(): Promise<Asset3D[]> {
  try {
    const res = await fetch(`${ASSET3D_BASE}/_report.json`, { cache: "force-cache" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        ok?: boolean; glb?: string; file?: string;
        verts?: number; polys?: number; actions?: string[]; glb_bytes?: number;
      }[];
    };
    return (data.items ?? [])
      .filter((i) => i.ok && i.glb)
      .map((i) => ({
        key: (i.glb as string).replace(/\.glb$/, ""),
        file: i.glb as string,
        pack: (i.file ?? "").split("/")[0] || "unknown",
        verts: i.verts ?? 0,
        polys: i.polys ?? 0,
        actions: i.actions ?? [],
        bytes: i.glb_bytes ?? 0,
      }));
  } catch {
    return [];
  }
}

/** 카탈로그 요약 — 설정/디버그 화면 표기용 */
export function summarize(cat: Asset3D[]) {
  return {
    count: cat.length,
    verts: cat.reduce((a, b) => a + b.verts, 0),
    polys: cat.reduce((a, b) => a + b.polys, 0),
    animated: cat.filter((c) => c.actions.length > 0).length,
    bytes: cat.reduce((a, b) => a + b.bytes, 0),
    packs: [...new Set(cat.map((c) => c.pack))],
  };
}
