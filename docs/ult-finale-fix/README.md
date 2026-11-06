# 궁극기 연출 개선 (vc251)

## before → after

| | before | after |
|---|---|---|
| 본체 스케일 | setScale(scale * 0.4) — 256px 텍스처를 40%로 축소 | itScale() 역산 — warbringer x_flarebig 90px → **540px** (6.0배) |
| 보조 스케일 | setScale(scale * 0.3) | 동일 방식, peak 의 80% |
| 기둥 | .setScale(0.5, 0.2) — 세로를 1/5로 찌그러뜨림 | 균등 setScale(k) + Back.easeOut |
| 마법진 | .setScale(0.6) → 2.2 | groundLayer() 가 520px 목표에서 역산 |
| 레이어 | ADD + 단색 tint **1겹** | **3층**: 지면(마법진·링) + 본체 섬광 + 방사형 잔상 2장 |
| 타이밍 | 즉발 | 예비동작 110ms 축소 → 폭발 120ms → 잔화 430ms |
| 카메라 | doShake(ms, amt) | doShake(ms*1.35, amt*1.5) + hitStop(90) |
| VC239 | **0곳 사용** | fx_holy_judgement / fx_void_collapse / fx_tidal_wave |

## 추가 발견 — 과제 설명에 없던 진짜 주범

**4차 10직업이 타는 plan 경로는 텍스처를 한 장도 안 그렸다.**
scene.add.graphics() 로 반투명 벡터 도형만 칠하고 있었다. 이게 "짜치다"의 실질 주범이다.
판정·롤·펄스 타이밍은 그대로 두고 그 위에 groundLayer + burst 를 얹었다.

## 스크린샷

- _fix4_before.png / _fix4_after.png — warbringer (5차)
- _fix4_before_arclord.png / _fix4_after_arclord.png — arclord (4차, plan 경로)

## 검증

- 	sc --noEmit = 0
- eslint src --max-warnings 0 = 0
- 테스트 235 / 225 pass / 10 fail (기준선 동일, 신규 실패 0)
- ultimate-finale.test.mjs 계약(10직업×2슬롯, 데미지·타이밍·lite 패리티) 전부 통과

## 알려진 한계

1. **playVc 를 ultFinale.ts 안에 최소 복제**했다. 	ests/ultimate-finale.test.mjs 가 이 파일 소스를 vm 으로 직접 실행하며 import 를 정규식으로 제거하기 때문에 StudioFX import 를 추가하면 테스트가 깨진다.
   \shortcut: 아틀라스 3종 전용, 다른 애니 필요해지면 StudioFX 로 통합\ 주석 남김.
2. **헤드리스 검증 환경 한계** — SwiftShader 가 DEFAULT_FX_MODE 를 low 로 강등해 xLevel=0 → lite=true 가 되고 VC239/잔상/스핀이 전부 스킵된다. localStorage sertz_fx_mode=high 강제로 확인했다. **모바일 실기기에서는 저사양 판정 시 L1 축소판**이 나간다(의도된 동작이나 실기기 확인은 못 했다).
3. 파티클 개수는 늘리지 않았다(이미지 장수만 증가). 직선 경로 12스텝에는 잔상을 붙이지 않아 폭주를 막았다.