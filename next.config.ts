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
      // APK 직결 다운로드는 패키지 용량 한도로 FC 미포함 → 안내 페이지로 연결
      // (※ 향후 APK를 public에 다시 넣어 배포할 때 이 redirects는 제거할 것)
      async redirects() {
        return [
          {
            source: "/SERTZ-v3.0.26.apk",
            destination: "/apk-guide.html",
            permanent: false,
          },
          {
            source: "/SERTZ-v3.0.27.apk",
            destination: "/apk-guide.html",
            permanent: false,
          },
          {
            // v3.1.0b — APK 파일이 배포 패키지에 없을 때 404 대신 gofile 미러로 연결 (안전망)
            source: "/SERTZ-v3.1.0.apk",
            destination: "https://gofile.io/d/Tcsl6sY2",
            permanent: false,
          },
        ];
      },
    };

export default nextConfig;
