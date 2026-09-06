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
      // v3.2.0 — APK 링크는 전부 gofile 미러로 (유저 지시: 사이트 직결 제거, gofile만 사용)
      async redirects() {
        return [
          {
            source: "/SERTZ-v3.0.26.apk",
            destination: "https://gofile.io/d/Tcsl6sY2",
            permanent: false,
          },
          {
            source: "/SERTZ-v3.0.27.apk",
            destination: "https://gofile.io/d/Tcsl6sY2",
            permanent: false,
          },
          {
            source: "/SERTZ-v3.1.0.apk",
            destination: "https://gofile.io/d/Tcsl6sY2",
            permanent: false,
          },
        ];
      },
    };

export default nextConfig;
