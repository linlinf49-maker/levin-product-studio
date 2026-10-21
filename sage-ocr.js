// English OCR runs locally using vendored Tesseract, never sends screenshots to a third party.
const sageOcrContent=content,sageOcrBind=bind;
let localOcrBusy=false;
function cleanOcrText(text){return text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!/^(?:Vi|Pp|\[J|\[i\])$/.test(s)).map(s=>s.replace(/^(Description|Colors|Keywords)\s*(?:\[i\]|[°®©])?$/i,'$1').replace(/^Themes\s*\(.*?\).*$/i,'Themes').replace(/^Origin Information.*$/i,'Origin Information')).join('\n')}
function parseSageOcr(text){const cleaned=cleanOcrText(text),out=parseSage(cleaned);let lines=cleaned.split('\n');
 // OCR sometimes merges a label with unrelated neighbouring columns. Use bounded sections.
 const section=(start,end)=>{const index=lines.findIndex(l=>start.test(l));if(index<0)return '';let result=[];for(let i=index+1;i<lines.length;i++){if(end.test(lines[i]))break;result.push(lines[i])}return result.join(' ').trim()};
 const desc=section(/^Description\b/i,/^(Keywords|Colors|Themes|Origin Information)\b/i);if(desc)out.description=desc.replace(/eco-\s+conscious/g,'eco-conscious');
 const name=section(/^Product Name$/i,/^(Primary Category|Secondary Category|Catalog|Product ID)\b/i);if(name)out.name=name.replace(/\s+[©®].*$/,'').trim();
 const colors=section(/^Colors$/i,/^(Themes|Origin Information|Dimensions|Decoration)\b/i);if(colors)out.colors=colors;
 const themes=section(/^Themes$/i,/^(Origin Information|Dimensions|Decoration)\b/i);if(themes)out.themes=themes.replace(/[=|]+/g,',').replace(/\s*,\s*/g,', ').trim();
 const decoration=section(/^Decoration Method\b/i,/^(Primary Imprint Area|Dimensions|Options)\b/i);if(decoration)out.decoration=decoration.replace(/\s+Print on Demand.*$/i,'').trim();
 // Dimension fractions are frequently misread. Keep them in raw OCR for review rather than publish incorrect numbers.
 delete out.dimensions;delete out.imprintArea;
 if(out.id&&!/^[A-Z]{2,5}\d{3,8}$/.test(out.id.trim()))delete out.id;
 return {fields:out,raw:cleaned,hasDimensions:/\bDimensions\b|Primary Imprint Area/i.test(cleaned)};
}
content=function(n){let html=sageOcrContent(n);if(n!==0)return html;html=html.replace('从粘贴文字提取（不识别截图）','识别 SAGE 截图并填充资料').replace('截图可粘贴、拖入和预览；OCR 尚未接入，接收截图不会自动填写字段。图片保存在当前浏览器，尚不能跨电脑共享。','英文截图 OCR 已接入，在本机浏览器运行。点击识别后可自动填充；小字、分数尺寸和 Logo 等必须核对。').replace('截图 OCR 尚未接入，请先从 SAGE 复制文字。导入文件与图片的跨电脑保存尚未实现。','截图英文 OCR 在本机运行，不使用付费 API。');
 return html.replace('<div class="sectionlabel">识别结果与来源',`<div id="ocr-progress" class="hint" role="status">${localOcrBusy?'正在识别，请勿切换或重复点击。':'可一次识别本产品已加入的多张 SAGE 截图。产品参考图不参与文字提取。'}</div>${p().ocrReport?`<details><summary>查看上次 OCR 原文与检查提示</summary><p class="notice">${esc(p().ocrReport.warning)}</p><textarea readonly rows="12" aria-label="OCR 识别原文">${esc(p().ocrReport.text)}</textarea></details>`:''}<div class="sectionlabel">识别结果与来源`);
};
async function upscaleScreenshot(blob){const image=await createImageBitmap(blob);const factor=Math.min(3,5000/image.width,7000/image.height);const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*factor);canvas.height=Math.round(image.height*factor);const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);image.close();return canvas}
async function extractScreenshots(){const target=p();if(localOcrBusy)return toast('识别正在进行中');const text=$('#sage-real')?.value||'';let images=[];try{if(target.attachmentKey)images=(await attachmentOp('readonly',s=>s.getAll())).filter(r=>r.owner===target.attachmentKey&&r.kind==='sage').sort((a,b)=>a.created-b.created)}catch{return toast('无法读取截图，请刷新后重试')}
 if(!images.length&&!text.trim())return toast('请先在 SAGE 截图区粘贴截图，或粘贴 SAGE 文字');
 localOcrBusy=true;let worker;const update=message=>{if(p()===target&&$('#ocr-progress'))$('#ocr-progress').textContent=message};const button=$('#extract-sage');if(button)button.disabled=true;
 try{let reports=[];if(images.length){if(!window.Tesseract)throw Error('本地 OCR 引擎加载失败，请强制刷新页面');update('正在加载本地英文识别模型…');worker=await Tesseract.createWorker('eng',1,{workerPath:new URL('vendor/ocr/worker.min.js',location.href).href,corePath:new URL('vendor/ocr/tesseract-core-lstm.wasm.js',location.href).href,langPath:new URL('vendor/ocr',location.href).href,workerBlobURL:false,cacheMethod:'none',logger:m=>{if(m.status==='recognizing text')update(`正在识别截图：${Math.round((m.progress||0)*100)}%`)}});for(let i=0;i<images.length;i++){update(`正在识别第 ${i+1}/${images.length} 张截图…`);const canvas=await upscaleScreenshot(images[i].file);const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});const parsed=parseSageOcr(data.text);const layout=await readSageLayout(worker,canvas,data);Object.assign(parsed.fields,layout.fields);reports.push({name:images[i].name,confidence:data.confidence,...parsed,layoutIssues:layout.issues})}}
 const fields={};const conflicts=[];for(const report of reports)for(const [key,val]of Object.entries(report.fields)){if(fields[key]&&fields[key]!==val)conflicts.push(key);else fields[key]=val}const manual=parseSage(text);Object.assign(fields,manual);
 if(fields.id&&target.id&&fields.id.toUpperCase()!==target.id.toUpperCase())throw Error(`识别编号 ${fields.id} 与当前 ${target.id} 不一致，未填入，请核对截图`);
 if(fields.name&&!manual.name&&typeof resolveRecognizedName==='function')fields.name=resolveRecognizedName(target,fields.name);target.sources??={};let filled=0;for(const [key,value]of Object.entries(fields)){if(!value||conflicts.includes(key)&&!manual[key])continue;target[key]=value;target.sources[key]=manual[key]?'SAGE 粘贴文字':'SAGE 本地截图 OCR（需核对）';filled++}
 // Preserve verified area/location if already present; do not silently replace them with unverified OCR numbers.
 if(fields.decoration||fields.imprintArea||fields.imprintLocation)target.imprint=[fields.decoration||target.decoration,target.imprintArea?'Imprint area: '+target.imprintArea:'',target.imprintLocation?'Imprint location: '+target.imprintLocation:'','Price includes a 1-color imprint in 1 location.'].filter(Boolean).join('\n');
 target.sageRaw=text;target.ocrReport={at:new Date().toLocaleString('zh-CN'),text:reports.map(r=>`--- ${r.name} (confidence ${r.confidence}) ---\n${r.raw}`).join('\n\n'),warning:[reports.some(r=>r.hasDimensions)?'尺寸与印刷面积已按单元格识别；未可靠读取的字段保留原值，仍请对照原图核对。':'请核对识别文字。',conflicts.length?`多图冲突字段未自动采用：${conflicts.join(', ')}。`:'',!fields.id&&!target.id?'未可靠识别编号，请按报价单确认 SKU。':''].filter(Boolean).join(' ')};
 target.importMessage=`已识别 ${images.length} 张 SAGE 截图，填入 ${filled} 项。请核对来源和 OCR 原文。`;persist();localOcrBusy=false;if(p()===target)render();toast(target.importMessage);
 }catch(error){update('识别未完成：'+error.message);toast('识别失败：'+error.message)}finally{localOcrBusy=false;if(worker)await worker.terminate();if(p()===target&&$('#extract-sage'))$('#extract-sage').disabled=false}
}
bind=function(){sageOcrBind();const b=$('#extract-sage');if(b){b.textContent='识别 SAGE 截图并填充资料';b.disabled=localOcrBusy;b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();extractScreenshots()},true)}};
render();
