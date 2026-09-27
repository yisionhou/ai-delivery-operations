import test from 'node:test';
import assert from 'node:assert/strict';
import {apiOperationsAdapter,loadOperations,loadOperationsPositions} from './operations-api.ts';

const plan={id:'plan-id',code:'PLAN-20260927-V2',version:2,status:'DRAFT'};
const stop={id:'stop-1',kind:'DELIVERY',order:'ORD-001',place:'Queenstown',at:'2026-09-27T10:00:00+08:00',point:[103.8,1.3],execution:'PLANNED',risk:'AT_RISK'};
const workspace={business_date:'2026-09-27',readiness:{orders:2,merchants_ready:1,merchants_preparing:0,merchants_delayed:0,vehicles:1,drivers:1},plan,
  routes:[{id:'route-1',route_no:1,vehicle:'VEH-001',driver:'DRV-001',vehicle_status:'ACTIVE',route_execution_status:'ACTIVE',distance_km:5,duration_min:30,utilization:25,status:'AT_RISK',stops:[stop],path:[[103.79,1.29],[103.8,1.3]],geometry_source:'STOP_CONNECTORS',road_aligned:false},
    {id:'route-2',route_no:2,vehicle:'VEH-002',driver:'DRV-002',vehicle_status:'ACTIVE',route_execution_status:'ACTIVE',distance_km:6,duration_min:35,utilization:20,status:'ON_ROUTE',stops:[stop],path:[[103.79,1.29],[103.795,1.305],[103.8,1.3]],geometry_source:'STORED_GEOMETRY',road_aligned:true}],
  alerts:[{id:'alert-1',title:'Delivery window at risk',detail:'ORD-001',level:'risk',incident_id:null,vehicle:'VEH-001'}],unassigned:[],on_time_rate:null,constraint_summary:['Pickup before delivery']};

test('backend Operations maps a persisted workspace and confirms its draft',async()=>{
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push([String(url),options.method??'GET']);
    const path=new URL(url,'http://localhost').pathname;
    const data=path.endsWith('simulated-positions')?{vehicles:[{route_id:'route-1',longitude:103.795,latitude:1.295}]}:
      path.endsWith('confirm')?{...plan,status:'CURRENT'}:
      path.endsWith('drafts')?plan:
      {...workspace,plan:calls.some(([p])=>p.endsWith('confirm'))?{...plan,status:'CURRENT'}:plan};
    return Response.json({success:true,code:'OK',message:'ok',data});
  };
  try{
    const loaded=await loadOperations('2026-09-27');
    assert.equal(loaded.source,'API');
    assert.equal(loaded.routes[0].geometrySource,'STOP_CONNECTORS');
    assert.equal(loaded.routes[0].roadAligned,false);
    assert.equal(loaded.routes[1].roadAligned,true);
    assert.equal(loaded.routes[0].stops[0].at,'10:00');
    assert.equal(loaded.routes[0].stops[0].risk,'AT_RISK');
    assert.deepEqual(await loadOperationsPositions('2026-09-27'),{'route-1':[103.795,1.295]});
    const confirmed=await apiOperationsAdapter.confirm(loaded);
    assert.equal(confirmed.plan.status,'CURRENT');
    assert.deepEqual(calls.map(([path,method])=>[new URL(path,'http://localhost').pathname,method]).filter(([,method])=>method==='POST'),[['/api/planning/drafts/plan-id/confirm','POST']]);
  }finally{globalThis.fetch=original;}
});

test('backend Operations never replaces a failed read with demo data',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:false,code:'BACKEND_UNAVAILABLE',message:'Backend offline',data:null},{status:503});
  try{await assert.rejects(loadOperations('2026-09-27'),/Backend offline/);}finally{globalThis.fetch=original;}
});
