#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""setCosmetic 단독 패치 (앞선 스크립트에서 regex 실패분)"""
import re

P = "/home/z/my-project/src/game/entities/Player.ts"
src = open(P, encoding="utf-8").read()

pat = re.compile(
    r'  /\*\* 치장 착용/해제 \(가방에서\).*?\*/\n  setCosmetic\(key: CosmeticKey \| null\): boolean \{\n.*?\n  \}\n',
    re.S,
)
m = pat.search(src)
assert m, "setCosmetic block not found"
new = '''/** 치장 착용/해제 (가방에서) — 오라 연출만, 전투 능력 없음
   *  v1.0.7 — 슬롯 분기: 코스튬/헤어 키가 오면 대응 슬롯에 착용 (기존 emit 경로 재사용)
   *  v1.1.0 (#4 해제 버그) — key=null이면 "해제" 의도인데 오라 슬롯으로만 처리돼 코스튬/헤어가 안 벗겨졌다.
   *  착용 중인 슬롯을 추론해 무엇이든 벗는다 (정확한 슬롯 해제는 setCosmeticSlot 사용) */
  setCosmetic(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (!key) {
      if (this.outfit) return this.setOutfit(null);
      if (this.hair) return this.setHair(null);
      if (this.accessory) return this.setAccessory(null);
      if (this.cosmetic) {
        this.cosmetic = null;
        this.scene.onCosmeticChanged();
        return true;
      }
      return false;
    }
    return this.setCosmeticSlot(key, COSMETIC_DEFS[key]?.slot ?? "aura");
  }

  /** v1.1.0 (#4) — 슬롯 지정 착용/해제: UI가 클릭한 아이템의 슬롯을 정확히 전달한다.
   *  해제(key=null) 시 대상 슬롯만 벗는다 — 코스튬+헤어 동시 착용 중에도 원하는 것만 해제 */
  setCosmeticSlot(key: CosmeticKey | null, slot: "aura" | "outfit" | "hair" | "acc"): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (slot === "outfit") return this.setOutfit(key);
    if (slot === "hair") return this.setHair(key);
    if (slot === "acc") return this.setAccessory(key);
    if (this.cosmetic === key) return false;
    this.cosmetic = key;
    this.scene.onCosmeticChanged();
    return true;
  }
'''
src = src[:m.start()] + new + src[m.end():]
open(P, "w", encoding="utf-8").write(src)
print("setCosmetic patched")
