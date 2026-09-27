import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from './route.ts';

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
