// Authenticated REST storage adapter. Private product data never belongs in GitHub Pages.
const SharedStore=(()=>{
 const cfg=globalThis.LEVIN_SHARED_CONFIG||{},SESSION='levin-shared-session-v1';
 let token;try{token=JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{token=null}
 function safePublicKey(key){if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key||''))return true;try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return payload.role==='anon'}catch{return false}}
 const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'')&&safePublicKey(cfg.publishableKey);
 const base=()=>cfg.url.replace(/\/$/,'');
 function saveSession(data){token={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000};sessionStorage.setItem(SESSION,JSON.stringify(token))}
 async function authRequest(grant,body){if(!configured())throw Error('共享存储尚未配置');const r=await fetch(base()+'/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.msg||data.error_description||'登录失败');saveSession(data)}
 async function login(email,password){await authRequest('password',{email,password})}
 async function headers(){if(!token)throw Error('请先登录共享工作区');if(token.expires_at<Date.now()+30000){try{await authRequest('refresh_token',{refresh_token:token.refresh_token})}catch{token=null;sessionStorage.removeItem(SESSION);throw Error('共享登录已过期，请重新登录')}}return {apikey:cfg.publishableKey,Authorization:'Bearer '+token.access_token}}
 async function request(path,options={}){const h=await headers();const r=await fetch(base()+path,{...options,headers:{...h,...options.headers}});if(!r.ok){let error;try{error=await r.json()}catch{error={message:'请求失败'}}throw Error(error.message||error.error_description||error.error||'共享请求失败')}return r}
 function validateSku(sku){if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(sku||''))throw Error('请先填写有效产品编号')}
 function productData(product){const data=JSON.parse(JSON.stringify(product));for(const key of ['sharedVersion','sharedFingerprint','sharedUpdatedAt','quoteCandidates','copyGenerationError'])delete data[key];return data}
 function fingerprint(product){return JSON.stringify(productData(product))}
 function isDirty(product){return Boolean(product.sharedFingerprint&&product.sharedFingerprint!==fingerprint(product))}
 async function list(){let all=[],offset=0;for(;;){const r=await request('/rest/v1/levin_products?select=sku,version,state,updated_at,data,attachments&deleted_at=is.null&order=sku&limit=100&offset='+offset);const rows=await r.json();all.push(...rows);if(rows.length<100)return all;offset+=rows.length}}
 function assetPath(sku,attachment){validateSku(sku);if(!/^[a-f0-9-]{12,64}$/i.test(attachment.id||''))throw Error('附件编号无效');const extension=(attachment.name||'').match(/\.(png|jpg|jpeg|webp|gif|xlsx)$/i)?.[1]?.toLowerCase();if(!extension)throw Error('不支持的附件类型');return `products/${sku}/${attachment.id}.${extension}`}
 async function upload(sku,attachment){const path=assetPath(sku,attachment);if(attachment.file.size>25*1024*1024)throw Error('单个附件不能超过 25 MB');await request('/storage/v1/object/'+cfg.bucket+'/'+path,{method:'POST',headers:{'Content-Type':attachment.file.type||'application/octet-stream','x-upsert':'true'},body:attachment.file});const {file,base64,...meta}=attachment;return {...meta,path,mime:file.type,size:file.size}}
 async function download(sku,meta){validateSku(sku);if(!meta.path?.startsWith(`products/${sku}/`)||meta.path.includes('..'))throw Error('共享附件路径不匹配');const r=await request('/storage/v1/object/authenticated/'+cfg.bucket+'/'+meta.path);return {...meta,file:await r.blob()}}
 async function save(product,attachments,state){validateSku(product.id);if(!['基础资料待补充','基础资料已整理／图文待补充','图文已补充'].includes(state))throw Error('无效协作状态');const data=productData(product);const r=await request('/rest/v1/rpc/save_levin_product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_sku:product.id,p_expected:Number(product.sharedVersion||0),p_data:data,p_attachments:attachments,p_state:state})});const result=await r.json();const row=Array.isArray(result)?result[0]:result;if(!row?.version)throw Error('共享保存未返回版本号');return row}
 function markSynced(product,row){product.sharedVersion=row.version;product.sharedUpdatedAt=row.updated_at;product.sharedFingerprint=fingerprint(product)}
 async function logout(){try{if(token)await request('/auth/v1/logout',{method:'POST'})}finally{token=null;sessionStorage.removeItem(SESSION)}}
 return {configured,login,logout,list,upload,download,save,markSynced,isDirty,productData,fingerprint,validateSku,assetPath,safePublicKey,signedIn:()=>Boolean(token)};
})();
