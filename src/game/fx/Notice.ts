/**
 * vc225 — 알림 단일 창구 (`WorldScene` 의 `banner:show` 직접 호출 통합).
 *
 * ## 왜 만드는가
 *
 * `docs/VC223_ARCH_AUDIT.md` 위험도 3순위가 "배너/토스트 36 메서드 → `fx/Notice.ts`" 였다.
 * 실측해 보니 `banner:show` 는 `WorldScene` 전체에서 **179회** 호출되고 있었다:
 *
 * | 위치 | 횟수 |
 * |---|---|
 * | `setupInput` (안내 메시지 핸들러들) | 109 |
 * | `handleIsekai` | 20 |
 * | `abyssBuy` | 6 |
 * | `buySilverShop` | 5 |
 * | 그 외 28곳 | 39 |
 *
 * 게다가 `setupInput` 안 100개는 **전부 동일한 형태** `{ text: <문자열> }` 이었다.
 * 즉 같은 이벤트를 100번 손으로 적고 있는 상태다. 이 모듈을 거치게 하면
 *
 * 1. 호출부가 `notice("...")` 한 줄로 줄고,
 * 2. 나중에 알림 정책(중복 억제·묶음·접근성)을 바꿀 때 한 곳만 고치면 되고,
 * 3. `banner:show` 를 직접 쏘는 코드와 아닌 코드가 뒤섞이는 일이 없어진다.
 *
 * ## 기존 동작 보존
 *
 * `EventBus.emit("banner:show", { text })` 를 **그대로** 발행한다. 수신 측(React 배너)은
 * 아무것도 바뀌지 않는다. 여기서 새 기능(큐·쿨다운·중복 억제)을 넣지 않는다 —
 * 이번 목표는 **이동**이지 동작 변경이 아니다. 빈 문자열 방어도 넣지 않는다
 * (원본이 `if (msg)` 로 거르던 자리는 호출부에 그대로 남아 있다).
 */
import { EventBus } from "../../components/game/EventBus";

/**
 * 사용자에게 한 줄 알림을 띄운다.
 *
 * @param text 표시할 문구
 * @param ms   유지 시간(ms). 생략하면 수신 측 기본값을 쓴다.
 */
export function notice(text: string, ms?: number): void {
  if (ms === undefined) EventBus.emit("banner:show", { text });
  else EventBus.emit("banner:show", { text, ms });
}
