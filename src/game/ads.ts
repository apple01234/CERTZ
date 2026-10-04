"use client";

import { Capacitor } from "@capacitor/core";

/**
 * v1.0.1-beta — 수익 연동 서비스 실연동 (BM 구글 플레이 결제 + 광고 보상)
 *
 * [보상형 광고 — AdMob]
 *  - 폰 버전(APK/AAB)에서만 동작 (Capacitor 네이티브 감지)
 *  - 기본값은 구글 공식 테스트 단위 ID — 실제 광고가 내려오고 보상도 지급된다.
 *  - 수익화 전환: 아래 ADMOB_REWARDED_ID를 본인 AdMob 보상형 단위 ID로 바꾸고
 *    AndroidManifest의 APPLICATION_ID(테스트 앱 ID)도 본인 앱 ID로 교체 후 재빌드.
 *
 * [에메랄드 충전 — Google Play 결제 (v1.0.1-beta 실연동)]
 *  - @capgo/native-purchases 플러그인 (구글 플레이 Billing 래퍼)
 *  - v4.1.0의 문제 수정: consumable(소모성) 상품이 consume되지 않아
 *    "이미 소유한 상품" 오류로 재구매가 막히던 것 → isConsumable 소유 보관 +
 *    지급 완료 후 consumePurchase로 소비(구매→지급→소비의 엄격한 순서 보장).
 *  - 결제 성공 직후 앱이 죽어도(지급 누락) 부팅 복구가 getPurchases로 미지급
 *    결제를 찾아 지급한다 — purchase token ledger(localStorage)로 이중 지급 차단.
 *  - acknowledge는 3일 내 필요(미승인 시 자동 환불) — 소비(consume)는 승인을
 *    포함하므로 젬은 소비로, 패키지(비소모성)는 지급 후 acknowledgePurchase로 처리.
 *
 * 웹(브라우저)에서는 네이티브 SDK가 없어 두 기능 모두 안내만 제공한다.
 */

/** 내 AdMob 보상형 광고 단위 ID — 여기만 바꾸면 실제 수익 연동 완료 */
export const ADMOB_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917"; // 구글 공식 테스트 ID

/** 에메랄드 충전 상품 (Play Console 인앱 상품 ID → 에메랄드 수량)
 *  priceLabel은 스토어 가격 조회 실패 시 폴백 — 실가격은 getProducts로 실측 표시 */
export const GEM_SKUS: { id: string; gems: number; priceLabel: string }[] = [
  { id: "sertz_gem_10", gems: 10, priceLabel: "₩1,100" },
  { id: "sertz_gem_55", gems: 55, priceLabel: "₩5,500" },
  { id: "sertz_gem_120", gems: 120, priceLabel: "₩11,000" },
  { id: "sertz_gem_300", gems: 300, priceLabel: "₩27,500" },
];

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/* v1.1.1 (#3 결제 취소) — 유저 취소와 진짜 실패를 구분한다.
 *  기존엔 어떤 에러든 "결제가 취소됐다"로 표시돼 (상품 미등록·네트워크 오류 포함)
 *  결제 시도마다 "취소됐다"가 반복 표시됐다.
 *  v1.0.1-beta — PENDING(편의점 결제 등 지연 확정) 분류 추가. */
function classifyPurchaseError(e: unknown): "cancelled" | "unavailable" | "pending" | "error" {
  const msg = String((e as { message?: string; code?: number })?.message ?? e ?? "").toLowerCase();
  if (msg.includes("cancel")) return "cancelled"; // 유저가 다이얼로그를 닫음
  if (msg.includes("pending")) return "pending"; // 결제 수단 확정 대기 — 완료 시 부팅 복구가 지급
  if (msg.includes("item") && (msg.includes("not") || msg.includes("unavail"))) return "unavailable"; // 상품 미등록
  if (msg.includes("not found") || msg.includes("unavailable") || msg.includes("sku")) return "unavailable";
  return "error";
}

/* ================= 구매 토큰 ledger (이중 지급 차단 + 부팅 복구) =================
 *  localStorage에 처리 완료 purchaseToken을 기록 — 부팅 복구가 소유 결제를
 *  훑을 때 ledger에 있으면 이미 지급된 것(재지급 금지, 젬이면 소비만 마무리). */
const LEDGER_KEY = "sertz_purch_ledger";

function loadLedger(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) || "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

function ledgerAdd(token: string): void {
  try {
    const l = loadLedger();
    l[token] = true;
    const keys = Object.keys(l);
    if (keys.length > 80) for (const k of keys.slice(0, keys.length - 80)) delete l[k]; // 상한 80개
    localStorage.setItem(LEDGER_KEY, JSON.stringify(l));
  } catch {
    /* 시크릿 모드 등 저장 실패 — 복구는 다음 결제 때 다시 시도 */
  }
}

type Txn = {
  transactionId?: string;
  purchaseToken?: string;
  productIdentifier?: string;
  isAcknowledged?: boolean;
};

async function plugin(): Promise<typeof import("@capgo/native-purchases").NativePurchases> {
  const m = await import("@capgo/native-purchases");
  return m.NativePurchases;
}

let adInitDone = false;

/** 보상형 광고 시청 → 성공 시 true. 웹/미초기화 환경은 false + 이유 반환 */
export async function showRewardedAd(): Promise<{ ok: boolean; reason?: string }> {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    if (!adInitDone) {
      await AdMob.initialize({ initializeForTesting: false });
      adInitDone = true;
    }
    await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_ID });
    const res = await AdMob.showRewardVideoAd();
    /* 플러그인 버전별 응답 형태 차이 흡수 — reward 확인 가능하면 검증, 아니면 완료 응답 자체를 성공으로 본다 */
    const reward = (res as { reward?: unknown } | undefined)?.reward;
    if (reward === null) return { ok: false, reason: "no-reward" };
    return { ok: true };
  } catch (e) {
    console.warn("[SERTZ] 광고 시청 실패", e);
    return { ok: false, reason: "error" };
  }
}

/** 구글 플레이 결제 — 에메랄드 상품 구매. 성공 시 { ok, token }
 *  v1.0.1-beta — 소모성 상품 소유 보관 설계:
 *   ① isConsumable:false + autoAcknowledge:false (소비 전까지 getPurchases에 남음 → 사망 복구 가능)
 *   ② 호출부(월드씬)가 지급 → ledger 기록 → completeGemPurchase(token)로 소비
 *   ③ 소비(consume)는 승인(acknowledge)을 포함 — 3일 자동환불 걱정 없음 */
let buying = false; // 결제창 중복 오픈 가드 (연타 → 다중 다이얼로그 방지)
export async function purchaseGems(skuId: string): Promise<{ ok: boolean; reason?: string; token?: string }> {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  if (!GEM_SKUS.some((s) => s.id === skuId)) return { ok: false, reason: "unknown-product" };
  if (buying) return { ok: false, reason: "busy" };
  buying = true;
  try {
    const P = await plugin();
    const r = (await P.purchaseProduct({
      productIdentifier: skuId,
      productType: "inapp" as never,
      isConsumable: false, // 소비는 지급 완료 후 completeGemPurchase에서
      autoAcknowledgePurchases: false, // 소비가 승인을 대체
    })) as unknown as Txn;
    const token = r?.purchaseToken || r?.transactionId;
    if (!token) return { ok: false, reason: "error" };
    return { ok: true, token };
  } catch (e) {
    console.warn("[SERTZ] 구글 플레이 결제 실패", e);
    return { ok: false, reason: classifyPurchaseError(e) };
  } finally {
    buying = false;
  }
}

/** 젬 지급 완료 후 호출 — ledger 등록 + 소비(재구매 가능화, 승인 포함) */
export async function completeGemPurchase(token: string): Promise<void> {
  ledgerAdd(token);
  try {
    const P = await plugin();
    await P.consumePurchase({ purchaseToken: token });
  } catch (e) {
    console.warn("[SERTZ] 젬 소비 실패(부팅 복구가 마무리)", e);
  }
}

/** v1.0.2 (#현금패키지) — 실제 결제(스토어 인앱) 패키지 상품.
 *  가격/판매 여부는 Play Console 상품 등록 기준 — 클라이언트에 금액을 하드코딩하지 않는다.
 *  구매 성공 시 WorldScene이 STORE_PACK_CONTENTS[id] 내용을 지급한다.
 *  v1.0.1-beta — 비소모성 유지(재설치 시 getPurchases 복원 대상) + 토큰 반환. */
export const STORE_PACKS: { id: string; label: string; desc: string }[] = [
  { id: "sertz_pack_growth_19800", label: "성장 패키지", desc: "성장 재화 · 강화 재료 · 경험치 아이템" },
  { id: "sertz_pack_growth_cos_29900", label: "성장+치장 패키지", desc: "성장 재화 · 전용 코스튬 · 전용 이펙트" },
  { id: "sertz_pack_season_15900", label: "시즌 패키지", desc: "시즌 코스튬 · 시즌 아이템 · 에메랄드" },
];

/** 현금 패키지 구매 (스토어 상품 ID로 결제 위임). 웹/미등록 상품은 실패
 *  v1.1.1 (#3) — purchaseGems와 동일 분류 + 진행중 가드
 *  v1.0.1-beta — autoAcknowledge:false → 지급+ledger 후 호출부가 ack 마무리 */
let packBuying = false;
export async function purchaseStorePack(productId: string): Promise<{ ok: boolean; reason?: string; token?: string; acknowledged?: boolean }> {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  if (!STORE_PACKS.some((x) => x.id === productId)) return { ok: false, reason: "unknown-product" };
  if (packBuying) return { ok: false, reason: "busy" };
  packBuying = true;
  try {
    const P = await plugin();
    const r = (await P.purchaseProduct({
      productIdentifier: productId,
      productType: "inapp" as never,
      isConsumable: false,
      autoAcknowledgePurchases: false,
    })) as unknown as Txn;
    const token = r?.purchaseToken || r?.transactionId;
    if (!token) return { ok: false, reason: "error" };
    return { ok: true, token, acknowledged: !!r?.isAcknowledged };
  } catch (e) {
    console.warn("[SERTZ] 패키지 결제 실패", e);
    return { ok: false, reason: classifyPurchaseError(e) };
  } finally {
    packBuying = false;
  }
}

/** 패키지 지급 완료 후 호출 — ledger 등록 + 미승인 승인(3일 자동환불 방지) */
export async function completePackPurchase(token: string, alreadyAcknowledged = false): Promise<void> {
  ledgerAdd(token);
  if (alreadyAcknowledged) return;
  try {
    const P = await plugin();
    await P.acknowledgePurchase({ purchaseToken: token });
  } catch (e) {
    console.warn("[SERTZ] 패키지 승인 실패(부팅 복구가 마무리)", e);
  }
}

/* ================= 부팅 복구 (v1.0.1-beta) =================
 *  결제 성공 직후 앱 종료·크래시로 지급이 누락된 구매를 스토어 조회로 복구.
 *   - 젬 SKU: ledger에 없으면 지급 콜백 → ledger → 소비. ledger에 있으면 소비만 마무리.
 *   - 패키지: ledger에 없으면 지급 콜백 → ledger → 미승인 승인 (비소모성 — 재설치 복원도 겸함).
 *  웹/오류 시 조용히 종료 — 게임 부팅에 영향 없음. */
export async function restorePendingPurchases(handlers: {
  grantGems: (skuId: string, gems: number) => void;
  grantPack: (productId: string) => void;
}): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const P = await plugin();
    const { purchases } = await P.getPurchases({ productType: "inapp" as never });
    const ledger = loadLedger();
    for (const p of purchases as unknown as Txn[]) {
      if (!p?.purchaseToken) continue;
      const sku = p.productIdentifier || "";
      const gem = GEM_SKUS.find((g) => g.id === sku);
      const pack = STORE_PACKS.find((g) => g.id === sku);
      if (!gem && !pack) continue;
      if (!ledger[p.purchaseToken]) {
        if (gem) handlers.grantGems(sku, gem.gems);
        else handlers.grantPack(sku);
        ledgerAdd(p.purchaseToken);
      }
      if (gem) {
        try {
          await P.consumePurchase({ purchaseToken: p.purchaseToken }); // 미소비 잔여 정리
        } catch {
          /* 이미 소비됐거나 일시 오류 — 무해 */
        }
      } else if (!p.isAcknowledged) {
        try {
          await P.acknowledgePurchase({ purchaseToken: p.purchaseToken });
        } catch {
          /* 무해 */
        }
      }
    }
  } catch (e) {
    console.warn("[SERTZ] 결제 복구 조회 실패(무해)", e);
  }
}

/** 스토어 실가격 조회 — 충전소 UI 표시용 (네이티브만, 실패 시 폴백 라벨 사용)
 *  v4.1.0 원칙(클라이언트 금액 하드코딩 금지)의 완성: Play에 등록된 통화·가격 그대로 표시 */
export async function fetchStorePrices(ids: string[]): Promise<Record<string, string>> {
  if (!isNativeApp()) return {};
  try {
    const P = await plugin();
    const { products } = await P.getProducts({ productIdentifiers: ids, productType: "inapp" as never });
    const out: Record<string, string> = {};
    for (const pr of products as unknown as { productId?: string; id?: string; price?: string; displayPrice?: string; title?: string }[]) {
      const id = pr?.productId || pr?.id;
      const label = pr?.price || pr?.displayPrice;
      if (id && label) out[id] = label;
    }
    return out;
  } catch {
    return {};
  }
}
