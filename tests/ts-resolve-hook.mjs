// 테스트 전용 리졸버 — 소스는 Next 규약상 확장자 없는 import 를 쓴다(예: "./utility").
// 순수 Node 로 테스트를 돌릴 때만 .ts 를 붙여 해석한다. 프로덕션 번들에는 관여하지 않는다.
import { register } from "node:module";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    try { return await next(specifier + ".ts", context); } catch { /* fall through */ }
  }
  return next(specifier, context);
}

register(import.meta.url);
