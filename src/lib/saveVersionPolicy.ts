import schema from "../../accounts/save-schema.json" with { type: "json" };

export const SUPPORTED_SAVE_VERSION = schema.version;
type SaveSet = { data?: unknown; chars?: unknown };
export type SaveVersionConflict = {
  code: "SAVE_VERSION_UNSUPPORTED";
  minimumSaveVersion: number;
  error: string;
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
  };
}

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
