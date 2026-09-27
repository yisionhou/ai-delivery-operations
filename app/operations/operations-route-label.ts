import type {Route} from './operations-data';

export function roadAlignmentLabel(routes: Pick<Route,'id'|'roadAligned'>[], selectedRoute: string|null): string {
  const selected=routes.find(route=>route.id===selectedRoute);
  if(selected)return selected.roadAligned?'ROAD-ALIGNED ROUTE · OSRM':'UNVERIFIED ROUTE · NOT ROAD-ALIGNED';
  if(routes.every(route=>route.roadAligned))return 'ROAD-ALIGNED ROUTES · OSRM';
  if(routes.some(route=>route.roadAligned))return 'MIXED ROAD ALIGNMENT · SELECT A ROUTE';
  return 'UNVERIFIED ROUTES · NOT ROAD-ALIGNED';
}
