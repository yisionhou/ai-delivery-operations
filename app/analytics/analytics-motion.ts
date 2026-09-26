export const easeOutCubic=(progress:number)=>1-Math.pow(1-Math.min(1,Math.max(0,progress)),3);

export function ringFrame(targetRatio:number,progress:number,radius:number){
  const ratio=targetRatio*progress;
  return {ratio,label:`${Math.round(ratio*100)}%`,dashOffset:2*Math.PI*radius*(1-ratio)};
}
