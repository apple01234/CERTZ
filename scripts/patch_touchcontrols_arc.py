# -*- coding: utf-8 -*-
"""v1.4.12 #8 — TouchControls 스킬 UI 와일드리프트식 아크 배치로 교체.
기존 flex 행([자동+물약][스킬그리드][공격]) 블록을 극좌표 아크 JSX로 교체한다."""
import io, sys

P = "/home/z/my-project/src/components/game/TouchControls.tsx"
src = io.open(P, encoding="utf-8").read()

START = "      {/* 버튼: 우하단 — 터치/PC 공용 (사용자 지시 #2)"
END = "    </>\n  );\n}\n\nfunction PotionButton({"

i = src.find(START)
j = src.find(END)
assert i != -1 and j != -1 and j > i, f"마커 미발견 i={i} j={j}"

NEW = '''      {/* ═══ v1.4.12 (#8 유저 지시 "사진처럼 스킬 UI 배치를 바꿔") — 와일드리프트식 아크 배치 ═══
       *  공격 버튼 우하단 코너 + 스킬 부채꼴(극좌표) + 자동/물약 좌하단 클러스터.
       *  컨테이너는 pointer-events-none, 개별 버튼만 pointer-events-auto — 아크 빈 공간은 터치 통과 */}
      <div
        className="pointer-events-none absolute z-20"
        style={{
          width: CW,
          height: CH,
          right: "max(0.25rem, env(safe-area-inset-right))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* 스킬 아크 (s1→s5: 왼쪽→위쪽 부채꼴) — 해금된 스킬만 등간격 배치 */}
        {unlocked.map((s, i) => {
          const p = arcPos(CCX, CCY, CR, angles[i]);
          return (
            <div
              key={s.key}
              className="pointer-events-auto absolute"
              style={{ left: p.left - SK / 2, top: p.top - SK / 2, width: SK, height: SK }}
            >
              <SkillButton
                ready={s.ready}
                cdPct={s.cd}
                label={s.name}
                mp={s.mp}
                icon={s.icon}
                compact={!!sm}
                onDown={() => EventBus.emit(s.emit as "input:skill1")}
              />
            </div>
          );
        })}
        {/* 궁극기(s5) — 아크 끝(가장 위쪽)에 살짝 큰 황금 버튼 */}
        {hasUlt && (() => {
          const p = arcPos(CCX, CCY, CR + (sm ? 10 : 8), angles[unlocked.length]);
          return (
            <div
              className="pointer-events-auto absolute"
              style={{ left: p.left - (SK + 6) / 2, top: p.top - (SK + 6) / 2, width: SK + 6, height: SK + 6 }}
            >
              <SkillButton
                ready={s5Ready}
                cdPct={s5Pct}
                label={s5Name || ""}
                mp={100}
                icon={skills.s5Icon}
                ult
                compact={!!sm}
                onDown={() => EventBus.emit("input:skill5")}
              >
                <Star size={18} />
              </SkillButton>
            </div>
          );
        })()}
        {/* 기본공격 — 컨테이너 우하단 코너 고정 */}
        <button
          aria-label="공격"
          className="pointer-events-auto absolute flex touch-none select-none items-center justify-center rounded-full border-[3px] border-rose-200/70 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-transform active:scale-90"
          style={{ left: CW - ATK, top: CH - ATK, width: ATK, height: ATK }}
          onPointerDown={(e) => {
            e.preventDefault();
            EventBus.emit("input:attack");
          }}
        >
          <div className="flex flex-col items-center">
            <Swords size={22} />
            <span className="mt-0.5 text-[9px] font-black tracking-wide">{atkName || "공격"}</span>
          </div>
        </button>
        {/* 자동전투 + 물약 퀵슬롯 — 좌하단 세로 클러스터 (와일드리프트 소환사 주문 자리 역할) */}
        <div className="pointer-events-auto absolute bottom-0 left-0 flex flex-col gap-1.5">
          {canAutoHunt && (
            <button
              aria-label={autoHunt ? "자동사냥 끄기" : "자동사냥 켜기"}
              className={`relative flex h-10 w-10 touch-none select-none items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-90 sm:h-12 sm:w-12 ${
                autoHunt
                  ? "border-lime-200/80 bg-gradient-to-b from-lime-500 to-emerald-700 text-white animate-pulse"
                  : "border-white/25 bg-slate-800/85 text-white/80"
              }`}
              onPointerDown={(e) => {
                e.preventDefault();
                EventBus.emit("rpg:autohunt", {});
              }}
            >
              {autoHunt ? <Pause size={17} /> : <Bot size={17} />}
              <span className="absolute -top-1 left-0.5 rounded bg-slate-900/80 px-0.5 text-[8px] font-black text-white/80">
                {autoHunt ? "자동중" : "자동"}
              </span>
            </button>
          )}
          {/* 물약 퀵슬롯 — v3.0.15 (#7) 인벤토리에서 장착한 물약이 버튼에 표시/사용된다 */}
          <PotionButton
            kind="hp"
            count={hpPot}
            itemKey={quickPots?.hp ?? "potion_hp"}
            itemCount={potCount?.(quickPots?.hp ?? "potion_hp") ?? hpPot}
            tint="from-rose-500 to-rose-700 border-rose-200/70"
            onDown={() => EventBus.emit("rpg:use", { kind: "hp" })}
          />
          <PotionButton
            kind="mp"
            count={mpPot}
            itemKey={quickPots?.mp ?? "potion_mp"}
            itemCount={potCount?.(quickPots?.mp ?? "potion_mp") ?? mpPot}
            tint="from-sky-500 to-blue-800 border-sky-200/70"
            onDown={() => EventBus.emit("rpg:use", { kind: "mp" })}
          />
        </div>
      </div>
    </>'''

out = src[:i] + NEW + "\n" + src[j:]
io.open(P, "w", encoding="utf-8").write(out)
print("OK — 아크 JSX 교체 완료:", P)
