/**
 * v1.4.22 — GET /api/auth/sns (serverless 이행)
 *  SNS OAuth 키는 Vercel serverless에 미구성 — 자체 가입(아이디·비밀번호) 이용 안내.
 *  (계승: 클라 AuthPanel은 configured:false면 안내 문구를 보여주고 OAuth 내비게이션을 하지 않는다)
 */
import { NextRequest } from "next/server";
import { json, options } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  return json(req, 200, {
    providers: {
      google: { name: "구글", configured: false },
      kakao: { name: "카카오", configured: false },
      naver: { name: "네이버", configured: false },
    },
  });
}
