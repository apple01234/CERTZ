import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

/* vc238 — APK 리다이렉트가 v1.4.54/vc214 에 하드코딩돼 있어, 최신 버전을 받으려는
 *  /SERTZ-v*.apk 링크가 **구버전 APK 로 튕겼다**. 릴리스마다 손으로 고쳐야 했고
 *  실제로 세 릴리스 연속 방치됐다(다운로드 오류 리포트의 근원).
 *  이제 버전 파일에서 자동 파생한다 → 버전을 올리면 이 파일을 건드릴 필요가 없다.
 *
 *  vc241 수정 — build.gradle 만 읽었는데 **Vercel 빌드에는 android/ 가 없다**.
 *  .vercelignore 가 android/ 를 제외하므로 readFileSync 가 던지고, 폴백 값이 그대로
 *  링크에 박혀 /api/version 이 code:0 · SERTZ-vc0.apk 를 응답했다(실측).
 *  → 존재하는 소스에서 순서대로 시도한다: build.gradle(로컬·CI) → android-version.json → package.json. */
function readAndroidVersion(): { code: string; name: string } {
  /* 1) build.gradle — 로컬/CI/GitHub Actions 에는 있다 */
  try {
    const gradle = readFileSync("android/app/build.gradle", "utf8");
    const code = /versionCode\s+(\d+)/.exec(gradle)?.[1] ?? "";
    const name = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? "";
    if (code) return { code, name };
  } catch {
    /* Vercel: android/ 제외됨 — 다음 소스로 */
  }
  /* 2) android-version.json — Vercel 에도 포함되는 커밋된 사본(빌드 스크립트가 갱신) */
  try {
    const v = JSON.parse(readFileSync("android-version.json", "utf8")) as { code?: number | string; name?: string };
    const code = String(v.code ?? "");
    if (code) return { code, name: String(v.name ?? "") };
  } catch {
    /* 없으면 package.json */
  }
  /* 3) package.json — versionName 과 versionCode 는 별도 축이라 태그만이라도 맞춘다 */
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };
    const name = String(pkg.version ?? "");
    if (name) return { code: "", name };
  } catch {
    /* 무시 */
  }
  return { code: "", name: "" };
}

/**
 * APK_EXPORT=1 → Capacitor용 정적 export (최종 산출물 .next-apk — Next 16 작업 캐시는 여전히 .next; 웹 빌드와 동시 실행 금지)
 * STATIC_EXPORT=1 → Vercel 정적 프론트 미러 export (v1.4.20 멀티서버 분리)
 *   - distDir 기본값(.next) 유지: output:export 결과가 표준 out/에 생성돼야 Vercel 빌더가 감지
 * 일반 dev/배포는 standalone 그대로.
 */
const isApkExport = process.env.APK_EXPORT === "1";
const isVercelExport = process.env.STATIC_EXPORT === "1";
const isStaticExport = isApkExport || isVercelExport;

/* v1.0.16 (F8) — 클라이언트에 버전 문자열 하나를 주려고 Overlays.tsx가 package.json을
 *  통째로 import하고 있었다. 번들러는 JSON 전체를 인라인하므로 **의존성 83개 목록·npm 스크립트·
 *  devDependencies 전문이 게임 번들에 그대로 실려 청크 하나가 3.08MB가 됐다**(실측).
 *  여기서 version만 뽑아 빌드 타임 상수로 주입하면 단일 소스(package.json)는 유지되고
 *  나머지 필드는 번들에 들어가지 않는다. */
const pkgVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version as string;

const nextConfig: NextConfig = isStaticExport
  ? {
      output: "export",
      ...(isApkExport ? { distDir: ".next-apk" } : {}),
      images: { unoptimized: true },
      /* v1.0.16 — typescript.ignoreBuildErrors 제거. CI가 타입 오류를 통과시키고 있었다.
       *  유일한 차단 요인이던 src/lib/db.ts(Prisma Client 미생성)는 `prisma generate`로 해소되고,
       *  빌드 파이프라인(워크플로 3종 + package.json build)이 이를 선행하도록 배선했다. */
      reactStrictMode: false,
      env: { NEXT_PUBLIC_APP_VERSION: pkgVersion },
    }
  : {
      output: "standalone",
      reactStrictMode: false,
      env: { NEXT_PUBLIC_APP_VERSION: pkgVersion },
      /* v4.1.6 성능 최적화 — gzip 압축 명시 (기본값 true 의존 제거).
       *  HTML/JS/CSS/JSON/SVG 등 텍스트 응답에만 적용되며 이미지·오디오는 건너뛴다. */
      compress: true,
      // v4.1.6 성능 최적화 — 정적 에셋 캐시 정책 (감사 보고서 병목 ② 해결).
      //  /assets: 7일 fresh + 30일 SWR — 리소스 교체 시 최악 7일 내 자가 수렴 (immutable 지양).
      //  /fonts: 30일 fresh + 1년 SWR — 폰트 교체는 사실상 없음.
      //  /_next/static: Next 기본값(immutable 1년) 그대로 — 해시 URL이라 충돌 없음.
      async headers() {
        return [
          {
            source: "/assets/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=604800, stale-while-revalidate=2592000",
              },
            ],
          },
          {
            source: "/fonts/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=2592000, stale-while-revalidate=31536000",
              },
            ],
          },
        ];
      },
      // v4.0.0 — APK 링크는 전부 GitHub 릴리스 직접 다운로드로 (CDN 즉시 시작, 404/대기 없음)
      // gofile은 콜드스토리지 첫 응답 ~1분 지연 때문에 apk-guide의 백업 경로로만 안내
      async redirects() {
        /* vc138 — v1.0.3-beta 하드코딩이 잔존해 /SERTZ-*.apk 경유 링크가 구버전 APK로
         *  리다이렉트되던 잠복 버그 수정 (server.js 정규식은 beta 미포함이라 이쪽이 개입).
         *  vc238 — build.gradle 에서 파생해 수동 싱크를 없앤다(위 readAndroidVersion). */
        const { code: apkCode, name: apkName } = readAndroidVersion();
        const APK_TAG = apkName ? `v${apkName}` : "v2.0.4";
        const APK_DL = apkCode
          ? `https://github.com/apple01234/CERTZ/releases/download/${APK_TAG}/SERTZ-vc${apkCode}.apk`
          : `https://github.com/apple01234/CERTZ/releases/download/${APK_TAG}/SERTZ-vc240.apk`;
        if (!apkCode) {
          console.warn("[next.config] build.gradle 버전 파싱 실패 — APK 리다이렉트가 구버전으로 폴백됩니다");
        }
        return [
          {
            /* v4.1.0 — 모든 버전의 /SERTZ-vX.apk 경로를 한 규칙으로 처리
             *  (standalone 구동 대비 — 커스텀 server.js의 정규식 리다이렉트와 이중 안전망) */
            source: "/SERTZ-v:ver.apk",
            destination: APK_DL,
            permanent: false,
          },
          {
            source: "/SERTZ-v3.0.26.apk",
            destination: APK_DL,
            permanent: false,
          },
          {
            source: "/SERTZ-v3.0.27.apk",
            destination: APK_DL,
            permanent: false,
          },
          {
            source: "/SERTZ-v3.1.0.apk",
            destination: APK_DL,
            permanent: false,
          },
          {
            source: "/SERTZ-v4.0.0.apk",
            destination: APK_DL,
            permanent: false,
          },
        ];
      },
    };

export default nextConfig;
