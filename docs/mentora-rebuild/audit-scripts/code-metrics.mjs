import fs from 'fs'; import path from 'path';
function walk(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,o);else o.push(p.split(path.sep).join('/'));}return o;}
const all=walk('src').filter(f=>/[.]tsx?$/.test(f)&&!f.includes('__tests__'));
const scope=all.filter(f=>f.startsWith('src/app/mentora')||f.startsWith('src/lib/mentora')||f.startsWith('src/lib/actions/mentora')||f.startsWith('src/components/app-shell')||f.startsWith('src/app/api/mentora'));
const cnt=(s,r)=>(s.match(r)||[]).length;
let loc=0,inl=0,cls=0,tw=0; const client=[]; const big=[]; const inlFiles=[];
for(const f of scope){const s=fs.readFileSync(f,'utf8'); const n=s.split(String.fromCharCode(10)).length; loc+=n; big.push([n,f]);
 const i=cnt(s,/style=[{][{]/g)+cnt(s,/style=[{][a-zA-Z]/g); inl+=i; if(i)inlFiles.push([i,f]);
 cls+=cnt(s,/className=/g); if(/className=["'`][^"'`]*(flex |grid |p-[0-9]|px-|py-|text-(sm|xs|lg)|rounded|gap-)/.test(s))tw++;
 const head=s.slice(0,300); if(head.includes("'use client'")||head.includes('"use client"'))client.push([n,f]);}
console.log('scope files',scope.length,'LOC',loc);
console.log('use client files',client.length,'LOC in them',client.reduce((a,c)=>a+c[0],0));
console.log('inline style= occurrences',inl,'in files',inlFiles.length,' className occurrences',cls,'files w/ tailwind-like classes',tw);
console.log('top inline',inlFiles.sort((a,b)=>b[0]-a[0]).slice(0,8).map(x=>x.join(' ')).join(' | '));
console.log('top LOC',big.sort((a,b)=>b[0]-a[0]).slice(0,8).map(x=>x.join(' ')).join(' | '));
console.log('client files:'); console.log(client.map(c=>c[1].replace('src/app/mentora/','')+':'+c[0]).join('  '));
// unused exports in lib/mentora + actions
const corpus=all.map(f=>[f,fs.readFileSync(f,'utf8')]);
const unused=[];
for(const f of scope.filter(f=>f.startsWith('src/lib/'))){const s=fs.readFileSync(f,'utf8');
 for(const m of s.matchAll(/export (?:async )?(?:function|const|type|class) ([A-Za-z0-9_]+)/g)){const name=m[1]; const used=corpus.some(([g,t])=>g!==f&&new RegExp('[^A-Za-z0-9_]'+name+'[^A-Za-z0-9_]').test(t)); if(!used)unused.push(f.replace('src/lib/','')+'#'+name);}}
console.log('exports never imported elsewhere',unused.length); console.log(unused.join(' '));
// components never imported
const comps=scope.filter(f=>f.includes('_components/')||f.includes('/_tabs/')||f.startsWith('src/components/app-shell')||/[A-Z][A-Za-z]+[.]tsx$/.test(f));
const unusedC=[]; for(const f of comps){const base=path.basename(f).replace(/[.]tsx?$/,''); const used=corpus.some(([g,t])=>g!==f&&(t.includes('/'+base+"'")||t.includes('/'+base+'"'))); if(!used)unusedC.push(f);} console.log('component files never imported',unusedC.join(' '));
