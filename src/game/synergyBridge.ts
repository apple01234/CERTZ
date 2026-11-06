/**
 * 시너지 브리지 — 장비에서 태그를 **유도**하고, 플레이어 스탯에 보너스를 환산한다
 *
 * 왜 뽑았나
 *   `synergy.ts` 는 집계 규칙(태그 개수 → 보너스)만 갖고 있어서, "무엇이 태그를 세는가"가
 *   게임 어디에도 없었다. 그렇다고 아이템 222개에 `synergy: "fire"` 필드를 새로 심는 건
 *   과하다(YAGNI) — 이미 `ItemDef.kind` 와 `SET_GEAR`/`CHAPTER_ELEM` 이 그 정보를 갖고 있다.
 *   여기서는 **기존 데이터에서 유도만** 하고, 밸런스 수치는 `synergy.ts` 것만 쓴다.
 *
 * 무엇
 *   · countSynergyTags — 장착 목록 → 태그별 개수
 *   · applySynergy    — 활성 보너스 → 스탯 **증가분**(델타)
 *
 * 매핑(새 이름을 만들지 않는다)
 *   · fire / frost / storm ← `ElemKey` 의 fire / ice / electric
 *     (물·바람·땅·자연·빛·어둠은 대응 태그가 없다 — 억지로 6태그에 밀어넣지 않는다)
 *   · blade / guard / vitality ← `ItemDef.kind` 의 weapon / armor / accessory
 *   · 세트 장비는 `elem` 이 없어도 `SET_GEAR` 의 챕터 → `CHAPTER_ELEM` 으로 원소를 얻는다
 *
 * 이 파일이 지켜야 하는 계약
 *   · Phaser / DOM / Math.random 의존 없음. 같은 입력이면 언제나 같은 출력.
 *   · 입력 배열/객체를 변형하지 않는다.
 *   · 태그가 0개면 모든 델타가 정확히 0 — 호출부 수치가 종전과 완전히 동일하다.
 */

import { CHAPTER_ELEM, ELEMENT_META, ITEMS, SET_GEAR, type ElemKey, type ItemKey } from "./data";
import { synergyTotals, type SynergyTag, type SynergyTotals } from "./synergy";

/** 장착 한 칸. `elem`/`setKey` 는 생략 가능 — 비면 아이템 데이터에서 유도한다. */
export type EquippedPiece = { key: string; elem?: string; setKey?: string };

/** 플레이어 스탯 기준값 — 시너지를 얹기 **전** 수치. */
export type SynergyBaseStats = {
  atk: number;
  /** 치명타 확률(%p) */
  crit: number;
  def: number;
  maxHp: number;
  /** 쿨타임(ms) 또는 비율 스칼라 — 0 이면 감소 효과도 0 */
  cdr: number;
};

/** `synergyTotals` 를 기준값에 얹었을 때의 **증가분**. 태그가 없으면 전부 0. */
export type SynergyDelta = SynergyBaseStats;

/** 원소 → 태그. 대응 태그가 없는 원소는 null (억지 매핑 금지). */
const ELEM_TAG: Partial<Record<ElemKey, SynergyTag>> = {
  fire: "fire",
  ice: "frost",
  electric: "storm",
};

/** 장비 종류 → 태그. */
const KIND_TAG: Partial<Record<string, SynergyTag>> = {
  weapon: "blade",
  armor: "guard",
  accessory: "vitality",
};

/** 세트 장비 키 → 세트 챕터. `setOfItem` 은 프리픽스 슬라이스가 어긋나 늘 null 이라 쓰지 않는다. */
const SET_OF_KEY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [ch, def] of Object.entries(SET_GEAR)) {
    out[def.w] = ch;
    out[def.a] = ch;
    out[def.r] = ch;
  }
  return out;
})();

/** 유효한 ElemKey 인지 — 외부 입력이라 방어한다. ELEMENT_META 가 10종 전부의 정본이다. */
function asElem(v: string | undefined): ElemKey | null {
  return v && v in ELEMENT_META ? (v as ElemKey) : null;
}

/**
 * 장착 중인 장비/세트에서 시너지 태그 개수를 센다. 새 데이터 필드를 추가하지 않는다.
 *
 * 한 칸이 **원소 태그 1개 + 종류 태그 1개**를 낼 수 있다
 * (예: 화염 세트 무기 = fire +1, blade +1). 두 축은 서로 다른 정체성이라 합쳐 세지 않는다.
 * 개수가 0 인 태그는 결과에 넣지 않는다.
 */
export function countSynergyTags(equipped: readonly EquippedPiece[]): Partial<Record<SynergyTag, number>> {
  const counts: Partial<Record<SynergyTag, number>> = {};
  const add = (tag: SynergyTag | undefined) => {
    if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
  };
  for (const piece of equipped ?? []) {
    if (!piece || typeof piece.key !== "string") continue;
    const item = ITEMS[piece.key as ItemKey];
    /* elem 우선, 없으면 세트 챕터의 원소(CHAPTER_ELEM). 둘 다 없으면 원소 태그 없음. */
    const setCh = piece.setKey ?? SET_OF_KEY[piece.key];
    const elem = asElem(piece.elem) ?? asElem(setCh ? CHAPTER_ELEM[setCh] : undefined);
    add(elem ? ELEM_TAG[elem] : undefined);
    add(KIND_TAG[item?.kind ?? ""]);
  }
  return counts;
}

/** 정수 스탯은 반올림, 치명타만 0.1 단위(Player.critRate 와 같은 정밀도)로 맞춘다. */
function roundDelta(v: number, oneDecimal = false): number {
  if (!Number.isFinite(v)) return 0;
  return oneDecimal ? Math.round(v * 10) / 10 : Math.round(v);
}

/**
 * 플레이어 스탯에 시너지 보너스를 곱/합산한다. 태그가 없으면 정확히 종전과 동일하다.
 *
 * 반환값은 **증가분(델타)** — `base` 를 돌려주는 게 아니다. 호출부가 이미 다른 보너스까지
 * 합산한 최종값을 갖고 있으므로, 여기서 절대값을 만들면 무엇을 기준으로 곱했는지가 사라진다.
 * 델타로 주면 `extBonus` 처럼 flat 채널에 그대로 더할 수 있고, 두 번 호출해도 누적되지 않는다.
 * `cdr` 은 "감소량"이라 델타가 양수다.
 */
export function applySynergy(totals: SynergyTotals, base: SynergyBaseStats): SynergyDelta {
  const safe = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  return {
    atk: roundDelta(safe(base.atk) * safe(totals.atkPct)),
    crit: roundDelta(totals.critAdd * 100, true),
    def: roundDelta(safe(base.def) * safe(totals.defPct)),
    maxHp: roundDelta(safe(base.maxHp) * safe(totals.hpPct)),
    cdr: roundDelta(safe(base.cdr) * safe(totals.cdrPct)),
  };
}

/** 편의 — 장착 목록에서 바로 보너스 총합까지. `synergyTotals` 를 그대로 재사용한다. */
export function synergyFor(equipped: readonly EquippedPiece[]): SynergyTotals {
  return synergyTotals(countSynergyTags(equipped));
}
