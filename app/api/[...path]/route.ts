// Same-origin bridge. Only explicitly registered backend resources are exposed.
const allowed=/^(vehicles(?:\/[a-zA-Z0-9-]+)?|operations\/(?:vehicles|orders|dashboard|routes|workspace|simulated-positions|alerts)|vehicle-routes\/[a-zA-Z0-9-]+(?:\/stops)?|incidents(?:\/[a-zA-Z0-9-]+(?:\/(?:affected-orders|recovery-plans|recovery-options))?)?|recovery-plans\/[a-zA-Z0-9-]+(?:\/comparison)?|delivery-plans(?:\/[a-zA-Z0-9-]+(?:\/(?:orders|routes))?)?|orders(?:\/[a-zA-Z0-9-]+)?|merchants\/[a-zA-Z0-9-]+)$/;
const draftPath=/^planning\/drafts(?:\/[0-9a-fA-F-]{36}\/confirm)?$/;
const agentWritePath=/^(?:agent\/dispatch|incidents\/[0-9a-fA-F-]{36}\/(?:recovery|recovery-options)|recovery-plans\/[0-9a-fA-F-]{36}\/approve)$/;
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params,resource=path.join('/');
  if(!allowed.test(resource))return Response.json({success:false,code:'NOT_FOUND',message:'This read endpoint is not registered.',data:null,request_id:'frontend'},{status:404});
  const base=process.env.PENROSE_API_URL??'http://127.0.0.1:8000';
  try{
    const target=new URL('/api/'+resource,base);target.search=new URL(request.url).search;
    const response=await fetch(target,{signal:AbortSignal.timeout(10000),cache:'no-store',redirect:'manual'});
    if(response.status>=300&&response.status<400)return Response.json({success:false,code:'BACKEND_REDIRECT',message:'PenroseRoute returned an unexpected redirect.',data:null,request_id:'frontend'},{status:502});
    return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')??'application/json','Cache-Control':'no-store'}});
  }catch{
    return Response.json({success:false,code:'BACKEND_UNAVAILABLE',message:'PenroseRoute is not reachable. Start the configured backend, then retry. Demo data is available separately.',data:null,request_id:'frontend'},{status:503});
  }
}

export async function POST(request:Request,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params,resource=path.join('/');
  const agentCommand=agentWritePath.test(resource);
  if(!draftPath.test(resource)&&!agentCommand)return Response.json({success:false,code:'NOT_FOUND',message:'This write endpoint is not registered.',data:null,request_id:'frontend'},{status:404});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({success:false,code:'INVALID_REQUEST',message:'Expected a JSON object.',data:null,request_id:'frontend'},{status:400});
  const command=body as Record<string,unknown>;
  if(resource==='planning/drafts'&&(typeof command.business_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(command.business_date)))return Response.json({success:false,code:'INVALID_REQUEST',message:'A business date is required.',data:null,request_id:'frontend'},{status:400});
  if(agentCommand){
    const secret=process.env.PENROSE_DISPATCH_TOKEN;
    if(!secret||secret.length<32)return Response.json({success:false,code:'AGENT_NOT_CONFIGURED',message:'Configure a backend dispatcher credential on the frontend server.',data:null,request_id:'frontend'},{status:503});
    const host=new URL(request.url).hostname;
    const local=process.env.PENROSE_AGENT_LOCAL_ONLY==='true'&&(host==='localhost'||host==='127.0.0.1');
    if(!local){
      if(process.env.PENROSE_AGENT_TRUSTED_AUTH_PROXY!=='true')return Response.json({success:false,code:'DISPATCH_FORBIDDEN',message:'Dispatcher commands require a trusted authentication proxy.',data:null,request_id:'frontend'},{status:403});
      const user=await import('../../chatgpt-auth.ts').then(({getChatGPTUser})=>getChatGPTUser()).catch(()=>null);
      if(!user)return Response.json({success:false,code:'UNAUTHORIZED',message:'Sign in before using dispatcher commands.',data:null,request_id:'frontend'},{status:401});
    }
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return Response.json({success:false,code:'INVALID_REQUEST',message:'JSON content type is required.',data:null,request_id:'frontend'},{status:400});
    if(resource==='agent/dispatch'&&(typeof command.message!=='string'||!command.message.trim()))return Response.json({success:false,code:'INVALID_REQUEST',message:'A question is required.',data:null,request_id:'frontend'},{status:400});
    if(resource.endsWith('/approve')&&(typeof command.decision_reason!=='string'||!command.decision_reason.trim()))return Response.json({success:false,code:'INVALID_REQUEST',message:'A decision reason is required.',data:null,request_id:'frontend'},{status:400});
  }
  const base=process.env.PENROSE_API_URL??'http://127.0.0.1:8000';
  try{
    const headers:Record<string,string>={'Content-Type':'application/json'};
    if(agentCommand)headers.Authorization=`Bearer ${process.env.PENROSE_DISPATCH_TOKEN}`;
    const response=await fetch(new URL('/api/'+resource,base),{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(agentCommand?90000:30000),cache:'no-store',redirect:'manual'});
    if(response.status>=300&&response.status<400)return Response.json({success:false,code:'BACKEND_REDIRECT',message:'PenroseRoute returned an unexpected redirect.',data:null,request_id:'frontend'},{status:502});
    return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')??'application/json','Cache-Control':'no-store'}});
  }catch{
    return Response.json({success:false,code:'BACKEND_UNAVAILABLE',message:'PenroseRoute is not reachable. Start the configured backend, then retry.',data:null,request_id:'frontend'},{status:503});
  }
}
