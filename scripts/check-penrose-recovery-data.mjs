import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
// Compile the pure data modules in memory; no generated production files or new runtime.
const cache=new Map();
function load(file){
 const absolute=path.resolve(file);
 if(cache.has(absolute))return cache.get(absolute);
 const compiled={exports:{}};cache.set(absolute,compiled.exports);
 const code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const run=vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:absolute});
 run(id=>load(path.resolve(path.dirname(absolute),id+'.ts')),compiled,compiled.exports);
 return compiled.exports;
}
const {createRecoveryDemo,loadRecoveryDemo}=load('app/agent/recovery-demo.ts');
const {validateRecoveryResult}=load('app/agent/recovery-types.ts');
for(let n=0;n<=3;n++){
 const data=validateRecoveryResult(createRecoveryDemo(n));
 assert.equal(data.candidates.length,n);
 for(const candidate of data.candidates){
  const changed=candidate.orderReassignments.filter(o=>o.fromResource!==o.toResource);
  assert.equal(changed.length,candidate.reassignedOrdersCount);
  assert.deepEqual(new Set(candidate.routeImpact.recoveryRoutes.flatMap(r=>r.stops)),new Set(changed.map(o=>o.orderId)));
  assert.ok(candidate.orderReassignments.every(o=>o.toResource!=='V03'));
 }
}
const custom=createRecoveryDemo(3);custom.recommendedCandidateId='B';validateRecoveryResult(custom);
custom.candidates[0].title='Changed';assert.notEqual(createRecoveryDemo(3).candidates[0].title,'Changed');
assert.throws(()=>createRecoveryDemo(4));
const duplicate=createRecoveryDemo(3);duplicate.candidates[1].id='A';assert.throws(()=>validateRecoveryResult(duplicate));
const invalid=createRecoveryDemo(1);invalid.candidates[0].reassignedOrdersCount=3;assert.throws(()=>validateRecoveryResult(invalid));
const controller=new AbortController();
const pending=loadRecoveryDemo({incidentId:'INC-014',demoCandidateCount:3,signal:controller.signal});
controller.abort();await assert.rejects(pending,{name:'AbortError'});
console.log('PASS: counts 0–3; assignment/map consistency; unavailable resource removed; recommendation by ID; independent fixtures; invalid totals/IDs rejected; cancellation.');
