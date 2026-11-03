import type { CSSProperties } from "react";
/** Original 16px UI glyphs: the same hard pixel grid as the Kenney world sprites. */
const GLYPHS = {
  book: [
    "1111110111111",
    "1000010100001",
    "1000010100001",
    "1011010110101",
    "1000010100001",
    "1011010110101",
    "1000010100001",
    "1111111111111",
  ],
  arrow: ["1000", "1100", "0110", "0011", "0110", "1100", "1000"],
  crown: [
    "1000001000001",
    "1100011100011",
    "1110111110111",
    "1111111111111",
    "0111111111110",
    "0111111111110",
    "0111111111110",
  ],
  heart: [
    "01110001110",
    "11111011111",
    "11111111111",
    "11111111111",
    "01111111110",
    "00111111100",
    "00011111000",
    "00001110000",
    "00000100000",
  ],
  cross: [
    "11000000011",
    "01100000110",
    "00110001100",
    "00011011000",
    "00001110000",
    "00011011000",
    "00110001100",
    "01100000110",
    "11000000011",
  ],
  shield: [
    "11111111111",
    "11111111111",
    "11000000011",
    "11000000011",
    "11000000011",
    "01100000110",
    "00110001100",
    "00011111000",
    "00001110000",
  ],
  star: [
    "000010000",
    "000111000",
    "000111000",
    "111111111",
    "011111110",
    "001111100",
    "001111100",
    "011101110",
    "011000110",
  ],
  people: [
    "0011001100",
    "0111111110",
    "0011001100",
    "0000000000",
    "0111111110",
    "1111111111",
    "1101111011",
    "1101111011",
  ],
  box: [
    "11111111111",
    "10000000001",
    "11111111111",
    "10011111001",
    "10010001001",
    "10011111001",
    "10000000001",
    "11111111111",
  ],
  compass: [
    "000111000",
    "001101100",
    "011000110",
    "110010011",
    "110111011",
    "110010011",
    "011000110",
    "001101100",
    "000111000",
  ],
};
type Props = { size?: number; style?: CSSProperties; className?: string };
function glyph(kind: keyof typeof GLYPHS) {
  return function Icon({ size = 18, ...rest }: Props) {
    const rows = GLYPHS[kind],
      w = rows[0].length,
      h = rows.length;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        aria-hidden="true"
        {...rest}
      >
        {rows.flatMap((row, y) =>
          [...row].flatMap((v, x) =>
            v === "1"
              ? [
                  <rect
                    key={`${x}-${y}`}
                    x={Math.floor((16 - w) / 2) + x}
                    y={Math.floor((16 - h) / 2) + y}
                    width="1"
                    height="1"
                    fill="currentColor"
                  />,
                ]
              : [],
          ),
        )}
      </svg>
    );
  };
}
export const BookOpen = glyph("book"),
  ChevronRight = glyph("arrow"),
  Compass = glyph("compass"),
  Crown = glyph("crown"),
  Download = glyph("box"),
  Flag = glyph("star"),
  FolderArchive = glyph("box"),
  Heart = glyph("heart"),
  LogOut = glyph("arrow"),
  Settings = glyph("compass"),
  Shield = glyph("shield"),
  Sparkles = glyph("star"),
  Swords = glyph("cross"),
  Users = glyph("people"),
  X = glyph("cross");
