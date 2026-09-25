import * as THREE from 'three';
import {supportPoint, type SupportState, SUPPORT_SITES} from './support-field.ts';

export const MIST_PER_SITE=10, MIST_CAPACITY=3*SUPPORT_SITES*MIST_PER_SITE;
const seed=(n:number)=>{const x=Math.sin(n*127.1+71.9)*43758.5453;return x-Math.floor(x);};

// A shallow 3D distribution of feathered wisps, not one flat cloud card or a bounding-box cushion.
export function createSupportMist(){
  const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
  geometry.index=plane.index;geometry.attributes.position=plane.attributes.position;geometry.attributes.uv=plane.attributes.uv;
  const centers=new THREE.InstancedBufferAttribute(new Float32Array(MIST_CAPACITY*3),3).setUsage(THREE.DynamicDrawUsage);
  const parameters=new THREE.InstancedBufferAttribute(new Float32Array(MIST_CAPACITY*4),4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aCenter',centers);geometry.setAttribute('aMist',parameters);geometry.instanceCount=0;
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uGold:{value:new THREE.Color('#E5BA61')}},
    vertexShader:`attribute vec3 aCenter;attribute vec4 aMist;varying vec2 vUv;varying vec2 vMist;
      void main(){vUv=uv;vMist=aMist.zw;vec4 p=modelViewMatrix*vec4(aCenter,1.);
        float angle=.3*sin(aMist.w);mat2 turn=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
        p.xy+=turn*(position.xy*aMist.xy);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uGold;varying vec2 vUv;varying vec2 vMist;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float flow(vec2 p){return noise(p)*.58+noise(p*2.07+4.3)*.28+noise(p*4.13-2.7)*.14;}
      void main(){vec2 q=(vUv-.5)*2.;float phase=vMist.y;
        vec2 drift=vec2(uTime*.07,-uTime*.045)+phase;
        float n=flow(q*2.1+drift);vec2 warp=q+vec2(n-.5,flow(q.yx*2.6-drift)-.5)*.42;
        float body=exp(-dot(warp,warp)*2.8);
        float feather=1.-smoothstep(.55,1.,max(abs(q.x),abs(q.y)));
        float pores=smoothstep(.2,.72,n);
        float density=body*feather*(.28+.72*pores);
        gl_FragColor=vec4(uGold*(.82+.18*n),density*vMist.x);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const point=new THREE.Vector3();
  function update(state:SupportState,enabled:boolean){
    let count=0;material.uniforms.uTime.value=state.time;
    for(const bank of state.banks){const fade=state.opacity(bank),loosen=1-fade;
      for(const a of bank.anchors)for(let i=0;i<MIST_PER_SITE;i++){
        const phase=a.phase+i*2.39996,h=seed(i+17),u=.06+.88*seed(i+41);
        supportPoint(a,i%2,u,state.time,point);
        const curl=phase+state.time*(.18+seed(i+8)*.12);
        const along=Math.cos(curl)*(.23+.18*h);point.x+=a.tx*along;point.z+=a.tz*along;
        point.x+=a.nx*(.22+Math.sin(curl)*.2);point.z+=a.nz*(.22+Math.sin(curl)*.2);
        point.y-=.1+h*.3;point.y+=Math.sin(curl*1.13)*.09;
        point.applyMatrix4(bank.matrix);centers.setXYZ(count,point.x,point.y,point.z);
        parameters.setXYZW(count,(1.9+seed(i+9)*1.5)*(1+loosen*.32),(1.+seed(i+25)*.85)*(1+loosen*.4),
          fade*(.19+.065*seed(i+2)),phase);count++;
      }
    }
    geometry.instanceCount=enabled?count:0;centers.needsUpdate=true;parameters.needsUpdate=true;
  }
  return {geometry,material,update,dispose(){geometry.dispose();material.dispose();plane.dispose();}};
}
