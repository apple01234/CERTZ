import { Capacitor } from "@capacitor/core";
import { PAID_PRODUCTS, CAMPAIGN_ID } from "./catalog";
export async function purchaseCosmetic(
  sku: keyof typeof PAID_PRODUCTS,
  uid: string,
) {
  if (Capacitor.getPlatform() !== "android")
    throw new Error(
      "유료 외형과 슬롯은 Google Play 앱에서 구매할 수 있습니다.",
    );
  const { NativePurchases, PURCHASE_TYPE } = await import(
    "@capgo/native-purchases"
  );
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [sku],
    productType: PURCHASE_TYPE.INAPP,
  });
  if (!products.length) throw new Error("아직 판매하지 않는 상품입니다.");
  const bytes = new TextEncoder().encode(`${CAMPAIGN_ID}:${uid}`),
    hash = await crypto.subtle.digest("SHA-256", bytes),
    accountId = [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return NativePurchases.purchaseProduct({
    productIdentifier: sku,
    productType: PURCHASE_TYPE.INAPP,
    isConsumable: false,
    autoAcknowledgePurchases: true,
    appAccountToken: accountId,
  });
}
export async function restoreCosmetics() {
  if (Capacitor.getPlatform() !== "android")
    throw new Error("Google Play 앱에서 구매를 복원할 수 있습니다.");
  const { NativePurchases } = await import("@capgo/native-purchases");
  const { purchases } = await NativePurchases.getPurchases({
    onlyCurrentEntitlements: true,
  });
  return purchases.filter(
    (p) => Object.hasOwn(PAID_PRODUCTS, p.productIdentifier) && p.purchaseToken,
  );
}
