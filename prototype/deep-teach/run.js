const {chromium}=require('playwright');
const url=process.argv[2]||'http://localhost:8765/deep/index.html';
(async()=>{const b=await chromium.launch();
for(const strat of (process.argv[3]||'weak,strong,mixed').split(',')){
 const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__fast=true});
 await p.goto(url);
 const rights=await p.evaluate(()=>{const r=new Set();const T=window.__TEACH;const add=q=>{if(!q)return;q.options.forEach(o=>{if(o.v==='right')r.add(o.t)});add(q.backup)};T.items.forEach(i=>add(i.check));(T.reading||[]).forEach(x=>add(x.check));return [...r]});
 const ok=await p.evaluate(()=>{const r=[];window.__TEACH.items.forEach(i=>i.scene.options.forEach(o=>{if(o.ok)r.push(o.t)}));return r});
 let n=0,it=0,k=0;
 for(;it<6000&&n<600;it++){
  const L=await p.$$eval('#bar button',bs=>bs.map(b=>({t:b.textContent,c:b.className,d:b.disabled})));
  if(!L.length||L.every(l=>l.d)){await p.waitForTimeout(80);continue}
  if(L.some(l=>l.t==='从头再上一遍'))break;
  const f=t=>L.findIndex(l=>l.t===t),has=t=>f(t)>=0;let pick=-1;k++;
  if(strat==='strong'){
    pick=f('这个我会，直接考我');
    if(pick<0)pick=L.findIndex(l=>rights.includes(l.t));
    if(pick<0)pick=f('自己说出来了');if(pick<0)pick=f('马上想到');
  }else if(strat==='weak'){
    if(has('给我关键词'))pick=f('给我关键词');else if(has('给我句子骨架'))pick=f('给我句子骨架');
    if(pick<0&&L.some(l=>l.c.includes('opt'))){pick=L.findIndex(l=>l.c.includes('opt')&&!rights.includes(l.t)&&!ok.includes(l.t));if(pick<0)pick=L.findIndex(l=>l.c.includes('opt'))}
    if(pick<0)pick=f('没说出来');if(pick<0)pick=f('看了提示说出来了');if(pick<0)pick=f('想不起来');
    if(pick<0)pick=L.findIndex(l=>l.t==='讲简单一点');
  }else{ // mixed: alternate
    if(L.some(l=>l.c.includes('opt'))){pick=k%2?L.findIndex(l=>rights.includes(l.t)||ok.includes(l.t)):L.findIndex(l=>l.c.includes('opt'))}
    if(pick<0)pick=L.findIndex(l=>l.c.includes('ask')&&l.t!=='这个我会，直接考我'&&k%3===0);
    if(pick<0)pick=f(k%2?'自己说出来了':'说了一半');if(pick<0)pick=f('有点慢');
  }
  if(pick<0)pick=L.findIndex(l=>l.c.includes('primary'));if(pick<0)pick=0;
  await p.locator('#bar button').nth(pick).click();n++;
 }
 await p.waitForTimeout(500);
 const info=await p.evaluate(()=>({tags:[...document.querySelectorAll('.msg.tag')].map(e=>e.textContent).filter(t=>t.includes('回想')),sum:(document.querySelector('.sum')||{}).innerText||'NO SUMMARY',ov:document.documentElement.scrollWidth>innerWidth}));
 console.log('=== '+strat+' clicks '+n+' overflow '+info.ov+' errors '+JSON.stringify(errs));info.tags.forEach(t=>console.log('  '+t));console.log(info.sum.split('\n').filter(Boolean).map(x=>'  | '+x).join('\n'));
 if(strat==='weak')await p.screenshot({path:'deep/shot-weak.png'});
}
await b.close()})();
