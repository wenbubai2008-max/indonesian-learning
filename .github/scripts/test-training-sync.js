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
  // Unauthorized requests are rejected by the Worker.
  const res=await worker.fetch(new Request('https://w.example/training',{headers:{'x-sync-key':'bad'}}),env);
  assert.equal(res.status,401);
  console.log('Training sync tests passed: newest record wins per word, three modes shared, key spelling kept, 404 back-off, auth.');
})().catch(e=>{console.error(e);process.exit(1)});
