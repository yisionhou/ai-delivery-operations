'use client';
/* eslint-disable react-hooks/immutability -- Isolated Three.js refs/uniforms are imperative GPU state. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import {buildCoast,type Feature,type P} from './sea-model';
import {createSea} from './sea-water';
import {createShoreSplash} from './shore-splash';
type Stats={fps:number;p95:number;calls:number;triangles:number;segments:number};
const names=['A','B','C'];
type Props={features:Feature[];mode:number;lift:boolean;view:string;reset:number;spray:boolean;report:(s:Stats)=>void};
function Scene({features,mode,lift,view,reset,spray,report}:Props){
 const model=useMemo(()=>buildCoast(features),[features]);
 const sea=useMemo(()=>createSea(model.mask),[model]);
 const splash=useMemo(()=>createShoreSplash(model.apron,model.mask),[model]);
 const land=useRef<THREE.Group>(null),time=useRef(0),samples=useRef<number[]>([]),last=useRef(0);
 const {camera,gl,size}=useThree();
 const controls=useRef<OrbitControls|null>(null);
 useEffect(()=>{const c=new OrbitControls(camera,gl.domElement);c.enablePan=false;c.enableDamping=true;c.minPolarAngle=.46;c.maxPolarAngle=.91;c.minDistance=16;c.maxDistance=43;c.minAzimuthAngle=-.22;c.maxAzimuthAngle=.42;controls.current=c;return()=>c.dispose();},[camera,gl]);
 useEffect(()=>{
  const scale=view==='shore'?.51:view==='wide'?1.20:1;
  const target=view==='shore'?new THREE.Vector3(.7,0,1.5):new THREE.Vector3(.7,0,0);
  camera.position.copy(target).add(new THREE.Vector3(2,27.5,19.6).multiplyScalar(scale));camera.lookAt(target);controls.current?.target.copy(target);controls.current?.update();
 },[camera,view,reset]);
 useEffect(()=>{time.current=0;samples.current=[];last.current=0;},[mode,reset]);
 useEffect(()=>()=>{splash.dispose();sea.dispose();model.geometry.dispose();model.apron.dispose();model.mask.dispose();},[splash,sea,model]);
 useFrame((_,dt)=>{
  time.current+=dt;sea.water.material.uniforms.time.value=time.current;
  sea.water.material.uniforms.uMode.value=mode;
  if(land.current){land.current.position.y=THREE.MathUtils.damp(land.current.position.y,lift?1.3:0,2.3,dt);sea.water.material.uniforms.uLift.value=land.current.position.y;}
  splash.update(time.current,mode,land.current?.position.y??0,size.height*gl.getPixelRatio(),(camera as THREE.PerspectiveCamera).fov,gl.getPixelRatio(),spray);
  controls.current?.update();samples.current.push(dt*1000);
  if(time.current-last.current>=1){const a=samples.current,sorted=[...a].sort((x,y)=>x-y);report({fps:1000/(a.reduce((s,x)=>s+x,0)/a.length),p95:sorted[Math.floor(sorted.length*.95)]??0,calls:gl.info.render.calls,triangles:gl.info.render.triangles,segments:model.segments});samples.current=[];last.current=time.current;}
  gl.domElement.dataset.seaPreview=JSON.stringify({mode:names[mode-1],time:time.current,lift:land.current?.position.y,seaLevel:sea.water.position.y,camera:camera.position.toArray(),exposure:gl.toneMappingExposure,spraySites:splash.state.sites.length,sprayEmitted:splash.state.emitted,sprayParticles:splash.points.geometry.drawRange.count});
 });
 return <>
  <color attach="background" args={['#000000']}/>
  <ambientLight intensity={.48}/><directionalLight position={[-12,24,14]} intensity={3.51} color="#f1e5d0"/><directionalLight position={[10,11,-10]} intensity={1.365} color="#deddd6"/>
  <group ref={land}>
   <mesh geometry={model.geometry}><meshStandardMaterial color="#252525" roughness={.88} metalness={.06}/></mesh>
   <mesh geometry={model.apron}><meshStandardMaterial vertexColors roughness={.73} metalness={.04}/></mesh>
  </group>
  <primitive object={sea.water}/>
  <primitive object={splash.points}/>
 </>;
}
const button:React.CSSProperties={padding:'9px 15px',border:'1px solid #514735',borderRadius:7,color:'#e5d9bf',background:'#151613',cursor:'pointer'};
export default function SeaPreview(){
 const [features,setFeatures]=useState<Feature[]>([]),[error,setError]=useState(''),[mode,setMode]=useState(3),[lift,setLift]=useState(false),[view,setView]=useState('overview'),[reset,setReset]=useState(0);
 const [stats,setStats]=useState<Stats|null>(null),[status,setStatus]=useState(''),[recording,setRecording]=useState(false),[video,setVideo]=useState('');
 const [spray,setSpray]=useState(true);
 const canvas=useRef<HTMLCanvasElement|null>(null),recorder=useRef<MediaRecorder|null>(null);
 useEffect(()=>{let live=true;Promise.all([fetch('/data/singapore-regions.geojson').then(r=>r.json() as Promise<{features:Feature[]}>),fetch('/data/singapore-coastlines.json').then(r=>r.json() as Promise<Record<string,P[][]>>)]).then(([g,c])=>{if(live)setFeatures(g.features.map((f:Feature)=>({...f,properties:{...f.properties,COASTLINES:c[f.properties.REGION_N]}})));}).catch(e=>setError(String(e)));return()=>{live=false;};},[]);
 useEffect(()=>()=>{if(video)URL.revokeObjectURL(video);},[video]);
 useEffect(()=>()=>{if(recorder.current?.state==='recording')recorder.current.stop();},[]);
 async function save(blob:Blob,name:string){
  try{const r=await fetch(`http://localhost:5182/${name}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob});if(!r.ok)throw new Error(`Evidence server ${r.status}`);setStatus(`Saved ${name}`);}
  catch{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);setStatus(`Downloaded ${name} (local evidence service unavailable)`);}
 }
 function snapshot(){const c=canvas.current;if(!c)return;c.toBlob(b=>{if(b)void save(b,`${names[mode-1]}-${view}.png`);});}
 function record(){const c=canvas.current;if(!c||recording)return;
  if(!window.MediaRecorder){setStatus('MediaRecorder unavailable');return;}
  const stream=c.captureStream(30),parts:Blob[]=[];
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const r=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});recorder.current=r;
  r.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
  r.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setRecording(false);const blob=new Blob(parts,{type:'video/webm'});setVideo(URL.createObjectURL(blob));void save(blob,`${names[mode-1]}-${view}.webm`);};
  r.onerror=()=>{stream.getTracks().forEach(t=>t.stop());setRecording(false);setStatus('Recording failed');};
  r.start();setRecording(true);setStatus('Recording 10 seconds at normal speed');setTimeout(()=>{if(r.state==='recording')r.stop();},10000);
 }
 return <main style={{height:'100dvh',minHeight:650,background:'#000',color:'#d8d4c9',fontFamily:'Arial,sans-serif',display:'flex',flexDirection:'column',overflow:'auto'}}>
  <header style={{padding:'20px 28px',borderBottom:'1px solid #292822',display:'flex',justifyContent:'space-between',gap:20}}><div><small style={{color:'#a18d60',letterSpacing:3}}>NEXUS / MATERIAL STUDY 01</small><h1 style={{font:'28px Georgia',margin:'9px 0'}}>Black coastal sea</h1><span style={{color:'#8b8b82',fontSize:12}}>ISOLATED PREVIEW · Production map untouched · Real southern-west coast sample</span></div><a style={{color:'#bca77b'}} href="http://localhost:5173/">Back to production</a></header>
  <section style={{padding:'12px 28px',display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
   {names.map((name,i)=><button key={name} disabled={recording} onClick={()=>setMode(i+1)} style={{...button,background:mode===i+1?'#493c22':'#151613'}}>{name} · {['Normals','Geometry','Shore contact'][i]}</button>)}
   <span style={{fontSize:12,color:'#8e897e'}}>54° view · 30° FOV · ACES 1.2 · Water y −0.10</span>
  </section>
  <section style={{flex:1,minHeight:420,position:'relative'}}>
   {features.length>0&&<Canvas camera={{position:[2.7,27.5,19.6],fov:30,near:.1,far:120}} dpr={[1,1.45]} gl={{antialias:true,alpha:false,preserveDrawingBuffer:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.2}} onCreated={({gl})=>{canvas.current=gl.domElement;}}><Scene features={features} mode={mode} lift={lift} view={view} reset={reset} spray={spray} report={setStats}/></Canvas>}
   <aside style={{position:'absolute',left:28,top:16,pointerEvents:'none',fontSize:12,lineHeight:1.8,color:'#a39c8e'}}>JURONG COAST / OFFSHORE ISLANDS<br/>Curved coast · shallow shelf · dark outer sea<br/>{error||'Drag to orbit · scroll to inspect'}</aside>
  </section>
  <footer style={{padding:'12px 28px',borderTop:'1px solid #25241f',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
   {['overview','shore','wide'].map(v=><button disabled={recording} key={v} style={button} onClick={()=>setView(v)}>{v==='shore'?'Shore close-up':v==='wide'?'Wide fade':'Overview'}</button>)}
   <button disabled={recording} style={button} onClick={()=>{setView('overview');setReset(r=>r+1);}}>Reset View</button>
   <button style={button} onClick={()=>setLift(v=>!v)}>{lift?'Lower land':'Mock lift'}</button>
   <button style={button} aria-pressed={spray} onClick={()=>setSpray(v=>!v)}>Local spray: {spray?'On':'Off'}</button>
   <button style={button} onClick={snapshot}>Save frame</button><button style={button} disabled={recording} onClick={record}>{recording?'Recording…':'Record 10s'}</button>
   <output style={{fontSize:11,color:'#b0a58b'}}>{stats?`${stats.fps.toFixed(1)} fps · p95 ${stats.p95.toFixed(1)} ms · ${stats.triangles.toLocaleString()} triangles · ${stats.segments} real coast segments`:'Loading coastal data…'}</output>
   <span role="status" style={{fontSize:12,width:'100%'}}>{status}</span>
  </footer>
  {video&&<details style={{position:'absolute',right:28,bottom:110,padding:12,background:'#111',border:'1px solid #494131',zIndex:5}}><summary>Recorded 1× playback</summary><button style={button} onClick={e=>{const v=e.currentTarget.parentElement?.querySelector('video');if(v){v.currentTime=0;v.playbackRate=1;void v.play();}}}>Play at 1×</button><video aria-label="Sea recording playback" src={video} controls muted playsInline style={{width:620,maxWidth:'80vw',display:'block'}}/></details>}
 </main>;
}
