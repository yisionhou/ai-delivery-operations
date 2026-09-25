import { useEffect, useState, useRef } from 'react';

export type VisibilitySettings={terrainProbe:boolean;rim:'off'|'normal'|'probe';shimmer:boolean;dustProbe:boolean;preview:number;halo:boolean;support:boolean};
export const NORMAL_VISIBILITY:VisibilitySettings={terrainProbe:false,rim:'normal',shimmer:true,dustProbe:false,preview:0,halo:true,support:true};

// Opt-in development UI only. Normal URL and production builds have no diagnostic controls.
export function VisibilityControls({value,onChange}:{value:VisibilitySettings;onChange:(next:VisibilitySettings)=>void}){
  const [enabled,setEnabled]=useState(false);
  const [recording,setRecording]=useState(false),[recordingUrl,setRecordingUrl]=useState('');
  const video=useRef<HTMLVideoElement>(null),[playback,setPlayback]=useState('');
  useEffect(()=>()=>{if(recordingUrl)URL.revokeObjectURL(recordingUrl);},[recordingUrl]);
  const record=()=>{
    const canvas=document.querySelector('canvas');if(!canvas||recording)return;
    const stream=canvas.captureStream(30),chunks:BlobPart[]=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setRecording(false);setRecordingUrl(URL.createObjectURL(new Blob(chunks,{type:'video/webm'})));};
    recorder.start();setRecording(true);setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},12000);
  };
  const saveFrame=()=>{const canvas=document.querySelector('canvas');if(!canvas)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='floating-island-frame.png';a.click();}));};
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query is client-only and not application state.
    setEnabled(process.env.NODE_ENV==='development'&&new URLSearchParams(location.search).has('visualDebug'));
  },[]);
  if(!enabled)return null;
  return <aside aria-label="Visibility diagnostics" style={{position:'absolute',zIndex:12,bottom:60,left:24,background:'#151719',color:'#eee',padding:12,border:'1px solid #8f805f',fontSize:12,display:'flex',gap:10,flexWrap:'wrap',maxWidth:690}}>
    <b>DEV · visibility gates</b>
    <label><input type="checkbox" checked={value.support} onChange={e=>onChange({...value,support:e.target.checked})}/> Support VFX</label>
    <label><input type="checkbox" checked={value.terrainProbe} onChange={e=>onChange({...value,terrainProbe:e.target.checked})}/> Terrain probe</label>
    <label>Rim <select aria-label="Rim mode" value={value.rim} onChange={e=>onChange({...value,rim:e.target.value as VisibilitySettings['rim']})}><option value="off">Off</option><option value="normal">Normal</option><option value="probe">Diagnostic</option></select></label>
    <label><input type="checkbox" checked={value.shimmer} onChange={e=>onChange({...value,shimmer:e.target.checked})}/> Shimmer</label>
    <label><input type="checkbox" checked={value.halo} onChange={e=>onChange({...value,halo:e.target.checked})}/> Edge halo</label>
    <button disabled={recording} onClick={record}>{recording?'Recording 12 seconds…':'Record 12s canvas'}</button>
    <button onClick={saveFrame}>Save canvas frame</button>
    {recordingUrl&&<a href={recordingUrl} download="floating-island-motion.webm">Download motion recording</a>}
    {recordingUrl&&<><button onClick={()=>{if(video.current){video.current.currentTime=0;video.current.playbackRate=1;void video.current.play();}}}>Play recording at 1x</button><video aria-label="Recorded motion playback" ref={video} src={recordingUrl} muted controls style={{width:310,background:'#090909'}} onTimeUpdate={()=>setPlayback(`${video.current?.currentTime.toFixed(1)}s · 1x`)} /><output>{playback}</output></>}
    <button onClick={()=>onChange({...NORMAL_VISIBILITY,preview:value.preview})}>Normal settings</button>
  </aside>;
}
