import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOrderPage} from './order-gateway.ts';
import {mergeOrderPage} from './order-data.ts';

const order=(id)=>({id,order_code:`ORD-${id}`,merchant_id:'merchant',execution_status:'PLANNED',risk_status:'AT_RISK',delivery_window_start_at:'2026-09-25T09:00:00+08:00',delivery_window_end_at:'2026-09-25T10:00:00+08:00'});
const filters={date:'2026-09-25',execution:'PLANNED',risk:'AT_RISK'};

test('backend order table requests only the selected filtered page',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    return Response.json({success:true,code:'SUCCESS',message:'ok',data:{items:[order('09'),order('10')],page:2,page_size:8,total:18,total_pages:3}});
  };
  try{
    const result=await loadOrderPage(filters,2,8,'api',new AbortController().signal);
    assert.deepEqual(result.items.map(item=>item.id),['09','10']);
    assert.deepEqual({page:result.page,total:result.total,totalPages:result.totalPages},{page:2,total:18,totalPages:3});
    assert.equal(calls.length,1);
    const query=new URL(calls[0],'http://localhost');
    assert.equal(query.pathname,'/api/orders');
    assert.deepEqual(Object.fromEntries(query.searchParams),{business_date:'2026-09-25',execution_status:'PLANNED',risk_status:'AT_RISK',page:'2',page_size:'8'});
  }finally{globalThis.fetch=original;}
});

test('out-of-range backend page re-queries the last page',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    const page=Number(new URL(url,'http://localhost').searchParams.get('page'));
    calls.push(page);
    return Response.json({success:true,code:'SUCCESS',message:'ok',data:{items:page===1?[order('01')]:[],page,page_size:8,total:1,total_pages:1}});
  };
  try{
    const result=await loadOrderPage(filters,9,8,'api',new AbortController().signal);
    assert.deepEqual(calls,[9,1]);
    assert.equal(result.page,1);
    assert.deepEqual(result.items.map(item=>item.id),['01']);
  }finally{globalThis.fetch=original;}
});

test('empty backend result resets the page indicator to page one',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:true,code:'SUCCESS',message:'ok',data:{items:[],page:4,page_size:8,total:0,total_pages:0}});
  try{
    const result=await loadOrderPage(filters,4,8,'api',new AbortController().signal);
    assert.deepEqual(result,{items:[],page:1,total:0,totalPages:1});
  }finally{globalThis.fetch=original;}
});

test('demo orders use the same page size and status filters',async()=>{
  const result=await loadOrderPage({date:'2026-09-25',execution:'All',risk:'All'},2,2,'demo',new AbortController().signal);
  assert.equal(result.page,2);
  assert.equal(result.items.length,2);
  assert.ok(result.total>=4);
  const filtered=await loadOrderPage({date:'2026-09-25',execution:'COMPLETED',risk:'All'},1,8,'demo',new AbortController().signal);
  assert.ok(filtered.items.every(item=>item.execution==='COMPLETED'));
});

test('page rows keep persisted status while using available plan enrichment',()=>{
  const page=[{id:'01',code:'ORD-01',merchant:'Merchant id',execution:'PLANNED',risk:'AT_RISK',assignment:null,vehicle:null,eta:null,windowStart:'start',windowEnd:'end'}];
  const snapshot=[{...page[0],merchant:'Fresh Kitchen',risk:'NORMAL',assignment:'ASSIGNED',vehicle:'V-01',eta:'eta'}];
  assert.deepEqual(mergeOrderPage(page,snapshot),[{...page[0],merchant:'Fresh Kitchen',assignment:'ASSIGNED',vehicle:'V-01',eta:'eta'}]);
});
