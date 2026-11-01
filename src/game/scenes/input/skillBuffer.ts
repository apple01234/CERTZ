/**
 * vc225 — 스킬 입력 버퍼 분리 (`WorldScene.setupInput` 1,861줄 중 두 번째 조각).
 *
 * 배경: `docs/VC223_ARCH_AUDIT.md` 위험도 1순위 = `setupInput`(1,861줄) 분리.
 *
 * ## 왜 이 단위인가
 *
 * 스킬 입력은 버퍼링이 필요하다. 플레이어가 모션 중(`state !== "idle"`)일 때 스킬을 누르면
 * 즉시 버리는 대신 300ms 까지 보관했다가, 다음 프레임에 발동 가능해지면 실행한다.
 * 이 로직은 **버퍼 상태 하나 + flush 동작 하나**로 완결되므로 씬에서 떼어낼 수 있다.
 *
 * ## 기존 버그 (보존해야 하는 동작)
 *
 * - `vc146` 이전엔 모바일 3/4차기 버튼이 발행하는 `input:skill3/4` 를 받지 못해
 *   그 스킬들이 아예 발동하지 않았다. 지금은 `onS3`/`onS4` 가 등록돼 있다.
 * - 만료 판정은 `now - at > SKILL_BUFFER_MS` 이다. `>=` 로 바꾸면 경계 프레임에서
 *   정상 입력이 버려진다.
 * - 발동 시 버퍼를 **먼저 비우고** 실행한다. 실행 중 재진입해도 중복 발동하지 않는다.
 *
 * ## 설계
 *
 * 씬은 `SkillInputBuffer` 를 하나 가지면 되고, 등록 핸들러는 `onS1..onS5b` 만 만들면 된다
 * (기존 6개 `const onS*` 는 이 클래스의 메서드 참조로 대체).
 *
 * 시각(`time.now`)을 직접 읽지 않고 호출자가 `now` 를 넘긴다 — 씬 없이 테스트할 수 있다.
 */

/** 버퍼가 보관하는 스킬 식별자. `s5` = 궁극기, `s5b` = 제2궁극기(쿨 2분). */
export type SkillId = "s1" | "s2" | "s3" | "s4" | "s5" | "s5b";

/** 입력 보관 한도. 이 시간을 넘긴 입력은 낡은 것으로 보고 버린다. */
export const SKILL_BUFFER_MS = 300;

/** 버퍼에 담긴 요청 */
type Buffered = { id: SkillId; at: number };

/**
 * 실행 주체. 씬의 `Player` 를 그대로 넘기거나 테스트용 목을 쓴다.
 * `state` 가 `"idle"` 이 아니면 아직 모션 중이라 발동하지 않는다.
 */
export interface SkillCaster {
  state: string;
  useSkill1(): void;
  useSkill2(): void;
  useSkill3(): void;
  useSkill4(): void;
  useSkill5(): void;
  useSkill5b(): void;
}

export class SkillInputBuffer {
  private buffered: Buffered | null = null;

  /** 입력을 접수한다. 모션 중이면 보관했다가 나중에 flush 된다. */
  queue(id: SkillId, now: number): void {
    this.buffered = { id, at: now };
  }

  /** 대기 중인 요청을 비운다 (맵 전환·정지 등에서 잔존 입력 제거). */
  clear(): void {
    this.buffered = null;
  }

  /** 대기 중인 요청이 있는가 (디버그/테스트용) */
  get pending(): SkillId | null {
    return this.buffered?.id ?? null;
  }

  /**
   * 지금 발동 가능하면 실행하고 비운다.
   * @param caster 현재 플레이어 (없으면 아무것도 하지 않는다 — 씬 미준비 상태)
   * @param now    현재 시각 (`scene.time.now`)
   * @returns      실제로 발동했으면 true
   */
  flush(caster: SkillCaster | null, now: number): boolean {
    if (!this.buffered || !caster) return false;
    if (now - this.buffered.at > SKILL_BUFFER_MS) {
      this.buffered = null; // 만료 — 낡은 입력은 버린다
      return false;
    }
    if (caster.state !== "idle") return false; // 아직 모션 중 — 다음 프레임에 재시도
    const id = this.buffered.id;
    this.buffered = null; // 중복 발동 방지 — 실행 전에 비운다
    switch (id) {
      case "s1": caster.useSkill1(); break;
      case "s2": caster.useSkill2(); break;
      case "s3": caster.useSkill3(); break;
      case "s4": caster.useSkill4(); break;
      case "s5": caster.useSkill5(); break;
      default: caster.useSkill5b(); break;
    }
    return true;
  }
}
