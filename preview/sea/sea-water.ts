import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {EXTENT,SEA_LEVEL} from './sea-model';
import {washGLSL,swellGLSL} from './shore-wash';

const waves=`
uniform float uMode;
uniform float uLift;
uniform sampler2D uCoast;
vec2 maskUV(vec2 p){return p/vec2(48.,38.)+.5;}
float shore(vec2 p){return texture2D(uCoast,maskUV(p)).g*2.;}
float bed(vec2 p){return texture2D(uCoast,maskUV(p)).b*2.-1.;}
// Height and analytic derivatives share phase: no painted scrolling color.
vec3 component(vec2 p,vec2 direction,float amp,float wavelength,float speed,float phase){
 float k=6.2831853/wavelength;vec2 d=normalize(direction);float q=dot(p,d)*k-time*speed+phase;
 return vec3(amp*sin(q),amp*k*d*cos(q));
}
${swellGLSL}
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 gradientNoise(vec2 p){
 vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
 float a=hash21(i),b=hash21(i+vec2(1.,0.)),c=hash21(i+vec2(0.,1.)),d=hash21(i+1.);
 return vec2(mix(b-a,d-c,u.y)*du.x,mix(c-a,d-b,u.x)*du.y);
}
vec2 fineSlope(vec2 p){
 mat2 turn=mat2(.8,-.6,.6,.8);
 return gradientNoise(p*vec2(.95,6.2)+vec2(time*.029,time*.14))*vec2(.016,.095)
      +turn*gradientNoise(turn*p*vec2(1.7,7.3)+vec2(-time*.038,time*.11))*vec2(.009,.031);
}
${washGLSL}
float seaHeight(vec2 p){
 float depth=max(0.,-.10-bed(p));
 return swell(p).x*mix(.28,1.,smoothstep(.03,.65,depth))+washHeight(p);
}
`;
export function createSea(mask:THREE.DataTexture){
  const geometry=new THREE.PlaneGeometry(...EXTENT,384,304);
  // Water expects a normal texture; the preview supplies analytic slopes instead.
  const normal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);normal.needsUpdate=true;
  const water=new Water(geometry,{textureWidth:512,textureHeight:512,waterNormals:normal,waterColor:0x030303,sunColor:0x000000,distortionScale:.7});
  water.rotation.x=-Math.PI/2;water.position.y=SEA_LEVEL;water.name='isolated-world-space-sea';
  water.raycast=()=>{};water.receiveShadow=false;water.castShadow=false;
  const mat=water.material;
  Object.assign(mat.uniforms,{uCoast:{value:mask},uMode:{value:2},uLift:{value:0}});
  mat.vertexShader=mat.vertexShader.replace('void main() {',`${waves}\nvoid main() {`)
    .replace('mirrorCoord = modelMatrix * vec4( position, 1.0 );',`vec3 displaced=position;vec2 p=vec2(position.x,-position.y);displaced.z+=seaHeight(p);mirrorCoord=modelMatrix*vec4(displaced,1.);`)
    .replace('modelViewMatrix * vec4( position, 1.0 )','modelViewMatrix * vec4( displaced, 1.0 )');
  mat.fragmentShader=mat.fragmentShader.replace('void main() {',`${waves}\nvoid main() {`)
    .replace('vec4 noise = getNoise( worldPosition.xz * size );',`vec2 p=worldPosition.xz;vec4 masks=texture2D(uCoast,maskUV(p));if(masks.r>.08)discard;
      float waterDepth=max(0.,worldPosition.y-bed(p));
      float h=.025;vec2 slope=vec2(seaHeight(p+vec2(h,0.))-seaHeight(p-vec2(h,0.)),seaHeight(p+vec2(0.,h))-seaHeight(p-vec2(0.,h)))/(2.*h);
      slope+=fineSlope(p)*mix(.45,1.,smoothstep(.04,.45,waterDepth));
      vec4 noise=vec4(0.);`)
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );','vec3 surfaceNormal=normalize(vec3(-slope.x,1.,-slope.y));')
    .replace('vec3 outgoingLight = albedo;',`// Water-only distant warm reflection lobes; they do not light the land.
      vec3 reflected=reflect(-eyeDirection,surfaceNormal);
      float warm=pow(max(0.,dot(reflected,normalize(vec3(-.26,.75,-.60)))),190.);
      float soft=pow(max(0.,dot(reflected,normalize(vec3(.24,.86,-.44)))),22.);
      vec3 environment=vec3(1.,.84,.58)*warm*.050+vec3(.78,.79,.80)*soft*.005;
      float outer=1.-smoothstep(.42,.94,length(p/vec2(22.,16.)));
      float embedded=1.-smoothstep(.04,.20,uLift);
      float shallows=exp(-waterDepth*7.)*embedded;
      // Absorption over the actual submerged shelf connects stone and water.
      // Warm graphite, not sand/gold emission; depth erases the shelf gradually.
      vec3 submergedStone=vec3(.028,.027,.023)*shallows;
      float contactShade=mix(.70,1.,smoothstep(.0,.06,waterDepth));
      vec3 outgoingLight=(vec3(.0022)+submergedStone+reflectionSample*reflectance*.24+environment*mix(1.,.42,shallows))*contactShade*outer;`);
  mat.needsUpdate=true;
  return {water,dispose(){geometry.dispose();normal.dispose();mat.uniforms.mirrorSampler.value.dispose();mat.dispose();}};
}
