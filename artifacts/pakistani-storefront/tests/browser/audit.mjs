import fs from 'node:fs/promises';
const targets=await (await fetch('http://localhost:9222/json/list')).json();
const target=targets.find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let seq=0;
const pending=new Map(), errors=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data);
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
});
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){
  const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await delay(500);}throw Error('Timed out: '+expression);}
async function click(selector){
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()})()`);
  await delay(250);
}
async function fill(selector,value){
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  await delay(150);
}
const results=[];
function check(name,pass,detail){results.push({name,pass,detail});if(!pass)console.error('FAIL',name,detail);}
await cdp('Page.enable');await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await cdp('Page.navigate',{url:'http://localhost:5000/tests/browser/fixture.html'});
await waitFor(`!!document.querySelector('[data-home-hero]')`);
await waitFor(`document.querySelector('[data-testid="img-home-hero"]')?.naturalWidth>0`);
await waitFor(`document.querySelector('[data-testid="fixture-responsive-fallback"]')?.naturalWidth>0`);
check('failed mobile image falls back to the working desktop image',await evaluate(`!document.querySelector('[data-testid="fixture-responsive-fallback"]').currentSrc.includes('intentionally-missing')`));
await evaluate('document.fonts.ready.then(()=>true)');
await fs.mkdir('nura-audit-evidence',{recursive:true});
const gold=await evaluate(`({variable:getComputedStyle(document.documentElement).getPropertyValue('--nura-gold').trim(),eyebrow:getComputedStyle(document.querySelector('[data-testid="text-offer-eyebrow"]')).color})`);
check('gold details stay distinct from the plum primary palette',gold.variable.toLowerCase()==='#c6a15b'&&gold.eyebrow==='rgb(198, 161, 91)',gold);
check('announcement matches the configured Nura delivery promise',await evaluate(`document.querySelector('[data-testid="text-announcement"]').textContent.includes('Complimentary delivery on orders over Rs 3,000 — across Pakistan')`));
for(const width of [320,390,768,1440]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<769});
  await delay(300);
  const info=await evaluate(`(()=>{const promos=[...document.querySelector('[data-testid="grid-home-occasion-promos"]').children].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}});const image=document.querySelector('[data-testid="story-image-container"]').getBoundingClientRect();const story=document.querySelector('[data-testid="home-story-section"]').getBoundingClientRect();const names=[...document.querySelectorAll('.nura-wordmark-row>.serif')].map(e=>({size:getComputedStyle(e).fontSize,family:getComputedStyle(e).fontFamily,weight:getComputedStyle(e).fontWeight}));return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,promos,image:{width:image.width},story:{width:story.width},names}})()`);
  check(`${width}px: no page overflow`,info.scrollWidth<=width,info);
  check(`${width}px: promo layout`,width<=768?info.promos[1].y>=info.promos[0].y+info.promos[0].height-1:Math.abs(info.promos[0].y-info.promos[1].y)<2,info.promos);
  if(width<=768)check(`${width}px: story image fills column`,Math.abs(info.image.width-info.story.width)<2,info);
  check(`${width}px: matching header/footer wordmark`,info.names.length>=2&&new Set(info.names.map(n=>JSON.stringify(n))).size===1,info.names);
}
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
const urdu=await evaluate(`(async()=>{const e=document.querySelector('[data-testid="story-urdu-copy"]');await document.fonts.load('400 16px "Nura Nastaliq"','نورا');e.scrollIntoView({block:'center',behavior:'instant'});return {font:getComputedStyle(e.querySelector('p')).fontFamily,loaded:document.fonts.check('400 16px "Nura Nastaliq"','نورا'),lineHeight:getComputedStyle(e.querySelector('p')).lineHeight}})()`);
check('authentic self-hosted Nastaliq loaded',urdu.loaded&&urdu.font.includes('Nura Nastaliq'),urdu);
await delay(400);
await fs.writeFile('nura-audit-evidence/mobile-story.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate(`document.querySelector('[data-testid="story-image-container"]').scrollIntoView({block:'center',behavior:'instant'})`);await delay(200);
await fs.writeFile('nura-audit-evidence/mobile-story-image.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate(`document.querySelector('[data-testid="grid-home-occasion-promos"]').scrollIntoView({block:'start',behavior:'instant'})`);await delay(400);
await fs.writeFile('nura-audit-evidence/mobile-promos.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
const storyText=await evaluate(`document.querySelector('[data-testid="story-urdu-copy"]').textContent`);
await click('details nav button:nth-of-type(1)');
check('hidden story does not render',await evaluate(`!document.querySelector('[data-testid="home-story-section"]')`));
await click('details nav button:nth-of-type(1)');
check('hidden story retains content',await evaluate(`document.querySelector('[data-testid="story-urdu-copy"]').textContent`)===storyText);
await click('details nav button:nth-of-type(5)');
check('box/grid settings render exactly',await evaluate(`(()=>{const e=document.querySelector('[data-home-collections] [data-layout]');return e.dataset.layout==='grid'&&e.dataset.shape==='box'})()`));
await click('details nav button:nth-of-type(6)');
check('circle/marquee settings render exactly',await evaluate(`(()=>{const e=document.querySelector('[data-home-collections] [data-layout]');return e.dataset.layout==='horizontal'&&e.dataset.shape==='circle'&&e.dataset.motion==='auto'})()`));
const sectionIds=await evaluate(`[...document.querySelectorAll('[data-testid^="fixture-section-"]')].map(e=>e.dataset.testid.replace('fixture-section-',''))`);
for(const id of sectionIds){
  const toggleSelector=`[data-testid="fixture-section-${id}"]`;
  const wasVisible=await evaluate(`document.querySelector(${JSON.stringify(toggleSelector)}).checked`);
  const sectionSelector=id==='announcement'?'[data-testid="text-announcement"]':id==='mediaBanner'?'[data-testid="section-home-media-banner"]':`[data-home-section="${id}"]`;
  if(!wasVisible)await click(toggleSelector);
  check(`${id}: enabled section renders`,await evaluate(`!!document.querySelector(${JSON.stringify(sectionSelector)})`));
  await click(toggleSelector);
  check(`${id}: disabled section does not render`,await evaluate(`!document.querySelector(${JSON.stringify(sectionSelector)})`));
  if(wasVisible)await click(toggleSelector);
}
await click('[data-testid^="button-wishlist-"]');
check('product wishlist heart updates its saved state',await evaluate(`document.querySelector('[data-testid^="button-wishlist-"]').getAttribute('aria-pressed')==='true'`));
await click('[data-testid^="button-add-to-cart-card-"]');
await click('details nav a[href="/cart"]');
await waitFor(`!!document.querySelector('[data-testid^="row-cart-item-"]')`);
const before=await evaluate(`document.querySelector('[data-testid="text-cart-subtotal"]').textContent`);
check('eligible starter order receives complimentary delivery',await evaluate(`document.querySelector('[data-testid="text-cart-delivery"]').textContent==='Complimentary'`));
await click('[data-testid$="-increase"]');
const after=await evaluate(`document.querySelector('[data-testid="text-cart-subtotal"]').textContent`);
const number=s=>Number(s.replace(/[^0-9.]/g,''));
check('cart quantity doubles line subtotal',number(after)===number(before)*2,{before,after});
await click('[data-testid="link-proceed-checkout"]');
await waitFor(`!!document.querySelector('[data-testid="select-checkout-city"]')`);
await fill('[data-testid="select-checkout-city"]','Lahore');
check('city/province binding',await evaluate(`document.querySelector('[data-testid="input-checkout-province"]').value==='Punjab'`));
await fill('[data-testid="input-checkout-fullName"]','UI Audit Customer');
await fill('[data-testid="input-checkout-phone"]','123');
await fill('[data-testid="input-checkout-address"]','10 Sample Street');
await click('[data-testid="button-place-order"]');
const validation=await evaluate(`document.querySelector('[data-testid="status-checkout-error"]')?.textContent`);
check('invalid mobile rejected before backend submission',validation?.includes('valid Pakistan mobile'),validation);
await fs.writeFile('nura-audit-evidence/mobile-checkout.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
check('no uncaught browser exceptions',errors.length===0,errors);
await fs.writeFile('nura-audit-evidence/results.json',JSON.stringify({results,errors,scope:'Isolated local fixture. No authenticated Supabase save, actual order placement, external payment/email/provider or production database writes.'},null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,total:results.length,results,errors},null,2));
ws.close();
process.exitCode=results.every(x=>x.pass)?0:1;
