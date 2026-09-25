export const DUST_CAPACITY=320;
export const DUST_EMISSION_SECONDS=.78;
const PER_LIFT=144;
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export type DustBirth={x:number;y:number;z:number;dx:number;dz:number};

// Fixed CPU pool; particles own their world-space birthplace, never their emitter's transform.
export class DustPool {
  positions=new Float32Array(DUST_CAPACITY*3);
  opacities=new Float32Array(DUST_CAPACITY);
  sizes=new Float32Array(DUST_CAPACITY);
  origins=new Float32Array(DUST_CAPACITY*3);
  velocities=new Float32Array(DUST_CAPACITY*3);
  ages=new Float32Array(DUST_CAPACITY).fill(10);
  lifetimes=new Float32Array(DUST_CAPACITY);
  phase=new Float32Array(DUST_CAPACITY);
  elapsed=1;emitted=0;bursts=0;active=0;cursor=0;
  start(){this.elapsed=0;this.emitted=0;this.bursts++;}
  stop(){this.elapsed=1;}
  update(dt:number,sample?:(fraction:number)=>DustBirth){
    if(this.elapsed<DUST_EMISSION_SECONDS&&sample){
      this.elapsed+=dt;
      const target=Math.min(PER_LIFT,Math.floor(this.elapsed/DUST_EMISSION_SECONDS*PER_LIFT));
      while(this.emitted<target){
        const index=this.cursor++%DUST_CAPACITY,seed=this.bursts*397+this.emitted++;
        // Stratification by arc length avoids vertex-density bias at intricate coastlines.
        const at=sample((this.emitted-1+hash(seed))/PER_LIFT),j=index*3;
        this.origins.set([at.x,at.y,at.z],j);
        this.velocities.set([at.dx*(.016+hash(seed+1)*.026),.025+hash(seed+2)*.027,at.dz*(.016+hash(seed+3)*.026)],j);
        this.ages[index]=0;this.lifetimes[index]=2.3+hash(seed+4)*.9;
        this.sizes[index]=1+hash(seed+5)*.4;this.phase[index]=hash(seed+6)*Math.PI*2;
      }
    }
    this.active=0;
    for(let i=0;i<DUST_CAPACITY;i++){
      const age=this.ages[i]+=dt,life=this.lifetimes[i];
      if(age>=life){this.opacities[i]=0;continue;}
      this.active++;
      const j=i*3,travel=(1-Math.exp(-age*1.15))/1.15,phase=this.phase[i];
      this.positions[j]=this.origins[j]+this.velocities[j]*travel+.013*(Math.sin(phase+age*.7)-Math.sin(phase));
      this.positions[j+1]=this.origins[j+1]+this.velocities[j+1]*travel+.019*age;
      this.positions[j+2]=this.origins[j+2]+this.velocities[j+2]*travel+.011*(Math.cos(phase+age*.6)-Math.cos(phase));
      const fadeIn=Math.min(1,age/.16),tail=Math.max(0,1-age/life);
      this.opacities[i]=.78*fadeIn*fadeIn*(3-2*fadeIn)*Math.pow(tail,1.05);
    }
  }
}
