// One focused product workspace; existing actions and storage remain in use.
function productListTime(x){
// Sync/import timestamps do not mean the product was edited recently.
const times=[x.lastEditedAt,x.updated,x.createdAt,x.created_at].map(value=>{
if(!value)return 0;if(typeof value==='number')return Number.isFinite(value)?value:0;
const text=String(value).trim(),match=text.match(/^(\d{4})[\/年.-](\d{1,2})[\/月.-](\d{1,2})日?\s*(上午|下午)?\s*(\d{1,2})?[:：]?(\d{2})?[:：]?(\d{2})?$/);
if(match){let hour=Number(match[5]||0);if(match[4]==='下午'&&hour<12)hour+=12;if(match[4]==='上午'&&hour===12)hour=0;return Date.UTC(+match[1],+match[2]-1,+match[3],hour,+(match[6]||0),+(match[7]||0))-8*60*60*1000}
const parsed=Date.parse(text);return Number.isFinite(parsed)?parsed:0});
return Math.max(0,...times);
}
list=function(){
const items=products.map((x,i)=>({x,i})).filter(({x})=>(x.id+' '+x.name).toLowerCase().includes(search.toLowerCase())&&(filter==='all'||x.status===filter)).sort((a,b)=>productListTime(b.x)-productListTime(a.x)||b.i-a.i);
return `<section class="home-workspace"><div class="home-heading"><div><h1>产品工作台</h1><p>${products.length} 条记录 <span>·</span> ${products.filter(x=>x.status==='整理中').length} 条整理中 <span>·</span> ${products.filter(x=>x.status==='已完成自查').length} 条已完成自查</p></div><div class="home-heading-actions"><button class="primary" id="new">＋ 新建产品</button><button id="workspace-more" aria-expanded="false" aria-controls="workspace-utilities">更多 ···</button></div></div>
<div class="home-filters"><input aria-label="搜索产品" id="search" placeholder="搜索产品编号或名称" value="${esc(search)}"><select id="filter" aria-label="筛选进度"><option value="all">全部进度</option><option ${filter==='整理中'?'selected':''}>整理中</option><option ${filter==='已完成自查'?'selected':''}>已完成自查</option></select><span class="home-result-count">显示 ${items.length} 条</span></div>
<div class="tablewrap"><table class="home-product-table"><thead><tr><th>产品名称 / SKU</th><th>当前步骤</th><th>状态</th><th>最近保存</th><th class="home-actions-heading">操作</th></tr></thead><tbody>${items.map(({x,i})=>`<tr><td class="productname"><button data-open="${i}">${esc(x.name||'未命名产品')}</button><small>${esc(x.id||'未填写编号')}</small></td><td>${esc(steps[x.step]||'资料导入')}</td><td><span class="badge">${esc(x.status||'整理中')}</span></td><td class="home-saved">${esc(x.updated||'未保存')}</td><td><div class="home-row-actions"><button data-open="${i}">继续整理 →</button><button class="danger" data-delete-product="${i}">删除</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="empty">没有匹配的产品</td></tr>'}</tbody></table></div></section>
<section id="workspace-utilities" class="home-utilities" hidden aria-label="更多工具"><div class="home-utility-heading"><h2>更多工具</h2><button id="workspace-more-close" aria-label="关闭更多工具">关闭</button></div><div class="home-utility-grid"><section><h3>备份与迁移</h3><div class="home-utility-actions"><button id="export-local-data">导出资料和图片备份</button><label class="home-import">导入备份<input type="file" id="import-local-data" accept=".json" aria-label="导入资料备份"></label></div></section><section><h3>回收站</h3><p>删除的产品可在这里恢复。</p><button id="product-trash">回收站（${readTrash().length}）</button></section></div><div id="home-local-utilities"></div></section>`;
};
const homeBind=bind;
bind=function(){homeBind();document.body.classList.toggle('products-home',page==='products');if(page!=='products')return;
const newButton=$('#new');if(newButton){const create=newButton.onclick;newButton.onclick=function(event){const before=products.length;create.call(this,event);if(products.length>before){const x=products[products.length-1];x.createdAt=new Date().toISOString();persist()}}}
const panel=$('#workspace-utilities'),toggle=$('#workspace-more');
function openMore(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(!open)toggle.focus()}
toggle.onclick=()=>openMore(panel.hidden);$('#workspace-more-close').onclick=()=>openMore(false);
// Earlier local-only helpers prepend panels; collect them inside the same utilities area.
for(const child of [...$('#app').children])if(child!==panel&&!child.classList.contains('home-workspace'))$('#home-local-utilities').append(child);
const footer=document.querySelector('.sidefoot');if(footer)footer.textContent='产品资料工作台';
};
render();
