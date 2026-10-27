// Automatic local saving and private-link record sync. Original files stay local.
(()=>{
const ACCESS='levin-record-access-v1',cfg=globalThis.LEVIN_SHARED_CONFIG||{};
let access=localStorage.getItem(ACCESS)||'',busy=false,applying=false,retryAt=0,lastPull=0;
const revisions=new WeakMap(),sent=new WeakMap(),conflicts=new WeakSet();
let state='已自动保存在本机';
const incoming=location.hash.match(/^#workspace=([A-Za-z0-9_-]{43,100})$/);
if(incoming){access=incoming[1];localStorage.setItem(ACCESS,access);history.replaceState(null,'',location.pathname+location.search)}
const data=x=>{const y=SharedStore.productData(x);for(const k of ['attachmentKey','history','quoteFiles','sageFiles','productFiles','imageFiles','quoteName'])delete y[k];return y};
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const signature=x=>canonical(data(x));
// Restore acknowledged snapshots after reload, before deciding a record is dirty.
for(const x of products){try{if(x.sharedFingerprint)sent.set(x,signature(JSON.parse(x.sharedFingerprint)))}catch{}}
function status(text){state=text;const e=$('#record-save-status');if(e)e.textContent=text}
function persistNow(){localStorage.setItem(KEY,JSON.stringify(products))}
const previousPersist=persist;
persist=function(){if(applying)return previousPersist();try{persistNow();status(access?'已保存本机，等待同步':'已自动保存在本机')}catch{status('本机保存失败，请保留页面并检查存储空间')}};
async function rpc(name,args){const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_access_key:access,...args}),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.message||'同步请求失败');return result}
function eligible(x){return /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x.id||'')&&x.updated!=='演示样例'}
async function pull(){const rows=await rpc('read_levin_records',{});let changed=false;
for(const row of rows){if(!row.data||row.data.id!==row.sku)throw Error('远端产品编号不一致');const matches=products.filter(x=>x.id===row.sku&&x.updated!=='演示样例');if(matches.length>1){for(const x of matches)conflicts.add(x);status('同一编号有多份本机记录，请先核对');continue}const existing=matches[0];
if(existing&&['id','name','description','colors','imprint'].every(k=>(existing[k]||'')===(row.data[k]||''))){
const clean=sent.get(existing)===signature(existing);let filled=false;
const localRequest=existing.copyGenerationRequest,remoteRequest=row.data.copyGenerationRequest;
if(localRequest?.id&&localRequest.id===remoteRequest?.id&&JSON.stringify(localRequest)!==JSON.stringify(remoteRequest)){
existing.copyGenerationRequest=structuredClone(remoteRequest);filled=true;
if(remoteRequest.state==='done'){
if(remoteRequest.type==='scene'){for(const k of ['sceneVariants','sceneVariantHistory','promptRefresh'])if(row.data[k]!==undefined)existing[k]=structuredClone(row.data[k])}

if(row.data.codexResult?.sections?.length)existing.codexResult=structuredClone(row.data.codexResult);
for(const k of ['seoTitle','seoDescription','copySource','copyVersions'])if(row.data[k]!==undefined)existing[k]=structuredClone(row.data[k]);
}}
if(!existing.codexResult?.sections?.length&&row.data.codexResult?.sections?.length){existing.codexResult=structuredClone(row.data.codexResult);filled=true}
for(const k of ['seoTitle','seoDescription'])if(!existing[k]&&row.data[k]){existing[k]=row.data[k];filled=true}
if(filled){changed=true;if(clean){sent.set(existing,signature(existing));existing.sharedFingerprint=SharedStore.fingerprint(existing)}}}
if(existing&&Number(existing.sharedVersion||0)>=row.version)continue;
if(existing&&sent.get(existing)!==signature(existing)){
 // Keep local edits, but recover missing generated output when product facts match exactly.
 const keys=['id','name','description','colors','imprint'];if(keys.every(k=>(existing[k]||'')===(row.data[k]||''))){if(!existing.codexResult?.sections?.length&&row.data.codexResult?.sections?.length){existing.codexResult=structuredClone(row.data.codexResult);changed=true}for(const k of ['seoTitle','seoDescription'])if(!existing[k]&&row.data[k]){existing[k]=row.data[k];changed=true}}
 conflicts.add(existing);status('本机修改已保留；存在不同版本，请核对');continue}
const record={...row.data,sharedVersion:row.version,sharedUpdatedAt:row.updated_at,history:existing?.history||[],attachmentKey:existing?.attachmentKey};if(existing)Object.assign(existing,record);else products.push(record);const saved=existing||record;sent.set(saved,signature(saved));saved.sharedFingerprint=SharedStore.fingerprint(saved);conflicts.delete(saved);changed=true}
lastPull=Date.now();if(changed){applying=true;persistNow();render();applying=false}}
async function sync(){if(!access||busy||Date.now()<retryAt||!navigator.onLine)return;busy=true;
try{
if(Date.now()-lastPull>15000)await pull();
for(const x of products){if(!eligible(x)||conflicts.has(x))continue;const before=signature(x);if(sent.get(x)===before)continue;status('正在同步产品记录…');const snapshot=data(x);const answer=await rpc('save_levin_record',{p_sku:x.id,p_expected:Number(x.sharedVersion||0),p_data:snapshot,p_state:nextHandoffState(x)});const row=Array.isArray(answer)?answer[0]:answer;if(!row?.version)throw Error('同步未返回保存版本');x.sharedVersion=row.version;x.sharedUpdatedAt=row.updated_at;
// Mark only the exact sent snapshot as synchronized. Edits made in flight stay pending.
sent.set(x,signature(snapshot));x.sharedFingerprint=SharedStore.fingerprint({...snapshot});persistNow();}
if(!products.some(x=>conflicts.has(x)))status('已自动同步');retryAt=0;
}catch(e){if(/版本已变化/.test(e.message)){for(const x of products)if(eligible(x)&&sent.get(x)!==signature(x))conflicts.add(x);status('同步版本冲突，本机修改已保留，请核对')}else{retryAt=Date.now()+15000;status('已保存本机，同步未完成：'+e.message)}}finally{applying=false;busy=false}}
let pendingTimer;
document.addEventListener('input',e=>{if(page!=='editor'||!e.target.closest('#app'))return;const target=p();clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{target.updated=new Date().toLocaleString('zh-CN');target.lastEditedAt=new Date().toISOString();persist();sync()},600)});
document.addEventListener('change',e=>{if(page!=='editor'||!e.target.closest('#app'))return;setTimeout(()=>{persist();sync()},0)},true);
window.addEventListener('pagehide',()=>{try{persistNow()}catch{}});
window.addEventListener('online',()=>{retryAt=0;sync()});
const beforeBind=bind;
bind=function(){beforeBind();const header=document.querySelector('header');if(header&&!$('#record-save-status')){const tag=document.createElement('span');tag.id='record-save-status';tag.setAttribute('role','status');tag.style.cssText='font-size:14px;color:var(--muted);margin-left:12px';header.append(tag)}status(state);for(const id of ['save','shared-push']){const b=$('#'+id);if(b)b.hidden=true}if(page==='products'&&access){const tools=$('#home-local-utilities');if(tools){const button=document.createElement('button');button.textContent='复制同事使用链接';button.onclick=async()=>{await navigator.clipboard.writeText('https://linlinf49-maker.github.io/levin-product-studio/?view=staff#workspace='+access);toast('专用链接已复制，请仅私下发给同事')};tools.append(button)}}};
// Detect async extraction and prompt/copy changes that do not trigger DOM input events.
setInterval(()=>{let changed=false;for(const x of products){const value=JSON.stringify(x);if(revisions.get(x)!==value){revisions.set(x,value);changed=true}}if(changed)persist();sync()},2000);
render();sync();
})();
