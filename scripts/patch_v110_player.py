#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.1.0 Player.ts 패치 — setCosmetic 해제(#4) / rerollPotentials 하한(#6) / setOutfit 완전교체+accessory(#1)"""
import re, sys

P = "/home/z/my-project/src/game/entities/Player.ts"
src = open(P, encoding="utf-8").read()
fails = []

def sub(old_pat, new, label, count=1):
    global src
    m = re.search(old_pat, src)
    if not m:
        fails.append(label)
        return
    src = src[:m.start()] + new + src[m.end():]

# ---------- 1) setCosmetic: 해제 추론 + setCosmeticSlot ----------
sub(
    r'/\*\* 치장 착용/해제 \(가방에서\)[^*]*\*/\n  setCosmetic\(key: CosmeticKey \| null\): boolean \{\n(?:.*?\n)*?  \}\n',
    '''/** 치장 착용/해제 (가방에서) — 오라 연출만, 전투 능력 없음
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
''',
    "setCosmetic",
)

# ---------- 2) rerollPotentials: 등급 하한 ----------
sub(
    r'  /\*\* eert 큐브 리롤[^\n]*\n  rerollPotentials\(key: ItemKey\): Potentials \| null \{\n(?:.*?\n)*?    return pot;\n  \}\n',
    '''/** eert 큐브 리롤 — 큐브 소모 후 잠재 재추첨. 결과를 반환 (씬에서 연출)
   *  v1.1.0 (#6) — 현재 등급 미만으로 떨어지지 않는다 (레어→레어 / 에픽 ≠> 레어 / 에픽 → 유니크) */
  rerollPotentials(key: ItemKey): Potentials | null {
    const item = ITEMS[key];
    if (!item || (item.kind !== "weapon" && item.kind !== "armor" && item.kind !== "accessory")) return null;
    // 장비는 보유 중이어야 (장착 중이든 가방이든) / 큐브 보유 확인
    if (!this.owned.includes(key) && this.weapon !== key && this.armor !== key && !this.accessories.includes(key)) return null;
    if (!this.owned.includes("eert_cube")) return null;
    this.consumeConsumable("eert_cube");
    /* v1.0.8 — 잠재 천장: 유니크 미달 연속 카운터 (10회째 롤은 유니크+ 확정 — UI 공시)
     *  v1.1.0 (#6) — minGrade 하한: 현재 등급 아래 굴림은 폐기하고 현재 등급 이상으로만 재추첨 */
    const curGrade = this.potentials[key]?.grade ?? 0;
    const pot = rollPotentials(this.potPity, curGrade);
    this.potPity = pot.grade >= 2 ? 0 : Math.min(POT_PITY_MAX - 1, this.potPity + 1);
    this.potentials[key] = pot;
    this.syncPotentialsHp();
    return pot;
  }
''',
    "rerollPotentials",
)

# ---------- 3) setOutfit: applyBodyLook ----------
sub(
    r'  /\* v1\.0\.7 — 코스튬\(의상\) 착용/해제[^*]*\*/\n  setOutfit\(key: CosmeticKey \| null\): boolean \{\n(?:.*?\n)*?  \}\n',
    '''/* v1.0.7 — 코스튬(의상) 착용/해제 — v1.1.0부터 스프라이트 "완전 교체"(applyBodyLook).
   *  기존: hero 위에 재색상 오버레이 겹치기 → 유저 지시 "겹치지 말고 아예 바뀌는 형식으로" */
  setOutfit(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.outfit === key) return false;
    this.outfit = key;
    this.applyBodyLook();
    this.scene.onCosmeticChanged();
    return true;
  }
''',
    "setOutfit",
)

# ---------- 4) setHair 뒤에 accessory 추가 ----------
sub(
    r'  /\* v1\.0\.7 — 헤어 착용/해제[^*]*\*/\n  setHair\(key: CosmeticKey \| null\): boolean \{\n(?:.*?\n)*?  \}\n',
    '''/* v1.0.7 — 헤어 착용/해제 (포니테일 등 — WorldScene 레이어 동기화) */
  setHair(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.hair === key) return false;
    this.hair = key;
    this.scene.onCosmeticChanged();
    return true;
  }

  /* v1.1.0 (#1 장식) — 어태치 악세서리 (왕관/리본/후광/날개 — WorldScene이 캐릭터에 고정 + 실시간 동기화) */
  accessory: CosmeticKey | null = null;
  setAccessory(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.accessory === key) return false;
    this.accessory = key;
    this.scene.onCosmeticChanged();
    return true;
  }
''',
    "setHair+accessory",
)

# ---------- 5) bodyKey/applyBodyLook 메서드 추가 (setLookTint 앞) ----------
sub(
    r'  /\*\* 로비 생성 시 고른 외형 색조 설정',
    '''/* ---------------- v1.1.0 외형 시스템 (#1/#21/#22) ---------------- */

  /** hero_* 텍스처 / hero-* 애님 키를 현재 외형 시트로 매핑.
   *  "" 프리픽스(기본 남성·기본피부)면 원본 키 그대로 — 기존 동작과 100% 동일 */
  bodyKey(k: string): string {
    if (!this.bodyPrefix) return k;
    if (k.startsWith("hero_")) return `${this.bodyPrefix}_${k.slice(5)}`;
    if (k.startsWith("hero-")) return `${this.bodyPrefix}-${k.slice(5)}`;
    return k;
  }

  /** 성별+피부(+코스튬) → 스프라이트 시트 전환. 코스튬이 최우선 (SPUM식 완전 교체 — 겹치기 아님) */
  applyBodyLook() {
    const prevAnim = this.anims?.currentAnim?.key ?? "";
    const playing = this.anims?.isPlaying ?? false;
    this.bodyPrefix = this.outfit
      ? `cost_${this.outfit.replace("outfit_", "")}`
      : (this.gender === "f" || this.skinIdx !== 2 ? `ch${this.gender}${this.skinIdx}` : "");
    const wantTex = this.bodyKey("hero_idle0");
    if (this.texture.key !== wantTex) this.setTexture(wantTex);
    // 진행 중이던 애니를 새 시트로 이어 재생 (프레임 리셋 방지)
    if (prevAnim && playing) {
      const mapped = this.bodyKey(prevAnim);
      if (this.scene.anims.exists(mapped)) this.play(mapped, true);
    }
    this.applyLookTint();
  }

  /** 로비 생성 시 고른 외형 색조 설정''',
    "bodyKey/applyBodyLook",
)

open(P, "w", encoding="utf-8").write(src)
print("FAILS:", fails if fails else "none")
