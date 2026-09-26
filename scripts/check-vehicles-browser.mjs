import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=process.argv[2]??'evidence/vehicles';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:process.env.HEADED!=='1'});
const page=await browser.newPage({viewport:{width:1672,height:941}});
const errors=[],consoleErrors=[],requests=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('request',r=>requests.push(r.url()));
const base=process.env.VEHICLES_BASE_URL??'http://localhost:5173';
const expectText=async(text)=>page.getByText(text,{exact:false}).first().waitFor();
const navigate=async(url)=>page.goto(base+url,{waitUntil:'domcontentloaded'});
const check=(name)=>{checks.push(name);console.log('PASS '+name);};
const row=id=>page.locator('[data-vehicle-id="'+id+'"]');
try {
  await navigate('/vehicles?source=demo');await row('V01').waitFor();
  assert.equal(await page.locator('.vf-row.active').count(),3);assert.equal(await page.locator('.vf-row.available').count(),3);assert.equal(await page.locator('.vf-row.exception').count(),1);
  assert.equal(await page.locator('.vf-row').first().getAttribute('data-vehicle-id'),'V03');
  await page.screenshot({path:path.join(output,'vehicles-main-board.png')});check('Demo board: exception first, Active and Available groups');
  await row('V01').click();await page.locator('.vf-inspector').waitFor();assert.match(page.url(),/selected_vehicle=V01/);assert.match(await page.locator('.vf-inspector-metrics').innerText(),/33%/);
  await page.getByText(/Remaining 00:/).waitFor();const countdownBefore=await page.locator('.vf-time-countdown').innerText();await page.waitForTimeout(1200);assert.notEqual(await page.locator('.vf-time-countdown').innerText(),countdownBefore);
  assert.ok(await row('V01').locator('.vf-marker').evaluate(el=>el.getBoundingClientRect().width<80));
  await row('V02').click();await expectText('Bukit Batok Merchant');assert.match(page.url(),/selected_vehicle=V02/);
  await row('V01').click();await page.screenshot({path:path.join(output,'vehicle-inspector.png')});check('Active rows switch one right-side inspector; deterministic 1/3 = 33%');
  await page.locator('.vf-inspector-orders a').first().click();await expectText('Selected order: O-012');assert.match(page.url(),/selected_order=O-012/);await page.getByRole('link',{name:'Back to Vehicle',exact:true}).click();await page.locator('.vf-inspector').waitFor();await page.getByRole('button',{name:'Close vehicle inspector'}).click();await row('V06').waitFor();check('Related order → Orders selected context → inspector → board');
  await row('V06').locator('.vf-chevron').click();await expectText('Vehicle & Rider');assert.match(await page.locator('.vf-inspector-metrics').innerText(),/0 \/ 0/);assert.doesNotMatch(await page.locator('.vf-inspector-metrics').innerText(),/0%/);await page.getByRole('button',{name:'Close vehicle inspector'}).click();await row('V03').waitFor();check('Available chevron → no-route inspector, no invented 0%');
  await row('V03').click();await page.locator('.incident-focus-page').waitFor({timeout:45000});assert.match(page.url(),/incidents\?.*incident_id=INC-007/);await page.getByRole('link',{name:/Back to Vehicles/}).click();await row('V03').waitFor();check('Exception row → existing related Incident workspace');
  await page.getByRole('button',{name:'Active',exact:true}).click();await row('V01').waitFor();assert.equal(await page.locator('.vf-row').count(),3);
  await page.getByRole('button',{name:'Active',exact:true}).click();await row('V01').waitFor();check('Filters and reselecting the current filter remain functional');
  await page.getByLabel('Business Date',{exact:true}).fill('2026-09-25');await expectText('No Current Plan for');assert.equal(await page.locator('.vf-marker').count(),0);check('Demo no-current-plan preserves resources and clears routes');
  await navigate('/vehicles?source=demo&business_date=2026-09-26&selected_vehicle=V01');await page.getByText('Ended',{exact:true}).waitFor();check('Historical demo snapshot shows ended time window');
  // Intercept exact verified wire contracts; no fixtures enter production API mode.
  const fixture=JSON.parse(await readFile('public/data/vehicles-demo.json','utf8'));
  const stopFixture=JSON.parse(await readFile('public/data/vehicle-stops-demo.json','utf8'));
  const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const vid=Object.fromEntries(fixture.vehicles.map((v,i)=>[v.id,uuid(i+1)]));
  const rid=Object.fromEntries(Object.keys(stopFixture).map((id,i)=>[id,uuid(i+101)]));
  const orders=new Map(),stops=new Map();
  for(const [routeId,list] of Object.entries(stopFixture)){
    stops.set(rid[routeId],list.map((s,i)=>{const oid=uuid(Number(s.orderId.replace(/\D/g,''))+200),lid=uuid(Number(s.id.replace(/\D/g,''))+400);
      const location={id:lid,display_name:s.location,address_text:null,latitude:1.3,longitude:103.8};
      const o=orders.get(oid)??{id:oid,order_code:s.orderId,business_date:'2026-09-26',execution_status:'DELIVERING',risk_status:'NORMAL',pickup_location:location,delivery_location:location};
      if(s.kind==='PICKUP')o.pickup_location=location;else o.delivery_location=location;orders.set(oid,o);
      return {id:uuid(Number(s.id.replace(/\D/g,''))+500),order_id:oid,location_id:lid,stop_type:s.kind,sequence_no:i+1,status:s.status==='WAITING'?'PLANNED':s.status==='IN_PROGRESS'?'IN_SERVICE':'COMPLETED',planned_arrival_at:'2026-09-26T02:20:00Z',planned_departure_at:'2026-09-26T02:25:00Z',actual_arrival_at:s.status==='COMPLETED'?'2026-09-26T02:21:00Z':null,actual_departure_at:s.status==='COMPLETED'?'2026-09-26T02:24:00Z':null};
    }));
  }
  let resources=fixture.vehicles.map(v=>({id:vid[v.id],vehicle_code:v.code,name:'Delivery vehicle '+v.code,status:v.status,capacity_load_units:12,current_location:{id:uuid(800),display_name:'Recorded depot',address_text:'Depot address',latitude:1.31,longitude:103.81},current_location_recorded_at:'2026-09-26T01:00:00Z'}));
  let operations=fixture.vehicles.filter(v=>v.routeId).map(v=>({vehicle_id:vid[v.id],driver_code:v.driver,route_id:rid[v.routeId],route_status:'ACTIVE'}));
  // Extra association pages prove no silent first-page truncation.
  operations=[...Array.from({length:100},(_,i)=>({vehicle_id:uuid(2000+i),driver_code:'D-extra',route_id:uuid(3000+i),route_status:'ACTIVE'})),...operations];
  let incidents=[{id:uuid(900),incident_code:'INC-REAL-007',vehicle_id:vid.V03,vehicle_route_id:rid['R-03'],business_date:'2026-09-26',status:'REVIEW',detected_at:'2026-09-26T02:42:00Z'}];
  let scenario='normal',failStops=false;
  const envelope=data=>({success:true,code:'SUCCESS',message:'Retrieved',data,request_id:'qa'});
  const paginated=(items,url)=>{const p=Number(url.searchParams.get('page')??1),size=Number(url.searchParams.get('page_size')??20);return {items:items.slice((p-1)*size,p*size),page:p,page_size:size,total:items.length,total_pages:Math.ceil(items.length/size)};};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),pathname=url.pathname;
    const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?envelope(data):data)});
    const failure=(code,status=503)=>respond({success:false,code,message:code,data:null,request_id:'qa'},status);
    if(pathname==='/api/vehicles'){
      const status=url.searchParams.get('status');return respond(paginated((scenario==='empty'?[]:resources).filter(v=>!status||v.status===status),url));
    }
    if(pathname.startsWith('/api/vehicles/'))return respond(resources.find(v=>v.id===pathname.split('/').at(-1)));
    if(pathname==='/api/operations/vehicles'){
      if(scenario==='no-plan')return failure('CURRENT_PLAN_NOT_FOUND',404);
      if(scenario==='partial')return failure('DATABASE_UNAVAILABLE');
      return respond(paginated(operations,url));
    }
    if(pathname==='/api/incidents')return respond(paginated(scenario==='no-incident'?[]:incidents,url));
    if(pathname.startsWith('/api/incidents/'))return respond({...incidents[0],base_plan_code:'PLAN-BASE',affected_order_count:4,requires_replanning:true});
    if(pathname.startsWith('/api/vehicle-routes/')){
      if(failStops)return failure('STOPS_TEMPORARILY_UNAVAILABLE');
      return respond(stops.get(pathname.split('/')[3])??[]);
    }
    if(pathname.startsWith('/api/orders/'))return respond(orders.get(pathname.split('/').at(-1)));
    throw new Error('Unexpected endpoint '+pathname);
  });
  const apiUrl='/vehicles?source=api&business_date=2026-09-26';
  await navigate(apiUrl);await row(vid.V01).waitFor();
  assert.equal(await page.locator('.vf-row').first().getAttribute('data-vehicle-id'),vid.V03);
  assert.ok(requests.some(u=>u.includes('/api/operations/vehicles?')&&u.includes('page=2')));
  assert.ok(requests.some(u=>u.includes('/api/vehicles?status=ACTIVE')&&u.includes('page_size=8')));
  await page.screenshot({path:path.join(output,'vehicles-api-contract.png')});check('Backend contracts: envelopes, resource pagination, association page 2, stable exception-first grouping');
  await row(vid.V01).click();await page.locator('.vf-execution-list').waitFor();await expectText('Recorded depot');
  assert.match(await page.locator('.vf-inspector-metrics').innerText(),/33%/);assert.match(await page.locator('.vf-execution-list').innerText(),/10:20/);
  await page.locator('.vf-inspector-orders a').first().click();await expectText('Pickup');assert.match(page.url(),/selected_order=00000000/);check('API inspector uses recorded location and SGT times; Orders reads selected UUID');
  await navigate(apiUrl);await row(vid.V03).waitFor();await row(vid.V03).locator('.vf-chevron').click();await expectText('INC-REAL-007');check('API exception chevron opens persisted Incident ID');
  scenario='no-incident';await navigate(apiUrl);await row(vid.V03).waitFor();await row(vid.V03).click();await expectText('No linked Incident');assert.ok(!page.url().includes('incident_id='));check('Unavailable without incident ID: safe Incident context, no fabrication');
  scenario='no-plan';await navigate(apiUrl);await expectText('No Current Plan for');assert.equal(await page.locator('.vf-row').count(),7);assert.equal(await page.locator('.vf-marker').count(),0);
  await row(vid.V06).click();await expectText('Vehicle & Rider');assert.match(await page.locator('.vf-inspector-metrics').innerText(),/0 \/ 0/);check('API CURRENT_PLAN_NOT_FOUND keeps fleet and no-route inspector');
  scenario='partial';await navigate(apiUrl);await expectText('Route assignments are unknown');assert.equal(await page.locator('.vf-row').count(),7);assert.equal(await row(vid.V01).locator('.vf-count b').innerText(),'—');check('Partial operations failure preserves resources without claiming no route');
  scenario='normal';failStops=true;await navigate('/vehicles/'+vid.V01+'?source=api&business_date=2026-09-26');await page.locator('.vf-inspector-local-error').first().waitFor();await expectText('Vehicle & Rider');assert.match(await page.locator('.vf-inspector-metrics').innerText(),/—/);
  await page.screenshot({path:path.join(output,'vehicle-stops-error.png')});
  failStops=false;await page.locator('.vf-inspector-local-error button').first().click();await page.locator('.vf-execution-list').waitFor();check('Stops error is isolated; Retry restores inspector');
  failStops=true;await navigate(apiUrl);await expectText('Some route stops could not be loaded');assert.equal(await page.locator('.vf-row').count(),7);failStops=false;await page.getByRole('button',{name:'Retry stops',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('Some route stops could not be loaded'));check('Board partial stops failure and retry');
  scenario='empty';await navigate(apiUrl);await expectText('Empty fleet');check('Empty fleet');
  scenario='normal';
  const original=structuredClone(resources);
  resources.push(...Array.from({length:12},(_,i)=>({...resources[4],id:uuid(4000+i),vehicle_code:'V'+(20+i)})));
  await navigate(apiUrl);await row(vid.V01).waitFor();await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForURL(/page=2/);await row(uuid(4001)).waitFor();assert.match(page.url(),/business_date=2026-09-26/);
  await page.getByRole('button',{name:'Available',exact:true}).click();await page.waitForURL(/filter=available/);await row(vid.V06).waitFor();await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForURL(/page=2/);assert.match(page.url(),/filter=available/);check('Server resource pagination preserves business date and filter');
  resources=original;await navigate(apiUrl);await row(vid.V01).waitFor();
  const initialOrder=await page.locator('.vf-row.active').evaluateAll(nodes=>nodes.map(n=>n.dataset.vehicleId));
  stops.get(rid['R-02'])[1].status='COMPLETED';await page.getByRole('button',{name:'Refresh vehicles'}).click();await page.waitForFunction(()=>!document.querySelector('.vf-refresh').disabled);assert.deepEqual(await page.locator('.vf-row.active').evaluateAll(nodes=>nodes.map(n=>n.dataset.vehicleId)),initialOrder);check('Progress updates do not reorder normal vehicles');
  resources.find(v=>v.id===vid.V04).status='UNAVAILABLE';await page.getByRole('button',{name:'Refresh vehicles'}).click();await row(vid.V04).locator('.vf-status.unavailable').waitFor();assert.equal(await page.locator('.vf-row.exception').count(),2);check('New exception changes group and moves above Active');
  stops.get(rid['R-01']).forEach(s=>s.status='COMPLETED');
  await page.getByRole('button',{name:'Refresh vehicles'}).click();await row(vid.V01).waitFor({state:'detached',timeout:5000});assert.ok(resources.find(v=>v.id===vid.V01));await row(vid.V02).waitFor();check('Completed route fades/collapses, lower rows remain, business record retained');
  await navigate('/vehicles/'+vid.V01+'?source=api&business_date=2026-09-26');await page.locator('.vf-execution-list').waitFor();assert.match(await page.locator('.vf-inspector-metrics').innerText(),/100%/);check('Completed vehicle inspector remains accessible through the old URL');
  await page.emulateMedia({reducedMotion:'reduce'});await navigate('/vehicles?source=demo');await row('V01').waitFor();assert.equal(await row('V01').evaluate(el=>getComputedStyle(el).animationName),'none');check('Reduced-motion mode does not require animation');
  await page.setViewportSize({width:1100,height:850});await page.screenshot({path:path.join(output,'vehicles-compact.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('Compact desktop layout has no document overflow');
  assert.equal(requests.filter(url=>url.includes('simulated-positions')).length,0);check('No simulated position requests');
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors.filter(text=>!text.includes('Failed to load resource')),[]);check('No browser runtime or hydration errors; HTTP errors only from injected failure scenarios');
  await writeFile(path.join(output,'vehicles-browser-results.json'),JSON.stringify({checks,errors,consoleErrors,apiRequests:requests.filter(url=>url.includes('/api/')),note:'API scenarios use browser-intercepted fixtures matching verified backend schemas; this is not a live DB integration test.'},null,2));
} catch(error){await page.screenshot({path:path.join(output,'vehicles-test-failure.png')});console.error(error);process.exitCode=1;}
finally{await browser.close();}

