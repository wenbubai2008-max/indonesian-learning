const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');

function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
const parts=[];
for(let i=1;i<=8;i++){
  const p=`data/bipa-gz-${String(i).padStart(2,'0')}.js`;
  const s=read(p);
  const m=s.match(/\+'([^']+)'\s*;?\s*$/);
  if(!m)throw new Error(`Cannot extract BIPA base64 from ${p}`);
  parts.push(m[1]);
}
const code=zlib.gunzipSync(Buffer.from(parts.join(''),'base64')).toString('utf8');
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(code,sandbox,{timeout:10000,filename:'bipa-gzip-payload.js'});
const raw=sandbox.window.BIPA_VOCAB_RAW;
if(!raw||typeof raw!=='object')throw new Error('BIPA gzip payload did not define window.BIPA_VOCAB_RAW');
const levels=['A1','A2','B1','B2'];
const counts={};
for(const lv of levels){
  if(!Array.isArray(raw[lv])||raw[lv].length===0)throw new Error(`BIPA ${lv} missing from compressed source`);
  counts[lv]=raw[lv].length;
}
const out=`/* AUTO-GENERATED from data/bipa-gz-01..08.js. Do not edit by hand. */\nwindow.BIPA_VOCAB_RAW=${JSON.stringify(raw)};\nwindow.BIPA_RUNTIME_COUNTS=${JSON.stringify(counts)};\n`;
fs.writeFileSync(path.join(ROOT,'data/bipa-runtime-data.js'),out);
console.log('BIPA runtime counts:',counts);
