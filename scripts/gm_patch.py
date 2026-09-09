#!/usr/bin/env python3
# GM 시스템 서버검증 게이팅 + GM 전용 아이템 (v1.0.2, Phase 12)
p = "src/game/scenes/WorldScene.ts"
s = open(p, encoding="utf8").read()

# 1) account 임포트 (authMe)
if 'from "../account"' not in s:
    anchor = 'import { viewZoom } from "../PhaserGame";'
    assert anchor in s
    s = s.replace(anchor, anchor + '\nimport { authMe } from "../account"; // v1.0.2 — GM 진입 서버 롤 검증', 1)

# 2) GM NPC — 관리자 확인 전까지 숨김 + 인터랙션 서버 검증
old = '''    /* v3.0.3 (사용자 지시 #2) — 임시 GM NPC: 자유전직/골드/레벨 지원
     *  마을 전직관 옆에 배치. E키 → GM 패널 (전직 무제한/골드/레벨 조정) */
    const gx = jx + 70;
    const gy = jy + 6;
    const gglow = this.add.image(gx, gy + 14, "glow").setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setScale(0.75).setAlpha(0.3);
    this.tweens.add({ targets: gglow, alpha: 0.5, scale: 0.95, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const gmNpc = this.add.image(gx, gy, "npc_gm").setDepth(Math.floor(gy / 10)).setScale(1.15);
    this.tweens.add({ targets: gmNpc, y: gy - 3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add
      .text(gx, gy - 46, "GM", {
        fontFamily: "Galmuri11, sans-serif", fontSize: "12px", color: "#ffd76a",
        stroke: "#1a1020", strokeThickness: 4, fontStyle: "bold",
      })
      .setOrigin(0.5).setDepth(21);
    this.add
      .text(gx, gy - 34, "운영자 지원", {
        fontFamily: "Galmuri11, sans-serif", fontSize: "10px", color: "#ffe9b0",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setDepth(21);
    this.interactables.push({ x: gx, y: gy, kind: "gm", npcId: "gm", label: "GM — 자유전직·골드·레벨·5차전직·무릉도장" });'''
new = '''    /* v3.0.3 (사용자 지시 #2) — GM NPC: 자유전직/골드/레벨 지원
     *  v1.0.2 (#GM서버검증) — GM은 NPC가 아닌 관리자 도구로 분리.
     *  · 마을 NPC는 관리자 계정(서버 롤) 확인 전까지 렌더 숨김 → 일반 유저에게는 존재하지 않음
     *  · 인터랙션 시 authMe()로 서버 롤 재확인 — 클라 플래그(isGM=true)만으론 절대 열리지 않음 */
    const gx = jx + 70;
    const gy = jy + 6;
    const gglow = this.add.image(gx, gy + 14, "glow").setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setScale(0.75).setAlpha(0.3).setVisible(false);
    this.tweens.add({ targets: gglow, alpha: 0.5, scale: 0.95, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const gmNpc = this.add.image(gx, gy, "npc_gm").setDepth(Math.floor(gy / 10)).setScale(1.15).setVisible(false);
    this.tweens.add({ targets: gmNpc, y: gy - 3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const gmLbl1 = this.add
      .text(gx, gy - 46, "GM", {
        fontFamily: "Galmuri11, sans-serif", fontSize: "12px", color: "#ffd76a",
        stroke: "#1a1020", strokeThickness: 4, fontStyle: "bold",
      })
      .setOrigin(0.5).setDepth(21).setVisible(false);
    const gmLbl2 = this.add
      .text(gx, gy - 34, "운영자 지원", {
        fontFamily: "Galmuri11, sans-serif", fontSize: "10px", color: "#ffe9b0",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setDepth(21).setVisible(false);
    this.gmNpcVisuals = [gglow, gmNpc, gmLbl1, gmLbl2];
    this.interactables.push({ x: gx, y: gy, kind: "gm", npcId: "gm", label: "GM — 자유전직·골드·레벨·5차전직·무릉도장" });'''
assert old in s; s = s.replace(old, new, 1)

# 3) 필드 선언
old2 = '''  /** v1.0.2 (#큐브연타) — eert 큐브 처리 잠금 시각 (260ms 내 재요청 무시) */
  private eertBusyUntil = 0;'''
new2 = '''  /** v1.0.2 (#큐브연타) — eert 큐브 처리 잠금 시각 (260ms 내 재요청 무시) */
  private eertBusyUntil = 0;
  /** v1.0.2 (#GM서버검증) — 서버가 알려준 관리자 롤 (authMe 결과 캐시) */
  private adminRole: string | null = null;
  private gmCheckBusy = false;
  /** GM NPC 비주얼 — 관리자 확인 시에만 표시 */
  private gmNpcVisuals: Phaser.GameObjects.GameObject[] = [];'''
assert old2 in s; s = s.replace(old2, new2, 1)

# 4) GM 인터랙션 서버 검증
old3 = '''    } else if (it.kind === "gm") {
      /* v3.0.3 — GM NPC: 전직 상담 없이 즉시 GM 패널 오픈 */
      EventBus.emit("ui:panel", { panel: "gm" });'''
new3 = '''    } else if (it.kind === "gm") {
      /* v1.0.2 (#GM서버검증) — GM 패널 진입은 서버 롤 재확인 후 허용 (매 상호작용 시 신선한 검증) */
      if (this.gmCheckBusy) return;
      this.gmCheckBusy = true;
      authMe()
        .then((u) => {
          this.adminRole = u?.role ?? null;
          if (this.adminRole === "admin") {
            EventBus.emit("ui:panel", { panel: "gm" });
          } else {
            EventBus.emit("banner:show", { text: "GM 기능은 관리자 계정 전용입니다" });
          }
        })
        .catch(() => EventBus.emit("banner:show", { text: "권한 확인에 실패했다 (관리자 전용)" }))
        .finally(() => { this.gmCheckBusy = false; });'''
assert old3 in s; s = s.replace(old3, new3, 1)

# 5) onGm 유니온에 gmitems 추가 + 지급 케이스
old4 = '''    const onGm = (v: { type: "job" | "gold" | "lv" | "heal" | "ap" | "em" | "fifth" | "dojang" | "gate" | "closet" | "freegacha" | "tickets" | "boss"; value?: number | string }) => {'''
new4 = '''    const onGm = (v: { type: "job" | "gold" | "lv" | "heal" | "ap" | "em" | "fifth" | "dojang" | "gate" | "closet" | "freegacha" | "tickets" | "boss" | "gmitems"; value?: number | string }) => {'''
assert old4 in s; s = s.replace(old4, new4, 1)

old5 = '''      } else if (v.type === "em" && typeof v.value === "number") {'''
new5 = '''      } else if (v.type === "gmitems") {
        /* v1.0.2 (#GM아이템) — GM 전용 장비 4종 지급 (gmOnly — 상점/드롭/거래 불가, 관리자 테스트용) */
        for (const k of ["gm_sword", "gm_armor", "gm_ring", "gm_elixir"]) {
          if (!p.owned.includes(k as ItemKey)) p.owned.push(k as ItemKey);
        }
        this.spawnPillar(p.x, p.y, 0xffd76a, 240);
        EventBus.emit("banner:show", { text: "GM 장비 지급 완료 — [GM] 대검·갑주·반지·엘릭서" });
        this.emitRpgState();
        this.save();
      } else if (v.type === "em" && typeof v.value === "number") {'''
assert old5 in s; s = s.replace(old5, new5, 1)

# 6) 마켓 등록 — gmOnly 차단
old6 = '''    const onMarketList = (v: { key: string; up: number }) => {
      if (!this.player || this.dialoguing) return;
      const idx = this.player.owned.indexOf(v.key as ItemKey);
      if (idx < 0) return;'''
new6 = '''    const onMarketList = (v: { key: string; up: number }) => {
      if (!this.player || this.dialoguing) return;
      /* v1.0.2 (#GM아이템) — GM 전용 아이템은 거래판 등록 불가 */
      if (ITEMS[v.key as ItemKey]?.gmOnly) {
        EventBus.emit("banner:show", { text: "GM 전용 아이템은 거래할 수 없다" });
        return;
      }
      const idx = this.player.owned.indexOf(v.key as ItemKey);
      if (idx < 0) return;'''
assert old6 in s; s = s.replace(old6, new6, 1)

open(p, "w", encoding="utf8").write(s)
print("GM 게이팅 적용 완료")
