const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const crypto=require('crypto');

const ROOT=path.resolve(__dirname,'../..');
const EXPECTED={A1:515,A2:290,B1:204,B2:274};
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(ROOT,p),s,'utf8');

const chunks=[];
for(let i=1;i<=8;i++){
  const p=`data/bipa-gz-${String(i).padStart(2,'0')}.js`;
  const s=read(p);
  const m=s.match(/\+'([^']+)'\s*;?\s*$/);
  if(!m)throw new Error('Cannot parse '+p);
  chunks.push(m[1]);
}

const raw=JSON.parse(zlib.gunzipSync(Buffer.from(chunks.join(''),'base64')).toString('utf8'));
const manifest={version:1,source:'data/bipa-gz-01.js..08.js',levels:{}};

for(const [lv,count] of Object.entries(EXPECTED)){
  const rows=raw[lv];
  if(!Array.isArray(rows)||rows.length!==count)throw new Error(`BIPA ${lv} count mismatch: ${Array.isArray(rows)?rows.length:0} / ${count}`);
  const json=JSON.stringify(rows);
  const gz=zlib.gzipSync(Buffer.from(json,'utf8'),{level:9});
  const b64=gz.toString('base64');
  const out=`window.BIPA_LEVEL_GZ=window.BIPA_LEVEL_GZ||{};window.BIPA_LEVEL_GZ.${lv}='${b64}';\n`;
  const file=`data/bipa-level-${lv.toLowerCase()}-gz.js`;
  write(file,out);
  manifest.levels[lv]={count,raw_bytes:Buffer.byteLength(json),gzip_bytes:gz.length,sha256:crypto.createHash('sha256').update(json).digest('hex')};
}
write('data/bipa-level-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Built BIPA per-level chunks:',manifest.levels);
