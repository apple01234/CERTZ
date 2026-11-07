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
  /* vc255 (지시 #7) — 기본 남캐도 이제 전용 시트를 쓴다.
   *
   *  [종전] `gender === "f" || skin !== 2 ? ch{g}{skin} : ""` —
   *   남캐 + 기본 피부(2)만 `""`(FA 아틀라스)로 떨어졌다. 그런데 FA idle 프레임은
   *   64×85 안에 캐릭터가 **18×36px** 이고, 실제로는 사람이 아니라 "청보라색 외계 생물"
   *   (큰 원형 머리 + 1px 촉수 팔다리 + 노란 사각 눈)로 보인다. 사용자가 지적한
   *   "남캐 디자인 꼬라지"가 이것이다.
   *  [수리] `scripts/make_player_sheet.py` 가 npcbody 규격(96×64 캔버스, 캐릭터 23×56,
   *   2.2등신, 실제 이목구비)으로 `chm2_*`/`chf2_*` 전 세트(7동작 × 4프레임 = 56장)를
   *   생성했다. 이제 기본 남캐도 자기 시트를 갖고, FA 폴백은 시트가 **없을 때만** 쓴다. */
  /* vc253 (지시 "그냥 이 에셋으로 바꿔") — 기본 캐릭터 시트를 유저가 준 그림으로 교체했다.
   *  `tools/apply_user_character.py` 가 그 원본(40×38)을 96×64 캔버스 규격의
   *  chm2_ / chf2_ 56장으로 변환한다. 그래서 기본 외형은 다시 `ch{m|f}{skin}` 이다.
   *  (hero_ 세트는 남성 전용이라 여성 캐릭터에 쓸 수 없었다.) */
  const own = `ch${gender}${skin}`;
  if (hasBody(own)) return own;
  /* 시트가 없는 구 배포/신규 피부 조합만 FA 로 폴백(깨짐 방지) */
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
