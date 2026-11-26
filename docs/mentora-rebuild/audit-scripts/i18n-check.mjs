import fs from 'fs'; import path from 'path';
const fr=JSON.parse(fs.readFileSync('messages/fr.json','utf8')), en=JSON.parse(fs.readFileSync('messages/en.json','utf8'));
function flat(o,p='',out={}){for(const[k,v]of Object.entries(o)){const kk=p?p+'.'+k:k; if(v&&typeof v==='object'&&!Array.isArray(v))flat(v,kk,out); else out[kk]=v;} return out;}
const F=flat(fr.mentora||{}),E=flat(en.mentora||{});
console.log('mentora keys fr',Object.keys(F).length,'en',Object.keys(E).length);
const oF=Object.keys(F).filter(k=>!(k in E)),oE=Object.keys(E).filter(k=>!(k in F));
console.log('only fr',oF.length,oF.slice(0,5).join(','),'| only en',oE.length,oE.slice(0,5).join(','));
function walk(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,o);else o.push(p.split(path.sep).join('/'));}return o;}
const files=walk('src').filter(f=>/[.]tsx?$/.test(f)&&!f.includes('__tests__'));
const src=files.map(f=>fs.readFileSync(f,'utf8')).join(' ');
const toks=new Set(src.match(/[A-Za-z0-9_]+/g));
const un=Object.keys(F).filter(k=>!toks.has(k.split('.').pop()));
console.log('mentora keys whose leaf name never appears in src:',un.length); 
const top={}; for(const k of un){const t=k.split('.').slice(0,2).join('.'); top[t]=(top[t]||0)+1;} console.log(JSON.stringify(Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,10)));
const types=['REQUEST_RECEIVED','REQUEST_ACCEPTED','REQUEST_DECLINED','SESSION_SCHEDULED','SESSION_REMINDER','SESSION_CANCELLED','MENTOR_APPROVED'];
for(const t of types) console.log(t,'subject fr',('notifications.emails.'+t+'.subject') in F,'en',('notifications.emails.'+t+'.subject') in E);
console.log('SESSION_SCHEDULED body fr:',F['notifications.emails.SESSION_SCHEDULED.body']);
const acc='éèêàùçôîâû'; let hard=0; const hf={};
for(const f of files.filter(f=>f.startsWith('src/app/mentora')||f.startsWith('src/components/app-shell'))){ let c=0; for(const l of fs.readFileSync(f,'utf8').split(String.fromCharCode(10))){const t=l.trim(); if(t.startsWith('//')||t.startsWith('*')||t.startsWith('/*')||t.startsWith('import'))continue; if(![...t].some(ch=>acc.includes(ch)))continue; if(/<[^>]*>[^<>{}]*[a-z]{3,}|^[A-Z][^=;{}]*$|(placeholder|title|aria-label|label|description)[:=]/.test(t))c++;} if(c){hf[f]=c;hard+=c;}}
console.log('lines w/ accented hard-coded text',hard,'in',Object.keys(hf).length,'files'); console.log(Object.entries(hf).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0].replace('src/','')+':'+x[1]).join(' '));
const g=(r)=>{let n=0;for(const f of ['messages/fr.json']){n+=(fs.readFileSync(f,'utf8').match(r)||[]).length}return n};
console.log('mentorée',g(/mentorée/gi),'mentoré',g(/mentoré/gi),'mentee(s) fr',g(/mentee/gi), 'filleul',g(/filleul/gi),'binôme',g(/binôme/gi));
