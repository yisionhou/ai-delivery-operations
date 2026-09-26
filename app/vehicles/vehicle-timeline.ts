type TimedStop={plannedArrival:string|null;plannedDeparture:string|null;actualArrival:string|null;actualDeparture:string|null};
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',hour12:false});
const currentClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'});

function moment(value:string|null,businessDate:string):number|null{
  if(!value)return null;
  if(/^\d{2}:\d{2}$/.test(value)){
    const time=Date.parse(`${businessDate}T${value}:00+08:00`);
    return Number.isFinite(time)?time:null;
  }
  if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const time=Date.parse(value);
  return Number.isFinite(time)?time:null;
}

export function buildStopTimeline(stops:TimedStop[],businessDate:string,now=new Date()){
  const starts=stops.map(stop=>moment(stop.actualArrival??stop.plannedArrival,businessDate)).filter((value):value is number=>value!==null);
  const ends=stops.map(stop=>moment(stop.plannedDeparture??stop.plannedArrival,businessDate)).filter((value):value is number=>value!==null);
  const start=starts.length?Math.min(...starts):null;
  const end=ends.length?Math.max(...ends):null;
  if(start===null||end===null||end<=start)return {startLabel:null,endLabel:null,currentLabel:null,currentPercent:null,remainingLabel:null};
  const currentDate=day.format(now);
  const remainingSeconds=Math.max(0,Math.ceil((end-now.getTime())/1000));
  const hours=Math.floor(remainingSeconds/3600),minutes=Math.floor(remainingSeconds%3600/60),seconds=remainingSeconds%60;
  return {
    startLabel:clock.format(start),endLabel:clock.format(end),
    currentLabel:`${currentDate===businessDate?'':`${currentDate} `}${currentClock.format(now)}`,
    currentPercent:Math.max(0,Math.min(100,(now.getTime()-start)/(end-start)*100)),
    remainingLabel:remainingSeconds?`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:'Ended',
  };
}
