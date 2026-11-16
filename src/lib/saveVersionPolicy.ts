import schema from "../../accounts/save-schema.json" with { type: "json" };

export const SUPPORTED_SAVE_VERSION = schema.version;
type SaveSet = { data?: unknown; chars?: unknown };
export type SaveVersionConflict = {
  code: "SAVE_VERSION_UNSUPPORTED";
  minimumSaveVersion: number;
  error: string;
  /** 막힌 사용자가 갈 곳 — 설치 안내(정적 파일이라 서버 버전과 무관하게 열린다). */
  guide?: string;
};

export function saveVersionOf(save: unknown): number {
  const v = save && typeof save === "object" ? (save as { v?: unknown }).v : undefined;
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : 1;
}

export function maximumSaveVersion(saved: SaveSet | null): number {
  let version = saveVersionOf(saved?.data);
  if (saved?.chars && typeof saved.chars === "object") {
    for (const save of Object.values(saved.chars)) version = Math.max(version, saveVersionOf(save));
  }
  return version;
}

function conflict(version: number): SaveVersionConflict {
  return {
    code: "SAVE_VERSION_UNSUPPORTED",
    minimumSaveVersion: version,
    error: "더 최신 형식의 저장 데이터가 있어요. 게임을 업데이트한 뒤 다시 시도해 주세요.",
    guide: SAVE_UPDATE_GUIDE,
  };
}

/* 2026-11-16 — 외부 평가 "구버전 APK 사용자가 새 버전의 클라우드 세이브를 받지 못하는 접근성 저하".
 *
 *  이 차단은 **의도한 보호**다: v2 클라이언트가 v3 데이터를 받아 읽으면 옛 식별자를 모르는 채로
 *  다시 저장해 진행을 덮어쓴다. 그래서 서버는 계속 409 로 막는다 — 여기서 여는 것이 아니다.
 *
 *  대신 막힌 사용자가 **무엇을 해야 하는지** 응답에 담아 준다. 종전 문구는 "업데이트한 뒤 다시
 *  시도"뿐이라, APK 사용자는 어디서 어떻게 업데이트하는지 알 수 없었다. 이제 설치 안내 경로를 같이
 *  주고 화면이 그 링크를 그대로 띄운다(웹·APK 공통 경로 — 정적 파일이라 서버 버전과 무관). */
export const SAVE_UPDATE_GUIDE = "/apk-guide.html";

/** Missing capability is the v1 APK protocol; never expose a v2 character to it. */
export function cloudReadVersionConflict(saved: SaveSet | null, requested: string | null): SaveVersionConflict | null {
  const parsed = Number(requested);
  const supported = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const required = maximumSaveVersion(saved);
  return supported < required ? conflict(required) : null;
}

/** Runs on decoded records before currency/escrow changes or replacement. */
export function cloudWriteVersionConflict(saved: SaveSet | null, data: unknown, chars?: Record<string, unknown>): SaveVersionConflict | null {
  const incoming = maximumSaveVersion({ data, chars });
  if (incoming > SUPPORTED_SAVE_VERSION) return conflict(incoming);
  const required = maximumSaveVersion(saved);
  if (saveVersionOf(data) < required) return conflict(required);
  if (chars && saved?.chars && typeof saved.chars === "object") {
    for (const [key, previous] of Object.entries(saved.chars)) {
      if (Object.hasOwn(chars, key) && saveVersionOf(chars[key]) < saveVersionOf(previous)) {
        return conflict(saveVersionOf(previous));
      }
    }
  }
  return null;
}
