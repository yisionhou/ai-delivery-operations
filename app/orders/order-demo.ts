import type {Order} from './order-data';
import type {OrderDetail,OrderStop} from './order-detail';

export const DEMO_DATE='2026-09-27';
export const demoClock=(date:string)=>`${date}T04:44:39+08:00`;
export function demoOrders(date:string):Order[]{
  const anchor=Date.parse(demoClock(date));
  const names=['Fresh Kitchen','River Bento','The Daily Grind','Maple & Co.','Luna Patisserie','Green Market'];
  return Array.from({length:32},(_,i)=>{
    const end=anchor+(i<8?-159000+i*10000:i<12?(i-7)*60000:(i+7)*60000);
    const code=`O-${String(i+21).padStart(3,'0')}`;
    return {id:code,code,merchant:names[i%names.length],execution:i===0?'DELIVERING':i<12?['DELIVERING','PICKUP_IN_PROGRESS','PICKED_UP','PLANNED'][i%4]:['PLANNED','PICKUP_IN_PROGRESS','PICKED_UP','DELIVERING','COMPLETED'][i%5],risk:i<8?'AT_RISK':'NORMAL',assignment:date===DEMO_DATE?'ASSIGNED':null,vehicle:date===DEMO_DATE?`V0${i%7+1}`:null,eta:date===DEMO_DATE?new Date(i===0?anchor+141000:anchor+(i+2)*60000).toISOString():null,windowStart:new Date(end-32*60000).toISOString(),windowEnd:new Date(end).toISOString()};
  });
}

export function demoOrderDetail(id:string,date:string):OrderDetail{
  const order=demoOrders(date).find(item=>item.id===id);
  if(!order)throw new Error('Demo order not found.');
  const special=id==='O-021',pickupName=order.merchant,deliveryName=special?'Queenstown':'Delivery destination not supplied';
  const pickupActual=special?`${date}T04:12:00+08:00`:null;
  const pickupStatus=['PICKED_UP','DELIVERING','COMPLETED'].includes(order.execution)?'COMPLETED':order.execution==='PICKUP_IN_PROGRESS'?'IN_SERVICE':'PLANNED';
  const stops:OrderStop[]=order.assignment?[
    {id:`${id}-pickup`,kind:'PICKUP',location:pickupName,planned:special?`${date}T04:12:00+08:00`:order.windowStart,actual:pickupActual,status:pickupStatus},
    {id:`${id}-delivery`,kind:'DELIVERY',location:deliveryName,planned:order.eta??order.windowEnd,actual:null,status:order.execution==='COMPLETED'?'COMPLETED':'PLANNED'},
  ]:[];
  return {order,businessDate:date,merchantId:null,pickup:{id:null,name:pickupName,address:special?'123 Orchard Rd, Singapore 238854':null},delivery:{id:null,name:deliveryName,address:special?'88 Queenstown Ave, Singapore 149267':null},readyAt:special?`${date}T04:10:00+08:00`:null,pickupServiceSeconds:special?120:null,deliveryServiceSeconds:special?120:null,demand:special?1:null,planCode:order.assignment?'DEMO-PLAN-01':null,routeId:order.assignment?`demo-route-${order.vehicle}`:null,routeNo:order.assignment?1:null,vehicleId:order.vehicle,driverCode:special?'D-01':null,stops};
}
