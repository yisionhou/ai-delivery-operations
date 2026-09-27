import {AlertTriangle,ArrowUpRight} from 'lucide-react';
import type {IncidentIndexItem} from './incident-read-api';

const readable=(value:string)=>value.replaceAll('_',' ');
const timestamp=(value:string)=>new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

export default function IncidentIndexTable({items,date}:{items:IncidentIndexItem[];date:string}){
  return <section className="vf-card bi-card bi-incidents-panel">
    <header className="bi-incidents-heading"><AlertTriangle aria-hidden="true"/><div><h2>All Incidents <span className="bi-count">{items.length}</span></h2><p>Incidents recorded for {date}. Open one to review its affected orders and recovery history.</p></div></header>
    {items.length?<div className="bi-incidents-scroll"><table className="bi-incidents-table" aria-label="All Incidents"><thead><tr><th scope="col">Incident</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Detected</th><th scope="col">Action</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.incident_code}</td><td>{readable(item.incident_type)}</td><td><span className="bi-incident-status">{readable(item.status)}</span></td><td><time dateTime={item.detected_at}>{timestamp(item.detected_at)}</time></td><td><a className="bi-incident-view" href={`/incidents?${new URLSearchParams({source:'api',business_date:date,incident_id:item.id})}`}>View<ArrowUpRight aria-hidden="true"/></a></td></tr>)}</tbody></table></div>:<p className="vf-muted">No Incidents for this business date. Choose another date or open an Incident linked from Vehicles or Operations.</p>}
  </section>;
}
