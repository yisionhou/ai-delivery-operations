type Point={x:number;y:number};
/** A continuous ribbon around a cubic centerline, tapered in screen pixels.
 * Dense samples are joined with quadratic midpoint curves, not stepped stroke widths.
 */
export function taperedBranch(start:Point,fork:Point,c1:Point,c2:Point,end:Point){
  const samples:Array<Point&{nx:number;ny:number;width:number}>=[];
  samples.push({...start,nx:0,ny:1,width:9});
  for(let i=0;i<=64;i++){
    const t=i/64,u=1-t;
    const x=u*u*u*fork.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x;
    const y=u*u*u*fork.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y;
    const dx=3*u*u*(c1.x-fork.x)+6*u*t*(c2.x-c1.x)+3*t*t*(end.x-c2.x);
    const dy=3*u*u*(c1.y-fork.y)+6*u*t*(c2.y-c1.y)+3*t*t*(end.y-c2.y);
    const length=Math.hypot(dx,dy)||1;
    samples.push({x,y,nx:-dy/length,ny:dx/length,width:3+6*Math.pow(1-t,1.5)});
  }
  const smooth=(points:Point[])=>{
    let d=`M${points[0].x} ${points[0].y}`;
    for(let i=1;i<points.length-1;i++){
      const a=points[i],b=points[i+1];
      d+=` Q${a.x} ${a.y} ${(a.x+b.x)/2} ${(a.y+b.y)/2}`;
    }
    return d+` L${points.at(-1)!.x} ${points.at(-1)!.y}`;
  };
  const ribbon=(scale:number)=>{
    const side=(direction:number)=>samples.map(p=>({x:p.x+p.nx*p.width*scale*.5*direction,y:p.y+p.ny*p.width*scale*.5*direction}));
    return smooth(side(1))+smooth(side(-1).reverse()).replace(/^M/,' L')+' Z';
  };
  return {
    centerline:`M${start.x} ${start.y} L${fork.x} ${fork.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
    core:ribbon(1),glow:ribbon(1.5),halo:ribbon(2.5),
  };
}
