import * as THREE from 'three';

// Object-space mineral grains: they travel with their terrain and never animate in time.
export function createTerrainMaterial(region: string) {
  const strength = { value: 1 };
  const density = { value: region.startsWith('CENTRAL') ? 1 : region.startsWith('NORTH-EAST') ? .65 : region.startsWith('NORTH') ? .35 : .7 };
  const material = new THREE.MeshPhysicalMaterial({
    color: '#303030', metalness: .18, roughness: .72,
    clearcoat: .08, clearcoatRoughness: .6, envMapIntensity: .8,
    side: THREE.DoubleSide,
  });
  material.userData.shimmerStrength = strength;
  const probe={value:0};material.userData.visibilityProbe=probe;
  material.onBeforeCompile = shader => {
    shader.uniforms.uMineralStrength = strength;
    shader.uniforms.uTerrainProbe=probe;
    shader.uniforms.uUrbanDensity = density;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMineralPosition;\nvarying vec3 vMineralEye;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMineralPosition = position;\nvec3 mineralWorldEye=cameraPosition-(modelMatrix*vec4(position,1.)).xyz;\nvMineralEye=vec3(dot(mineralWorldEye,modelMatrix[0].xyz),dot(mineralWorldEye,modelMatrix[1].xyz),dot(mineralWorldEye,modelMatrix[2].xyz));');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMineralPosition;
      varying vec3 vMineralEye;
      uniform float uMineralStrength;
      uniform float uTerrainProbe;
      uniform float uUrbanDensity;
      vec3 mineralHash(vec2 p) {
        return fract(sin(vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9))))*43758.5453);
      }
      float mineralGrain(vec2 p, vec3 viewDirection) {
        vec2 cell=floor(p); vec3 seed=mineralHash(cell);
        vec2 q=fract(p)-(.22+.56*seed.xy);
        float aa=max(length(fwidth(p)),.015);
        float radius=mix(.06,.19,seed.z);
        float spot=1.-smoothstep(radius-aa*.35,radius+aa*.7,length(q));
        // Filter subpixel fields instead of letting them alias into flashing pixels.
        float lod=1.-smoothstep(.65,1.8,aa);
        vec3 facet=normalize(vec3((seed.x-.5)*1.3,.85,(seed.y-.5)*1.3));
        float reflection=pow(max(dot(facet,viewDirection),0.),24.);
        float rare=smoothstep(.91,.995,seed.z);
        return spot*lod*(.012+reflection*.6*rare);
      }
    `).replace('#include <color_fragment>',`#include <color_fragment>
      // Read the displaced surface elevation: restrained carved-stone tonal
      // hierarchy reinforces the actual broad landform, not fake bump relief.
      float landformTone=.84+.50*smoothstep(.68,1.9,vMineralPosition.y);
      diffuseColor.rgb=mix(diffuseColor.rgb*landformTone,vec3(.32),uTerrainProbe);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float microFilter=1.-smoothstep(.3,1.,length(fwidth(vMineralPosition.xz*85.)));
      float mineralNoise=mix(.5,mineralHash(floor(vMineralPosition.xz*85.)).x,microFilter);
      roughnessFactor=clamp(roughnessFactor+(mineralNoise-.5)*.11,.46,.8);
    `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal=normalize(normal+vec3(mineralNoise-.5,0.,.5-mineralNoise)*.018);
    `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec2 land=vMineralPosition.xz;
      vec3 eye=normalize(vMineralEye);
      float field=mineralGrain(land*32.,eye)+.42*mineralGrain(land*71.+23.7,eye);
      float central=exp(-dot((land-vec2(2.,4.))*.35,(land-vec2(2.,4.))*.35));
      float airport=exp(-pow((land.y+land.x*.22-1.7)*2.,2.))*smoothstep(6.,10.,land.x);
      float clusters=.5+.5*sin(land.x*1.3)*sin(land.y*1.6);
      float urban=.38+uUrbanDensity*(central*.7+airport*.6+clusters*.3);
      float bedFilter=1.-smoothstep(.4,1.5,length(fwidth(land*43.)));
      float bed=mix(.5,mineralHash(floor(land*43.)).y,bedFilter);
      totalEmissiveRadiance+=vec3(.89,.86,.79)*(field*.15+bed*.0035)*urban*uMineralStrength;
    `);
  };
  material.customProgramCacheKey = () => 'nexus-mineral-landform-v3';
  return material;
}

// Stationary, object-space carved facets. Exact shore vertices are not displaced.
export function createCutFaceMaterial(){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,color:'#ffffff',metalness:.14,roughness:.83,envMapIntensity:.8,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCut;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCut=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vCut;
      float cutGrain(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float seam=sin(vCut.y*43.+sin(vCut.x*2.1+vCut.z*1.6)*1.3);
      float grain=cutGrain(floor(vCut*vec3(12.,26.,12.)));
      float grainLod=1.-smoothstep(.3,1.,length(fwidth(vCut*16.)));
      diffuseColor.rgb*=.88+.10*seam+.13*mix(.5,grain,grainLod);
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float relief=.008*sin(vCut.z*11.+vCut.y*7.)*cos(vCut.x*8.-vCut.z*6.);
      vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition);
      vec3 r1=cross(dpdy,normal),r2=cross(normal,dpdx);
      float determinant=dot(dpdx,r1);
      if(abs(determinant)>1e-10)normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(relief)*r1+dFdy(relief)*r2));
    `);
  };
  material.customProgramCacheKey=()=> 'nexus-carved-cut-v1';return material;
}
