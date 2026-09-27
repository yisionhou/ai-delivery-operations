import type {OverviewSnapshot} from './overview-api.ts';

export function overviewMetrics(snapshot:OverviewSnapshot){
  const {orders,vehicles,open_incidents}=snapshot.dashboard;
  return {orders:orders.total,vehicles:vehicles.available+vehicles.active+vehicles.unavailable,activeVehicles:vehicles.active,atRisk:orders.at_risk,exceptions:open_incidents,onTimeRate:snapshot.dashboard.on_time?.rate??null};
}

export function overviewVehicles(snapshot:OverviewSnapshot){
  if(!snapshot.vehicles)return [];
  const routes=new Map(snapshot.routes?.map(route=>[route.route_id,route])??[]);
  return [...snapshot.vehicles].sort((a,b)=>({ACTIVE:0,UNAVAILABLE:1,AVAILABLE:2}[a.vehicle_status as 'ACTIVE'|'UNAVAILABLE'|'AVAILABLE']??3)-({ACTIVE:0,UNAVAILABLE:1,AVAILABLE:2}[b.vehicle_status as 'ACTIVE'|'UNAVAILABLE'|'AVAILABLE']??3)||a.vehicle_code.localeCompare(b.vehicle_code)).map(vehicle=>{
    const route=routes.get(vehicle.route_id);
    return {...vehicle,route,progress:route&&route.total_stops>0?Math.min(1,Math.max(0,route.completed_stops/route.total_stops)):null};
  });
}
