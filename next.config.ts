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
      // v3.0.26 → v3.0.27: 유저가 저장해둔 구버전 APK 링크도 새 버전으로 연결
      async redirects() {
        return [
          {
            source: "/SERTZ-v3.0.26.apk",
            destination: "/SERTZ-v3.0.27.apk",
            permanent: true,
          },
        ];
      },
    };

export default nextConfig;
