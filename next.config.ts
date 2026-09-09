import type { NextConfig } from "next";

/**
 * APK_EXPORT=1 → Capacitor용 정적 export (distDir 분리로 dev .next 보호)
 * 일반 dev/배포는 standalone 그대로.
 */
const isApkExport = process.env.APK_EXPORT === "1";

const nextConfig: NextConfig = isApkExport
  ? {
      output: "export",
      distDir: ".next-apk",
      images: { unoptimized: true },
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
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
        const APK_DL =
          "https://github.com/apple01234/CERTZ/releases/download/v1.0.6/SERTZ-v1.0.6.apk";
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
