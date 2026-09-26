type Props={start:string;current:string;end:string;percent:number;leftCaption:string;middleCaption:string;rightCaption:string;indicatorLabel:string;currentPrefix?:string};
export default function VehicleTimeGauge({start,current,end,percent,leftCaption,middleCaption,rightCaption,indicatorLabel,currentPrefix='Current time'}:Props){
  return <div className="vf-time-gauge"><div className="vf-time-labels"><time>{start}</time><span>{currentPrefix} {current}</span><time>{end}</time></div><div className="vf-time-line"><span className="vf-time-now" style={{left:`${percent}%`}} aria-label={indicatorLabel}/></div><div className="vf-time-caption"><span>{leftCaption}</span><span className="vf-time-countdown" role="timer" aria-live="off">{middleCaption}</span><span>{rightCaption}</span></div></div>;
}
