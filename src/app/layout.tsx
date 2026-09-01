import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SERTZ — 이그드라실: 아홉 왕국",
  description:
    "2D 액션 MORPG. 세계수의 파편을 찾고 늑대를 토벌하고 심연의 수호자에 맞서라. 모든 그래픽과 사운드가 코드로 생성됩니다.",
  keywords: ["SERTZ", "이그드라실", "아홉 왕국", "픽셀 RPG", "액션 RPG"],
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
    <html lang="ko">
      <body className="bg-[#05070d] text-white antialiased">{children}</body>
    </html>
  );
}
