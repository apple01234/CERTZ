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
      // v4.0.0 — APK 링크는 전부 GitHub 릴리스 직접 다운로드로 (CDN 즉시 시작, 404/대기 없음)
      // gofile은 콜드스토리지 첫 응답 ~1분 지연 때문에 apk-guide의 백업 경로로만 안내
      async redirects() {
        const APK_DL =
          "https://github.com/apple01234/CERTZ/releases/download/v4.1.2/SERTZ-v4.1.2.apk";
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
