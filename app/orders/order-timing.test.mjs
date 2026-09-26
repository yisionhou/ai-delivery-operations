import test from 'node:test';
import assert from 'node:assert/strict';
import {orderTiming} from './order-timing.ts';
import {demoOrders} from './order-demo.ts';

const start='2026-09-27T04:10:00+08:00';
const end='2026-09-27T04:42:00+08:00';
const at=value=>Date.parse(`2026-09-27T${value}+08:00`);
const order={execution:'DELIVERING',windowStart:start,windowEnd:end};

test('time pressure follows the full delivery window and not ETA',()=>{
  assert.equal(orderTiming(order,at('04:09:00')).kind,'before');
  assert.equal(orderTiming(order,at('04:20:00')).kind,'remaining');
  assert.equal(orderTiming(order,at('04:37:00')).kind,'remaining');
  assert.equal(orderTiming(order,at('04:37:01')).kind,'closing');
  assert.equal(orderTiming(order,at('04:42:00')).kind,'now');
  const late=orderTiming(order,at('04:44:39'));
  assert.equal(late.kind,'overdue');
  assert.equal(late.label,'02:39');
  assert.equal(late.progress,100);
});

test('completed and invalid windows never create live overdue pressure',()=>{
  assert.equal(orderTiming({...order,execution:'COMPLETED'},at('04:44:39')).kind,'completed');
  assert.equal(orderTiming({...order,execution:'COMPLETED',windowEnd:null},at('04:44:39')).kind,'completed');
  const recorded=orderTiming({...order,deliveredAt:'2026-09-27T04:40:00+08:00'},at('04:44:39'));
  assert.equal(recorded.kind,'completed');
  assert.ok(recorded.progress<100);
  const historical=orderTiming({...order,deliveredAt:'2026-09-27T04:40:00+08:00'},NaN);
  assert.notEqual(historical.progress,null);
  assert.ok(historical.progress<100);
  assert.equal(orderTiming({...order,windowEnd:null},at('04:44:39')).kind,'unavailable');
  assert.equal(orderTiming({...order,windowEnd:start},at('04:44:39')).kind,'unavailable');
});

test('demo O-021 facts share the requested overdue scenario',()=>{
  const orders=demoOrders('2026-09-27');
  const o=orders.find(order=>order.code==='O-021');
  assert.ok(o);
  assert.equal(o.execution,'DELIVERING');
  assert.equal(o.merchant,'Fresh Kitchen');
  assert.equal(Date.parse(o.windowStart),Date.parse(start));
  assert.equal(Date.parse(o.windowEnd),Date.parse(end));
  assert.equal(Date.parse(o.eta),Date.parse('2026-09-27T04:47:00+08:00'));
  assert.ok(orders.slice(1,8).every(order=>Date.parse(order.windowEnd)>Date.parse(o.windowEnd)));
});
