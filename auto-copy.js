const autoCopyEditor=editor,autoCopyBind=bind;
const activeCopyJobs=new WeakMap();
editor=function(){let html=autoCopyEditor();return html.replace('<h2>Product Information</h2>',`<h2>Product Information</h2><button id="generate-product-copy" class="primary" ${activeCopyJobs.has(p())?'disabled':''}>${activeCopyJobs.has(p())?'正在生成…':p().codexResult?.sections?.length?'重新生成文案':'生成两组英文文案'}</button>`)};
async function generateCurrentCopy(target,force=false){if(activeCopyJobs.has(target))return;if(!target.name||!target.description||target.description.length<30)return;if(!force&&target.codexResult?.sections?.length)return;
 if(location.protocol==='https:'){
  if(['queued','running'].includes(target.copyGenerationRequest?.state)&&Date.now()-Date.parse(target.copyGenerationRequest.startedAt||target.copyGenerationRequest.requestedAt)<360000)return toast('当前任务正在处理，请勿重复提交；完成后自动显示');
  if(!localStorage.getItem('levin-record-access-v1'))return toast('请通过专用工作区链接打开，才能提交生成任务');
  target.copyGenerationRequest={id:crypto.randomUUID(),state:'queued',requestedAt:new Date().toISOString()};delete target.copyGenerationError;persist();render();toast('已提交，等待生成服务接收；接收后会显示生成中');return;
 }
 const signature=JSON.stringify([target.id,target.name,target.description,target.colors,target.imprint]);
 try{activeCopyJobs.set(target,'starting');if(p()===target&&page==='editor')render();const response=await localRequest('/api/copy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:target})});activeCopyJobs.set(target,response.job);toast('正在根据当前产品资料生成英文文案…');
 const poll=async()=>{try{const result=await localRequest('/api/copy/'+response.job);if(result.state==='running'||result.state==='queued'){setTimeout(poll,1800);return}activeCopyJobs.delete(target);if(result.state!=='done')throw Error(result.error||'生成失败');if(signature!==JSON.stringify([target.id,target.name,target.description,target.colors,target.imprint]))throw Error('生成期间产品资料已更改，请重新生成');const prior=target.codexResult?.sections;if(prior){target.copyVersions??=[];target.copyVersions.unshift({at:new Date().toLocaleString('zh-CN'),sections:structuredClone(prior)})}target.codexResult??={};target.codexResult.sections=result.result.sections;target.seoTitle=result.result.seoTitle;target.seoDescription=result.result.seoDescription;target.copySource='本机 Codex 根据当前产品资料生成';normalizeProductInches(target);persist();if(p()===target)render();toast('两组英文文案及 SEO 已生成，可直接复制')}catch(e){activeCopyJobs.delete(target);target.copyGenerationError=e.message;persist();if(p()===target)render();toast(e.message)}};poll();
 }catch(e){activeCopyJobs.delete(target);target.copyGenerationError=e.message;persist();if(p()===target)render();toast(e.message)}}
bind=function(){autoCopyBind();$('#generate-product-copy')?.addEventListener('click',()=>{if(!p().name||!p().description||p().description.length<30)return toast('请先提取产品名称和 Overview');generateCurrentCopy(p(),true)});if((typeof isLocalOwner!=='function'||isLocalOwner())&&admin&&page==='editor'&&p().workspaceStage==='results'&&location.protocol==='http:'&&!p().copyGenerationError&&!p().codexResult?.sections?.length&&!activeCopyJobs.has(p())&&p().name&&p().description?.length>=30)setTimeout(()=>generateCurrentCopy(p()),100)};
// Stop the previous SKU-specific injection: every product goes through the same generator.
ensureProductCopy=function(){};
const cloudCopyEditor=editor;
editor=function(){const html=cloudCopyEditor(),request=p().copyGenerationRequest;if(location.protocol!=='https:'||!request||request.type==='scene')return html;const message=['queued','running'].includes(request.state)?copyRequestStatus(request):request.state==='error'?'生成未完成：'+(request.error||'请重新提交'):request.state==='done'?'文案与 SEO 已生成。':'';return html.replace('<h2>Product Information</h2>','<h2>Product Information</h2><p class="muted" role="status">'+esc(message)+'</p>')};
const seoRepairBind=bind;
function queueMissingSeo(target){if(target.seoTitle&&target.seoDescription)return;target.copyGenerationRequest={id:crypto.randomUUID(),type:'seo',state:'queued',requestedAt:new Date().toISOString()};persist()}
bind=function(){seoRepairBind();if(page!=='editor'||!admin||location.protocol!=='https:'||!localStorage.getItem('levin-record-access-v1'))return;const x=p();if(x.codexResult?.sections?.length&&(!x.seoTitle||!x.seoDescription)&&!['queued','running','error'].includes(x.copyGenerationRequest?.state)){queueMissingSeo(x);setTimeout(()=>{if(p()===x)render()},0)}const field=$('#compact-seoTitle'),section=field?.closest('section.card');if(section&&(!x.seoTitle||!x.seoDescription)&&!section.querySelector('#generate-seo-only')){const b=document.createElement('button');b.id='generate-seo-only';b.textContent=['queued','running'].includes(x.copyGenerationRequest?.state)?'SEO 生成中…':'补充 SEO';b.disabled=['queued','running'].includes(x.copyGenerationRequest?.state);b.onclick=()=>{queueMissingSeo(x);render()};section.prepend(b)}};
render();

function copyRequestStatus(request){
 const age=Date.now()-Date.parse(request.startedAt||request.requestedAt),late=age>360000;
 if(late)return '生成服务长时间未完成。请检查负责人电脑上的生成服务，然后点击重试；原内容已保留。';
 return request.state==='running'?'正在生成文案与 SEO，完成后自动显示。':'任务已保存，等待负责人电脑上的生成服务接收。';
}
const copyStateBind=bind;
bind=function(){copyStateBind();if(page!=='editor'||location.protocol!=='https:')return;const r=p().copyGenerationRequest,b=$('#generate-product-copy');if(!r||!b)return;const pending=['queued','running'].includes(r.state),late=Date.now()-Date.parse(r.startedAt||r.requestedAt)>360000;b.disabled=pending&&!late;if(pending)b.textContent=late?'重新提交生成':r.state==='running'?'正在生成…':'等待生成服务…'};
render();
