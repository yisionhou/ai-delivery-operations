import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('All Incidents renders comparable columns and a dated detail action',async()=>{
  const {default:IncidentIndexTable}=await import('./incident-index-table.tsx');
  const items=[{id:'incident-1',incident_code:'INC-001',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',business_date:'2026-09-27',detected_at:'2026-09-27T02:00:00Z'}];
  const html=renderToStaticMarkup(React.createElement(IncidentIndexTable,{items,date:'2026-09-27'}));
  assert.match(html,/<table/);
  for(const heading of ['Incident','Type','Status','Detected','Action'])assert.match(html,new RegExp(`<th[^>]*>${heading}<\/th>`));
  assert.match(html,/<td[^>]*>INC-001<\/td>/);
  assert.match(html,/VEHICLE UNAVAILABLE/);
  assert.match(html,/href="\/incidents\?source=api&amp;business_date=2026-09-27&amp;incident_id=incident-1"/);
  assert.match(html,/>View</);
  assert.doesNotMatch(html,/class="bi-list"/);
});

test('All Incidents retains an explicit empty state',async()=>{
  const {default:IncidentIndexTable}=await import('./incident-index-table.tsx');
  const html=renderToStaticMarkup(React.createElement(IncidentIndexTable,{items:[],date:'2026-09-27'}));
  assert.match(html,/No Incidents for this business date/);
  assert.doesNotMatch(html,/<table/);
});
