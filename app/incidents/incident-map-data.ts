import type {FeatureCollection,LineString} from 'geojson';
import type {Coordinate,IncidentWorkspace} from './incident-mock';

// Camera framing is centered on the selected incident, with room for its network.
// All coordinates come from that workspace; these functions know no district.
export function incidentFocusBounds(data:IncidentWorkspace):[Coordinate,Coordinate]{
  const {lng,lat}=data.incident.location;
  const points=[...data.affectedOrders.map(order=>order.coordinate),...data.recoveryVehicles.map(vehicle=>vehicle.coordinate),...data.completedStops,...data.routeGeometry.original.coordinates,...Object.values(data.routeGeometry.recovery).flatMap(route=>route.coordinates)];
  const dx=Math.max(.006,...points.map(point=>Math.abs(point[0]-lng)));
  const dy=Math.max(.006,...points.map(point=>Math.abs(point[1]-lat)));
  return [[lng-dx,lat-dy],[lng+dx,lat+dy]];
}
export function incidentOverlayData(data:IncidentWorkspace,changesOnly=false):FeatureCollection<LineString>{
  const {routeGeometry}=data;
  const feature=(geometry:LineString,kind:string,vehicle='')=>({type:'Feature' as const,geometry,properties:{kind,vehicle}});
  const original=changesOnly?data.comparison.mapChanges.base:routeGeometry.original;
  const recovery=changesOnly?data.comparison.mapChanges.candidate:routeGeometry.recovery;
  return {type:'FeatureCollection',features:[feature(original,'original'),...(!changesOnly?[feature(routeGeometry.completed,'completed')]:[]),feature(data.affectedSegmentGeometry,'affected'),...Object.entries(recovery).map(([id,line])=>feature(line,'recovery',id))]};
}
