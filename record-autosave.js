// Automatic local saving and private-link record sync. Original files stay local.
(()=>{
const ACCESS='levin-record-access-v1',cfg=globalThis.LEVIN_SHARED_CONFIG||{};
let access=localStorage.getItem(ACCESS)||'',busy=false,applying=false,retryAt=0,lastPull=0;
const revisions=new WeakMap(),sent=new WeakMap(),conflicts=new WeakSet();
let state='已自动保存在本机';
const incoming=location.hash.match(/^#workspace=([A-Za-z0-9_-]{43,100})$/);
if(incoming){access=incoming[1];localStorage.setItem(ACCESS,access);history.replaceState(null,'',location.pathname+location.search)}
const data=x=>{const y=SharedStore.productData(x);for(const k of ['attachmentKey','history','quoteFiles','sageFiles','productFiles','imageFiles','quoteName'])delete y[k];return y};
const signature=x=>JSON.stringify(data(x));
function status(text){state=text;const e=$('#record-save-status');if(e)e.textContent=text}
function persistNow(){localStorage.setItem(KEY,JSON.stringify(products))}
const previousPersist=persist;
persist=function(){if(applying)return previousPersist();try{persistNow();status(access?'已保存本机，等待同步':'已自动保存在本机')}catch{status('本机保存失败，请保留页面并检查存储空间')}};
async function rpc(name,args){const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_access_key:access,...args}),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.message||'同步请求失败');return result}
function eligible(x){return /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x.id||'')&&x.updated!=='演示样例'}
async function sync(){if(!access||busy||Date.now()<retryAt||!navigator.onLine)return;busy=true;
try{
for(const x of products){if(!eligible(x)||conflicts.has(x))continue;const before=signature(x);if(sent.get(x)===before)continue;status('正在同步产品记录…');const snapshot=data(x);const answer=await rpc('save_levin_record',{p_sku:x.id,p_expected:Number(x.sharedVersion||0),p_data:snapshot,p_state:nextHandoffState(x)});const row=Array.isArray(answer)?answer[0]:answer;if(!row?.version)throw Error('同步未返回保存版本');x.sharedVersion=row.version;x.sharedUpdatedAt=row.updated_at;
// Mark only the exact sent snapshot as synchronized. Edits made in flight stay pending.
const acknowledged={...snapshot};for(const k of ['sharedVersion','sharedUpdatedAt','sharedFingerprint'])delete acknowledged[k];sent.set(x,JSON.stringify(acknowledged));x.sharedFingerprint=SharedStore.fingerprint({...snapshot});persistNow();}
if(Date.now()-lastPull>15000){const rows=await rpc('read_levin_records',{});let changed=false;for(const row of rows){if(!row.data||row.data.id!==row.sku)throw Error('远端产品编号不一致');const matches=products.filter(x=>x.id===row.sku&&x.updated!=='演示样例');if(matches.length>1){for(const x of matches)conflicts.add(x);status('同一编号有多份本机记录，请先核对');continue}const existing=matches[0];if(existing&&Number(existing.sharedVersion||0)>=row.version)continue;if(existing&&sent.get(existing)!==signature(existing)){conflicts.add(existing);status('存在其他人更新，本机修改已保留，请核对');continue}const record={...row.data,sharedVersion:row.version,sharedUpdatedAt:row.updated_at,history:existing?.history||[],attachmentKey:existing?.attachmentKey};if(existing)products[products.indexOf(existing)]=record;else products.push(record);sent.set(record,signature(record));record.sharedFingerprint=SharedStore.fingerprint(record);changed=true}lastPull=Date.now();if(changed){applying=true;persistNow();render();applying=false}}
if(!products.some(x=>conflicts.has(x)))status('已自动同步');retryAt=0;
}catch(e){if(/版本已变化/.test(e.message)){for(const x of products)if(eligible(x)&&sent.get(x)!==signature(x))conflicts.add(x);status('同步版本冲突，本机修改已保留，请核对')}else{retryAt=Date.now()+15000;status('已保存本机，同步未完成：'+e.message)}}finally{applying=false;busy=false}}
let pendingTimer;
document.addEventListener('input',e=>{if(page!=='editor'||!e.target.closest('#app'))return;clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{if(page==='editor'){p().updated=new Date().toLocaleString('zh-CN');persist();sync()}},600)});
document.addEventListener('change',e=>{if(page!=='editor'||!e.target.closest('#app'))return;setTimeout(()=>{persist();sync()},0)},true);
window.addEventListener('pagehide',()=>{try{persistNow()}catch{}});
window.addEventListener('online',()=>{retryAt=0;sync()});
const beforeBind=bind;
bind=function(){beforeBind();const header=document.querySelector('header');if(header&&!$('#record-save-status')){const tag=document.createElement('span');tag.id='record-save-status';tag.setAttribute('role','status');tag.style.cssText='font-size:14px;color:var(--muted);margin-left:12px';header.append(tag)}status(state);for(const id of ['save','shared-push']){const b=$('#'+id);if(b)b.hidden=true}if(page==='products'&&access){const tools=$('#home-local-utilities');if(tools){const button=document.createElement('button');button.textContent='复制同事使用链接';button.onclick=async()=>{await navigator.clipboard.writeText('https://linlinf49-maker.github.io/levin-product-studio/#workspace='+access);toast('专用链接已复制，请仅私下发给同事')};tools.append(button)}}};
// Detect async extraction and prompt/copy changes that do not trigger DOM input events.
setInterval(()=>{let changed=false;for(const x of products){const value=JSON.stringify(x);if(revisions.get(x)!==value){revisions.set(x,value);changed=true}}if(changed)persist();sync()},2000);
render();sync();
})();
