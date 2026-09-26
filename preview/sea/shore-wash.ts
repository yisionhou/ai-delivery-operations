// Shared run-up definition: splash contact and water use the same clock/phase.
export const WASH={speed:.82,xPhase:.71,zPhase:.96,distancePhase:4,amplitude:.044,offset:.004};
export const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function washLocality(x:number,z:number){return smooth(-.12,.65,Math.sin(x*.77+z*.43)*Math.sin(z*.83-x*.21));}
export function washHeight(x:number,z:number,distance:number,time:number,lift=0,mode=3){
 const contact=(1-smooth(.35,1.10,distance))*(mode>=2.5?1:0)*(1-smooth(.04,.20,lift));
 const pulse=Math.max(0,Math.sin(time*WASH.speed+x*WASH.xPhase+z*WASH.zPhase+distance*WASH.distancePhase))**5;
 return contact*washLocality(x,z)*(pulse*WASH.amplitude-WASH.offset);
}
const gl=(n:number)=>Number.isInteger(n)?`${n}.0`:String(n);
export const washGLSL=`
float washHeight(vec2 p){
 float contact=(1.-smoothstep(.35,1.10,shore(p)))*step(2.5,uMode)*(1.-smoothstep(.04,.20,uLift));
 float locality=smoothstep(-.12,.65,sin(p.x*.77+p.y*.43)*sin(p.y*.83-p.x*.21));
 float pulse=pow(max(0.,sin(time*${gl(WASH.speed)}+p.x*${gl(WASH.xPhase)}+p.y*${gl(WASH.zPhase)}+shore(p)*${gl(WASH.distancePhase)})),5.);
 return contact*locality*(pulse*${gl(WASH.amplitude)}-${gl(WASH.offset)});
}`;
export const WAVE_COMPONENTS=[ [.83,.55,.023,5.1,.61,.2],[.35,.94,.014,2.9,.87,2.4],[-.72,.69,.008,1.73,1.19,4.7],[.94,-.34,.005,.94,1.53,1.3] ];
export const swellGLSL=`vec3 swell(vec2 p){return (${WAVE_COMPONENTS.map(v=>`component(p,vec2(${gl(v[0])},${gl(v[1])}),${v.slice(2).map(gl).join(',')})`).join('+')})*step(1.5,uMode);}`;
export function waterHeight(x:number,z:number,distance:number,bed:number,time:number){
 let swell=0;
 for(const [dx,dz,a,w,s,phase] of WAVE_COMPONENTS)swell+=a*Math.sin((x*dx+z*dz)/Math.hypot(dx,dz)*(2*Math.PI/w)-time*s+phase);
 return -.10+swell*(.28+.72*smooth(.03,.65,Math.max(0,-.10-bed)))+washHeight(x,z,distance,time);
}
