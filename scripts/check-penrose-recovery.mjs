import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=process.argv[2];if(!output)throw Error('Evidence directory required');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}});
const errors=[],requests=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
const base=process.env.PENROSE_BASE_URL??'http://127.0.0.1:5180';
const shot=name=>page.screenshot({path:path.join(output,name+'.png')});
const check=name=>{checks.push(name);console.log('PASS '+name);};
const scene=state=>page.waitForFunction(s=>document.querySelector('main')?.dataset.recoveryScene===s,state);
const ui=state=>page.waitForFunction(s=>document.querySelector('.pr-workspace')?.dataset.uiState===s,state);
const enterRecovery=()=>page.getByRole('button',{name:'Enter Recovery',exact:true}).click();
// Exercise fixture variants at the loader boundary; the product has no Demo footer controls.
let fixtureCount=3;
await page.route('**/recovery-demo.ts*',async route=>{
 const response=await route.fetch();
 const body=(await response.text()).replace('createRecoveryDemo(demoCandidateCount)','createRecoveryDemo('+fixtureCount+')');
 await route.fulfill({response,body});
});
const chooseCount=async count=>{
 fixtureCount=count;
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Enter Workspace',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.dataset.phase==='workspace-ready');
 await page.evaluate(()=>window.qaOriginalHero=document.querySelector('.pe-hero'));
 await enterRecovery();await scene('options');
 await ui(count?'options-ready':'manual-intervention');
 await page.waitForTimeout(1200);
};
const identity=()=>page.evaluate(()=>document.querySelector('.pe-hero')===window.qaOriginalHero&&document.querySelectorAll('.pe-hero').length===1);
const connections=async()=>{
 const edges=await page.locator('.pr-branch-guide').evaluateAll(paths=>paths.map((p,i)=>{
  const endpoint=p.getPointAtLength(p.getTotalLength());
  const end=new DOMPoint(endpoint.x,endpoint.y).matrixTransform(p.getScreenCTM());
  const ring=document.querySelectorAll('.pr-branch-node>.pr-node-disc')[i].getBoundingClientRect();
  const branch=p.closest('svg'),core=branch.querySelector('.pr-branch-core');
  return {gap:Math.hypot(end.x-ring.left,end.y-ring.top-ring.height/2),origin:Number(branch.dataset.originWidth),tip:Number(branch.dataset.tipWidth),fill:getComputedStyle(core).fill};
 }));
 assert.ok(edges.length&&edges.every(e=>e.gap<1&&e.origin===9&&e.tip===3&&e.fill!=='none'),JSON.stringify(edges));
 assert.equal(await page.locator('.pr-demo-controls,.pr-disclosure').count(),0);
 assert.equal(await page.getByLabel('Demo candidate count').count(),0);
};
try{
 await page.goto(base+'/agent',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Enter Workspace',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.dataset.phase==='workspace-ready');
 await page.evaluate(()=>{
  window.qaOriginalHero=document.querySelector('.pe-hero');window.qaFrames=[];
  const started=performance.now();
  const frame=()=>{
   const el=document.querySelector('.pe-hero'),r=el.getBoundingClientRect();
   window.qaFrames.push({t:performance.now()-started,x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,same:el===window.qaOriginalHero,opacity:getComputedStyle(el).opacity});
   if(performance.now()-started<2500)requestAnimationFrame(frame);
  };requestAnimationFrame(frame);
 });
 await enterRecovery();await ui('transitioning-in');
 await scene('options');await ui('options-ready');await page.waitForTimeout(1200);
 const frames=await page.evaluate(()=>window.qaFrames);
 assert.ok(frames.length>20&&frames.every(f=>f.same&&f.opacity==='1'));
 const a=frames[0],b=frames.at(-1),distance=Math.hypot(b.x-a.x,b.y-a.y);
 assert.ok(distance>100&&b.w<a.w);
 assert.ok(Math.max(...frames.map(p=>Math.abs((b.y-a.y)*p.x-(b.x-a.x)*p.y+b.x*a.y-b.y*a.x)/distance))>8);
 assert.equal(new URL(page.url()).pathname,'/agent');
 assert.equal(await page.locator('.pe-hero').getAttribute('data-hero-state'),'recovery-options');
 const hero=await page.locator('.pe-hero').boundingBox(),dest=await page.locator('.pr-hero-destination').boundingBox();
 assert.ok(Math.abs(hero.x+hero.width/2-dest.x-dest.width/2)<2&&Math.abs(hero.y+hero.height/2-dest.y-dest.height/2)<2);
 await shot('options-three');
 await connections();
 assert.equal(await page.locator('.pr-candidate-path').first().evaluate(e=>getComputedStyle(e).animationDuration),'0.85s');
 check('Same Hero remains mounted and opaque; measured arc, smaller scale and correct recovery destination without route navigation');
 assert.equal(await page.locator('.pr-candidate-card').count(),3);
 assert.equal(await page.locator('.pr-branch-node').count(),3);
 assert.equal(await page.locator('.pr-candidate-card[data-recommended=true]').getAttribute('data-candidate-id'),'A');
 await page.locator('.pr-candidate-card[data-candidate-id=B]').hover();
 assert.equal(await page.locator('.pr-branch-visual').getAttribute('data-highlight'),'B');
 assert.equal(await page.locator('.pr-candidate-path[data-dimmed=true]').count(),2);
 const mainBefore=await page.locator('.pr-main-panel').boundingBox();
 await page.locator('.pr-candidate-card[data-candidate-id=B]').click();
 await ui('candidate-detail');
 assert.match(await page.locator('.pr-detail-metrics').textContent(),/−4 min/);
 assert.equal(await page.locator('.pr-reassignments>div').count(),3);
 assert.deepEqual(await page.locator('.pr-main-panel').boundingBox(),mainBefore);
 assert.ok(await identity());
 await page.keyboard.press('Escape');await ui('options-ready');
 await page.waitForFunction(()=>document.activeElement?.getAttribute('data-candidate-id')==='B');
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-candidate-id')),'B');
 await page.locator('.pr-candidate-card[data-candidate-id=A]').click();await page.waitForTimeout(400);
 const action=await page.getByRole('button',{name:'Select this option',exact:true}).boundingBox();
 const panel=await page.locator('.pr-comparison-panel').boundingBox();
 assert.ok(action.y+action.height<panel.y+panel.height);
 await shot('detail-a');
 await page.getByRole('button',{name:'Select this option',exact:true}).click();await ui('candidate-selected');
 assert.match(await page.locator('.rr-overview').textContent(),/has not changed the current plan/);
 await shot('candidate-selected');
 await page.getByRole('button',{name:'Compare options',exact:true}).click();
 assert.equal(await page.locator('.pr-candidate-card[data-selected=true]').getAttribute('data-candidate-id'),'A');
 assert.equal(await page.locator('.pr-candidate-path[data-selected=true]').getAttribute('data-candidate-id'),'A');
 assert.ok(await identity());
 check('Hover links cards to branches; right-side details preserve the left panel; Escape restores focus; selection only stages human review');
 for(const count of [1,2,3]){
  await chooseCount(count);
  assert.equal(await page.locator('.pr-candidate-card').count(),count);
  assert.equal(await page.locator('.pr-branch-node').count(),count);
  const cards=await page.locator('.pr-candidate-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));
  assert.ok(cards.every(w=>Math.abs(w-cards[0])<1));
  if(count<3)await shot('options-'+count);
  await connections();
 }
 check('Exactly 1/2/3 cards and branch endpoints from loader fixtures; no empty slots');
 await chooseCount(0);await shot('manual-intervention');
 assert.equal(await page.locator('.pr-candidate-card,.pr-branch-node').count(),0);
 assert.ok(await page.getByText('MANUAL INTERVENTION REQUIRED',{exact:true}).isVisible());
 assert.ok(await identity());
 await page.getByRole('button',{name:'Start Manual Intervention',exact:true}).click();
 assert.equal(await page.locator('.pr-manual-checklist input').count(),5);
 await page.locator('.pr-manual-checklist input').first().check();
 await page.getByRole('button',{name:'Retry Planning',exact:true}).click();
 await ui('generating');await ui('manual-intervention');
 assert.equal(await page.locator('.pr-main-metrics dd').last().textContent(),'0');
 check('Zero is a valid manual-intervention outcome; checklist and retry work without external actions');
 await chooseCount(3);
 for(const size of [{width:1366,height:768},{width:1100,height:800},{width:900,height:800},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);await page.waitForTimeout(250);
  await page.locator('.pw-workspace').evaluate(e=>e.scrollTop=0);
  await connections();
  assert.ok(await page.locator('.pw-workspace').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  assert.ok(await identity());
  const h=await page.locator('.pe-hero').boundingBox(),d=await page.locator('.pr-hero-destination').boundingBox();
  assert.ok(Math.abs(h.x+h.width/2-d.x-d.width/2)<2);
  await page.locator('.pr-candidate-card[data-candidate-id=C]').click();
  await ui('candidate-detail');
  assert.ok(await page.getByRole('button',{name:'Select this option',exact:true}).isVisible());
  await page.getByRole('button',{name:'Close candidate details',exact:true}).click();
  assert.equal(await page.locator('main').evaluate(e=>e.scrollTop),0);
  if(size.width===390){
   await page.locator('.pr-candidate-grid').evaluate(e=>e.scrollTop=0);
   await page.locator('.pw-workspace').evaluate(e=>e.scrollTop=0);await shot('mobile-main');
   await page.locator('.pr-comparison-panel').scrollIntoViewIfNeeded();await shot('mobile-comparison');
  }
 }
 check('1366/1100/900/390/320px layouts: no horizontal overflow, stacked panels, usable details and preserved Hero alignment');
 await page.setViewportSize({width:1672,height:941});
 await page.getByRole('button',{name:'Back',exact:true}).click();await scene('briefing');
 assert.ok(await identity());
 assert.equal(await page.getByRole('button',{name:'Enter Recovery',exact:true}).evaluate(e=>e===document.activeElement),true);
 await enterRecovery();await scene('options');await ui('options-ready');
 assert.equal(await page.locator('.pr-candidate-card').count(),3);
 check('Back reverses to briefing and restores CTA focus; re-entry preserves completed plans');
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Enter Workspace',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.dataset.phase==='workspace-ready');
 await enterRecovery();await scene('options');await ui('options-ready');
 assert.equal(await page.locator('.pr-candidate-path').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('.pe-orbit-particle').first().evaluate(e=>getComputedStyle(e).display),'none');
 assert.ok(!requests.some(r=>r.method!=='GET'||new URL(r.url).pathname.startsWith('/api/')));
 assert.deepEqual(errors,[]);
 check('Reduced-motion branches stay static; no browser runtime errors, API planning claims or dispatch requests');
}catch(error){console.error(error);await page.screenshot({path:path.join(output,'failure.png'),timeout:5000}).catch(()=>{});throw error;}
finally{await writeFile(path.join(output,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close();}
