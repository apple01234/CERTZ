# -*- coding: utf-8 -*-
"""v1.0.2-beta — TouchControls 조작 UI 배치 복귀 (유저 지시 "배치만 옛날처럼").
v1.4.12~v1.4.28 와일드리프트식 아크 배치를 철거하고 그 이전의
우하단 flex 행 [자동+물약 세로열][스킬그리드][공격] 구조로 되돌린다.
스킬/물약/공격 버튼의 색·모양·크기(현행 SkillButton/PotionButton)는 그대로 유지."""
import io

P = "/home/z/my-project/src/components/game/TouchControls.tsx"
src = io.open(P, encoding="utf-8").read()


def replace_block(s, start_marker, end_marker, new, label):
    i = s.find(start_marker)
    assert i != -1, f"[{label}] 시작 마커 미발견"
    j = s.find(end_marker, i)
    assert j != -1, f"[{label}] 종료 마커 미발견"
    j += len(end_marker)
    print(f"[{label}] {j - i}자 교체")
    return s[:i] + new + s[j:]


# ── A) 모듈 상단: ARC 상수 + arcPos + arcAngles 철거 ──
A_START = '/* ═══ v1.4.12 (#8 유저 지시 "사진처럼 스킬 UI 배치를 바꿔")'
A_END = "function arcAngles(n: number): number[] {\n  if (n <= 0) return [];\n  if (n === 1) return [(ARC.a0 + ARC.a1) / 2];\n  const step = (ARC.a0 - ARC.a1) / (n - 1);\n  return Array.from({ length: n }, (_, i) => ARC.a0 - i * step);\n}\n"
A_NEW = """/* ═══ v1.0.2-beta — 조작 UI 배치 복귀 (유저 지시 "배치만 옛날처럼") ═══
 *  v1.4.12~v1.4.28의 와일드리프트식 아크(부채꼴) 배치를 철거하고, 그 이전의
 *  우하단 flex 행 [자동+물약 세로열] [스킬그리드] [공격] 구조로 되돌린다.
 *  단, 스킬/물약/공격/자동 버튼의 색·모양·크기(현행 SkillButton/PotionButton)는 그대로 —
 *  "배치만" 복귀가 원칙. 좁은 세로 화면(W<576)의 물약-조이스틱 겹침만은
 *  v1.4.18 안전장치(클러스터 플로팅)를 유지한다(배치가 아닌 사고 방지 장치). */
"""
src = replace_block(src, A_START, A_END, A_NEW, "A-ARC제거")

# ── B) 컴포넌트 내 레이아웃 변수: CW/CH/CR/CCX/CCY 제거 ──
B_START = "  /* ═══ v1.4.12 (#8) — 와일드리프트식 아크 레이아웃 ═══"
B_END = "  const ATK = sm ? 112 : 100; // 공격 버튼 지름 (확대)\n"
B_NEW = """  const sm = !isTouch; // PC(넓은 화면)에선 살짝 큰 크기
  /* v1.4.18 (#4) — 공격 버튼 100 (모바일) / 112 (PC) · v1.4.14 — 스킬 56/66 (현행 크기 유지) */
  const ATK = sm ? 112 : 100; // 공격 버튼 지름
"""
src = replace_block(src, B_START, B_END, B_NEW, "B-변수정리")

# ── C) angles/SK 정의 정리 (SK는 B에서 이미 정의) ──
C_START = "  const hasUlt = !!s5Name;\n  const angles = arcAngles(unlocked.length + (hasUlt ? 1 : 0));\n"
C_END = "  const SK = sm ? 66 : 56; // 스킬 버튼 지름 (확대)\n"
C_NEW = "  const hasUlt = !!s5Name;\n"
src = replace_block(src, C_START, C_END, C_NEW, "C-SK정리")

# ── D) PSC + v1.4.25 물약 절대배치 좌표 주석 제거 ──
D_START = "  /* ═══ v1.4.25 (#물약거리"
D_END = "  const PSC = sm ? 1.12 : 1;\n"
src = replace_block(src, D_START, D_END, "", "D-PSC제거")

# ── E) JSX: 아크 배치 블록 → 옛날 flex 행 블록 ──
E_START = '      {/* ═══ v1.4.12 (#8 유저 지시 "사진처럼 스킬 UI 배치를 바꿔")'
E_END = "      </div>\n    </>\n  );\n}\n\nfunction PotionButton({"
E_NEW = """      {/* ═══ v1.0.2-beta — 옛날 배치 복귀: 우하단 flex 행 [자동+물약][스킬그리드][공격] ═══
       *  버튼 색·모양·크기는 현행 그대로(SkillButton/PotionButton), 배치만 v1.4.12 이전 구조.
       *  컨테이너는 pointer-events-none, 개별 버튼만 pointer-events-auto — 빈 공간 터치 통과 */}
      <div
        className="pointer-events-none absolute z-20 flex items-end gap-2"
        style={{
          right: "max(0.5rem, env(safe-area-inset-right))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* [자동+물약] 세로열 — 옛날 좌측 클러스터. 좁은 세로 화면(clusterFloat)은
         *  조이스틱 겹침 방지(v1.4.18 안전장치 유지) 때문에 행 위쪽 가로열로 피난 */}
        {!clusterFloat && (
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            {autoBtn}
            {hpBtn}
            {mpBtn}
          </div>
        )}
        {/* [스킬그리드] — 해금된 스킬 2열 랩 그리드(아래→위로 쌓임), 궁극기는 마지막 칸의
         *  살짝 큰 황금 버튼(현행 스타일). 미해금 스킬은 그리드에서 제외 */}
        <div
          className="pointer-events-auto flex flex-wrap-reverse items-end justify-end gap-1.5"
          style={{ maxWidth: SK * 2 + 14 }}
        >
          {unlocked.map((s) => (
            <div key={s.key} style={{ width: SK, height: SK }}>
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
          ))}
          {hasUlt && (
            <div style={{ width: SK + 6, height: SK + 6 }}>
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
          )}
        </div>
        {/* [공격] — 행 끝 대형 원형 버튼 (현행 스타일·크기 유지) */}
        <button
          aria-label="공격"
          className="pointer-events-auto flex touch-none select-none items-center justify-center rounded-full border-[3px] border-rose-200/70 bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-transform active:scale-90"
          style={{ width: ATK, height: ATK }}
          onPointerDown={(e) => {
            e.preventDefault();
            EventBus.emit("input:attack");
          }}
        >
          <div className="flex flex-col items-center">
            <Swords size={26} />
            <span className="mt-0.5 text-[10px] font-black tracking-wide">{atkName || "공격"}</span>
          </div>
        </button>
        {/* clusterFloat(좁은 세로 화면) — [자동+물약]을 행 위쪽 가로열로 피난:
         *  배치 복귀와 무관하게 조이스틱(화면 좌하단 46%)과의 겹침만 막는 안전장치(v1.4.18 계승) */}
        {clusterFloat && (
          <div className="pointer-events-auto absolute bottom-full right-0 mb-2 flex items-center gap-2">
            {autoBtn}
            {hpBtn}
            {mpBtn}
          </div>
        )}
      </div>
    </>
  );
}

function PotionButton({"""
src = replace_block(src, E_START, E_END, E_NEW, "E-JSX교체")

io.open(P, "w", encoding="utf-8").write(src)
print("완료 — ARC 잔존 참조 확인:", "ARC" in src, "/ arcPos:", "arcPos" in src, "/ arcAngles:", "arcAngles" in src, "/ PSC:", "PSC" in src, "/ CCX:", "CCX" in src)
