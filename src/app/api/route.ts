import { NextResponse } from "next/server";

/* APK 정적 export(output: export) 대응 — 고정 JSON 응답이므로 force-static 무해 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}