import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import IncidentFocusPage from './incident-focus-page.tsx';
import {incidentWorkspace} from './incident-mock.ts';

test('Incident Demo keeps impact evidence without dispatcher decision controls',()=>{
  const html=renderToStaticMarkup(createElement(IncidentFocusPage,{data:incidentWorkspace,active:false}));
  assert.match(html,/Affected Orders/);
  assert.match(html,/What Changes/);
  assert.doesNotMatch(html,/Approve Dispatch|>Reject<|>Modify<|Request new candidate/);
});
