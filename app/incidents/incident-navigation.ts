export function incidentPageHref(businessDate:string,incidentId?:string){
  const params=new URLSearchParams({source:'api'});
  if(businessDate)params.set('business_date',businessDate);
  if(incidentId)params.set('incident_id',incidentId);
  return `/incidents?${params}`;
}

export function incidentBackLink(incidentId:string|null,businessDate:string){
  return incidentId?{href:incidentPageHref(businessDate),label:'Back to Incidents'}:null;
}
