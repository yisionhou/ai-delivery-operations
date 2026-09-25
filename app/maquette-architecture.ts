import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Position = [number, number];
type Finish = "limestone" | "concrete" | "graphite" | "aluminium" | "glass" | "roof" | "accent";
type Kind = "marina" | "wheel" | "office" | "residence" | "courtyard" | "hall" | "logistics" | "refinery" | "terminal" | "runway" | "pavilion" | "jewel" | "terrace";
type Asset = {at:Position;kind:Kind;scale?:number;angle?:number};
type Part = {geometry:THREE.BufferGeometry;finish:Finish};

export const architecturalFinishes: Record<Finish,{color:string;metalness:number;roughness:number;emissive?:string;emissiveIntensity?:number}> = {
  limestone:{color:"#b6b1a5",metalness:.08,roughness:.66},
  concrete:{color:"#78776f",metalness:.06,roughness:.8},
  graphite:{color:"#343430",metalness:.22,roughness:.65},
  aluminium:{color:"#aaa9a4",metalness:.72,roughness:.4},
  glass:{color:"#292a27",metalness:.4,roughness:.23},
  roof:{color:"#5d5b53",metalness:.58,roughness:.46},
  accent:{color:"#c9b080",metalness:.52,roughness:.48,emissive:"#977039",emissiveIntensity:.08},
};

// Deliberately curated districts, with a small number of recognizable silhouettes.
const assets:Record<string,Asset[]> = {
  "CENTRAL REGION":[
    {at:[103.86,1.282],kind:"marina",scale:1.05,angle:-.25},
    {at:[103.864,1.292],kind:"wheel",scale:.85,angle:-.15},
    {at:[103.849,1.282],kind:"office",scale:.88},
    {at:[103.846,1.286],kind:"office",scale:.72,angle:.2},
    {at:[103.838,1.303],kind:"courtyard",scale:.8},
    {at:[103.825,1.308],kind:"office",scale:.75},
    {at:[103.813,1.31],kind:"courtyard"},
    {at:[103.798,1.305],kind:"residence",scale:.8},
    {at:[103.778,1.31],kind:"courtyard",scale:.8},
    {at:[103.842,1.329],kind:"residence",scale:.85},
    {at:[103.861,1.328],kind:"courtyard",scale:.75},
    {at:[103.878,1.312],kind:"courtyard",scale:.8},
    {at:[103.892,1.323],kind:"residence",scale:.75},
    {at:[103.832,1.249],kind:"pavilion",scale:.7,angle:.3},
    {at:[103.82,1.253],kind:"pavilion",scale:.6},
  ],
  "WEST REGION":[
    {at:[103.63,1.322],kind:"logistics",scale:.85},
    {at:[103.645,1.328],kind:"hall"},
    {at:[103.654,1.342],kind:"hall",scale:.8},
    {at:[103.668,1.328],kind:"refinery",scale:.8},
    {at:[103.683,1.337],kind:"hall",angle:.2},
    {at:[103.695,1.33],kind:"logistics",scale:.75},
    {at:[103.709,1.345],kind:"courtyard",scale:.7},
    {at:[103.725,1.335],kind:"hall",scale:.85},
    {at:[103.746,1.342],kind:"residence",scale:.85},
    {at:[103.713,1.371],kind:"courtyard",scale:.8},
    {at:[103.736,1.376],kind:"residence",scale:.8},
    {at:[103.684,1.377],kind:"hall",scale:.65},
    {at:[103.696,1.297],kind:"refinery",scale:.75},
    {at:[103.711,1.31],kind:"refinery",scale:.65},
  ],
  "EAST REGION":[
    {at:[103.982,1.354],kind:"terminal",scale:1.05,angle:-.25},
    {at:[103.994,1.362],kind:"runway",scale:1,angle:-.5},
    {at:[103.989,1.360],kind:"jewel",scale:.85},
    {at:[103.967,1.343],kind:"hall",scale:.8},
    {at:[103.943,1.355],kind:"courtyard",scale:.8},
    {at:[103.948,1.37],kind:"residence",scale:.8},
    {at:[103.925,1.345],kind:"residence",scale:.8},
    {at:[103.921,1.365],kind:"courtyard",scale:.7},
    {at:[103.94,1.33],kind:"courtyard",scale:.8},
    {at:[103.908,1.334],kind:"courtyard",scale:.65},
  ],
  "NORTH REGION":[
    {at:[103.769,1.436],kind:"residence",scale:.8},
    {at:[103.786,1.44],kind:"terrace",scale:.75},
    {at:[103.797,1.449],kind:"residence",scale:.7},
    {at:[103.812,1.433],kind:"courtyard",scale:.8},
    {at:[103.833,1.423],kind:"residence",scale:.85},
    {at:[103.789,1.412],kind:"terrace",scale:.7},
    {at:[103.758,1.409],kind:"hall",scale:.65},
  ],
  "NORTH-EAST REGION":[
    {at:[103.851,1.385],kind:"residence",scale:.75},
    {at:[103.871,1.392],kind:"courtyard",scale:.8},
    {at:[103.894,1.392],kind:"residence",scale:.85},
    {at:[103.896,1.411],kind:"residence",scale:.9},
    {at:[103.915,1.404],kind:"courtyard",scale:.8},
    {at:[103.914,1.418],kind:"residence",scale:.8},
    {at:[103.932,1.415],kind:"courtyard",scale:.7},
  ],
};

function rounded(width:number,depth:number,radius:number) {
  const s=new THREE.Shape(), x=-width/2,z=-depth/2,r=Math.min(radius,width/2,depth/2);
  s.moveTo(x+r,z);s.lineTo(x+width-r,z);s.quadraticCurveTo(x+width,z,x+width,z+r);
  s.lineTo(x+width,z+depth-r);s.quadraticCurveTo(x+width,z+depth,x+width-r,z+depth);
  s.lineTo(x+r,z+depth);s.quadraticCurveTo(x,z+depth,x,z+depth-r);
  s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);s.closePath();return s;
}

function model(kind:Kind):Part[] {
  const parts:Part[]=[];
  const add=(geometry:THREE.BufferGeometry,finish:Finish,at:[number,number,number]=[0,0,0])=>{
    geometry.translate(...at);parts.push({geometry,finish});
  };
  const volume=(w:number,d:number,h:number,y:number,finish:Finish,x=0,z=0,r=.04)=>{
    const geometry=new THREE.ExtrudeGeometry(rounded(w,d,r),{depth:h,steps:1,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:2,curveSegments:5});
    geometry.rotateX(-Math.PI/2);add(geometry,finish,[x,y,z]);
  };
  const cylinder=(r:number,h:number,at:[number,number,number],finish:Finish,top=r)=>add(new THREE.CylinderGeometry(top,r,h,24),finish,at);
  const beam=(a:[number,number,number],b:[number,number,number],r:number,finish:Finish)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from);
    const g=new THREE.CylinderGeometry(r,r,direction.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
    add(g,finish,from.add(to).multiplyScalar(.5).toArray() as [number,number,number]);
  };
  const sweep=(points:THREE.Vector3[],radius:number,finish:Finish)=>{
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,radius,5,false),finish);
  };
  const arcade=(width:number,z:number,y:number)=>{
    for(let i=0;i<7;i++){
      const x=-width/2+i*width/6;
      beam([x,.08,z],[x,y,z],.017,'limestone');
    }
    beam([-width/2,y,z],[width/2,y,z],.025,'aluminium');
  };
  const loft=(x:number,z:number,height:number,w:number,d:number,finish:Finish,lean=0,bands=true)=>{
    const ring=rounded(w,d,.09).getPoints(5);ring.pop();
    const positions:number[]=[],indices:number[]=[];const rows=16,n=ring.length;
    for(let j=0;j<=rows;j++){
      const t=j/rows,scale=1-.11*t+.07*Math.sin(t*Math.PI);
      for(const p of ring)positions.push(x+p.x*scale+lean*Math.sin(t*Math.PI*.6),.13+t*height,z-p.y*scale);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<n;i++){
      const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+i,e=(j+1)*n+(i+1)%n;
      indices.push(a,c,b,b,c,e);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,finish);
    volume(w*.89,d*.89,.045,height+.12,"roof",x+lean*Math.sin(Math.PI*.6),z,.08);
    for(let j=1;bands&&j<rows;j++){
      const t=j/rows,scale=1-.11*t+.07*Math.sin(t*Math.PI);
      volume(w*scale+.014,d*scale+.014,.016,.13+t*height,"aluminium",x+lean*Math.sin(t*Math.PI*.6),z,.09);
    }
  };

  if(kind==="marina"){
    volume(2.15,.95,.13,0,"graphite",0,0,.2);
    for(const x of [-.67,0,.67]){
      loft(x,0,2.05,.43,.56,"glass",.13);
      // Paired stone ribs give each tower its curved, split silhouette.
      loft(x-.17,-.015,2.05,.065,.58,"limestone",.13,false);
      // Continuous structural blades distinguish curved split towers from stacked slabs.
      for(const dx of [-.08,.11])for(const side of [-1,1]){
        sweep(Array.from({length:9},(_,i)=>{const t=i/8,s=1-.11*t+.07*Math.sin(t*Math.PI);
          return new THREE.Vector3(x+dx*s+.13*Math.sin(t*Math.PI*.6),.14+t*2.04,side*.282*s);}),.014,'limestone');
      }
    }
    const deck=new THREE.Shape();deck.moveTo(-1.15,-.25);deck.bezierCurveTo(-1.65,-.2,-1.55,.19,-1.15,.25);
    deck.lineTo(1.16,.25);deck.bezierCurveTo(1.72,.14,1.62,-.1,1.17,-.25);deck.closePath();
    const g=new THREE.ExtrudeGeometry(deck,{depth:.115,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,curveSegments:16});g.rotateX(-Math.PI/2);add(g,"limestone",[.1,2.22,0]);
    volume(1.2,.2,.025,2.375,"glass",-.16,0,.075);
    volume(.54,.2,.065,2.37,"roof",.89,0,.09);
    volume(2.21,.38,.025,2.19,'graphite',.1,0,.14);
    volume(1.3,.55,.23,.12,"limestone",-.4,.48,.16);
    arcade(1.25,.79,.3);
    // Three scalloped convention roofs form a horizontal waterfront podium.
    for(const x of [-.75,-.25,.25]){
      const shell=new THREE.CylinderGeometry(.25,.25,.55,20,1,true,0,Math.PI);
      shell.rotateZ(Math.PI/2);shell.rotateY(Math.PI/2);add(shell,'roof',[x,.36,.5]);
    }
  }else if(kind==="wheel"){
    volume(1.1,.65,.1,0,"graphite",0,0,.15);
    const cy=.79,rad=.65;
    for(const z of [-.07,.07]){const g=new THREE.TorusGeometry(rad,.024,8,64);add(g,"aluminium",[0,cy,z]);}
    for(let i=0;i<16;i++){
      const a=i*Math.PI*2/16,x=Math.cos(a)*rad,y=cy+Math.sin(a)*rad;
      beam([0,cy,0],[x,y,0],.008,"aluminium");
      const g=new THREE.SphereGeometry(.055,8,6);g.scale(1.45,.8,1);add(g,"limestone",[x,y,0]);
    }
    beam([-.33,.1,.21],[0,cy,0],.03,"limestone");beam([.33,.1,.21],[0,cy,0],.03,"limestone");
    cylinder(.07,.14,[0,cy,0],"accent");
  }else if(kind==="office"){
    volume(1,.8,.13,0,"graphite",0,0,.12);
    volume(.85,.65,.2,.12,"limestone",0,0,.1);
    loft(0,0,1.65,.53,.49,"glass",.08);
    volume(.39,.35,.17,1.83,"aluminium",.07,0,.075);
    beam([.07,2,0],[.07,2.21,0],.012,"accent");
    volume(.32,.45,.43,.25,"concrete",.5,.12,.05);
    // Continuous fins follow the bowed tower instead of a painted window grid.
    for(const x of [-.2,0,.2])for(const z of [-.247,.247]){
      sweep(Array.from({length:9},(_,i)=>{const t=i/8;return new THREE.Vector3(x+.08*Math.sin(t*Math.PI*.6),.15+t*1.65,z*(1-.11*t+.07*Math.sin(t*Math.PI)));}),.012,'aluminium');
    }
    arcade(.75,.36,.28);
  }else if(kind==="residence"){
    volume(1.6,1,.1,0,"graphite",0,0,.11);
    for(const [x,h,z] of [[-.42,1.13,-.15],[.24,.88,.1],[.53,.6,-.25]]){
      loft(x,z,h-.05,.39,.49,"glass",.025);
      // Broad alternating terraces and a vertical service spine define the massing.
      for(let f=0;f<Math.floor(h/.18);f++)volume(.46,.59,.028,.18+f*.18,"limestone",x+(f%2?.025:-.025),z,.08);
      volume(.26,.28,.085,h+.13,"roof",x-.025,z,.04);
      volume(.055,.5,h,.12,"concrete",x-.2,z,.015);
    }
    volume(.8,.28,.12,.12,"concrete",-.05,.43,.05);
    arcade(.75,.59,.24);
  }else if(kind==="courtyard"){
    volume(1.25,1,.07,0,"graphite",0,0,.12);
    for(const [x,z,w,d,h] of [[-.43,0,.3,.8,.45],[.36,-.2,.34,.42,.64],[.06,.3,.74,.27,.36]]){
      volume(w,d,h,.07,"limestone",x,z,.05);
      volume(w+.025,d+.03,.045,h+.08,"roof",x,z,.055);
      volume(w*.83,d*.8,.07,h+.12,"glass",x,z,.04);
    }
    volume(.38,.35,.04,.075,"concrete",-.05,-.08,.08);
    arcade(.7,.45,.29);
    for(const x of [-.52,-.43,-.34])beam([x,.1,.42],[x,.49,.42],.015,'aluminium');
  }else if(kind==='terrace'){
    volume(1.35,.92,.075,0,'graphite',0,0,.14);
    // Low terraced housing: receding roof gardens, shaded verandas, separate roof planes.
    for(let i=0;i<3;i++){
      const z=-.25+i*.24,y=.12+(2-i)*.3;
      volume(1.18,.3,y,0,'glass',0,z,.09);
      volume(1.24,.36,.035,y,'limestone',0,z+.025,.09);
    }
    arcade(1.2,.42,.17);
  }else if(kind==="hall"||kind==="logistics"){
    volume(1.9,1.05,.085,0,"graphite",0,0,.06);
    volume(1.65,.85,.31,.09,"concrete",0,0,.025);
    // Sawtooth industrial roof profile, not a rectangular roof slab.
    const section=new THREE.Shape();section.moveTo(-.84,0);
    for(let i=0;i<4;i++){section.lineTo(-.84+i*.42+.31,.14);section.lineTo(-.84+(i+1)*.42,0);}
    section.lineTo(.84,-.05);section.lineTo(-.84,-.05);section.closePath();
    const roof=new THREE.ExtrudeGeometry(section,{depth:.88,bevelEnabled:false});add(roof,"roof",[0,.43,-.44]);
    // Recessed north-light glazing on the sawtooth returns, not painted facade squares.
    for(let i=0;i<4;i++){
      const x=-.84+(i+1)*.42;
      beam([x-.1,.556,-.4],[x-.1,.556,.4],.017,'glass');
      beam([x-.025,.445,-.4],[x-.1,.556,-.4],.012,'aluminium');
      beam([x-.025,.445,.4],[x-.1,.556,.4],.012,'aluminium');
    }
    for(let i=0;i<5;i++)volume(.17,.025,.14,.12,"glass",-.64+i*.32,.437,.01);
    for(let i=0;i<6;i++)beam([-.76+i*.3,.1,.44],[-.76+i*.3,.4,.44],.012,'aluminium');
    volume(1.72,.27,.035,.21,'aluminium',0,.56,.015);
    if(kind==="logistics"){
      for(const x of [-.77,.77]){beam([x,.05,.67],[x,1,.67],.034,"aluminium");beam([x,.05,.38],[x,1,.67],.023,"aluminium");}
      beam([-.97,1,.67],[.97,1,.67],.04,"aluminium");beam([.27,1,.67],[.27,.55,.67],.012,"accent");
      for(let i=0;i<4;i++){
        const x=-.76+i*.38;
        beam([x,.84,.67],[x+.38,1,.67],.018,'roof');
        beam([x,1,.67],[x+.38,.84,.67],.018,'roof');
      }
      volume(.27,.18,.045,.52,"roof",.27,.67,.02);
    }
  }else if(kind==="refinery"){
    volume(1.7,1.2,.09,0,"graphite",0,0,.08);
    for(const [x,z,r,h] of [[-.45,-.16,.27,.43],[.23,-.25,.21,.56],[.53,.3,.19,.32]]){
      cylinder(r,h,[x,.09+h/2,z],"aluminium");cylinder(r+.015,.035,[x,.11+h,z],"limestone");
    }
    beam([-.6,.2,.45],[.6,.2,.45],.035,"roof");
    cylinder(.07,.95,[-.58,.55,.35],"roof");cylinder(.09,.82,[-.28,.49,.37],"concrete");
  }else if(kind==="terminal"){
    volume(2.7,1.2,.075,0,"graphite",0,0,.14);
    volume(2.4,.35,.28,.08,"glass",0,0,.12);
    // Shallow vaulted terminal roof, same approved span and height envelope.
    const vault=new THREE.Shape();vault.moveTo(-.245,0);vault.quadraticCurveTo(0,.09,.245,0);
    vault.lineTo(.245,-.012);vault.quadraticCurveTo(0,.065,-.245,-.012);vault.closePath();
    const vaultMesh=new THREE.ExtrudeGeometry(vault,{depth:2.55,bevelEnabled:false,curveSegments:12});
    vaultMesh.rotateY(Math.PI/2);add(vaultMesh,'aluminium',[-1.275,.37,0]);
    for(const x of [-.86,0,.86]){
      volume(.27,1.22,.17,.075,"glass",x,0,.075);
      volume(.35,1.29,.06,.25,"limestone",x,0,.11);
    }
    cylinder(.085,.76,[1.12,.51,.58],"concrete",.06);
    cylinder(.18,.12,[1.12,.93,.58],"glass",.2);
    cylinder(.21,.04,[1.12,1.02,.58],"aluminium");
    for(let i=0;i<9;i++){
      const x=-1.08+i*.27;
      sweep([new THREE.Vector3(x,.31,-.25),new THREE.Vector3(x,.45,0),new THREE.Vector3(x,.31,.25)],.012,'aluminium');
    }
    for(const x of [-.86,0,.86])for(const z of [-.65,.65]){
      volume(.45,.06,.05,.12,'aluminium',x,z,.02);
    }
    // A shaded colonnade separates the concourse glazing from its roof structure.
    for(let i=0;i<11;i++)for(const z of [-.18,.18]){
      const x=-1.12+i*.224;beam([x,.09,z],[x,.365,z],.01,'limestone');
    }
  }else if(kind==='jewel'){
    cylinder(.83,.07,[0,.035,0],'graphite');
    const profile=Array.from({length:18},(_,i)=>{const t=i/17;return new THREE.Vector2(.12+.7*t,.11+.42*Math.cos(t*Math.PI/2));});
    const dome=new THREE.LatheGeometry(profile,64);dome.scale(1,1,.86);add(dome,'glass');
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12;
      sweep(profile.map(p=>new THREE.Vector3(Math.cos(a)*p.x,p.y+.008,Math.sin(a)*p.x*.86)),.008,'aluminium');
    }
    for(const i of [4,9,14]){
      const p=profile[i],g=new THREE.TorusGeometry(p.x,.009,5,64);g.rotateX(-Math.PI/2);g.scale(1,1,.86);add(g,'aluminium',[0,p.y,0]);
    }
    const oculus=new THREE.TorusGeometry(.12,.018,6,40);oculus.rotateX(-Math.PI/2);add(oculus,'limestone',[0,.535,0]);
  }else if(kind==="runway"){
    volume(3,.23,.025,0,"roof",0,0,.015);
    for(let i=0;i<11;i++)volume(.1,.012,.005,.028,"limestone",-1.35+i*.27,0,.003);
    volume(1.25,.025,.014,.025,"concrete",0,-.32,.008);
  }else if(kind==="pavilion"){
    volume(1.25,.85,.12,0,"graphite",0,0,.3);
    for(const [x,z,scale] of [[-.33,0,.42],[.17,-.12,.47],[.43,.15,.28]]){
      const g=new THREE.SphereGeometry(scale,24,12,0,Math.PI*2,0,Math.PI*.46);g.scale(1,.55,.75);add(g,"limestone",[x,.25,z]);
      cylinder(scale*.77,.15,[x,.18,z],"glass");
    }
  }
  return parts;
}

export function architecturalScale() {
  // Approved city-to-terrain proportions: refine individual models, never shrink the city globally.
  return new THREE.Vector3(.73,1.02,.73);
}

export function createArchitecture(region:string, isLand:(p:Position)=>boolean, surface:(p:Position)=>THREE.Vector3) {
  const buckets=new Map<Finish,THREE.BufferGeometry[]>();
  const placed=assets[region].filter(asset=>isLand(asset.at));
  for(const asset of placed){
    const s=asset.scale??1,position=surface(asset.at);position.y-=.014;
    const scale=architecturalScale().multiplyScalar(s);
    const transform=new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),asset.angle??0),scale);
    for(const part of model(asset.kind)){
      const original=part.geometry,geometry=original.index?original.toNonIndexed():original;
      geometry.deleteAttribute('uv');geometry.applyMatrix4(transform);
      const group=buckets.get(part.finish)??[];group.push(geometry);buckets.set(part.finish,group);
      if(geometry!==original)original.dispose();
    }
  }
  return [...buckets.entries()].map(([finish,parts])=>{
    const geometry=mergeGeometries(parts,false)!;parts.forEach(part=>part.dispose());
    return {finish,geometry};
  });
}
