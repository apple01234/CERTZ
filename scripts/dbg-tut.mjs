import { chromium } from "playwright";
const B = process.argv[2];
const br = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage"] });
const pg = await br.newPage({ viewport:{width:1280,height:800} });
await pg.goto(B, { waitUntil:"domcontentloaded", timeout:90000 });
await pg.locator("button",{hasText:"게임 시작"}).first().click({timeout:120000});
await pg.getByRole("button",{name:"캐릭터 생성",exact:true}).first().click();
await pg.locator("input").first().fill("디버"+String(Date.now()).slice(-4));
await pg.getByRole("button",{name:/다음/}).click();
await pg.getByRole("button",{name:"모험가로 생성!"}).click({timeout:30000});
await pg.getByRole("button",{name:"이 캐릭터로 시작"}).click({timeout:30000});
await pg.waitForFunction(()=>window.__SERTZ_SCENE__?.player,{timeout:90000});
await pg.waitForTimeout(3000);
// Space/Enter 로 연출을 진행시켜 본다
for (let i=0;i<12;i++){
  await pg.keyboard.press("Space");
  await pg.waitForTimeout(700);
  const d = await pg.evaluate(()=>{const s=window.__SERTZ_SCENE__;return{
   tut:!!s.tut, dlg:s.dialoguing, tutStep:s.tutStep }}) ;
  console.log(i, JSON.stringify(d));
  if (d.tut) break;
}
await br.close();
