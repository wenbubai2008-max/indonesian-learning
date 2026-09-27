'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');
const assert=require('assert/strict');
const writer=path.resolve(__dirname,'write-vocab-profile-snapshot.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vocab-profile-test-'));
function save(name,value){fs.writeFileSync(path.join(root,'data',name),JSON.stringify(value,null,2)+'\n');}
function run(expectSuccess=true){
 const x=spawnSync(process.execPath,[writer],{cwd:root,encoding:'utf8'});
 assert.equal(x.status,expectSuccess?0:1,x.stdout+'\n'+x.stderr);
 return x;
}
try{
 fs.mkdirSync(path.join(root,'data'));
 const at='2026-09-27T05:32:00.649Z';
 const p={generated_at:'2026-09-27T11:13:39.313Z',source_updated_at:at,taught_total:3,confirmed_mastered:1,needs_reinforcement:1,unverified:1};
 const r={generated_at:'2026-09-27T11:13:39.201Z',weakness_updated_at:at,stats:{daily_taught_unique:3,review_pool_total_full:1}};
 const w={updated_at:at};
 save('vocab-profile.json',p);save('learning-runtime.json',r);save('weakness-sync.json',w);
 run();
 const h=path.join(root,'data/vocab-profile-history.json');
 const first=fs.readFileSync(h,'utf8'),obj=JSON.parse(first);
 assert.equal(obj.version,1);assert.equal(obj.timezone,'Asia/Jakarta');
 assert.equal(obj.snapshots.length,1);
 assert.match(obj.snapshots[0].date,/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(obj.snapshots[0].taught_total,3);
 run();assert.equal(fs.readFileSync(h,'utf8'),first,'Unchanged daily observation must be idempotent');
 p.confirmed_mastered=2;p.needs_reinforcement=0;r.stats.review_pool_total_full=0;
 save('vocab-profile.json',p);save('learning-runtime.json',r);
 run();let next=JSON.parse(fs.readFileSync(h,'utf8'));
 assert.equal(next.snapshots.length,1,'Same Jakarta day must upsert');
 assert.equal(next.snapshots[0].confirmed_mastered,2);
 const stable=fs.readFileSync(h,'utf8');
 p.source_updated_at='2026-09-26T01:00:00.000Z';save('vocab-profile.json',p);
 run(false);assert.equal(fs.readFileSync(h,'utf8'),stable,'Invalid source watermark must not alter history');
 console.log('Profile snapshot tests passed: ISO date, initial snapshot, idempotence, same-day upsert, invalid watermark guard.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
