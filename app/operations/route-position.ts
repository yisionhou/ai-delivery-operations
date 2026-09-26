import type {Coordinate} from './operations-data';

// Advance by distance along the road geometry, not by the number of vertices.
export function pointAlongRoute(path:Coordinate[],fraction:number):Coordinate{
  if(path.length===0)throw new Error('Route path is empty');
  if(path.length===1||fraction<=0)return path[0];
  if(fraction>=1)return path[path.length-1];
  const lengths=path.slice(1).map((point,index)=>Math.hypot(point[0]-path[index][0],point[1]-path[index][1]));
  const total=lengths.reduce((sum,length)=>sum+length,0);
  if(total===0)return path[0];
  let remaining=fraction*total;
  for(let index=0;index<lengths.length;index++){
    const length=lengths[index];
    if(remaining<=length){
      const progress=length===0?0:remaining/length;
      return [path[index][0]+(path[index+1][0]-path[index][0])*progress,path[index][1]+(path[index+1][1]-path[index][1])*progress];
    }
    remaining-=length;
  }
  return path[path.length-1];
}
