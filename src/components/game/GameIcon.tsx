/**
 * vc185 (지시 #7 — "AI가 만든 아이콘&버튼 에셋이나 사람이 만든걸로 교체해") — UI 아이콘.
 *
 * 배경:
 *  HUD 아이콘은 lucide-react 선화(Line) 아이콘이었다. 얇은 벡터 선은 웹 관리자
 *  페이지 느낌이라, 도트 그래픽 게임 위에 얹으면 UI만 따로 노는 것이 바로 보였다.
 *
 *  사용자가 제공한 Classic_RPG_GUI 팩에 사람이 그린 256×256 아이콘 17종이 있어
 *  이것으로 교체했다(신규 생성 없음 — 제공 에셋 사용 지침 준수).
 *  64×64로 리사이즈해 public/assets/ui/*.webp 로 저장(총 555KB).
 *
 * 사용:
 *  <GameIcon name="bag" />  — 크기·색은 CSS로 제어. 이미지라 tint 가 아니라
 *  filter 로 밝기를 조절한다(활성/비활성 표현용).
 */
type IconName =
  | "bag" | "equip" | "fight" | "honor" | "inventory" | "menu" | "options"
  | "profession" | "quest" | "skull" | "boss" | "close" | "greed" | "need"
  | "runes" | "skills" | "trade";

const SRC: Record<IconName, string> = {
  bag: "/assets/ui/ui_bag.webp",
  equip: "/assets/ui/ui_equip.webp",
  fight: "/assets/ui/ui_fight.webp",
  honor: "/assets/ui/ui_honor.webp",
  inventory: "/assets/ui/ui_inventory.webp",
  menu: "/assets/ui/ui_menu.webp",
  options: "/assets/ui/ui_options.webp",
  profession: "/assets/ui/ui_profession.webp",
  quest: "/assets/ui/ui_quest.webp",
  skull: "/assets/ui/ui_skull.webp",
  boss: "/assets/ui/ui_boss.webp",
  close: "/assets/ui/ui_close.webp",
  greed: "/assets/ui/ui_greed.webp",
  need: "/assets/ui/ui_need.webp",
  runes: "/assets/ui/ui_runes.webp",
  skills: "/assets/ui/ui_skills.webp",
  trade: "/assets/ui/ui_trade.webp",
};

export function GameIcon({
  name,
  size = 20,
  dim = false,
  className = "",
}: {
  name: IconName;
  /** px — 기본 20 */
  size?: number;
  /** 비활성(어둡게) */
  dim?: boolean;
  className?: string;
}) {
  return (
    <img
      src={SRC[name]}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className={`shrink-0 object-contain transition-opacity ${dim ? "opacity-35 grayscale" : "opacity-100"} ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export type { IconName };
