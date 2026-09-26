import type {StyleSpecification} from 'maplibre-gl';

// OneMap visual settings are shared by Operations and the Incident workspace.
export const singaporeBasemapTiles=['https://www.onemap.gov.sg/maps/tiles/GreyLite/{z}/{x}/{y}.png'];
export const singaporeBounds:[[number,number],[number,number]]=[[103.50,1.15],[104.12,1.57]];
export function singaporeBasemapStyle():StyleSpecification{return {version:8,sources:{onemap:{type:'raster',tiles:singaporeBasemapTiles,tileSize:128,minzoom:11,maxzoom:19,bounds:[103.502,1.16,104.11475,1.56073]}},layers:[{id:'background',type:'background',paint:{'background-color':'#081216'}},{id:'onemap',type:'raster',source:'onemap',paint:{'raster-saturation':-1,'raster-brightness-min':.66,'raster-brightness-max':.025,'raster-contrast':.05}}]};}
