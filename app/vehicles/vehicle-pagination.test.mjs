import test from 'node:test';
import assert from 'node:assert/strict';
import {pageFleetVehicles} from './vehicle-data.ts';

const vehicle=(id,status='ACTIVE')=>({id,code:id,name:id,status,capacity:1,recordedLocation:null,recordedAt:null,incidentId:null,driver:null,routeId:null,routeStatus:null});

test('server page is displayed as returned, including completed-route vehicles',()=>{
  const completed={...vehicle('V-10'),routeId:'R-10',routeStatus:'COMPLETED'};
  const fleet={source:'API',businessDate:'2026-09-25',hasCurrentPlan:true,vehicles:[completed,vehicle('V-09')],pagination:{page:2,pageSize:2,total:5,counts:{total:5,active:5,available:0,exception:0}}};
  const result=pageFleetVehicles(fleet,'all',2,2);
  assert.deepEqual(result.vehicles.map(item=>item.id),['V-09','V-10']);
  assert.deepEqual({page:result.page,pages:result.pages,total:result.total},{page:2,pages:3,total:5});
});

test('demo collection keeps local status filtering and pagination',()=>{
  const fleet={source:'DEMO',businessDate:'2026-09-25',hasCurrentPlan:true,vehicles:[vehicle('V-03','AVAILABLE'),vehicle('V-02'),vehicle('V-01'),vehicle('V-04','UNAVAILABLE')]};
  const result=pageFleetVehicles(fleet,'active',2,1);
  assert.deepEqual(result.vehicles.map(item=>item.id),['V-02']);
  assert.deepEqual({page:result.page,pages:result.pages,total:result.total},{page:2,pages:2,total:2});
});
