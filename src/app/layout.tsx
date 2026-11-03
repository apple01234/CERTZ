import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next"; // v4.10.0 — Vercel Speed Insights (웹 성능 실측)
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SERTZ — 기억의 서약",
  description:
    "당신만의 연합원으로 함께하는 2D 스토리 어드벤처. 왕국의 전쟁부터 별 너머의 귀향까지, 지워지지 않는 기억을 잇는 여정.",
  keywords: ["SERTZ", "기억의 서약", "스토리 어드벤처", "픽셀 RPG", "협동 보스"],
};

/** F3: 모바일 확대/줌 차단, 세이프에어리어 대응 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#05070d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-contrast="high">
      <body className="bg-[#05070d] text-white antialiased">
        {/* v4.1.6 성능 최적화 — Galmuri woff2 4종 선도 다운로드 (React 19 head 호이스팅).
         *  BootScene의 document.fonts 대기 시간 단축 + 캔버스 텍스트 FOUT 제거. */}
        <link rel="preload" href="/fonts/Galmuri11.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Galmuri11-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Galmuri9.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Galmuri14.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {children}
        {/* v4.10.0 — Vercel Speed Insights (웹 바이탈 실측). APK 정적 export 빌드에선 비활성(빌드 시 상수 평가) */}
        {process.env.APK_EXPORT !== "1" && <SpeedInsights />}
      </body>
    </html>
  );
}
