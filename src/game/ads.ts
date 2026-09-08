"use client";

import { Capacitor } from "@capacitor/core";

/**
 * v4.1.0 — 수익 연동 서비스 (유저 지시 #10 — BM 구글 플레이 결제 + 광고 보상)
 *
 * [보상형 광고 — AdMob]
 *  - 폰 버전(APK)에서만 동작 (Capacitor 네이티브 감지)
 *  - 기본값은 구글 공식 테스트 단위 ID — 실제 광고가 내려오고 보상도 지급된다.
 *  - 수익화 전환: 아래 ADMOB_REWARDED_ID를 본인 AdMob 보상형 단위 ID로 바꾸고
 *    APK를 다시 빌드하면 된다 (AdMob 콘솔 → 앱 등록 → 단위 ID).
 *
 * [에메랄드 충전 — Google Play 결제]
 *  - @capgo/native-purchases 플러그인 (구글 플레이 Billing v6 래퍼)
 *  - Play Console에 아래 GEM_SKUS 상품을 등록하면 바로 판매 가능.
 *  - 미등록/미연결 환경에서는 "준비 중" 안내만 표시 (가짜 결제 금지).
 *
 * 웹(브라우저)에서는 네이티브 SDK가 없어 두 기능 모두 안내만 제공한다.
 */

/** 내 AdMob 보상형 광고 단위 ID — 여기만 바꾸면 실제 수익 연동 완료 */
export const ADMOB_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917"; // 구글 공식 테스트 ID

/** 에메랄드 충전 상품 (Play Console 인앱 상품 ID → 에메랄드 수량) */
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

/** 구글 플레이 결제 — 에메랄드 상품 구매. 성공 시 true */
export async function purchaseGems(skuId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  try {
    const { NativePurchases } = await import("@capgo/native-purchases");
    await NativePurchases.purchaseProduct({ productIdentifier: skuId, productType: "inapp" as never });
    return { ok: true };
  } catch (e) {
    console.warn("[SERTZ] 구글 플레이 결제 실패", e);
    return { ok: false, reason: "error" };
  }
}

/** v1.0.2 (#현금패키지) — 실제 결제(스토어 인앱) 패키지 상품.
 *  가격/판매 여부는 Play Console 상품 등록 기준 — 클라이언트에 금액을 하드코딩하지 않는다.
 *  구매 성공 시 WorldScene이 STORE_PACK_CONTENTS[id] 내용을 지급한다. */
export const STORE_PACKS: { id: string; label: string; desc: string }[] = [
  { id: "sertz_pack_growth_19800", label: "성장 패키지", desc: "성장 재화 · 강화 재료 · 경험치 아이템" },
  { id: "sertz_pack_growth_cos_29900", label: "성장+치장 패키지", desc: "성장 재화 · 전용 코스튬 · 전용 이펙트" },
  { id: "sertz_pack_season_15900", label: "시즌 패키지", desc: "시즌 코스튬 · 시즌 아이템 · 에메랄드" },
];

/** 현금 패키지 구매 (스토어 상품 ID로 결제 위임). 웹/미등록 상품은 실패 */
export async function purchaseStorePack(productId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isNativeApp()) return { ok: false, reason: "web" };
  if (!STORE_PACKS.some((x) => x.id === productId)) return { ok: false, reason: "unknown-product" };
  try {
    const { NativePurchases } = await import("@capgo/native-purchases");
    await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: "inapp" as never });
    return { ok: true };
  } catch (e) {
    console.warn("[SERTZ] 패키지 결제 실패", e);
    return { ok: false, reason: "error" };
  }
}
