import fs from 'node:fs';import path from 'node:path';import ts from '../node_modules/typescript/lib/typescript.js';
const root=process.cwd(),exts=['.ts','.tsx','.js','.jsx','.mjs'];const files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(exts.includes(path.extname(p)))files.push(path.relative(root,p).replaceAll('\\','/'));}}walk(path.join(root,'src'));const set=new Set(files),g=new Map();
function resolve(from,spec){if(!spec.startsWith('.'))return null;const b=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));for(const c of [b,...exts.map(x=>b+x),...exts.map(x=>b+'/index'+x)])if(set.has(c))return c;return null;}
for(const f of files){const s=fs.readFileSync(f,'utf8'),sf=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS),deps=[];for(const st of sf.statements)if(ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)){const r=resolve(f,st.moduleSpecifier.text);if(r)deps.push(r);}g.set(f,deps);}
const start='src/App.tsx',seen=new Set([start]),parent=new Map(),q=[start];while(q.length){const f=q.shift();for(const d of g.get(f)||[])if(!seen.has(d)){seen.add(d);parent.set(d,f);q.push(d);}}
const targets=[...seen].filter(f=>{const s=fs.readFileSync(f,'utf8');return /from ['"]typescript['"]/.test(s)||/from ['"]sql\.js['"]/.test(s)||/from ['"]@babel\//.test(s)});
for(const f of targets){let x=f,c=[];while(x){c.push(x);x=parent.get(x);}console.log(c.reverse().join(' -> '));}
console.log(JSON.stringify({appStaticReachable:seen.size,heavyTargets:targets.length},null,2));
