import assert from 'node:assert/strict';
import {test} from 'node:test';
import {easeOutCubic,ringFrame} from './analytics-motion.ts';

test('ring uses the unrounded fraction and reaches its exact target',()=>{
  const start=ringFrame(4/6,0,60);
  const middle=ringFrame(4/6,easeOutCubic(.5),60);
  const end=ringFrame(4/6,1,60);
  assert.equal(start.label,'0%');
  assert.equal(start.dashOffset,2*Math.PI*60);
  assert.ok(middle.ratio>0&&middle.ratio<4/6);
  assert.equal(end.label,'67%');
  assert.ok(Math.abs(end.dashOffset-(2*Math.PI*60/3))<1e-8);
});
