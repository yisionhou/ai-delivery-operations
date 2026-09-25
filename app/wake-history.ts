export type WakePoint={x:number;y:number;z:number};
export const WAKE_SITES=3, WAKE_SAMPLES=192, WAKE_BANKS=3;
export const WAKE_HOLD=.45, WAKE_FADE=2.65;
export type Wake={id:number;region:string;paths:WakePoint[][];times:number[];started:number;released:number|null;cancelled:boolean};
const distance=(a:WakePoint,b:WakePoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const copy=(p:WakePoint)=>({...p});
// Actual world positions; neither camera paths nor predictions. Departure survives until arrival.
export class WakeHistory{
  banks:Wake[]=[];serial=0;current:Wake|null=null;time=0;
  begin(region:string,sites:WakePoint[]){
    this.release(true);
    const wake:Wake={id:++this.serial,region,paths:sites.map(p=>[copy(p)]),times:[this.time],started:this.time,released:null,cancelled:false};
    this.banks.push(wake);if(this.banks.length>WAKE_BANKS)this.banks.shift();
    this.current=wake;return wake.id;
  }
  sample(sites:WakePoint[],force=false){
    const w=this.current;if(!w)return;
    const travel=distance(w.paths[0].at(-1)!,sites[0]);
    if(travel<1e-6||(travel<.025&&!force))return;
    const steps=Math.min(12,Math.max(1,Math.ceil(travel/.065)));
    const previous=w.paths.map(p=>p.at(-1)!);const time=w.times.at(-1)!;
    for(let s=1;s<=steps;s++){
      const t=s/steps;
      w.paths.forEach((path,i)=>path.push({x:previous[i].x+(sites[i].x-previous[i].x)*t,y:previous[i].y+(sites[i].y-previous[i].y)*t,z:previous[i].z+(sites[i].z-previous[i].z)*t}));
      w.times.push(time+(this.time-time)*t);
      if(w.times.length>=WAKE_SAMPLES){
        w.paths=w.paths.map(path=>path.filter((_,i)=>i%2===0||i===path.length-1));
        w.times=w.times.filter((_,i)=>i%2===0||i===w.times.length-1);
      }
    }
  }
  release(cancelled=false){if(this.current){this.current.released=this.time;this.current.cancelled=cancelled;this.current=null;}}
  update(dt:number){this.time+=Math.max(0,dt);this.banks=this.banks.filter(w=>w.released===null||this.time-w.released<WAKE_HOLD+WAKE_FADE);}
  envelope(w:Wake){const age=w.released===null?0:Math.max(0,this.time-w.released-WAKE_HOLD);return Math.pow(Math.max(0,1-age/WAKE_FADE),1.6);}
  phase(w:Wake){return w.released===null?'travel':this.time-w.released<WAKE_HOLD?'hold':'fade';}
}
