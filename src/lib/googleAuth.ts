"use client";

/**
 * v1.0.5-beta (vc134) — 웹 구글 로그인 안정화 (모바일 브라우저 리다이렉트 플로우)
 *
 *  [문제] 지금까지 웹은 signInWithPopup(팝업) 단일 경로였다. PC 브라우저에선 잘 동작하지만
 *   모바일 브라우저(삼성 인터넷·Chrome 모바일·인앱 웹뷰)에서는 팝업 차단·"지원하지 않는
 *   환경"(auth/operation-not-supported-in-this-environment)·팝업 렌더 실패로 구글 로그인이
 *   실패하는 사례가 굉장히 흔하다 — Firebase 공식 문서도 모바일에선 signInWithRedirect를 권장한다.
 *
 *  [해결]
 *   · 모바일/터치 브라우저 → 처음부터 signInWithRedirect(전체 페이지 이동) 사용.
 *     로그인 후 원 페이지로 돌아오면 AuthPanel 마운트 시 googleWebRedirectToken()이
 *     getRedirectResult로 자격증명을 회수한다(새로고침 1회가 정상 동선).
 *   · PC → 기존대로 popup, 실패 코드가 팝업 차단/미지원 계열이면 자동 리다이렉트 폴백.
 *   · Firebase 앱 초기화는 지연 1회(모듈 캐시) — 기존 googleLogin의 인라인 초기화를 이관.
 *   · 게임 상태는 세이브가 localStorage에 상시 기록되므로 리다이렉트 왕복 새로고침에 안전.
 */

/* 지연 로딩 유지 — firebase 모듈은 구글 로그인 시점에만 내려받는다 */
type FirebaseAppLike = unknown;

let appPromise: Promise<FirebaseAppLike> | null = null;

/** Firebase 앱(sertz-681eb) 지연 초기화 — 모듈당 1회 */
function getFirebaseApp(): Promise<FirebaseAppLike> {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApps } = await import("firebase/app");
      return (
        getApps()[0] ??
        initializeApp({
          apiKey: "AIzaSyDQqPSeG3zLINfpynVF3dVxNTVSVD6nE2g",
          authDomain: "sertz-681eb.firebaseapp.com",
          projectId: "sertz-681eb",
        })
      );
    })();
  }
  return appPromise;
}

async function getFirebaseAuth(): Promise<ReturnType<typeof Object> & object> {
  const app = await getFirebaseApp();
  const { getAuth } = await import("firebase/auth");
  return getAuth(app as Parameters<typeof getAuth>[0]);
}

/** 모바일 계열 브라우저 판정 — 터치 지원 + 짧은 변 화면(폰/태블릿) */
export function isMobileWeb(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const touch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    const shortSide = Math.min(window.innerWidth, window.innerHeight) <= 820;
    return touch && shortSide;
  } catch {
    return false;
  }
}

/** 팝업 실패 시 리다이렉트로 대체해도 되는(되어야 하는) Firebase 오류 코드 */
const REDIRECT_FALLBACK_CODES = [
  "auth/popup-blocked",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/popup-blocked-by-browser",
];

/**
 * 웹 구글 로그인 시작 — 성공하면 ID 토큰, 리다이렉트로 이동하면 "" 반환.
 * ("" 반환 시 페이지가 곧 이동하므로 호출부는 조용히 종료하면 된다)
 */
export async function googleWebSignIn(): Promise<string> {
  const auth = (await getFirebaseAuth()) as never;
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();

  if (isMobileWeb()) {
    await signInWithRedirect(auth, provider);
    return ""; // accounts.google.com으로 이동 — 복귀 후 googleWebRedirectToken()이 회수
  }

  try {
    const cred = await signInWithPopup(auth, provider);
    return await cred.user.getIdToken();
  } catch (e) {
    const code = String((e as { code?: string })?.code ?? "");
    /* 유저가 스스로 닫은 것(사용자 취소)은 오류 아님 — 그대로 위로 던져 기존 무시 로직이 처리 */
    if (code.includes("popup-closed-by-user") || code.includes("user-cancelled")) throw e;
    if (REDIRECT_FALLBACK_CODES.some((k) => code.includes(k))) {
      await signInWithRedirect(auth, provider); // 팝업 차단/미지원 환경 → 전체 페이지 리다이렉트
      return "";
    }
    throw e;
  }
}

let redirectConsumed = false;

/**
 * 리다이렉트 복귀 처리 — AuthPanel 마운트 시 1회 호출.
 * 로그인 완료분이 있으면 ID 토큰, 없으면 "".
 */
export async function googleWebRedirectToken(): Promise<string> {
  if (redirectConsumed) return "";
  redirectConsumed = true;
  try {
    const auth = (await getFirebaseAuth()) as never;
    const { getRedirectResult } = await import("firebase/auth");
    const res = await getRedirectResult(auth);
    if (!res || !res.user) return "";
    return await res.user.getIdToken();
  } catch {
    /* 리다이렉트 결과 없음/만료 — 조용히 무시(일반 로그인 UI 사용) */
    return "";
  }
}
