import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from './route.ts';

test('read bridge forwards merchant detail and rejects unrelated paths', async () => {
  const originalFetch = globalThis.fetch;
  const targets = [];
  globalThis.fetch = async target => {
    targets.push(String(target));
    return Response.json({success:true, code:'OK', message:'ok', data:{name:'Fresh Kitchen'}});
  };
  try {
    const merchant = await GET(new Request('http://localhost:5173/api/merchants/merchant-1'), {
      params: Promise.resolve({path:['merchants', 'merchant-1']}),
    });
    assert.equal(merchant.status, 200);
    assert.equal((await merchant.json()).data.name, 'Fresh Kitchen');
    assert.deepEqual(targets, ['http://127.0.0.1:8000/api/merchants/merchant-1']);

    const blocked = await GET(new Request('http://localhost:5173/api/merchants/merchant-1/status'), {
      params: Promise.resolve({path:['merchants', 'merchant-1', 'status']}),
    });
    assert.equal(blocked.status, 404);
    assert.equal(targets.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('incident review reads reach only registered backend resources', async () => {
  const originalFetch=globalThis.fetch,targets=[];
  globalThis.fetch=async target=>{targets.push(String(target));return Response.json({success:true,code:'SUCCESS',message:'ok',data:{}});};
  const paths=[
    ['incidents','incident-1','affected-orders'],
    ['incidents','incident-1','recovery-plans'],
    ['recovery-plans','recovery-1'],
    ['recovery-plans','recovery-1','comparison'],
    ['delivery-plans','plan-1'],
    ['delivery-plans','plan-1','routes'],
    ['vehicle-routes','route-1'],
    ['vehicle-routes','route-1','stops'],
  ];
  try{
    for(const path of paths){
      const resource=path.join('/');
      const response=await GET(new Request(`http://localhost:5173/api/${resource}?page=2`),{params:Promise.resolve({path})});
      assert.equal(response.status,200,resource);
    }
    assert.deepEqual(targets,paths.map(path=>`http://127.0.0.1:8000/api/${path.join('/')}?page=2`));
    const blocked=await GET(new Request('http://localhost:5173/api/recovery-plans/recovery-1/delete'),{params:Promise.resolve({path:['recovery-plans','recovery-1','delete']})});
    assert.equal(blocked.status,404);
    const write=await POST(new Request('http://localhost:5173/api/incidents/incident-1/recovery',{method:'POST',body:'{}'}),{params:Promise.resolve({path:['incidents','incident-1','recovery']})});
    assert.equal(write.status,404);
    assert.equal(targets.length,paths.length);
  }finally{globalThis.fetch=originalFetch;}
});
