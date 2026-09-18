import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const files=[];
const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else files.push(full);}};
walk(path.join(root,'src'));
const sourceFiles=files.filter(file=>/\.(ts|tsx)$/.test(file));
const failures=[];
for(const file of sourceFiles){
  const relative=path.relative(root,file).replaceAll('\\','/');
  const text=fs.readFileSync(file,'utf8');
  if(text.includes('nonLlmRuntimeService'))failures.push(`LEGACY_RUNTIME_SYMBOL:${relative}`);
  if(text.includes('NonLlmTeacherConfig'))failures.push(`LEGACY_TEACHER_TYPE:${relative}`);
  if(/autoLoadDownloadedModelIfAvailable\s*\(/.test(text))failures.push(`LOCAL_MODEL_AUTOLOAD:${relative}`);
  if(/deterministicRuntimeService\.loadModel\s*\(/.test(text))failures.push(`LOCAL_MODEL_LOAD_CALL:${relative}`);
}
if(fs.existsSync(path.join(root,'src/miki/safety/services/nonLlmRuntimeService.ts')))failures.push('LEGACY_RUNTIME_FILE_PRESENT');
if(!fs.existsSync(path.join(root,'src/miki/safety/services/deterministicRuntimeService.ts')))failures.push('DETERMINISTIC_RUNTIME_FILE_MISSING');
const report={version:31,passed:failures.length===0,checkedFiles:sourceFiles.length,failures};
fs.writeFileSync('LEGACY_RUNTIME_REMOVAL_V31.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
