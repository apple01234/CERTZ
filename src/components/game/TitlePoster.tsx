/* 시작 화면 포스터 — "하루는 웨폰마스터가 되었다." 레이어 키트(Poster_AE_Kit)를 CSS 애니메이션으로 옮긴 것.
 *
 *  - 레이어: 하늘 / 원경 / 근경(꽃 언덕) / 캐릭터 3 / 슬라임 / 타이틀 3줄 + 장식. 좌표는 키트 1024×571 기준(asset_manifest.json).
 *  - 모션은 키트 AE 스크립트(Build_Poster.jsx)의 구조를 따른다: 원경·근경 패럴랙스, 캐릭터 숨쉬기(상하+기울기, 위상 어긋남),
 *    슬라임 눌림, 떠다니는 빛 입자, 타이틀 인트로. 시작 화면에서 눈에 띄도록 진폭은 키트 값의 약 2배다.
 *  - 전부 transform/opacity 만 쓰는 CSS 라 Phaser 캔버스·JS 타이머를 쓰지 않는다. 스타일은 globals.css 의 `.tp*`.
 *  - 장식 전용이므로 aria-hidden. 접근 가능한 제목은 TitleScreen 의 sr-only <h1> 이 맡는다.
 */

const W = 1024;
const H = 571;
const src = (name: string) => `/assets/title/${name}.webp`;
/** 키트 좌표(px) → 무대 대비 % 위치/폭 */
const box = (x: number, y: number, w: number) => ({
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  width: `${(w / W) * 100}%`,
});
/** 발 밑 피벗(키트 좌표) → 자기 상자 안의 transform-origin */
const pivot = (x: number, y: number, w: number, h: number, px: number, py: number) => `${(((px - x) / w) * 100).toFixed(1)}% ${(((py - y) / h) * 100).toFixed(1)}%`;

/* 키트 manifest: { x, y, width, height } 와 AE 스크립트의 피벗 */
const MAGE = { x: 504, y: 275, w: 175, h: 182, px: 603, py: 449 };
const HERO = { x: 670, y: 247, w: 146, h: 219, px: 743, py: 461 };
const ARCHER = { x: 797, y: 275, w: 155, h: 187, px: 875, py: 455 };
const SLIME = { x: 586, y: 415, w: 80, h: 59, px: 625, py: 471 };

/* 빛 입자 — 키트 공식: x = 70 + (i*137)%890, y = 320 + (i*47)%210, 크기 = 1.2 + (i%3)*0.6 */
const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: `${((70 + ((i * 137) % 890)) / W) * 100}%`,
  top: `${((320 + ((i * 47) % 210)) / H) * 100}%`,
  size: 1.2 + (i % 3) * 0.6,
  delay: `${-(i * 0.73).toFixed(2)}s`,
  dur: `${6 + (i % 4)}s`,
}));

/* 하늘의 빛 조각 — 정적인 하늘에 은은한 생동감만 준다(개수·크기를 일부러 작게) */
const GLINTS = [
  { x: 640, y: 118, s: 9 }, { x: 760, y: 62, s: 7 }, { x: 872, y: 150, s: 8 },
  { x: 590, y: 214, s: 6 }, { x: 930, y: 60, s: 6 }, { x: 505, y: 70, s: 5 },
];

export function TitlePoster() {
  return (
    <div aria-hidden="true" className="tp">
      <div className="tp-stage">
        <img className="tp-sky" src={src("sky")} alt="" draggable={false} />
        <img className="tp-land" src={src("land")} alt="" draggable={false} />
        <i className="tp-sun" />
        <img className="tp-front" src={src("front")} alt="" draggable={false} />

        {[
          { k: "mage", c: MAGE, d: "0s", t: "0s" },
          { k: "hero", c: HERO, d: "-0.89s", t: "-1.78s" },
          { k: "archer", c: ARCHER, d: "-1.72s", t: "-3.44s" },
        ].map(({ k, c, d, t }) => (
          <img
            key={k}
            className={`tp-char tp-${k}`}
            src={src(k)}
            alt=""
            draggable={false}
            style={{ ...box(c.x, c.y, c.w), transformOrigin: pivot(c.x, c.y, c.w, c.h, c.px, c.py), ["--bob" as string]: d, ["--tilt" as string]: t }}
          />
        ))}
        <img
          className="tp-slime"
          src={src("slime")}
          alt=""
          draggable={false}
          style={{ ...box(SLIME.x, SLIME.y, SLIME.w), transformOrigin: pivot(SLIME.x, SLIME.y, SLIME.w, SLIME.h, SLIME.px, SLIME.py) }}
        />
        <i className="tp-crystal" />

        {GLINTS.map((g, i) => (
          <i
            key={i}
            className="tp-glint"
            style={{ left: `${(g.x / W) * 100}%`, top: `${(g.y / H) * 100}%`, ["--s" as string]: g.s, animationDelay: `${-(i * 0.9).toFixed(1)}s`, animationDuration: `${3 + (i % 3) * 0.8}s` }}
          />
        ))}
        {MOTES.map((m, i) => (
          <i key={i} className="tp-mote" style={{ left: m.left, top: m.top, ["--s" as string]: m.size, animationDelay: m.delay, animationDuration: m.dur }} />
        ))}
      </div>

      <div className="tp-shade" />

      <div className="tp-title">
        <img className="tp-orn" src={src("ornament")} alt="" draggable={false} />
        <img className="tp-l1" src={src("line1")} alt="" draggable={false} />
        <img className="tp-l2" src={src("line2")} alt="" draggable={false} />
        <img className="tp-l3" src={src("line3")} alt="" draggable={false} />
      </div>
    </div>
  );
}
