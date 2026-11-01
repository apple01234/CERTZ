// vc220 — 전직별 평타 강화 검증
let pass=0, fail=0;
const t=(n,c,x='')=>{ if(c){pass++;console.log(`PASS  ${n} ${x}`);} else {fail++;console.log(`FAIL  ${n} ${x}`);} };

// Player.atkSlash 의 실제 계산식 (코드 그대로)
function melee(tier, family) {
  const warrior = family === 'warrior';
  const tierK = Math.max(0, tier - 1);
  const fxK = 1 + 0.11 * tierK;
  const dmgMul = (warrior ? 1.1 : 1.0) + 0.22 * tier;
  const reach = (warrior ? 176 : 160) * (1 + 0.035 * tierK);
  const hitW = 116 * fxK;
  const knock = (warrior ? 320 : 280) * fxK;
  const slashScale = (warrior ? 1.15 : 1.0) * fxK;
  return { dmgMul, reach, hitW, knock, slashScale, arcScale: 1 + 0.1*Math.max(0,tier-1) };
}

console.log('=== 전사(warrior) 전직별 평타 ===');
console.log('tier  dmgMul  1차比   참격크기  판정폭  사거리  넉백  궤적');
const w = [1,2,3,4].map(t=>melee(t,'warrior'));
for (let i=0;i<w.length;i++){
  const m=w[i], t=i+1;
  console.log(` ${t}차  ${m.dmgMul.toFixed(2)}  ${((m.dmgMul/w[0].dmgMul-1)*100).toFixed(0).padStart(5)}%  ${m.slashScale.toFixed(2)}   ${m.hitW.toFixed(0)}   ${m.reach.toFixed(0)}   ${m.knock.toFixed(0)}   ${m.arcScale.toFixed(2)}`);
}
console.log('\n=== 도적(thief) 전직별 평타 ===');
const th = [1,2,3,4].map(t=>melee(t,'thief'));
for (let i=0;i<th.length;i++){
  const m=th[i], t=i+1;
  console.log(` ${t}차  ${m.dmgMul.toFixed(2)}  ${((m.dmgMul/th[0].dmgMul-1)*100).toFixed(0).padStart(5)}%  ${m.slashScale.toFixed(2)}   ${m.hitW.toFixed(0)}   ${m.reach.toFixed(0)}   ${m.knock.toFixed(0)}   ${m.arcScale.toFixed(2)}`);
}

console.log('\n=== 계약 검증 ===');
const W=[1,2,3,4].map(t=>melee(t,'warrior'));
const T=[1,2,3,4].map(t=>melee(t,'thief'));
for (const [name,arr] of [['전사',W],['도적',T]]) {
  let mono=true;
  for(let i=1;i<arr.length;i++) if(arr[i].dmgMul<=arr[i-1].dmgMul) mono=false;
  t(`${name} 데미지 단조 증가`, mono);
  t(`${name} 참격 크기 단조 증가`, arr.every((m,i)=>i===0||m.slashScale>arr[i-1].slashScale));
  t(`${name} 판정폭 단조 증가`, arr.every((m,i)=>i===0||m.hitW>arr[i-1].hitW));
  const gain=(arr[3].dmgMul/arr[0].dmgMul-1)*100;
  t(`${name} 1→4차 데미지 +50% 이상`, gain>=50, `(+${gain.toFixed(0)}%)`);
  const fxGain=(arr[3].slashScale/arr[0].slashScale-1)*100;
  t(`${name} 1→4차 이펙트 +30% 이상`, fxGain>=30, `(+${fxGain.toFixed(0)}%)`);
}
// 미전직(0)은 약해야 한다
const z=melee(0,'warrior');
t('미전직이 1차보다 약함', z.dmgMul < W[0].dmgMul, `(${z.dmgMul.toFixed(2)} < ${W[0].dmgMul.toFixed(2)})`);
// 5차(각성) 상한 확인 — 폭주하지 않는가
const five=melee(5,'warrior');
t('5차 각성도 과하지 않음(<2.5x)', five.dmgMul < 2.5, `(${five.dmgMul.toFixed(2)})`);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
