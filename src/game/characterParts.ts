/**
 * vc278 — 부위별 파츠 레이어 (핸드오프 작업 A).
 *
 * 왜 이 파일이 있나
 * -----------------
 * 지금 캐릭터는 **몸체 통짜 시트 + 액세서리 오버레이 1개**다. 액세서리 배치는
 * WorldScene 의 `if (a.key === "acc_crown") ... else if (...)` 하드코딩이라
 * 종류를 늘리려면 500KB 파일을 고쳐야 한다. 게다가 `rank_crown_gold` 는
 * 그 분기에 없어서 **머리에 붙지 않는 버그**가 있었다(텍스처만 acc_crown 재활용).
 *
 * 이 모듈은 그 분기를 **데이터 테이블**로 바꾸고, 그리기 순서를 계산하는
 * **순수 함수**를 제공한다. Phaser 를 import 하지 않으므로 노드 테스트에서 그대로
 * 검증된다(creepZone.ts 와 같은 방침).
 *
 * ── 하지 않은 것 (의도적 상한) ──
 * 몸체 시트를 파츠로 쪼개지 않았다. 기존 28프레임 세트·3·4차 전용 외형·코스튬이
 * 전부 깨진다. 새 그림도 그리지 않았다. 이미 있는 `acc_*` 만 쓴다.
 * `ponytail:` 실제 SPUM 파츠(머리 387종 등)를 쓰려면 시트 분해 + 아틀라스가 필요하고,
 *  그것은 이 파일이 아니라 에셋 파이프라인(scripts/gen_*)의 일이다.
 */

/** 세이브에 저장되는 부위 지정. **전부 optional** — 없으면 기존 동작과 100% 동일. */
export type CharacterParts = {
  wing?: string | null;
  hair?: string | null;
  hat?: string | null;
  cape?: string | null;
  weaponSkin?: string | null;
  /** 표정 — 같은 좌표에서 스프라이트만 교체한다(애니메이션 없음) */
  face?: "idle" | "happy" | "angry" | null;
};

/**
 * 그리기 순서 (뒤 → 앞). 핸드오프 지정 순서를 그대로 옮겼다:
 *   leg_B → wing_B → cape_B → torso → arm_B → weapon → head → hair_B
 *   → face → hair_F → hat → arm_F → cape_F → wing_F
 *
 * 현재 SERTZ 에 실재하는 레이어만 남기고 나머지는 주석으로 자리를 표시했다.
 * 순서 배열을 두는 이유: 나중에 레이어를 추가할 때 **코드가 아니라 이 배열만**
 * 고치면 되게 하기 위해서다.
 */
export const PART_DRAW_ORDER = [
  "cape",      // 뒤로 펄럭이는 망토 (날개보다 몸에 가깝다)
  "wing",      // 날개 — 가장 뒤
  "weaponSkin",
  "hair",      // 뒷머리
  "face",      // 표정 (머리 앞, 모자 뒤)
  "hat",
] as const;

export type PartSlot = (typeof PART_DRAW_ORDER)[number];

/** 부착 기준점의 종류. 좌표 계산 방식이 여기서 갈린다. */
export type PartAnchor = "headTop" | "headSide" | "hover" | "back" | "none";

export type PartLayerSpec = {
  /** 어느 기준점에 붙는가 */
  anchor: PartAnchor;
  /** 기준점으로부터의 오프셋(월드 px, 스케일 적용 전) */
  dx: number;
  dy: number;
  /** 기본 배율 (1 = 본체와 동일) */
  scale: number;
  /** true 면 본체 **뒤** depth (-0.2), false 면 앞 (+0.3) */
  behind: boolean;
  /** 시간 기반 위아래 흔들림을 더할지 */
  bob: boolean;
  /** back 앵커 전용 — 바라보는 방향별 dy 보정 */
  dirDy?: { back: number; side: number; front: number };
};

/**
 * 키 → 부착 사양 테이블.
 *
 * 여기에 한 줄 추가하면 새 장식이 붙는다 — WorldScene 을 고칠 필요가 없다.
 * 값은 vc277 하드코딩 분기를 **그대로 옮긴 것**이므로 기존 동작이 변하지 않는다.
 */
export const PART_ANCHORS: Record<string, PartLayerSpec> = {
  /* ── 기존 어태치 장식 (동작 보존) ── */
  acc_crown: { anchor: "headTop", dx: 1, dy: -2, scale: 1, behind: false, bob: false },
  acc_ribbon: { anchor: "headSide", dx: 0, dy: 4, scale: 1, behind: false, bob: false },
  acc_halo: { anchor: "hover", dx: 0, dy: -9, scale: 1, behind: false, bob: true },
  acc_wings_devil: {
    anchor: "back", dx: 0, dy: 11, scale: 1.35, behind: true, bob: false,
    dirDy: { back: 2, side: -2, front: -5 },
  },
  acc_wings_fairy: {
    anchor: "back", dx: 0, dy: 11, scale: 1.35, behind: true, bob: false,
    dirDy: { back: 2, side: -2, front: -5 },
  },
  /* vc278 — 왕관 버그 수정. rank_crown_gold 는 acc_crown 텍스처를 재활용하는데
   *  vc277 분기는 `a.key === "acc_crown"` 만 봐서 이 키는 **어느 분기도 타지 않았다**.
   *  그 결과 착용 후 이동하면 왕관이 스폰 지점에 남았다. 같은 사양을 준다. */
  rank_crown_gold: { anchor: "headTop", dx: 1, dy: -2, scale: 1, behind: false, bob: false },

  /* ── 신규: 망토 (텍스처는 이미 있고 코드에서 안 쓰이던 acc_cape_*) ── */
  acc_cape_crimson: {
    anchor: "back", dx: 0, dy: 9, scale: 1.2, behind: true, bob: false,
    dirDy: { back: 1, side: -1, front: -3 },
  },
  acc_cape_royal: {
    anchor: "back", dx: 0, dy: 9, scale: 1.2, behind: true, bob: false,
    dirDy: { back: 1, side: -1, front: -3 },
  },
};

/** 테이블에 없는 키 — 위치를 옮기지 않고 본체 위치만 따라간다(종전과 동일한 결과). */
export const PART_FALLBACK: PartLayerSpec = {
  anchor: "none", dx: 0, dy: 0, scale: 1, behind: false, bob: false,
};

/** 부위 이름 → 이 부위가 쓰는 앵커 테이블 키 접두사.
 *  `parts.hat = "acc_crown"` 처럼 **에셋 키를 직접** 넣게 해서 매핑 표를 늘리지 않는다. */
const PART_SLOT_ANCHOR: Record<PartSlot, string> = {
  cape: "acc_cape",
  wing: "acc_wings",
  weaponSkin: "acc_weapon",
  hair: "acc_hair",
  face: "acc_face",
  hat: "acc_hat",
};

export type ResolvedPartLayer = {
  /** 텍스처 키 (에셋 키 그대로) */
  key: string;
  /** 어느 부위인가 */
  slot: PartSlot;
  spec: PartLayerSpec;
};

/**
 * 세이브/플레이어의 착용 필드 → 런타임 뷰. 순수 함수.
 *
 * 저장 스키마를 두 벌로 만들지 않는다: 저장은 기존 `accessory`(장식 1개)와 `cape` 뿐이고,
 * 이 함수가 그것을 부위로 읽어 준다. `accessory` 는 역사적으로 모자류와 날개를 함께 담아
 * 왔으므로 키로 구분한다(날개 = `acc_wings*`, 나머지 = 모자).
 */
export function toCharacterParts(look: { accessory?: string | null; cape?: string | null }): CharacterParts {
  const acc = look.accessory || null;
  const wing = acc && acc.startsWith(PART_SLOT_ANCHOR.wing) ? acc : null;
  return { cape: look.cape || null, wing, hat: wing ? null : acc };
}

/**
 * `parts` 를 **그리기 순서대로** 펼친다. 순수 함수.
 *
 * 규칙
 * ----
 *  · 반환 순서 = PART_DRAW_ORDER (뒤 → 앞). 호출부는 배열 순서대로 add 하면 된다.
 *  · 지정되지 않은(null/undefined/빈 문자열) 부위는 **아예 포함하지 않는다**.
 *  · `parts` 가 없으면 **빈 배열** — 즉 기존 저장 데이터는 지금과 100% 동일하게 동작한다.
 *  · 알 수 없는 키는 PART_FALLBACK 사양을 받되 레이어 자체는 유지한다
 *    (그림이 없으면 호출부가 textures.exists 로 거른다).
 *
 * @param parts 세이브의 부위 지정 (없으면 null)
 * @param hasTexture 선택 — 해당 키의 텍스처가 실제로 있는지. 주면 없는 건 건너뛴다.
 */
export function resolvePartLayers(
  parts: CharacterParts | null | undefined,
  hasTexture?: (key: string) => boolean,
): ResolvedPartLayer[] {
  if (!parts) return [];
  const picked = new Map<PartSlot, string>();
  for (const slot of PART_DRAW_ORDER) {
    const v = parts[slot as keyof CharacterParts];
    if (typeof v !== "string" || v.length === 0) continue;
    if (hasTexture && !hasTexture(v)) continue;
    picked.set(slot, v);
  }
  const out: ResolvedPartLayer[] = [];
  for (const slot of PART_DRAW_ORDER) {
    const key = picked.get(slot);
    if (!key) continue;
    out.push({ key, slot, spec: PART_ANCHORS[key] ?? fallbackFor(slot) });
  }
  return out;
}

/** 테이블에 없는 키의 기본 사양 — 부위별로 그럴듯한 앵커를 준다. */
function fallbackFor(slot: PartSlot): PartLayerSpec {
  const prefix = PART_SLOT_ANCHOR[slot];
  const known = Object.keys(PART_ANCHORS).find((k) => k.startsWith(prefix));
  return known ? PART_ANCHORS[known] : PART_FALLBACK;
}

/** placePart 가 필요로 하는 장면 값 (Phaser 없이 전달) */
export type PartPlacementContext = {
  /** 플레이어 월드 좌표 */
  px: number;
  py: number;
  /** 플레이어 배율 */
  sx: number;
  sy: number;
  flipX: boolean;
  /** 뒷모습인가 (위쪽 바라봄) */
  back: boolean;
  /** 옆모습인가 */
  side: boolean;
  /** 머리 꼭대기 월드 y */
  headTopY: number;
  /** 머리 반폭(월드) */
  headHalfW: number;
  /** 시간 기반 흔들림 값 */
  bob: number;
  /** ACC_ANCHORS 한 줄 [머리꼭대기y, 좌경계x, 우경계x, 발y] */
  anchorY: number;
};

export type PartPlacement = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** 본체 depth 에 더할 값 — 뒤면 음수, 앞이면 양수 */
  depthBias: number;
};

/**
 * 사양 + 장면 값 → 실제 좌표/배율/depth. 순수 함수.
 *
 * vc277 하드코딩 분기의 계산식을 **그대로** 옮겼다. 값이 달라지면 회귀다.
 */
export function placePart(spec: PartLayerSpec, ctx: PartPlacementContext): PartPlacement {
  const scaleX = ctx.sx * spec.scale;
  const scaleY = ctx.sy * spec.scale;
  const depthBias = spec.behind ? -0.2 : 0.3;
  const bob = spec.bob ? ctx.bob : 0;

  let x = ctx.px;
  let y = ctx.py;
  switch (spec.anchor) {
    case "headTop":
      // 종전: px + (flipX ? 1 : -1)  — 좌우로 1px 비켜 머리 정중앙을 피한다
      x = ctx.px + (ctx.flipX ? 1 : -1) * spec.dx;
      y = ctx.headTopY + spec.dy * ctx.sy + bob;
      break;
    case "headSide":
      // 종전: px + (flipX ? -1 : 1) * hw   — 리본은 머리 옆
      x = ctx.px + (ctx.flipX ? -1 : 1) * ctx.headHalfW + spec.dx;
      y = ctx.headTopY + spec.dy * ctx.sy + bob;
      break;
    case "hover":
      x = ctx.px + spec.dx;
      y = ctx.headTopY + spec.dy * ctx.sy + bob;
      break;
    case "back": {
      /* 종전: py + (an[0] + 11 + dy - 32) * sy
       *  dy 는 방향별 — 뒷모습 +2, 옆 −2, 정면 −5. 등 뒤에 붙어 있게 유지한다. */
      const d = spec.dirDy ? (ctx.back ? spec.dirDy.back : ctx.side ? spec.dirDy.side : spec.dirDy.front) : 0;
      x = ctx.px + spec.dx;
      y = ctx.py + (ctx.anchorY + spec.dy + d - 32) * ctx.sy;
      break;
    }
    case "none":
    default:
      // 위치를 바꾸지 않는다 — 종전 unknown 키와 같은 결과
      x = ctx.px;
      y = ctx.py;
      break;
  }
  return { x, y, scaleX, scaleY, depthBias };
}
