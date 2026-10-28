const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--enable-webgl']});
  const p = await b.newPage({viewport:{width:1280,height:720}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await p.goto('http://127.0.0.1:3210/', {waitUntil:'domcontentloaded', timeout:120000});

  // 로비 뜰 때까지 최대 150초 대기
  for (let i=0;i<15;i++){
    await p.waitForTimeout(10000);
    const t = await p.evaluate(()=>document.body.innerText).catch(()=>'');
    const pg = await p.evaluate(()=>{ const c=document.querySelector('canvas'); return c? c.width+'x'+c.height : 'nocanvas'; }).catch(()=>'');
    console.log(`[${(i+1)*10}s] canvas=${pg} text=${t.replace(/\n/g,'|').slice(0,80)}`);
    if (/시작|모험|출발|START/i.test(t)) { console.log('로비 감지'); break; }
  }
  await p.screenshot({path:'/tmp/lobby2.png'});
  console.log('err:', errs.slice(0,2).join(' | ')||'없음');
  await b.close();
})();
