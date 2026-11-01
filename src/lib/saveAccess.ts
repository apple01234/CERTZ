/**
 * vc229 — 세이브 레코드 접근자 (압축/평문 혼재 안전).
 *
 * ## 왜 이 파일이 필요한가
 *
 * 서버의 세이브 레코드는 두 형태가 공존한다:
 *   · 구 세이브 — `{ data: {...}, updatedAt }`            (평문)
 *   · 신 세이브 — `{ data: "BR:…", packed: true, … }`     (압축)
 *
 * `db.saves[uid].data` 를 **직접** 읽는 코드가 8곳 있었다
 * (market/buy·list·collect, iap/verify, sapi 의 ownedCountOf·creditOwned·
 *  ownsListableItem·rankListFor). 압축 저장을 켜면 그 전부가 조용히 깨진다:
 * `data.owned` 가 undefined → 거래소가 "보유하지 않은 아이템"으로 거절,
 * `data.gold` 가 undefined → 골드 증발, 랭킹이 빈 값.
 *
 * 그래서 **읽는 경로를 이 파일 하나로 모은다.** 새 코드는 `db.saves[uid].data` 를
 * 직접 만지지 말고 반드시 `saveDataOf()` 를 쓴다.
 *
 * ## 왜 쓰기(write) 헬퍼도 두는가
 *
 * 압축본을 읽어 고친 뒤 다시 평문으로 저장하면 `packed` 플래그와 어긋나
 * 다음 읽기에서 JSON.parse 가 객체를 받아 실패한다. `mutateSaveData()` 가
 * 그 변환을 한 곳에서 처리한다.
 */

/* 확장자를 붙인다 — node 가 .ts 를 직접 실행하는 테스트(save-codec)가
 * 확장자 없는 지정자를 해석하지 못한다. tsc/Next 는 둘 다 허용한다. */
import { compressJson, decompressJson } from "./saveCodec.ts";

/** 평문 객체를 압축 저장 형태로 바꾼다 — `rec.data` 에 직접 쓰는 곳에서 사용 */
export function packedData(v: unknown): unknown {
  return compressJson(JSON.stringify(v));
}

/** 압축된 base64 문자열인지 (접두사로 판별) */
function isPackedString(v: unknown): v is string {
  return typeof v === "string" && (v.startsWith("BR:") || v.startsWith("GZ:"));
}

/**
 * 세이브 레코드에서 **평문 data** 를 꺼낸다. 없거나 손상이면 null.
 *
 * 손상 시 빈 객체를 돌려주지 않는다 — 빈 객체를 주면 호출부가
 * "세이브는 있는데 아이템이 없다"로 오판해 골드를 0으로 덮어쓸 수 있다.
 *
 * ## 왜 문자열 JSON 폴백이 필요한가 (실제로 물린 버그)
 *
 * `compressJson` 은 512바이트 미만이면 **압축하지 않고 원문 문자열을 그대로** 준다.
 * `packSaveRec` 은 그 결과를 `data` 에 넣으므로, 작은 세이브는
 * `"{\"gold\":1}"` 같은 **평문 JSON 문자열**로 저장된다.
 * 접두사(BR:/GZ:)만 보고 판별하면 이런 레코드를 놓쳐 `null` 이 되고
 * → 세이브가 통째로 사라진 것처럼 보인다.
 * 그래서 "문자열이면 일단 JSON 으로 파싱해 본다"를 추가한다.
 */
export function saveDataOf(rec: { data?: unknown; packed?: boolean } | undefined): Record<string, unknown> | null {
  if (!rec) return null;
  const d = rec.data;
  if (!d) return null;
  if (typeof d === "string") {
    /* 압축본이면 풀고, 아니면 그 자체가 JSON 텍스트다(소형 페이로드) */
    let text: string;
    try {
      text = decompressJson(d);
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof d !== "object" || Array.isArray(d)) return null;
  return d as Record<string, unknown>;
}

/** 세이브 레코드에서 **평문 chars** 를 꺼낸다 (없으면 undefined) */
export function saveCharsOf(rec: { chars?: unknown } | undefined): Record<string, Record<string, unknown>> | undefined {
  const c = rec?.chars;
  if (!c) return undefined;
  if (typeof c === "string") {
    let text: string;
    try {
      text = decompressJson(c);
    } catch {
      return undefined;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, Record<string, unknown>>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof c !== "object" || Array.isArray(c)) return undefined;
  return c as Record<string, Record<string, unknown>>;
}

/**
 * 세이브 레코드를 평문 `{ data, chars, updatedAt }` 로 푼다.
 * 레코드가 없으면 null.
 */
export function unpackSaveRec(
  rec: { data?: unknown; chars?: unknown; updatedAt?: number } | undefined
): { data: Record<string, unknown>; chars?: Record<string, Record<string, unknown>>; updatedAt: number } | null {
  if (!rec) return null;
  const data = saveDataOf(rec);
  if (!data) return null;
  return { data, chars: saveCharsOf(rec), updatedAt: Number(rec.updatedAt || 0) };
}

/**
 * vc229 — 세이브 레코드의 `data` 를 평문으로 꺼내 **고친 뒤 되돌려 넣는다.**
 *
 * 거래소·IAP 처럼 "서버가 세이브 값을 직접 바꾸는" 경로가 여러 곳이다.
 * 각자 `rec.data.xxx = ...` 로 쓰면 압축 형태와 어긋나므로,
 * 읽기(풀기) → 수정 → 쓰기(압축) 를 한 함수로 묶는다.
 *
 * 반환값이 false 면 레코드가 없거나 손상 — 호출부는 기존과 같이 409 로 응답한다.
 */
export function mutateSaveData(
  rec: { data?: unknown; chars?: unknown; updatedAt?: number; packed?: boolean } | undefined,
  fn: (data: Record<string, unknown>) => boolean
): boolean {
  const plain = saveDataOf(rec);
  if (!rec || !plain) return false;
  const changed = fn(plain);
  if (!changed) return false;
  const chars = saveCharsOf(rec);
  rec.data = packedData(plain) as Record<string, unknown>;
  if (chars) rec.chars = packedData(chars) as Record<string, Record<string, unknown>>;
  rec.packed = true;
  rec.updatedAt = Date.now();
  return true;
}

/**
 * 세이브 레코드를 **압축 형태로 다시 만든다** (fp·packed 포함).
 *
 * 호출부가 data 를 고친 뒤 그대로 저장할 때 쓴다.
 * `chars` 는 넘기지 않으면 기존 값을 보존한다(미포함 요청이 백업을 지우지 않게).
 */
export function packSaveRec(
  data: Record<string, unknown>,
  opts: { chars?: Record<string, Record<string, unknown>> | null; updatedAt: number; fp?: string }
): { data: unknown; chars?: unknown; updatedAt: number; fp?: string; packed: true } {
  const out: { data: unknown; chars?: unknown; updatedAt: number; fp?: string; packed: true } = {
    data: compressJson(JSON.stringify(data)),
    updatedAt: opts.updatedAt,
    packed: true,
  };
  if (opts.fp) out.fp = opts.fp;
  if (opts.chars) out.chars = compressJson(JSON.stringify(opts.chars));
  return out;
}
