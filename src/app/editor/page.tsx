import type { Metadata } from "next";
import TilemapEditor from "@/components/game/TilemapEditor";

export const metadata: Metadata = {
  title: "SERTZ 맵 에디터",
  description: "타일맵 저작 도구 — 게임과 동일한 렌더 규칙을 사용합니다.",
};

/**
 * 타일맵 에디터 페이지.
 *
 * [왜 게임과 분리된 라우트인가]
 *  에디터는 Phaser 를 띄우지 않는다(canvas 2D + React). 게임 번들에 섞으면
 *  에디터 코드가 플레이어에게 내려가고, 게임 씬의 물리·에셋 로딩이 편집을 방해한다.
 *  `/editor` 는 순수 도구라 정적 서빙해도 무해하다.
 */
export default function EditorPage() {
  return <TilemapEditor />;
}
