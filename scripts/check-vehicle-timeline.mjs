import assert from 'node:assert/strict';
import {buildStopTimeline} from '../app/vehicles/vehicle-timeline.ts';

const stops=[
  {plannedArrival:'2026-09-27T10:20:00+08:00',plannedDeparture:null,actualArrival:'2026-09-27T10:15:00+08:00',actualDeparture:null},
  {plannedArrival:'2026-09-27T12:30:00+08:00',plannedDeparture:'2026-09-27T12:45:00+08:00',actualArrival:null,actualDeparture:null},
];
const live=buildStopTimeline(stops,'2026-09-27',new Date('2026-09-27T11:30:00+08:00'));
assert.equal(live.startLabel,'10:15');
assert.equal(live.endLabel,'12:45');
assert.ok(live.currentPercent!==null&&live.currentPercent>0&&live.currentPercent<100);
assert.equal(live.currentLabel,'11:30:00');
assert.equal(live.remainingLabel,'01:15:00');
assert.equal(buildStopTimeline(stops,'2026-09-27',new Date('2026-09-27T11:30:01+08:00')).remainingLabel,'01:14:59');
const historical=buildStopTimeline(stops,'2026-09-27',new Date('2026-09-28T11:30:00+08:00'));
assert.equal(historical.remainingLabel,'Ended');
assert.equal(historical.currentPercent,100);
assert.match(historical.currentLabel,/2026-09-28/);
const demo=buildStopTimeline([{plannedArrival:'10:20',plannedDeparture:null,actualArrival:null,actualDeparture:null},{plannedArrival:'11:16',plannedDeparture:null,actualArrival:null,actualDeparture:null}],'2026-09-26',new Date('2026-09-27T10:48:00+08:00'));
assert.equal(demo.startLabel,'10:20');
assert.equal(demo.endLabel,'11:16');
assert.equal(demo.currentPercent,100);
assert.equal(demo.remainingLabel,'Ended');
assert.equal(buildStopTimeline([{plannedArrival:null,plannedDeparture:null,actualArrival:null,actualDeparture:null}],'2026-09-27').startLabel,null);
console.log('Vehicle timeline checks passed');
