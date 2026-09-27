import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as navigation from './incident-navigation.ts';
import {IncidentPanel} from '../operations-console.tsx';

const {incidentPageHref}=navigation;

test('backend Incident navigation retains business date and selected Incident',()=>{
  assert.equal(incidentPageHref('2026-09-27'),'/incidents?source=api&business_date=2026-09-27');
  assert.equal(incidentPageHref('2026-09-27','i-1'),'/incidents?source=api&business_date=2026-09-27&incident_id=i-1');
});

test('Incident list has no back link and detail returns to its dated list',()=>{
  assert.equal(typeof navigation.incidentBackLink,'function');
  assert.equal(navigation.incidentBackLink(null,'2026-09-27'),null);
  assert.deepEqual(navigation.incidentBackLink('i-1','2026-09-27'),{
    href:'/incidents?source=api&business_date=2026-09-27',
    label:'Back to Incidents',
  });
});

test('Overview backend Incident list exposes real list and detail navigation',()=>{
  const snapshot={dashboard:{open_incidents:1},incidents:[{id:'i-1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',detected_at:'2026-09-27T02:00:00Z'}]};
  const html=renderToStaticMarkup(createElement(IncidentPanel,{source:'api',snapshot,businessDate:'2026-09-27',onIncident:()=>{}}));
  assert.match(html,/href="\/incidents\?source=api&amp;business_date=2026-09-27"/);
  assert.match(html,/href="\/incidents\?source=api&amp;business_date=2026-09-27&amp;incident_id=i-1"/);
  assert.match(html,/INC-1/);
  assert.doesNotMatch(html,/Backend incident workspace is not connected|disabled=""/);
});
