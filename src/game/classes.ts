/**
 * 전직 시스템 — 클래스 정의 (v1.7)
 *  - Lv 10 도달 시 1회 전직 (세이브에 cls 저장, 구 세이브 호환: null)
 *  - 보너스는 스탯 getter에서 곱연산/합연산 적용 — 기존 전투 코드 무변경
 */

export const JOB_LEVEL = 10;

export type ClassKey = "warrior" | "ranger" | "mage";

export type ClassDef = {
  key: ClassKey;
  /** 클래스명 (HUD 배지/이름표) */
  name: string;
  /** 칭호 (전직 배너) */
  title: string;
  /** UI 강조색 (css) */
  color: string;
  /** 게임 내 마커색 (hex) */
  hex: number;
  /** 공격력 배율 (atkTotal에 곱함) */
  atkMult: number;
  /** 크리티컬 추가 (%p) */
  critAdd: number;
  /** 전직 즉시 최대 HP 가산 */
  hpAdd: number;
  /** 전직 즉시 최대 MP 가산 */
  mpAdd: number;
  /** 이동속도 배율 */
  speedMult: number;
  desc: string;
};

export const CLASSES: Record<ClassKey, ClassDef> = {
  warrior: {
    key: "warrior",
    name: "전사",
    title: "버서커",
    color: "#ff9a8a",
    hex: 0xff9a8a,
    atkMult: 1.18,
    critAdd: 0,
    hpAdd: 120,
    mpAdd: 0,
    speedMult: 1.0,
    desc: "끈질긴 생명력과 무모한 화력. 앞에 서는 자의 길.",
  },
  ranger: {
    key: "ranger",
    name: "궁수",
    title: "윈드러너",
    color: "#7dffa8",
    hex: 0x7dffa8,
    atkMult: 1.08,
    critAdd: 12,
    hpAdd: 60,
    mpAdd: 20,
    speedMult: 1.15,
    desc: "치명타와 기동성의 대가. 붓처럼 지도를 달린다.",
  },
  mage: {
    key: "mage",
    name: "마법사",
    title: "아크메이지",
    color: "#a5b9ff",
    hex: 0xa5b9ff,
    atkMult: 1.3,
    critAdd: 4,
    hpAdd: 30,
    mpAdd: 60,
    speedMult: 1.0,
    desc: "세계의 마나를 화력으로 바꾼다. 유리 대포.",
  },
};

export const CLASS_LIST: ClassDef[] = [CLASSES.warrior, CLASSES.ranger, CLASSES.mage];

export function isClassKey(v: unknown): v is ClassKey {
  return v === "warrior" || v === "ranger" || v === "mage";
}

/** 세이브 문자열 → 정의 (무효값 null 방어) */
export function classDef(key?: string | null): ClassDef | null {
  return isClassKey(key) ? CLASSES[key] : null;
}
