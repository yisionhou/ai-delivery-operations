// Isolated local Chrome smoke test. Never attaches to an existing user browser.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=new URL('../',import.meta.url),output=new URL('evidence/shore-splash/',root);
await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'nexus-splash-qa-'));
const executable=process.env.SPLASH_QA_BROWSER??'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser=spawn(executable,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--window-size=1536,1024','about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let socket,id=0;
const waiting=new Map(),errors=[],warnings=[];
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const next=++id;const timeout=setTimeout(()=>{waiting.delete(next);reject(new Error(`Timeout: ${method}`));},30000);waiting.set(next,{resolve,reject,timeout});socket.send(JSON.stringify({id:next,method,params,sessionId}));});}
try{
 let port;for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await pause(100);}}
 if(!port)throw new Error('Isolated Chrome did not start');
 const info=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
 socket=new WebSocket(info.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const entry=waiting.get(message.id);if(entry){clearTimeout(entry.timeout);waiting.delete(message.id);if(message.error)entry.reject(new Error(JSON.stringify(message.error)));else entry.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);else if(message.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(message.params.type)){const text=message.params.args.map(a=>a.value??a.description).join(' ');(message.params.type==='error'?errors:warnings).push(text);}};
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params={})=>send(method,params,sessionId);
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1536,height:1024,deviceScaleFactor:1,mobile:false});
 const evaluate=async(expression,awaitPromise=false)=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 await call('Page.navigate',{url:'http://127.0.0.1:5184/'});
 let ready=false;for(let i=0;i<120;i++){ready=await evaluate(`!!document.querySelector('canvas')?.dataset.seaPreview`);if(ready)break;await pause(250);}
 if(!ready)throw new Error('Preview failed to reach a rendered frame');
 const screenshot=async(name)=>{const image=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL(name,output),Buffer.from(image.data,'base64'));};
 await screenshot('overview.png');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Shore close-up').click()`);await pause(500);
 await screenshot('shore-base.png');
 await evaluate(`window.__splashRecording=new Promise(resolve=>{const stream=document.querySelector('canvas').captureStream(30),chunks=[],r=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:4000000});r.ondataavailable=e=>chunks.push(e.data);r.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};r.start();setTimeout(()=>r.stop(),14000);});true`);
 const samples=[];let captured=false;
 for(let i=0;i<42;i++){await pause(350);const sample=await evaluate(`JSON.parse(document.querySelector('canvas').dataset.seaPreview)`);samples.push(sample);if(!captured&&sample.sprayParticles>0){await screenshot('shore-contact.png');captured=true;}}
 const recording=await evaluate('window.__splashRecording',true);await writeFile(new URL('shore-normal-speed.webm',output),Buffer.from(recording.split(',')[1],'base64'));
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Local spray: On').click()`);await pause(100);const off=await evaluate(`JSON.parse(document.querySelector('canvas').dataset.seaPreview)`);if(off.sprayParticles!==0)throw new Error('Off did not clear spray');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Local spray: Off').click();Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Mock lift').click()`);await pause(1800);const lifted=await evaluate(`JSON.parse(document.querySelector('canvas').dataset.seaPreview)`);if(lifted.sprayParticles!==0||lifted.seaLevel!==-.1)throw new Error('Lift spray suppression failed');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Lower land').click();Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Reset View').click()`);await pause(1800);
 const renderer=await evaluate(`(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';})()`);
 const report={captured,renderer,errors,warnings,samples,off,lifted,profile};await writeFile(new URL('runtime.json',output),JSON.stringify(report,null,2));
 console.log(JSON.stringify({captured,renderer,errors,warnings,sites:samples[0]?.spraySites,emissions:samples.at(-1)?.sprayEmitted,maxParticles:Math.max(...samples.map(s=>s.sprayParticles)),output:output.pathname}));
 if(errors.length)process.exitCode=1;
}finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
 if(browser.exitCode===null)browser.kill();
}
