// Optional loopback-only capture sink for this isolated preview. No production route.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const folder=new URL('../evidence/sea-preview-curved/',import.meta.url);
await mkdir(folder,{recursive:true});
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(!['http://localhost:5184','http://127.0.0.1:5184'].includes(origin)){res.writeHead(403).end();return;}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const name=(req.url??'').slice(1);
 if(req.method!=='POST'||!/^([ABC])-(overview|shore|wide)\.(png|webm)$/.test(name)){res.writeHead(400).end();return;}
 try{let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>64*1024*1024)throw new Error('Capture too large');chunks.push(b);}
  const data=Buffer.concat(chunks),png=name.endsWith('.png');
  if(png?!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):!data.subarray(0,4).equals(Buffer.from([26,69,223,163])))throw new Error('Invalid media');
  await writeFile(new URL(name,folder),data);console.log(`Saved ${name} (${data.length} bytes)`);res.writeHead(201).end('saved');
 }catch(e){res.writeHead(400).end(String(e));}
}).listen(5182,'127.0.0.1',()=>console.log(`Sea capture sink: http://localhost:5182 → ${fileURLToPath(folder)}`));
