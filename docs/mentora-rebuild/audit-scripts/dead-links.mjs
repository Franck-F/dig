import fs from 'fs'; import path from 'path';
function walk(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,o);else o.push(p);}return o;}
const files=walk('src').map(f=>f.split(path.sep).join('/'));
const pages=files.filter(f=>f.endsWith('/page.tsx')).map(f=>f.replace('src/app','').replace('/page.tsx','')||'/').map(r=>r.replace(/\/\([^)]+\)/g,''));
const re=pages.map(p=>new RegExp('^'+p.replace(/\[[^\]]+\]/g,'[^/]+')+'$'));
const bad=new Map();
for(const f of files){ if(!/\.tsx?$/.test(f)||f.includes('__tests__'))continue; const s=fs.readFileSync(f,'utf8').split('\n');
 s.forEach((l,i)=>{ for(const m of l.matchAll(/['"`](\/mentora[^'"`?#\s]*)/g)){ let u=m[1].replace(/\$\{[^}]*\}/g,'X').replace(/\/$/,''); if(u==='')u='/mentora'; if(!re.some(r=>r.test(u))){ (bad.get(u)||bad.set(u,[]).get(u)).push(f+':'+(i+1)); } } }); }
for(const [k,v] of bad) console.log(k, v.slice(0,3).join(' | '));
console.log('mentora pages',pages.filter(p=>p.startsWith('/mentora')).length);
