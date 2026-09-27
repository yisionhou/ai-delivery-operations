import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('Incident detail map explains focused route colors and stop nodes',async()=>{
  const {default:BackendIncidentMap}=await import('./backend-incident-map.tsx');
  const feature={type:'Feature',properties:{incident_id:'i-1',order_id:'o-1',plan:'base',vehicle_id:'v-1',completed:false,origin:'PICKUP'},geometry:{type:'LineString',coordinates:[[103.7,1.3],[103.8,1.4]]}};
  const map={features:[feature],approaches:[],nodes:[{order_id:'o-1',vehicle_id:'v-1',plan:'base',kind:'PICKUP',completed:false,point:[103.7,1.3]},{order_id:'o-1',vehicle_id:'v-1',plan:'base',kind:'DELIVERY',completed:false,point:[103.8,1.4]}],incidentPoint:[103.75,1.35],hasCandidate:true,warnings:[]};
  const html=renderToStaticMarkup(React.createElement(BackendIncidentMap,{map,loading:false}));
  assert.match(html,/Affected order routes/);
  assert.match(html,/Base affected/);
  assert.match(html,/Candidate delivery/);
  assert.match(html,/Completed protected/);
  assert.match(html,/Pickup/);
  assert.match(html,/Handover/);
  assert.match(html,/Delivery/);
  assert.match(html,/2 route nodes/);
  assert.doesNotMatch(html,/whole saved vehicle routes/);
});
