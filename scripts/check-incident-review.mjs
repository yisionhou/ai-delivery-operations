// Compile this small review check with the existing TypeScript dependency.
// Avoids requiring a separate test runner; all generated files live in work/.
import ts from 'typescript';
import {readFile,readdir,writeFile,mkdir,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'work','incident-review-check');
await mkdir(path.join(output,'app','incidents'),{recursive:true});
await mkdir(path.join(output,'scripts'),{recursive:true});
await writeFile(path.join(output,'package.json'),'{"type":"commonjs"}');
for(const name of await readdir(path.join(root,'app','incidents'))){
 if(!/\.(tsx?|json)$/.test(name))continue;
 const source=await readFile(path.join(root,'app','incidents',name),'utf8');
 const compiled=name.endsWith('.json')?source:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 await writeFile(path.join(output,'app','incidents',name.replace(/\.tsx?$/,'.js')),compiled);
}
let test=await readFile(path.join(root,'scripts','check-incident-review.tsx'),'utf8');
test=test.replace('const original=','(async()=>{\nconst original=')+'\n})().catch(error=>{console.error(error);process.exitCode=1;});';
const compiled=ts.transpileModule(test,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
await writeFile(path.join(output,'scripts','check-incident-review.js'),compiled);
const result=spawnSync(process.execPath,[path.join(output,'scripts','check-incident-review.js')],{stdio:'inherit'});
// Delete only this runner's verified generated directory, never project sources.
if(path.dirname(path.resolve(output))!==path.resolve(root,'work')||path.basename(output)!=='incident-review-check')throw new Error('Unexpected test output path');
await rm(output,{recursive:true,force:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
