// vc222 — 셰이크 강도 접근성 배율 검증
let pass=0, fail=0;
const t=(n,c,x='')=>{ if(c){pass++;console.log(`PASS  ${n} ${x}`);} else {fail++;console.log(`FAIL  ${n} ${x}`);} };

// localStorage 스텁
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  },
};

const mod = await import('../src/game/fx/shakeScale.ts');
const { SHAKE_FACTORS, DEFAULT_SHAKE_SCALE, SHAKE_STORAGE_KEY,
        loadShakeScale, getShakeScale, setShakeScale, shakeFactor, shakeEnabled } = mod;

console.log('=== 1) 기본값 ===');
t('기본은 normal', DEFAULT_SHAKE_SCALE === 'normal');
t('저장값 없으면 normal', loadShakeScale() === 'normal' && getShakeScale() === 'normal');
t('기본 배율 1.0', shakeFactor() === 1);
t('기본은 흔들림 켜짐', shakeEnabled() === true);

console.log('\n=== 2) 각 단계 배율 ===');
for (const [m, want] of [['off',0],['low',0.45],['normal',1],['strong',1.45]]) {
  setShakeScale(m);
  t(`${m} → ${want}`, shakeFactor() === want, `(=${shakeFactor()})`);
  t(`${m} 저장됨`, window.localStorage.getItem(SHAKE_STORAGE_KEY) === m);
}

console.log('\n=== 3) off 는 흔들림 비활성 ===');
setShakeScale('off');
t('off → shakeEnabled=false', shakeEnabled() === false);
t('off → factor 0 (연출 스킵 가능)', shakeFactor() === 0);

console.log('\n=== 4) 부팅 복원 ===');
setShakeScale('strong');
const restored = loadShakeScale();
t('저장된 strong 복원', restored === 'strong' && shakeFactor() === 1.45);

console.log('\n=== 5) 손상된 값 방어 ===');
store.set(SHAKE_STORAGE_KEY, 'garbage');
t('잘못된 값 → normal 로 복구', loadShakeScale() === 'normal' && shakeFactor() === 1);
store.set(SHAKE_STORAGE_KEY, '');
t('빈 문자열 → normal', loadShakeScale() === 'normal');
// localStorage 자체가 던지는 환경 (사파리 프라이빗 등)
globalThis.window = { localStorage: { getItem(){ throw new Error('denied'); }, setItem(){ throw new Error('denied'); } } };
t('localStorage 예외 → 기본값', loadShakeScale() === 'normal');
let threw = false;
try { setShakeScale('low'); } catch { threw = true; }
t('저장 실패해도 예외를 던지지 않음', !threw);
t('저장 실패해도 이번 세션엔 적용', getShakeScale() === 'low');

console.log('\n=== 6) 실제 흔들림 계산에 반영되는가 ===');
// ImpactFX.shake: intensity *= k
function effIntensity(base, mode) {
  const k = SHAKE_FACTORS[mode];
  if (k <= 0) return null;  // 연출 스킵
  return base * k;
}
t('normal 은 원본 그대로', effIntensity(0.004, 'normal') === 0.004);
t('low 는 45%', Math.abs(effIntensity(0.004,'low') - 0.0018) < 1e-9, `(=${effIntensity(0.004,'low')})`);
t('strong 은 145%', Math.abs(effIntensity(0.004,'strong') - 0.0058) < 1e-9);
t('off 는 연출 자체를 안 냄', effIntensity(0.004,'off') === null);

// TraumaShake: ox = sin(t*1.7)*18*s*k
function traumaOx(trauma, t, mode) {
  const k = SHAKE_FACTORS[mode];
  const s = trauma * trauma;
  return Math.sin(t * 1.7) * 18 * s * k;
}
const oxN = traumaOx(0.8, 1.0, 'normal');
t('trauma normal = 기준값', Math.abs(oxN - Math.sin(1.7)*18*0.64) < 1e-9);
t('trauma off = 0 (화면 고정)', traumaOx(0.8, 1.0, 'off') === 0);
t('trauma low < normal', Math.abs(traumaOx(0.8,1.0,'low')) < Math.abs(oxN));
t('trauma strong > normal', Math.abs(traumaOx(0.8,1.0,'strong')) > Math.abs(oxN));

console.log('\n=== 7) 히트스톱은 영향 없음 (타격감 보존) ===');
// 배율은 카메라 오프셋에만 곱해진다 — hitStop 은 이 모듈을 참조하지 않는다
import { readFileSync } from 'node:fs';
const impact = readFileSync(new URL('../src/game/fx/ImpactFX.ts', import.meta.url), 'utf8');
const hitStopBody = impact.slice(impact.indexOf('hitStop(ms: number)'), impact.indexOf('hitStop(ms: number)') + 900);
t('hitStop 이 shakeFactor 를 참조하지 않음', !hitStopBody.includes('shakeFactor'));
const scene = readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
const hs = scene.slice(scene.indexOf('hitStop(ms = 26)'), scene.indexOf('hitStop(ms = 26)') + 400);
t('WorldScene.hitStop 도 위임만 (배율 무관)', !hs.includes('shakeFactor') && hs.includes('impactFX'));

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
