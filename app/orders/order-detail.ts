import type {Order} from './order-data';

export type OrderStop={id:string;kind:'PICKUP'|'HANDOVER'|'DELIVERY';location:string;planned:string|null;actual:string|null;status:string};
export type OrderDetail={order:Order;businessDate:string;merchantId:string|null;pickup:{id:string|null;name:string;address:string|null};delivery:{id:string|null;name:string;address:string|null};readyAt:string|null;pickupServiceSeconds:number|null;deliveryServiceSeconds:number|null;demand:number|null;planCode:string|null;routeId:string|null;routeNo:number|null;vehicleId:string|null;driverCode:string|null;stops:OrderStop[]};

export function onlyOrderStops<T extends {order_id:string;sequence_no:number}>(stops:T[],orderId:string){
  return stops.filter(stop=>stop.order_id===orderId).sort((a,b)=>a.sequence_no-b.sequence_no);
}

export function mergeListFacts(detail:OrderDetail,listOrder:Order|null):OrderDetail{
  if(!listOrder||listOrder.id!==detail.order.id)return detail;
  return {...detail,order:{...detail.order,eta:listOrder.eta??detail.order.eta,vehicle:detail.order.vehicle??listOrder.vehicle}};
}
