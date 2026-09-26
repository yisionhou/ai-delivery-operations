// Same-origin read-only bridge. No credentials or backend URLs enter the UI.
// Backend must be running separately; no automatic mock fallback or mutations.
const allowed=/^(vehicles(?:\/[a-zA-Z0-9-]+)?|operations\/(?:vehicles|orders|dashboard)|vehicle-routes\/[a-zA-Z0-9-]+\/stops|incidents(?:\/[a-zA-Z0-9-]+)?|orders(?:\/[a-zA-Z0-9-]+)?)$/;
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params,resource=path.join('/');
  if(!allowed.test(resource))return Response.json({success:false,code:'NOT_FOUND',message:'This read endpoint is not registered.',data:null,request_id:'frontend'},{status:404});
  const base=process.env.PENROSE_API_URL??'http://127.0.0.1:8000';
  try{
    const target=new URL('/api/'+resource,base);target.search=new URL(request.url).search;
    const response=await fetch(target,{signal:AbortSignal.timeout(10000),cache:'no-store',redirect:'error'});
    return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')??'application/json','Cache-Control':'no-store'}});
  }catch{
    return Response.json({success:false,code:'BACKEND_UNAVAILABLE',message:'PenroseRoute is not reachable. Start the configured backend, then retry. Demo data is available separately.',data:null,request_id:'frontend'},{status:503});
  }
}
