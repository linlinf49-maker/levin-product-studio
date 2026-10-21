// Explicit local-to-hosted migration. Private records never enter the code repository.
(()=>{
const hosted='https://linlinf49-maker.github.io',base=hosted+'/levin-product-studio/';
const locals=['http://127.0.0.1:8765','http://localhost:8765'];
const pending=new Map();let receiver=null;
function call(target,origin,nonce,type,data){return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(Error('迁移响应超时，请保留备份后重试'))},120000);pending.set(id,{resolve,reject,timer,target,origin,nonce});target.postMessage({levinMigration:1,nonce,id,type,data},origin)})}
window.addEventListener('message',async e=>{
const m=e.data;if(!m||m.levinMigration!==1)return;
if(m.type==='reply'){const p=pending.get(m.id);if(!p||p.target!==e.source||p.origin!==e.origin||p.nonce!==m.nonce)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.data);return}
const nonce=location.hash.match(/^#migration=([a-f0-9-]{36})$/)?.[1];
if(!nonce||m.nonce!==nonce||!locals.includes(e.origin)||e.source!==window.opener)return;
try{let result={};
if(m.type==='begin'){if(!Array.isArray(m.data.products))throw Error('产品资料格式无效');receiver={products:m.data.products,attachments:0};result={ready:true}}
else if(m.type==='attachment'){if(!receiver)throw Error('尚未开始迁移');const r=m.data;if(!r||!r.id||!r.owner||!(r.file instanceof Blob))throw Error('附件无效');await attachmentOp('readwrite',s=>s.put(r));receiver.attachments++;result={saved:true}}
else if(m.type==='finish'){if(!receiver)throw Error('尚未开始迁移');const before=products.length,keep=new Set(products.map(x=>JSON.stringify(x)));for(const x of receiver.products){const key=JSON.stringify(x);if(!keep.has(key)){products.push(x);keep.add(key)}}persist();const rows=await attachmentOp('readonly',s=>s.getAll());result={complete:true,products:products.length,added:products.length-before,transferredAttachments:receiver.attachments,storedAttachments:rows.length};receiver=null;history.replaceState(null,'',location.pathname);render();toast(`迁移完成：${result.products} 条产品记录，${result.storedAttachments} 个附件`)}
else return;
e.source.postMessage({levinMigration:1,type:'reply',nonce,id:m.id,data:result},e.origin)
}catch(err){e.source.postMessage({levinMigration:1,type:'reply',nonce,id:m.id,error:err.message},e.origin)}
});
const previousBind=bind;
bind=function(){previousBind();if(!locals.includes(location.origin)||page!=='products')return;const box=document.createElement('div');box.className='card';box.innerHTML='<button id="transfer-to-hosted">将当前完整资料迁移到新网址</button><p id="transfer-status" role="status"></p>';$('#app').prepend(box);box.querySelector('button').onclick=async()=>{const button=box.querySelector('button'),status=box.querySelector('p');button.disabled=true;const nonce=crypto.randomUUID(),target=window.open(base+'#migration='+nonce,'levin-product-migration');if(!target){button.disabled=false;status.textContent='请允许本工具打开迁移页面';return}try{status.textContent='正在连接新网址…';let connected=false;for(let attempt=0;attempt<30&&!connected;attempt++){try{await new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('loading'))},2000);pending.set(id,{resolve,reject,timer,target,origin:hosted,nonce});target.postMessage({levinMigration:1,nonce,id,type:'begin',data:{products}},hosted)});connected=true}catch{}}if(!connected)throw Error('新网址未响应，原资料和备份均已保留');const rows=await attachmentOp('readonly',s=>s.getAll());for(let i=0;i<rows.length;i++){status.textContent=`正在迁移附件 ${i+1} / ${rows.length}…`;await call(target,hosted,nonce,'attachment',rows[i])}const result=await call(target,hosted,nonce,'finish',{});status.textContent='迁移完成：'+JSON.stringify(result);button.disabled=false}catch(err){status.textContent='迁移未完成：'+err.message;button.disabled=false}}};
render();
})();
