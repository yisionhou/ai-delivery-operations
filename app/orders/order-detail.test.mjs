import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeListFacts,onlyOrderStops} from './order-detail.ts';
import {demoOrderDetail} from './order-demo.ts';

test('journey keeps only the selected order and does not relabel handover as pickup',()=>{
  const stops=[
    {id:'a',order_id:'one',stop_type:'PICKUP',sequence_no:1,location_id:'merchant'},
    {id:'b',order_id:'two',stop_type:'DELIVERY',sequence_no:2,location_id:'other'},
    {id:'c',order_id:'one',stop_type:'HANDOVER',sequence_no:3,location_id:'handover'},
  ];
  assert.deepEqual(onlyOrderStops(stops,'one').map(stop=>[stop.id,stop.stop_type]),[['a','PICKUP'],['c','HANDOVER']]);
});

test('demo order details preserve O-021 identity and recorded pickup without inventing delivery',()=>{
  const detail=demoOrderDetail('O-021','2026-09-27');
  assert.equal(detail.order.code,'O-021');
  assert.equal(detail.order.vehicle,'V01');
  assert.equal(detail.driverCode,'D-01');
  assert.equal(detail.delivery.name,'Queenstown');
  assert.deepEqual(detail.stops.map(stop=>stop.kind),['PICKUP','DELIVERY']);
  assert.equal(detail.stops[0].actual,'2026-09-27T04:12:00+08:00');
  assert.equal(detail.stops[1].actual,null);
});

test('a direct-open detail receives ETA when the matching list snapshot arrives',()=>{
  const detail=demoOrderDetail('O-021','2026-09-27');
  const withoutEta={...detail,order:{...detail.order,eta:null}};
  assert.equal(mergeListFacts(withoutEta,detail.order).order.eta,detail.order.eta);
  assert.equal(mergeListFacts(withoutEta,{...detail.order,id:'other'}).order.eta,null);
});
