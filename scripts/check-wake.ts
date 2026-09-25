import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WakeHistory,WAKE_HOLD,WAKE_FADE,WAKE_SAMPLES} from '../app/wake-history.ts';
const sites=(x:number,y:number,z:number)=>[0,1,2].map(i=>({x:x+i,y,z}));
for(const fps of [20,30,60,120]){
  const h=new WakeHistory();h.begin('CENTRAL',sites(0,0,0));const start={...h.current!.paths[0][0]};
  for(let frame=1;frame<=fps*4;frame++){const t=frame/fps;h.update(1/fps);h.sample(sites(-5*Math.min(1,Math.max(0,t-.45)/2),.76*Math.min(1,t/.45),6*Math.min(1,Math.max(0,t-.45)/2)));}
  const w=h.current!;assert.deepEqual(w.paths[0][0],start);assert(w.paths[0].at(-1)!.x< -4.97);assert(w.paths[0].length<WAKE_SAMPLES);
  const count=w.times.length;h.sample(sites(-5,.76,6));assert.equal(w.times.length,count,'stationary camera/orbit produces no samples');
  h.release();h.update(WAKE_HOLD*.8);assert.equal(h.phase(w),'hold');assert.equal(h.envelope(w),1);
  h.update(.8);const a=h.envelope(w);assert(a>0&&a<1);assert.equal(h.phase(w),'fade');
  h.update(WAKE_FADE);assert.equal(h.banks.length,0);
}
const h=new WakeHistory();for(let i=0;i<50;i++){h.begin(`R${i}`,sites(i*100,0,0));h.update(.01);h.sample(sites(i*100+1,1,0));assert(h.banks.length<=3);}
assert(h.banks.every(w=>w.paths[0].at(-1)!.x-w.paths[0][0].x<=1));h.release(true);h.update(4);assert.equal(h.banks.length,0);
const lift=fs.readFileSync(new URL('../app/lift-dust.tsx',import.meta.url),'utf8');assert(!lift.includes('DUST_EMISSION_SECONDS'));assert(lift.includes('source.current.position.distanceTo(goal)<.02'));assert(lift.includes('depthTest:true'));assert(lift.includes('noDecorationRaycast'));
console.log('PASS: full lift/travel history at 20/30/60/120 fps; stationary suppression; immutable departure; .45s hold + 2.65s fade; 50 rapid transitions bounded to 3 independent banks; cleanup.');
