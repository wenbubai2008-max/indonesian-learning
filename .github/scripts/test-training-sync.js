'use strict';
// 2026-10-14: two simulated devices sync quick / listen / auto training state through the real Worker code.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..','..');
(async()=>{
  const worker=(await import(path.join(repo,'cloudflare','weakness-sync-worker.js'))).default;
  const kv=new Map(),env={SYNC_KEY:'k',ALLOWED_ORIGIN:'https://wenbubai2008-max.github.io',
    WEAK_SYNC_KV:{get:async(k,t)=>kv.has(k)?(t==='json'?JSON.parse(kv.get(k)):kv.get(k)):null,put:async(k,v)=>{kv.set(k,v)}}};
  const src=fs.readFileSync(path.join(repo,'data','training-sync-client.js'),'utf8');
  function device(name,{supported=true}={}){
    const store=new Map(),events=[];
    store.set('indo_weak_sync_config_v1',JSON.stringify({endpoint:'https://w.example',key:'k'}));
    const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
    const fetch=async(url,opt)=>{
      if(!supported)return {status:404,ok:false,json:async()=>({error:'not_found'})};
      const req=new Request(url,{method:opt.method,headers:Object.assign({origin:'https://wenbubai2008-max.github.io'},opt.headers),body:opt.body});
      const res=await worker.fetch(req,env);return {status:res.status,ok:res.ok,json:()=>res.json()};
    };
    const win={addEventListener(){},dispatchEvent(e){events.push(e.type);return true}};
    const ctx={window:win,document:{readyState:'loading',addEventListener(){},visibilityState:'visible'},localStorage,fetch,CustomEvent:function(t,o){this.type=t;this.detail=o&&o.detail},
      setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,Date,JSON,Object,Number,String,Math,Array};
    vm.runInNewContext(src,ctx,{filename:name+'-training-sync-client.js'});
    const read=k=>JSON.parse(store.get(k)||'{}'),write=(k,v)=>store.set(k,JSON.stringify(v));
    return {api:win.TrainingSync,store,read,write,events};
  }
  const phone=device('phone'),laptop=device('laptop');
  phone.write('indo_quick_practice_state',{tunda:{last:1000,review_level:2,review_due:5000}});
  phone.write('indo_automation_training_state_v1',{baru:{word:'baru',stage:3,status:'active',last_at:2000}});
  laptop.write('indo_quick_practice_state',{Tunda:{last:500,review_level:1},lain:{last:3000,review_level:1}});
  laptop.write('indo_listen_stats_v1',{lain:{last_at:'2026-10-14T05:00:00.000Z',review_level:1}});
  await phone.api.run();await laptop.api.run();await phone.api.run();
  for(const d of [phone,laptop]){
    const q=d.read('indo_quick_practice_state'),tunda=q.tunda||q.Tunda;
    assert.equal(tunda.review_level,2,'the newer quick record (phone, last=1000) wins on both devices');
    assert.equal(q.lain.review_level,1,'a word practiced only on the laptop reaches the phone');
    assert.equal(d.read('indo_automation_training_state_v1').baru.stage,3,'automatic training state is shared');
    assert.equal(d.read('indo_listen_stats_v1').lain.review_level,1,'listening state is shared');
  }
  assert.ok(laptop.read('indo_quick_practice_state').Tunda&&!laptop.read('indo_quick_practice_state').tunda,'local key spelling is kept');
  assert.ok(laptop.events.includes('quick-practice-updated'),'modules are told to refresh after a pull');
  const before=JSON.parse(kv.get('training-state-v1')).modes.quick.tunda.review_level;
  laptop.write('indo_quick_practice_state',Object.assign(laptop.read('indo_quick_practice_state'),{Tunda:{last:9000,review_level:3}}));
  await laptop.api.run();await phone.api.run();
  assert.equal(before,2);assert.equal(phone.read('indo_quick_practice_state').tunda.review_level,3,'a later answer on the laptop updates the phone');
  // A Worker without /training (not yet redeployed): the client does nothing and backs off.
  const old=device('old',{supported:false});old.write('indo_quick_practice_state',{x:{last:1}});
  await old.api.run();assert.ok(JSON.parse(old.store.get('indo_training_sync_meta_v1')).unsupported_until>Date.now(),'404 is remembered, no retries every minute');
  assert.deepEqual(old.read('indo_quick_practice_state'),{x:{last:1}},'local state untouched');
  // QR setup (data/sync-device-setup.js): the computer's link configures a new phone, the fragment is removed from
  // the address bar before the page's own navigation reads it, and a phone stuck in the 404 back-off syncs at once.
  const setupSrc=fs.readFileSync(path.join(repo,'data','sync-device-setup.js'),'utf8');
  function setupCtx(hash,store){
    const urls=[],win={};
    const ctx={window:win,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
      location:{hash,pathname:'/indonesian-learning/',search:'',origin:'https://wenbubai2008-max.github.io'},
      history:{replaceState:(s,t,u)=>urls.push(u)},document:{readyState:'loading',addEventListener(){}},
      btoa,atob,escape,unescape,JSON,Object,String,Promise,Array,setTimeout:()=>0,clearTimeout(){}};
    vm.runInNewContext(setupSrc,ctx,{filename:'sync-device-setup.js'});return {api:win.SyncDeviceSetup,urls,win};
  }
  const pc=setupCtx('',new Map([['indo_weak_sync_config_v1',JSON.stringify({endpoint:'https://w.example/',key:'k'})]]));
  const link=pc.api.link({endpoint:'https://w.example',key:'k'},'https://wenbubai2008-max.github.io/indonesian-learning/');
  assert.match(link,/^https:\/\/wenbubai2008-max\.github\.io\/indonesian-learning\/#sync-setup=[A-Za-z0-9_-]+$/,'setup link is a URL fragment, never a query string');
  assert.equal(pc.urls.length,0,'a normal visit leaves the address bar alone');
  const newPhone=device('new-phone');newPhone.store.delete('indo_weak_sync_config_v1');
  newPhone.store.set('indo_training_sync_meta_v1',JSON.stringify({unsupported_until:Date.now()+3600000}));
  const rc=setupCtx(link.slice(link.indexOf('#')),newPhone.store);
  assert.equal(rc.urls.join(),'/indonesian-learning/','the key is removed from the address bar at once');
  assert.equal(newPhone.store.get('indo_weak_sync_config_v1'),undefined,'nothing is saved before the learner taps 启用');
  assert.equal(JSON.stringify(rc.api.parse(link.slice(link.indexOf('#')))),JSON.stringify({endpoint:'https://w.example',key:'k'}));
  assert.equal(rc.api.parse('#sync-setup='+Buffer.from(JSON.stringify({e:'http://w.example',k:'k'})).toString('base64url')),null,'plain http endpoints are refused');
  assert.equal(rc.api.parse('#sync-setup=%%%'),null,'a damaged link is refused');
  rc.win.TrainingSync=newPhone.api;await rc.api.accept(rc.api.parse(link.slice(link.indexOf('#'))));
  assert.deepEqual(JSON.parse(newPhone.store.get('indo_weak_sync_config_v1')),{endpoint:'https://w.example',key:'k'});
  assert.ok(!JSON.parse(newPhone.store.get('indo_training_sync_meta_v1')).unsupported_until,'setting up lifts the 404 back-off');
  assert.equal(newPhone.read('indo_quick_practice_state').tunda.review_level,3,'the newly set-up phone receives the existing training state');
  // GitHub writes only in the pre-generator windows (Jakarta 06:40-07:15, 10:40-11:15, 16:40-17:20, 21:00-21:10).
  {
    const calls=[],realFetch=globalThis.fetch;
    globalThis.fetch=async(u,o)=>{calls.push((o&&o.method||'GET')+' '+u);return (o&&o.method==='PUT')?new Response('{}',{status:200}):new Response('{}',{status:404});};
    const genv=Object.assign({},env,{GITHUB_TOKEN:'t'});
    const tick=async(utcH,utcM)=>{const jobs=[];kv.set('weakness-state-v1',JSON.stringify({version:1,updated_at:'2026-10-14T05:00:00.000Z',dirty:true,words:{x:{word:'x'}}}));calls.length=0;
      await worker.scheduled({scheduledTime:Date.UTC(2026,9,14,utcH,utcM)},genv,{waitUntil:p=>jobs.push(p)});await Promise.all(jobs);return calls.some(c=>c.startsWith('PUT'));};
    try{
      for(const [h,m,want,label] of [[6,0,false,'13:00'],[23,35,false,'06:35'],[23,40,true,'06:40'],[0,10,true,'07:10'],[0,15,false,'07:15'],[3,45,true,'10:45'],[9,40,true,'16:40'],[10,15,true,'17:15'],[10,20,false,'17:20'],[14,0,true,'21:00'],[14,10,false,'21:10'],[18,0,false,'01:00']])
        assert.equal(await tick(h,m),want,'Jakarta '+label+' GitHub write='+want);
      kv.set('weakness-state-v1',JSON.stringify({version:1,updated_at:'x',dirty:false,words:{}}));calls.length=0;
      const jobs=[];await worker.scheduled({scheduledTime:Date.UTC(2026,9,14,0,0)},genv,{waitUntil:p=>jobs.push(p)});await Promise.all(jobs);
      assert.equal(calls.length,0,'a clean state never writes, even inside a window');
      const res=await worker.fetch(new Request('https://w.example/flush',{method:'POST',headers:{'x-sync-key':'k'},body:'{}'}),(kv.set('weakness-state-v1',JSON.stringify({version:1,updated_at:'y',dirty:true,words:{}})),genv));
      assert.equal(res.status,200);assert.ok(calls.some(c=>c.startsWith('PUT')),'立即同步 (/flush) still writes at once');
    }finally{globalThis.fetch=realFetch;}
  }
  // Unauthorized requests are rejected by the Worker.
  const res=await worker.fetch(new Request('https://w.example/training',{headers:{'x-sync-key':'bad'}}),env);
  assert.equal(res.status,401);
  console.log('Training sync tests passed: newest record wins per word, three modes shared, key spelling kept, 404 back-off, QR setup link, GitHub write windows, auth.');
})().catch(e=>{console.error(e);process.exit(1)});
