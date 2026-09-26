import {redirect} from 'next/navigation';

export default async function VehicleDetailPage({params,searchParams}:{params:Promise<{vehicleId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const [{vehicleId},search]=await Promise.all([params,searchParams]);
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(search))if(typeof value==='string')query.set(key,value);
  query.set('selected_vehicle',vehicleId);
  redirect(`/vehicles?${query}`);
}
