import type {RemainingMetric} from '../incidents/incident-types';
export function RemainingTravel({label,metric}:{label:string;metric:RemainingMetric}){
  return <div className="if-metric"><b>{label}</b>{metric.comparable&&metric.base!==null&&metric.candidate!==null?<><span>{metric.base} → {metric.candidate}{metric.delta&&` (${metric.delta})`}</span><small>{metric.baseline}</small></>:<><span className="if-unavailable">Unavailable</span><small>{metric.reason??'Comparable remaining-travel data was not supplied.'}</small></>}</div>;
}