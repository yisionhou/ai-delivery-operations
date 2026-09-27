import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('Incident index map describes affected-order paths and leaves empty geometry honest',async()=>{
  const {default:IncidentIndexMap}=await import('./backend-incident-index-map.tsx');
  const empty=renderToStaticMarkup(React.createElement(IncidentIndexMap,{data:{features:[],incidents:[],warnings:[]},loading:false,date:'2026-09-27'}));
  assert.match(empty,/No affected-order road paths/);
  assert.doesNotMatch(empty,/All orders/);

  const feature={type:'Feature',properties:{incident_id:'i-1',order_id:'o-1',plan:'base',vehicle_id:'v-1',completed:true,origin:'PICKUP'},geometry:{type:'LineString',coordinates:[[103.70,1.30],[103.71,1.31]]}};
  const filled=renderToStaticMarkup(React.createElement(IncidentIndexMap,{data:{features:[feature],incidents:[{id:'i-1',code:'INC-1',point:[103.7596,1.3039]}],warnings:[]},loading:false,date:'2026-09-27'}));
  assert.match(filled,/1 affected-order path/);
  assert.match(filled,/1 Incident location/);
  assert.match(filled,/role="img"/);
});
