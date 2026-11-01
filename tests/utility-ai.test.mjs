// vc214 Utility AI 단위 검증 — `node --experimental-strip-types tests/utility-ai.test.mjs`
// 이 파일은 src/game/ai/utility.ts 의 계약(0..1 정규화, 0 배제, 히스테리시스)을 고정한다.
import { Curve, compensate, UtilityEvaluator } from '../src/game/ai/utility.ts';

let pass=0, fail=0;
function t(name, cond, extra='') {
  if (cond) { pass++; console.log(`PASS  ${name} ${extra}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}

// --- Curve: 정규화 0..1 범위 보장 (스킬 핵심 지침) ---
t('linear 범위', Curve.linear(5,0,10)===0.5);
t('linear 클램프', Curve.linear(-5,0,10)===0 && Curve.linear(99,0,10)===1);
t('inverse 가까울수록 높음', Curve.inverse(2,2,20)===1 && Curve.inverse(20,2,20)===0);
t('exponential 문턱', Curve.exponential(0.3,0.3,1,2)===0 && Curve.exponential(1,0.3,1,2)===1);
t('sigmoid 중심', Math.abs(Curve.sigmoid(0.5,0.5)-0.5)<1e-9);
t('smoothstep 양끝', Curve.smoothstep(0,0,1)===0 && Curve.smoothstep(1,0,1)===1);
for (const f of ['linear','inverse','exponential','sigmoid','smoothstep']) {
  let ok=true;
  for (let v=-10; v<=10; v+=0.37) {
    let r;
    if (f==='linear') r=Curve.linear(v,0,1);
    else if (f==='inverse') r=Curve.inverse(v,0,1);
    else if (f==='exponential') r=Curve.exponential(v,0,1,2);
    else if (f==='sigmoid') r=Curve.sigmoid(v,0.5);
    else r=Curve.smoothstep(v,0,1);
    if (!(r>=0 && r<=1)) ok=false;
  }
  t(`${f} 항상 0..1`, ok);
}

// --- compensate: 인자 수가 늘어도 0 으로 눌리지 않아야 ---
const p4 = 0.8*0.8*0.8*0.8;          // 0.4096
const c4 = compensate(p4, 4, 0.5);
t('compensate 가 곱보다 큼', c4 > p4, `(${c4.toFixed(3)} > ${p4.toFixed(3)})`);
const p1 = compensate(0.8, 4, 0.5);
t('보상 후 1 미만', p1 < 1, `=${p1.toFixed(3)}`);
t('보상이 곱 대비 개선', p1 > Math.pow(0.8,4), `${p1.toFixed(3)} > ${Math.pow(0.8,4).toFixed(3)}`);
t('보상은 단조(항목↑ → 값↑)', compensate(0.5,4,0.5) > compensate(0.5,2,0.5));
t('전체 0 은 그대로 0', compensate(0,4,0.5)===0);

// --- UtilityEvaluator: 상황에 따라 행동이 바뀌는가 ---
const actions = [
  // chase = 중거리 선호. 역거리(inverse)를 쓰면 근접에서 포화돼 attack 을 이긴다.
  { id:'chase', considerations:[ (c)=>Curve.smoothstep(c.dist,0,120) * Curve.inverse(c.dist,120,900), (c)=>Curve.linear(c.hp,0,1) ] },
  { id:'flee',  considerations:[ (c)=>Curve.linear(c.dist,0,600), (c)=>Curve.inverse(c.hp,0,1) ] },
  { id:'attack',considerations:[ (c)=>Curve.inverse(c.dist,0,80), (c)=>Curve.linear(c.hp,0,1) ] },
];
const ev = new UtilityEvaluator(actions, { hysteresis:0.06, minScore:0.05 });

// 1) 멀리 있고 체력 만땅 → chase
let id = ev.select({ dist:500, hp:1 }, null);
t('원거리·풀피 → chase', id==='chase', `(got ${id})`);

// 2) 가까이 있고 풀피 → attack
id = ev.select({ dist:20, hp:1 }, null);
t('근거리·풀피 → attack', id==='attack', `(got ${id})`);

// 3) 체력 낮고 멀리 → flee
id = ev.select({ dist:500, hp:0.1 }, null);
t('체력 낮음 → flee', id==='flee', `(got ${id})`);

// 4) 히스테리시스: 거의 같은 점수면 현재 행동 유지
const near = [
  { id:'A', considerations:[ ()=>0.60 ] },
  { id:'B', considerations:[ ()=>0.61 ] },
];
const ev2 = new UtilityEvaluator(near, { hysteresis:0.06 });
t('히스테리시스로 현재 행동 유지', ev2.select({}, 'A')==='A', '(B=0.61 vs A+0.06)');

// 5) minScore 미만이면 null(대기)
const ev3 = new UtilityEvaluator([{ id:'x', considerations:[ ()=>0.01 ] }], { minScore:0.05 });
t('임계 미만 → null', ev3.select({}, null)===null);

// 6) 점수 맵 노출 (디버그용)
ev.evaluate({ dist:20, hp:1 }, 'chase');
t('lastScores 노출', ev.lastScores.size===3, `size=${ev.lastScores.size}`);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
