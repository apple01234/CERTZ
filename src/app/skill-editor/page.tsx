import type { Metadata } from "next";
import SkillEditor from "@/components/game/SkillEditor";

export const metadata: Metadata = {
  title: "SERTZ 스킬 메이커",
  description: "스킬 저작 도구 — 게임의 검증·판정·데미지 공식을 그대로 사용합니다.",
};

/**
 * 스킬 메이커 페이지.
 *
 * [왜 게임과 분리된 라우트인가]
 *  `/editor`(타일맵)와 같은 이유다. 에디터는 Phaser 를 띄우지 않고(canvas 2D + React),
 *  게임 번들에 섞으면 도구 코드가 플레이어에게 내려가며 씬의 물리·에셋 로딩이 편집을
 *  방해한다. 스킬 메이커는 순수 도구라 정적 서빙해도 무해하다.
 *  (`/editor` 를 그대로 확장하지 않은 이유: 타일맵과 스킬은 문서 형식·검증·히스토리가
 *   전부 달라 한 화면에 넣으면 둘 다 복잡해진다.)
 */
export default function SkillEditorPage() {
  return <SkillEditor />;
}
