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
      // v3.2.0 — APK 링크는 전부 GitHub 릴리스 직접 다운로드로 (CDN 즉시 시작, 404/대기 없음)
      // gofile은 콜드스토리지 첫 응답 ~1분 지연 때문에 apk-guide의 백업 경로로만 안내
      async redirects() {
        const APK_DL =
          "https://github.com/apple01234/CERTZ/releases/download/v3.1.0/SERTZ-v3.1.0.apk";
        return [
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
        ];
      },
    };

export default nextConfig;
