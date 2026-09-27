import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from './[...path]/route.ts';

const token='local-dispatch-token-for-tests-only-000000000000';
const request=(path,method='GET',body)=>new Request(`http://localhost/api/${path}`,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
const params=path=>({params:Promise.resolve({path:path.split('/')})});

test('agent bridge forwards only official authenticated Recovery commands',async()=>{
  const before=process.env.PENROSE_DISPATCH_TOKEN,localBefore=process.env.PENROSE_AGENT_LOCAL_ONLY,oldFetch=globalThis.fetch,calls=[];
  process.env.PENROSE_DISPATCH_TOKEN=token;
  process.env.PENROSE_AGENT_LOCAL_ONLY='true';
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({success:true,code:'RECOVERY_PENDING_REVIEW',message:'ok',data:{candidate_delivery_plan_id:'plan-1'},request_id:'req-1'},{status:201});};
  try{
    const path='incidents/11111111-1111-4111-8111-111111111111/recovery';
    const reply=await POST(request(path,'POST',{}),params(path));
    assert.equal(reply.status,201);
    assert.equal(calls.length,1);
    assert.equal(new URL(calls[0].url).pathname,'/api/'+path);
    assert.equal(calls[0].init.headers.Authorization,`Bearer ${token}`);
    const legacy='incidents/11111111-1111-4111-8111-111111111111/deterministic-recovery';
    assert.equal((await POST(request(legacy,'POST',{}),params(legacy))).status,404);
    assert.equal(calls.length,1);
  }finally{globalThis.fetch=oldFetch;if(before===undefined)delete process.env.PENROSE_DISPATCH_TOKEN;else process.env.PENROSE_DISPATCH_TOKEN=before;if(localBefore===undefined)delete process.env.PENROSE_AGENT_LOCAL_ONLY;else process.env.PENROSE_AGENT_LOCAL_ONLY=localBefore;}
});

test('agent bridge refuses public writes unless a trusted authentication proxy is explicitly configured',async()=>{
  const before=process.env.PENROSE_DISPATCH_TOKEN,localBefore=process.env.PENROSE_AGENT_LOCAL_ONLY,proxyBefore=process.env.PENROSE_AGENT_TRUSTED_AUTH_PROXY,oldFetch=globalThis.fetch;
  process.env.PENROSE_DISPATCH_TOKEN=token;delete process.env.PENROSE_AGENT_LOCAL_ONLY;delete process.env.PENROSE_AGENT_TRUSTED_AUTH_PROXY;
  globalThis.fetch=async()=>{throw Error('must not reach backend');};
  try{
    const path='incidents/11111111-1111-4111-8111-111111111111/recovery';
    const reply=await POST(request(path,'POST',{}),params(path));
    assert.equal(reply.status,403);
  }finally{globalThis.fetch=oldFetch;if(before===undefined)delete process.env.PENROSE_DISPATCH_TOKEN;else process.env.PENROSE_DISPATCH_TOKEN=before;if(localBefore!==undefined)process.env.PENROSE_AGENT_LOCAL_ONLY=localBefore;if(proxyBefore!==undefined)process.env.PENROSE_AGENT_TRUSTED_AUTH_PROXY=proxyBefore;}
});

test('agent bridge refuses a mutating command without a configured dispatcher credential',async()=>{
  const before=process.env.PENROSE_DISPATCH_TOKEN,oldFetch=globalThis.fetch;
  delete process.env.PENROSE_DISPATCH_TOKEN;
  globalThis.fetch=async()=>{throw Error('must not reach backend');};
  try{
    const path='recovery-plans/55555555-5555-4555-8555-555555555555/approve';
    const reply=await POST(request(path,'POST',{decision_reason:'Reviewed'}),params(path));
    assert.equal(reply.status,503);
  }finally{globalThis.fetch=oldFetch;if(before!==undefined)process.env.PENROSE_DISPATCH_TOKEN=before;}
});

test('agent bridge exposes persisted alert reads',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:true,code:'SUCCESS',message:'ok',data:{items:[]},request_id:'req-1'});
  try{assert.equal((await GET(request('operations/alerts?status=ACTIVE'),params('operations/alerts'))).status,200);}
  finally{globalThis.fetch=oldFetch;}
});

test('agent bridge exposes Current Plan list for a context-free Agent entrance',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:true,code:'SUCCESS',message:'ok',data:{items:[]},request_id:'req-1'});
  try{assert.equal((await GET(request('delivery-plans?status=CURRENT'),params('delivery-plans'))).status,200);}
  finally{globalThis.fetch=oldFetch;}
});
