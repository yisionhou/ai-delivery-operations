import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from './route.ts';

test('planning write bridge only forwards registered draft commands',async()=>{
  const original=globalThis.fetch,targets=[];
  globalThis.fetch=async(target,options)=>{targets.push([String(target),options.method,JSON.parse(options.body)]);return Response.json({success:true,code:'PLAN_DRAFT_CREATED',message:'ok',data:{status:'DRAFT'}});};
  try{
    const context=path=>({params:Promise.resolve({path})});
    const valid=await POST(new Request('http://localhost/api/planning/drafts',{method:'POST',body:JSON.stringify({business_date:'2026-09-27'})}),context(['planning','drafts']));
    assert.equal(valid.status,200);
    assert.deepEqual(targets,[['http://127.0.0.1:8000/api/planning/drafts','POST',{business_date:'2026-09-27'}]]);
    const invalid=await POST(new Request('http://localhost/api/planning/drafts',{method:'POST',body:'{}'}),context(['planning','drafts']));
    assert.equal(invalid.status,400);
    const blocked=await POST(new Request('http://localhost/api/planning/generate',{method:'POST',body:'{}'}),context(['planning','generate']));
    assert.equal(blocked.status,404);
    assert.equal(targets.length,1);
  }finally{globalThis.fetch=original;}
});
