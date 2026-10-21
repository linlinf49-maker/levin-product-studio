// Strip only recognizable trailing OCR control/icon noise; preserve real product wording.
function cleanProductName(value){return String(value||'').replace(/\s+(?:-?\s*['’]h\s*)+(?:=+)?\s*$/i,'').replace(/\s+[©®].*$/,'').replace(/\s*[~|=]+\s*$/,'').trim()}
function comparableProductName(value){return cleanProductName(value).toLowerCase().replace(/[\s-]+/g,' ').trim()}
function resolveRecognizedName(target,value){const clean=cleanProductName(value);if(!clean)return '';if(target.quoteProductName&&comparableProductName(clean)!==comparableProductName(target.quoteProductName)){target.nameReview={recognized:clean,quote:target.quoteProductName};return target.name||target.quoteProductName}delete target.nameReview;return clean}
const qualityParseOcr=parseSageOcr;
parseSageOcr=function(text){const result=qualityParseOcr(text);if(result.fields.name)result.fields.name=cleanProductName(result.fields.name);return result};
function repairStoredName(x){const clean=cleanProductName(x.name);if(clean!==x.name){x.originalOcrName??=x.name;x.name=clean}}
const qualityEditor=editor,qualityBind=bind;
editor=function(){repairStoredName(p());let html=qualityEditor();if(p().nameReview){html=html.replace('<div class="compact-results">',`<div class="notice">名称需核对：SAGE 识别为「${esc(p().nameReview.recognized)}」，报价单为「${esc(p().nameReview.quote)}」。已保留原名称，可在产品名称栏修改。</div><div class="compact-results">`)}return html};
bind=function(){qualityBind();const el=$('#compact-name');el?.addEventListener('change',()=>{p().name=cleanProductName(el.value);el.value=p().name;delete p().nameReview;persist()})};
for(const x of products)repairStoredName(x);persist();render();
