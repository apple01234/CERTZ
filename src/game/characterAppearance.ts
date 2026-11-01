import { tier2RootOf } from "./classes";
import faAtlas from "../../public/assets/fa/p1.json" with { type: "json" };

/** 기존 에셋만 선택한다. 선택창/Player에서 같은 우선순위로 사용하며 VFX는 포함하지 않는다. */
export type CharacterAppearance = {
  cls?: string | null;
  gender?: "m" | "f" | null;
  skinIdx?: number | null;
  outfit?: string | null;
  gmSkin?: boolean;
  gmApproved?: boolean;
};

/** 빈 prefix는 기본 남성(FA 사용 가능), 나머지는 기존 28프레임 몸체 세트다.
 * hasBody는 에셋이 실제로 없는 구 배포의 폴백용이다. 아직 로드되지 않았다는 이유로
 * false를 주면 전용 3·4차 외형 대신 2차 외형이 고정되므로 로드 여부와 구분한다. */
export function resolveBodyPrefix(
  look: CharacterAppearance,
  hasBody: (prefix: string) => boolean = () => true,
): string {
  const gender = look.gender === "f" ? "f" : "m";
  const skin = Number.isInteger(look.skinIdx) && look.skinIdx! >= 0 && look.skinIdx! <= 5 ? look.skinIdx! : 2;
  if (look.gmSkin && look.gmApproved) return "gm";
  const outfit = look.outfit?.replace("outfit_", "");
  if (outfit) return gender === "m" ? `costm_${outfit}` : `cost_${outfit}`;
  const root = tier2RootOf(look.cls);
  if (root) {
    const own = `job${gender}_${look.cls}`;
    return hasBody(own) ? own : `job${gender}_${root}`;
  }
  return gender === "f" || skin !== 2 ? `ch${gender}${skin}` : "";
}

/** DOM은 기본 FA도 새 파일 생성 없이 기존 아틀라스의 idle 프레임을 잘라 보여준다. */
export function resolveCharacterPreview(look: CharacterAppearance): {
  src: string;
  width: number;
  height: number;
  crop?: { x: number; y: number; w: number; h: number };
  sheet?: { w: number; h: number };
} {
  const prefix = resolveBodyPrefix(look);
  if (prefix) return { src: `/assets/${prefix}_idle0.webp`, width: 96, height: 64 };
  const crop = faAtlas.frames.fa_p1_idle__0.frame;
  return { src: "/assets/fa/p1.png", width: crop.w, height: crop.h, crop, sheet: faAtlas.meta.size };
}
