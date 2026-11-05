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
  | "runes" | "skills" | "trade"
  /* vc247 (지시 #11) — 레벨 잠금 표시용. 기존 18종 팩에 자물쇠가 없어 SVG 로 그린다
   *  (webp 를 새로 만들면 톤/해상도가 어긋나므로, 단색 실루엣인 자물쇠는 벡터가 더 안전하다). */
  | "lock";

const SRC: Record<Exclude<IconName, "lock">, string> = {
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
  /* vc247 (지시 #11) — 자물쇠는 SVG. 다른 아이콘과 같은 방식으로 dim 처리한다. */
  if (name === "lock") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        role="img"
        aria-hidden="true"
        className={`shrink-0 transition-opacity ${dim ? "opacity-35 grayscale" : "opacity-100"} ${className}`}
        style={{ display: "block" }}
      >
        {/* 쇠고리 */}
        <path
          d="M4.6 7V5.2a3.4 3.4 0 0 1 6.8 0V7"
          fill="none"
          stroke="#e8edf7"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        {/* 몸체 */}
        <rect x="2.6" y="7" width="10.8" height="7.6" rx="1.5" fill="#e8edf7" />
        {/* 열쇠구멍 */}
        <circle cx="8" cy="10.2" r="1.15" fill="#1b2432" />
        <rect x="7.35" y="10.6" width="1.3" height="2.4" rx="0.6" fill="#1b2432" />
      </svg>
    );
  }
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
