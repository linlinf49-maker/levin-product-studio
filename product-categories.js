// Product categories supplied by the owner from the website's actual taxonomy.
const websiteCategories=['Apparel & Wearables','Bags & Totes','Drinkware','Sports & Outdoor','Home & Kitchen','Personal Care & Beauty','Technology & Electronics','Office & Business','Tools & Auto','Events & Trade Show','Toys & Novelties','Pet Products','Bar & Wine','Gifts & Packaging'];
function recommendWebsiteCategory(x){
const rules=[
['Pet Products',/\b(dog|cat toy|cat bowl|cat collar|pet|leash|collar|fetch(?:ing)?|pet bowl)\b/i],
['Personal Care & Beauty',/\b(beauty|makeup|cosmetic|blender sponge|lip balm|manicure|nail file|hair brush|toiletry|sunscreen)\b/i],
['Bar & Wine',/\b(wine|cocktail|bartender|corkscrew|shot glass|bottle opener|beer opener|wine stopper)\b/i],
['Bags & Totes',/\b(bag|tote|backpack|duffel|pouch|drawstring pack|fanny pack)\b/i],
['Drinkware',/\b(tumbler|mug|cup|water bottle|drinking bottle|vacuum flask|travel flask|drinkware)\b/i],
['Apparel & Wearables',/\b(hat|cap|beanie|t-shirt|shirt|jacket|apron|hoodie|socks?|scarf|gloves?|vest|bandana|poncho)\b/i],
['Technology & Electronics',/\b(charger|charging|usb|power bank|earbuds?|headphones?|bluetooth|wireless|phone stand|mouse pad|webcam|flash drive)\b/i],
['Tools & Auto',/\b(screwdriver|wrench|multitool|multi-tool|tire|car tool|ice scraper|jumper cable|utility knife|tape measure|tire gauge)\b/i],
['Home & Kitchen',/\b(dish|scrubber|loofah|kitchen|spatula|cutting board|coaster|oven mitt|dishcloth|cleaning cloth|food container|lunch box|utensil)\b/i],
['Office & Business',/\b(ballpoint|pen|pencil|notebook|notepad|sticky note|journal|desk organizer|business card|document folder|stapler)\b/i],
['Sports & Outdoor',/\b(yoga|pilates|exercise|fitness|sport|camping|hiking|golf|cycling|bicycle|jump rope|resistance band|frisbee|basketball|soccer)\b/i],
['Events & Trade Show',/\b(lanyard|badge holder|name badge|wristband|trade show display|banner stand|table cover|event tent)\b/i],
['Toys & Novelties',/\b(toy|fidget|stress ball|puzzle|yo-yo|yoyo|bubble wand|plush|rubber duck|novelty)\b/i],
['Gifts & Packaging',/\b(gift box|gift wrap|wrapping paper|packaging|ribbon|gift tag|gift set|presentation box)\b/i]
];
const title=String(x.name||'');if(!title.trim())return '';
for(const [category,pattern] of rules)if(pattern.test(title))return category;
// Description can help only when it points to a single category, avoiding giveaway boilerplate.
const text=String(x.description||'');const matches=rules.filter(([,pattern])=>pattern.test(text));return matches.length===1?matches[0][0]:'';
}
function ensureWebsiteCategory(x){if(x.categorySource==='manual')return;if(x.category&&websiteCategories.includes(x.category)&&x.categorySource!=='recommended')return;const recommendation=recommendWebsiteCategory(x);if(recommendation){x.category=recommendation;x.categorySource='recommended'}}
const categoryEditor=editor,categoryBind=bind;
editor=function(){const x=p();ensureWebsiteCategory(x);const html=categoryEditor(),old=dataItem('category','官网分类',x.category);const value=x.category||'';const options=websiteCategories.map(c=>`<option value="${esc(c)}" ${c===value?'selected':''}>${esc(c)}</option>`).join('');return html.replace(old,`<div class="data-item"><div class="row"><label for="compact-category">官网分类</label><button data-fast-copy="category" ${value?'':'disabled'}>复制</button></div><select id="compact-category" data-fast-key="category"><option value="">请选择官网分类</option>${value&&!websiteCategories.includes(value)?`<option selected value="${esc(value)}">${esc(value)}（原分类，请核对）</option>`:''}${options}</select><small class="muted">${value?'Products / '+esc(value):'暂无法明确归类，请选择'}${x.categorySource==='recommended'?' · 推荐，可修改':''}</small></div>`)};
bind=function(){categoryBind();$('#compact-category')?.addEventListener('change',e=>{p().category=e.target.value;p().categorySource='manual';persist();const button=document.querySelector('[data-fast-copy="category"]');if(button)button.disabled=!e.target.value})};
render();
