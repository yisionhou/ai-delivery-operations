import type {DustBirth} from './dust-pool';

export const FILAMENT_CAPACITY=32;
export const FILAMENT_SEGMENTS=18;
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

// Short independent curves, never a strip connecting emitter positions into a long ribbon.
export class FilamentPool {
  positions=new Float32Array(FILAMENT_CAPACITY*FILAMENT_SEGMENTS*2*3);
  opacities=new Float32Array(FILAMENT_CAPACITY*FILAMENT_SEGMENTS*2);
  origins=new Float32Array(FILAMENT_CAPACITY*3);
  directions=new Float32Array(FILAMENT_CAPACITY*2);
  ages=new Float32Array(FILAMENT_CAPACITY).fill(10);
  lifetimes=new Float32Array(FILAMENT_CAPACITY);
  lengths=new Float32Array(FILAMENT_CAPACITY);
  phases=new Float32Array(FILAMENT_CAPACITY);
  cursor=0;active=0;
  spawn(at:DustBirth){
    const seed=this.cursor++,i=seed%FILAMENT_CAPACITY;
    this.origins.set([at.x,at.y,at.z],i*3);this.directions.set([at.dx,at.dz],i*2);
    this.ages[i]=0;this.lifetimes[i]=2.7+hash(seed+13)*.6;
    this.lengths[i]=.36+hash(seed+7)*.36;this.phases[i]=hash(seed+3)*Math.PI*2;
  }
  update(dt:number){
    this.active=0;
    for(let i=0;i<FILAMENT_CAPACITY;i++){
      const age=this.ages[i]+=dt,life=this.lifetimes[i],offset=i*FILAMENT_SEGMENTS*2;
      if(age>=life){this.opacities.fill(0,offset,offset+FILAMENT_SEGMENTS*2);continue;}
      this.active++;
      const phase=this.phases[i],length=this.lengths[i],growth=Math.min(1,age/.55);
      const dx=this.directions[i*2],dz=this.directions[i*2+1];
      const fadeIn=Math.min(1,age/.18),fadeOut=Math.pow(Math.max(0,1-age/life),.95);
      for(let segment=0;segment<FILAMENT_SEGMENTS;segment++)for(let end=0;end<2;end++){
        const t=(segment+end)/FILAMENT_SEGMENTS,index=offset+segment*2+end,j=index*3;
        const along=(t-.12)*length*growth;
        const bend=Math.sin(t*Math.PI)*(.085+.03*Math.sin(phase+age*.55));
        this.positions[j]=this.origins[i*3]+dx*(along+age*.018)-dz*bend;
        this.positions[j+1]=this.origins[i*3+1]+.11*Math.sin(t*Math.PI)*growth+age*.042;
        this.positions[j+2]=this.origins[i*3+2]+dz*(along+age*.018)+dx*bend;
        this.opacities[index]=.7*fadeIn*fadeOut*Math.pow(Math.sin(Math.PI*t),.6);
      }
    }
  }
}
