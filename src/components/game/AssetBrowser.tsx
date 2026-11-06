"use client";

/**
 * 에셋 브라우저 — 맵 에디터/스킬 메이커 공용.
 *
 * [왜 공용 컴포넌트인가]
 *  두 에디터 모두 "에셋을 눈으로 보고 고른다" 는 같은 요구를 갖는다. 각자 만들면
 *  검색/페이징/썸네일 규칙이 갈라지고, 1002개 목록을 다루는 최적화도 두 번 해야 한다.
 *
 * [핵심 제약]
 *  ① **한 번에 다 그리지 않는다.** `EDITOR_ASSETS` 는 1002개다. 전부 `<img>` 로 만들면
 *     브라우저가 1002개 요청을 동시에 열어 에디터가 멈춘다. 필터 결과를 `PAGE` 단위로
 *     잘라 그리고, 나머지는 "더 보기" 로 이어붙인다.
 *  ② **목록은 생성 파일에서 온다.** `editorAssetManifest.ts` 는 `node scripts/build-editor-assets.mjs`
 *     가 `public/assets` 를 실제로 훑어 만든다 — 손으로 적지 않는다.
 *  ③ **import 는 서버가 없다.** 정적 사이트라 업로드 백엔드가 없다. 파일을 고르면
 *     (a) `URL.createObjectURL` 로 **이 세션에서만** 쓸 수 있게 하고
 *     (b) 저장해야 할 `public/assets/...` 경로를 같이 보여준다. 저장은 사용자가 직접 한다.
 *     (다운로드 버튼은 원본 파일을 그대로 내려받게 해 준다.)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_GROUPS, CATEGORY_LABELS, CATEGORY_ORDER,
  EDITOR_ASSETS, assetLabel, filterAssets,
  type EditorAsset,
} from "@/game/editorAssetManifest";

/** 한 번에 그리는 개수. 60개면 스크롤 한 화면을 넘기고, 요청 폭주도 없다. */
const PAGE = 60;

/** 가져온 이미지 — 세션 한정 objectURL. 저장 경로를 같이 들고 다닌다. */
export type ImportedAsset = {
  /** `blob:` URL — 이 탭을 닫으면 사라진다 */
  url: string;
  /** 저장해야 할 위치 (public 기준) */
  targetPath: string;
  name: string;
  bytes: number;
};

/** 업로드 경로 규칙 — 파일명을 그대로 쓰되 공백/한글은 URL 안전하게 바꾼다. */
function publicPathFor(fileName: string): string {
  const clean = fileName
    .trim()
    .replace(/\s+/g, "_")
    /* 한글 파일명은 그대로 두면 URL 인코딩 이슈가 생긴다 — 확장자만 남기고 안전 문자로 */
    .replace(/[^\w.\-]/g, "")
    .replace(/^_+/, "") || "imported.png";
  return `/assets/imported/${clean}`;
}

const ACCEPT = "image/png,image/webp,image/jpeg";

export default function AssetBrowser({
  onPick,
  compact = false,
  initialCategory,
}: {
  /** 에셋 선택 — URL 과 메타를 넘긴다. 두 에디터가 쓰는 형태가 달라 필요한 것만 넘긴다. */
  onPick?: (a: EditorAsset | ImportedAsset) => void;
  /** 좁은 사이드바용(썸네일 작게, 카테고리 셀렉트만) */
  compact?: boolean;
  initialCategory?: string;
}) {
  const [cat, setCat] = useState<string>(initialCategory ?? "objects");
  const [group, setGroup] = useState<string>("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [dropHot, setDropHot] = useState(false);
  const [imported, setImported] = useState<ImportedAsset[]>([]);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  /* 만든 objectURL 은 반드시 회수한다 — 안 하면 탭 메모리에 파일이 계속 쌓인다. */
  const urls = useRef<string[]>([]);
  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  /* 필터 결과 — 입력이 바뀌면 페이지도 처음으로 되돌린다(1페이지를 보여주는 게 자연스럽다). */
  const list = useMemo(() => {
    const r = filterAssets({ category: cat || undefined, group: group || undefined, query });
    return r;
  }, [cat, group, query]);
  const shown = list.slice(0, limit);

  const groups = CATEGORY_GROUPS[cat] ?? [];

  const pickCategory = (c: string) => { setCat(c); setGroup(""); setLimit(PAGE); };
  const pickGroup = (g: string) => { setGroup(g); setLimit(PAGE); };

  /* ── import ── */
  const takeFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added: ImportedAsset[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(f);
      urls.current.push(url);
      added.push({ url, targetPath: publicPathFor(f.name), name: f.name, bytes: f.size });
    }
    if (!added.length) { setNote("이미지 파일만 가져올 수 있습니다"); return; }
    setImported((prev) => [...added, ...prev].slice(0, 24));
    setNote(`${added.length}개 가져옴 — 저장 경로를 확인하세요`);
    if (added.length === 1) onPick?.(added[0]);
  };

  const kB = (n: number) => `${Math.max(1, Math.round(n / 1024))}KB`;

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      {/* 카테고리 */}
      <select
        value={cat}
        onChange={(e) => pickCategory(e.target.value)}
        className="w-full rounded border border-white/15 bg-[#151922] px-1.5 py-1 text-[10px]"
        aria-label="에셋 카테고리"
      >
        {CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c] ?? c} ({EDITOR_ASSETS.filter((a) => a.category === c).length})
          </option>
        ))}
      </select>

      {/* 그룹 — 카테고리에 세부 그룹이 있을 때만 */}
      {groups.length > 1 && (
        <select
          value={group}
          onChange={(e) => pickGroup(e.target.value)}
          className="w-full rounded border border-white/15 bg-[#151922] px-1.5 py-0.5 text-[10px]"
          aria-label="세부 그룹"
        >
          <option value="">전체 그룹</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      )}

      {/* 검색 */}
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
        placeholder="검색 (이름·경로·태그)"
        aria-label="에셋 검색"
        className="w-full rounded border border-white/15 bg-[#151922] px-1.5 py-1 text-[10px]"
      />

      {/* import — 파일 선택 + 드래그앤드롭 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDropHot(true); }}
        onDragLeave={() => setDropHot(false)}
        onDrop={(e) => {
          e.preventDefault(); setDropHot(false);
          takeFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        className={`cursor-pointer rounded border border-dashed px-1.5 py-2 text-center text-[9px] leading-tight transition ${
          dropHot ? "border-amber-300/70 bg-amber-400/10 text-amber-100" : "border-white/20 text-white/40 hover:border-white/35"
        }`}
      >
        이미지 가져오기 — 클릭 또는 드래그
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {note && <p className="text-[9px] leading-tight text-amber-200/80">{note}</p>}

      {/* 가져온 이미지 — 세션 한정 */}
      {imported.length > 0 && (
        <div className="rounded border border-amber-300/25 bg-amber-400/5 p-1">
          <p className="mb-1 text-[8px] font-bold text-amber-200/80">
            가져온 이미지 {imported.length}개 · 세션 한정(새로고침하면 사라짐)
          </p>
          <div className="max-h-[132px] space-y-1 overflow-y-auto">
            {imported.map((im) => (
              <div key={im.url} className="flex items-center gap-1">
                <img src={im.url} alt={im.name} className="h-7 w-7 shrink-0 rounded bg-black/30 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[8px] text-white/70">{im.name} · {kB(im.bytes)}</p>
                  <p className="truncate font-mono text-[8px] text-emerald-300/70" title="이 경로로 저장하세요">
                    {im.targetPath}
                  </p>
                </div>
                <button
                  onClick={() => onPick?.(im)}
                  className="shrink-0 rounded bg-white/10 px-1 py-0.5 text-[8px] hover:bg-white/20"
                  title="이 이미지를 편집에 사용"
                >
                  사용
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[8px] leading-tight text-white/30">
            이 앱은 정적 사이트라 서버 업로드가 없습니다. 파일을 위 경로에 저장한 뒤 커밋하세요.
          </p>
        </div>
      )}

      {/* 썸네일 그리드 */}
      <div className={`grid gap-1 overflow-y-auto ${compact ? "grid-cols-4 max-h-[240px]" : "grid-cols-5 max-h-[300px]"}`}>
        {shown.map((a) => (
          <button
            key={a.url}
            onClick={() => onPick?.(a)}
            title={`${a.url}${a.w ? ` · ${a.w}×${a.h}` : ""}`}
            className="group flex flex-col items-center gap-0.5 rounded border border-white/10 bg-black/30 p-0.5 hover:border-amber-300/60 hover:bg-amber-400/10"
          >
            <img
              src={a.url}
              alt={assetLabel(a)}
              loading="lazy"
              decoding="async"
              className={`${compact ? "h-8 w-8" : "h-10 w-10"} shrink-0 object-contain`}
            />
            <span className="w-full truncate text-center text-[7px] leading-tight text-white/45 group-hover:text-amber-100">
              {assetLabel(a)}
            </span>
          </button>
        ))}
        {shown.length === 0 && (
          <p className="col-span-full py-2 text-center text-[9px] text-white/35">결과 없음</p>
        )}
      </div>

      {/* 더 보기 — 남은 개수를 정확히 알려 준다 */}
      {list.length > shown.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="rounded border border-white/15 px-1.5 py-1 text-[9px] hover:bg-white/10"
        >
          더 보기 ({shown.length}/{list.length})
        </button>
      )}
      {list.length > 0 && list.length <= shown.length && (
        <p className="text-center text-[8px] text-white/25">{list.length}개 전부 표시</p>
      )}
    </div>
  );
}
