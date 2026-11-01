/**
 * vc229 — 세이브 저장 경로 최적화 모듈.
 *
 * ## 실측으로 확정한 병목 (tools/measure_save_cost.mjs)
 *
 *   세이브 1건 ≈ 19KB(보통) ~ 99KB(최대). 상위 8필드가 66%
 *   (seen 14KB / potentials 12KB / visited 8KB / achClaimed 8KB …)
 *
 *   유저 500명이면 **세이브 1건 저장에 DB 전체 17MB 를 재전송**한다.
 *   읽기도 같은 비용. 저장은 O(1) 이 아니라 **O(유저 수)**.
 *
 * ## 왜 서버 DB 구조를 지금 바꾸지 않는가
 *
 * SZBK1 컨테이너를 읽는 코드가 9곳이다
 * (accounts/index.js 1,201줄 · scripts/db_*.js 6개 · src/lib/ghdb.ts · verify_dbkey_rotation).
 * 포맷을 바꾸면 그 전부가 조용히 깨진다. 게다가 지금은 저장 빈도가 낮아
 * **선형 비용이 실사용에서 문제되지 않는다**(90초 1회 × 동시 사용자 수십).
 *
 * 그래서 순서를 나눈다:
 *   1단계(이 파일) — **압축 + 무변경 쓰기 생략**. 포맷 유지, 위험 0
 *   2단계 — 트래픽이 늘면 세이브를 유저별 파일로 분리(DB 분할)
 *
 * ## 압축 실측 (tools/measure_compression.mjs)
 *
 *   세이브 1건 30.6KB → gzip 7.3KB(24%) / brotli 2.9KB(10%)
 *   → 같은 PUT 으로 4배 많은 세이브를 실을 수 있다.
 */

import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from "node:zlib";

/** 압축 결과 — `c` 가 붙은 base64 는 압축본이다 */
const GZIP_TAG = "GZ:";
const BROTLI_TAG = "BR:";

/**
 * JSON 문자열을 압축해 base64 로 만든다.
 *
 * 왜 brotli 인가: 실측에서 gzip 24% / brotli 10% 였다. 세이브는 반복 키가 많은
 * JSON 이라 사전 기반 압축이 훨씬 잘 듣는다. Node 12+ 는 brotli 내장이라
 * 의존성이 늘지 않는다.
 *
 * 왜 접두사를 붙이나: 압축 여부를 **데이터 자신이** 들고 있어야
 * 읽는 쪽이 분기 없이 처리한다. 나중에 포맷을 또 바꿔도 접두사로 구분된다.
 */
export function compressJson(json: string): string {
  const raw = Buffer.from(json, "utf8");
  /* 아주 작은 페이로드는 압축 이득이 없다 — 태그 3바이트가 손해가 될 수 있다 */
  if (raw.length < 512) return json;
  const br = brotliCompressSync(raw, {
    params: {
      /* quality 9: 세이브는 수 KB~수십 KB라 압축 시간이 1ms 미만이다.
       *  서버 CPU 가 아깝지 않고, 저장 크기가 곧 전송량이므로 최대 압축을 쓴다. */
      1: 9, // BROTLI_PARAM_QUALITY
    },
  });
  /* brotli 가 gzip 보다 크면 gzip 을 쓴다 — 데이터에 따라 뒤집힐 수 있다 */
  const gz = gzipSync(raw, { level: 9 });
  if (gz.length < br.length) return GZIP_TAG + gz.toString("base64");
  return BROTLI_TAG + br.toString("base64");
}

/** compressJson 의 역 — 접두사가 없으면 그대로 JSON 이다 */
export function decompressJson(s: string): string {
  if (s.startsWith(GZIP_TAG)) return gunzipSync(Buffer.from(s.slice(GZIP_TAG.length), "base64")).toString("utf8");
  if (s.startsWith(BROTLI_TAG)) return brotliDecompressSync(Buffer.from(s.slice(BROTLI_TAG.length), "base64")).toString("utf8");
  return s;
}

/**
 * 세이브 내용의 지문.
 *
 * 왜 필요한가: 클라이언트가 90초마다 세이브를 올린다. 그런데 90초 동안
 * 아무것도 안 바뀐 경우가 대부분이다(가만히 서 있음, 메뉴 열어둠).
 * 내용이 같으면 **쓰기를 건너뛰어** O(N) 전송과 암호화를 통째로 아낀다.
 *
 * 왜 JSON 문자열 해시인가: 깊은 비교(structuredEqual)는 큰 객체에서
 * 해시보다 느리고, 어차피 우리는 "같은가"만 알면 된다.
 * 키 순서가 바뀌면 다른 해시가 되지만, 같은 클라이언트가 같은 코드로
 * 직렬화하므로 실사용에서 순서는 안정적이다.
 */
export function saveFingerprint(data: unknown): string {
  return createHash("sha1").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}
