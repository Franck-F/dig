import fs from 'fs'; import zlib from 'zlib'; import path from 'path'; import vm from 'vm';
function walk(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,o);else o.push(p);}return o;}
const base='.next/server/app';
const gz=f=>{try{return zlib.gzipSync(fs.readFileSync('.next/'+f)).length}catch{return 0}};
const rows=[];
for(const f of walk(base).filter(f=>f.endsWith('page_client-reference-manifest.js')&&f.split(path.sep).join('/').includes('/mentora/'))){
  const ctx={globalThis:{}}; ctx.globalThis=ctx; vm.createContext(ctx);
  try{vm.runInContext(fs.readFileSync(f,'utf8'),ctx);}catch(e){continue}
  const m=ctx.__RSC_MANIFEST; const set=new Set(); let key='';
  for(const [k,v] of Object.entries(m)){key=k; for(const [p,arr] of Object.entries(v.entryJSFiles||{})) arr.forEach(x=>set.add(x));}
  let t=0; for(const x of set) if(x.endsWith('.js')) t+=gz(x);
  rows.push([key,set.size,Math.round(t/1024)]);
}
rows.sort((a,b)=>b[2]-a[2]); for(const r of rows) console.log(r.join('  '));
