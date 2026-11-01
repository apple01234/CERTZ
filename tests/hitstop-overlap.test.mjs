// vc221 통합(위임) 검증 — ImpactFX 단일 소유 + 자가치유 연동
let pass=0, fail=0;
const t=(n,c,x='')=>{ if(c){pass++;console.log(`PASS  ${n} ${x}`);} else {fail++;console.log(`FAIL  ${n} ${x}`);} };

function make() {
  let now=0, seq=0, until=0, frozen=false, resumes=0, pauses=0;
  const timers=[];
  function hitStop(ms){
    if(ms<=0) return;
    const target=Math.max(until, now+ms);
    until=target;
    const myId=++seq;
    if(!frozen){ frozen=true; pauses++; }
    timers.push({at:target, fn:()=>{
      if(myId!==seq) return;
      frozen=false; resumes++;
    }});
  }
  // 씬 자가치유: isPaused && now>=endsAt 이면 resume
  function watchdog(){
    if(frozen && now>=until){ frozen=false; resumes++; }
  }
  function tick(dt){ now+=dt;
    for(let i=timers.length-1;i>=0;i--) if(timers[i].at<=now){ timers[i].fn(); timers.splice(i,1); }
    watchdog();
  }
  return {hitStop,tick,get paused(){return frozen;},get resumes(){return resumes;},
          get pauses(){return pauses;},get endsAt(){return until;},get now(){return now;}};
}

console.log("=== 1) 단일 경로 히트스톱 ===");
{
  const s=make(); s.hitStop(55);
  t("즉시 정지", s.paused);
  for(let i=0;i<4;i++) s.tick(10);  // t=40
  t("자가치유가 자르지 않음 (40ms < 55ms)", s.paused, `(endsAt=${s.endsAt})`);
  for(let i=0;i<3;i++) s.tick(10);  // t=70
  t("종료 후 재개", !s.paused);
  t("pause 1 / resume 1", s.pauses===1 && s.resumes===1);
}

console.log("\n=== 2) 위임 경로 겹침 (원소반응 + 근접) ===");
{
  const s=make();
  s.hitStop(55);   // 근접 명중 → ImpactFX
  s.tick(16);
  s.hitStop(45);   // 같은 프레임대 원소반응 → WorldScene 위임 → ImpactFX
  t("겹쳐도 정지 유지", s.paused);
  for(let i=0;i<3;i++) s.tick(10);  // t=46
  t("46ms 에 아직 정지 (45짜리 두번째가 살아있음)", s.paused);
  for(let i=0;i<4;i++) s.tick(10);  // t=86
  t("최종 재개", !s.paused);
  t("resume 1회", s.resumes===1, `(resumes=${s.resumes})`);
}

console.log("\n=== 3) 자가치유 블록이 히트스톱을 존중 ===");
{
  const s=make(); s.hitStop(70);
  let cut=false;
  for(let i=0;i<5;i++){ s.tick(10); if(i<4 && !s.paused) cut=true; }  // t=40까지 유지돼야
  t("히트스톱 중 자가치유 미개입", !cut);
  for(let i=0;i<5;i++) s.tick(10);  // t=90
  t("히트스톱 후 정상 재개", !s.paused);
}

console.log("\n=== 4) 연타 폭격 ===");
{
  const s=make();
  for(let i=0;i<8;i++){ s.hitStop(55); s.tick(10); }  // 80ms 동안 8회
  t("폭격 중 정지 유지", s.paused);
  for(let i=0;i<10;i++) s.tick(10);
  t("폭격 후 재개", !s.paused);
  t("resume 1회 (중복 없음)", s.resumes===1, `(resumes=${s.resumes})`);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
