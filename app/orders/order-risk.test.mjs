import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOrders} from './order-gateway.ts';
import {riskGroup} from './order-data.ts';
import {orderTiming} from './order-timing.ts';

test('At Risk and risk filter use persisted order risk, not a late clock or projected operation risk', async () => {
  const originalFetch = globalThis.fetch;
  const end = '2026-09-27T11:30:00+08:00';
  const operations = [
    {order_id:'normal', order_code:'ORD-005', merchant_id:'merchant', merchant_name:'Kitchen', execution_status:'PLANNED', risk_status:'AT_RISK', assignment_status:'ASSIGNED', vehicle_id:null, delivery_eta:end},
    {order_id:'risk', order_code:'ORD-003', merchant_id:'merchant', merchant_name:'Kitchen', execution_status:'PLANNED', risk_status:'AT_RISK', assignment_status:'ASSIGNED', vehicle_id:null, delivery_eta:end},
  ];
  const resources = operations.map(order => ({id:order.order_id, order_code:order.order_code, merchant_id:'merchant', execution_status:'PLANNED', risk_status:order.order_id==='risk'?'AT_RISK':'NORMAL', delivery_window_start_at:'2026-09-27T10:00:00+08:00', delivery_window_end_at:end}));
  globalThis.fetch = async url => {
    const path = new URL(url, 'http://localhost').pathname;
    const data = path==='/api/operations/orders'?{items:operations,page:1,page_size:100,total:2,total_pages:1}
      :path==='/api/orders'?{items:resources,page:1,page_size:100,total:2,total_pages:1}
      :path==='/api/operations/vehicles'?{items:[],page:1,page_size:100,total:0,total_pages:0}
      :path==='/api/operations/dashboard'?{calculated_at:'2026-09-27T15:00:00+08:00'}:null;
    assert.notEqual(data,null,`Unexpected request ${url}`);
    return Response.json({success:true,code:'OK',message:'ok',data});
  };
  try {
    const all = await loadOrders({date:'2026-09-27',execution:'All',risk:'All'},new AbortController().signal);
    assert.deepEqual(all.orders.map(order => [order.code,order.risk]),[['ORD-005','NORMAL'],['ORD-003','AT_RISK']]);
    const late = Date.parse('2026-09-27T15:00:00+08:00');
    assert.equal(orderTiming(all.orders[0],late).kind,'overdue');
    assert.deepEqual(all.orders.filter(riskGroup).map(order => order.code),['ORD-003']);
    const filtered = await loadOrders({date:'2026-09-27',execution:'All',risk:'AT_RISK'},new AbortController().signal);
    assert.deepEqual(filtered.orders.map(order => order.code),['ORD-003']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
