/* =====================================================================
 * vc236 (지시 #2 "낚시 기능 없애") — 낚시 시스템 제거.
 *
 * 원래 이 파일은 어종 18종 · 등급 추첨 · 무게 · 도감 계산을 담당했다.
 * 낚시 미니게임(WorldScene.startFishing / tickFishing / resolveFishing),
 * 도감 UI(컬렉션 패널), H키 매핑, fishSave 세이브 필드, 물고기 재료 요리까지
 * 전부 걷어냈다.
 *
 * 남겨둔 것: `FishingZone` — 이름만 낚시지만 실체는 **지역 키 타입**이고,
 * 채집(gathering.ts 의 gatherPoolFor)과 WorldScene.currentZone() 이 지역별
 * 재료 풀을 고르는 데 계속 쓴다. 여기서 지우면 채집이 통째로 깨진다.
 * (이름을 바꾸려면 두 호출부를 함께 고쳐야 하므로 이번 범위에서는 유지)
 * ===================================================================== */

/** 지역 키 — 채집 재료 풀 판정에 쓰인다 (구 낚시 지역 구분에서 유래). */
export type FishingZone = "forest" | "kingdom" | "alfheim" | "muspelheim" | "niflheim" | "cave" | "nidavellir" | "hel" | "abyss";
