(function(){
  if(window.BipaDataLoader)return;
  const EXPECTED={A1:515,A2:290,B1:204,B2:274};
  const VERSION='20260917-level1';
  const inflight=new Map();

  function normalizeLevel(level){const lv=String(level||'').trim().toUpperCase();return Object.prototype.hasOwnProperty.call(EXPECTED,lv)?lv:''}
  function levelScript(lv){return 'data/bipa-level-'+lv.toLowerCase()+'-gz.js?v='+VERSION}
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error('加载失败：'+src));document.head.appendChild(s)})}
  function count(level){const lv=normalizeLevel(level),raw=window.BIPA_VOCAB_RAW||{};return lv&&Array.isArray(raw[lv])?raw[lv].length:0}
  function ready(level){
    const lv=normalizeLevel(level);
    if(lv)return count(lv)===EXPECTED[lv];
    return Object.keys(EXPECTED).every(k=>count(k)===EXPECTED[k]);
  }
  async function decodeLevel(lv,b64){
    if(typeof DecompressionStream==='undefined')throw new Error('浏览器不支持 BIPA gzip 数据解压');
    const bin=atob(b64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text=await new Response(stream).text();
    let rows;try{rows=JSON.parse(text)}catch(e){throw new Error('BIPA '+lv+' 压缩数据不是有效 JSON：'+e.message)}
    if(!Array.isArray(rows)||rows.length!==EXPECTED[lv])throw new Error('BIPA '+lv+' 数量异常：'+(Array.isArray(rows)?rows.length:0)+' / '+EXPECTED[lv]);
    return rows;
  }
  async function loadOne(level){
    const lv=normalizeLevel(level);if(!lv)throw new Error('未知 BIPA 级别：'+level);
    if(ready(lv))return window.BIPA_VOCAB_RAW[lv];
    if(inflight.has(lv))return inflight.get(lv);
    const job=(async()=>{
      window.BIPA_LEVEL_GZ=window.BIPA_LEVEL_GZ||{};
      if(!window.BIPA_LEVEL_GZ[lv])await loadScript(levelScript(lv));
      const b64=window.BIPA_LEVEL_GZ&&window.BIPA_LEVEL_GZ[lv];
      if(!b64)throw new Error('BIPA '+lv+' 压缩数据为空');
      const rows=await decodeLevel(lv,b64);
      delete window.BIPA_LEVEL_GZ[lv];
      window.BIPA_VOCAB_RAW=window.BIPA_VOCAB_RAW||{};
      window.BIPA_VOCAB_RAW[lv]=rows;
      window.BIPA_RUNTIME_COUNTS=window.BIPA_RUNTIME_COUNTS||{};
      window.BIPA_RUNTIME_COUNTS[lv]=rows.length;
      window.dispatchEvent(new CustomEvent('bipa-data-ready',{detail:{level:lv,count:rows.length}}));
      return rows;
    })();
    inflight.set(lv,job);
    try{return await job}finally{inflight.delete(lv)}
  }
  async function load(level){
    const lv=normalizeLevel(level);
    if(lv)return loadOne(lv);
    for(const k of Object.keys(EXPECTED))await loadOne(k);
    return window.BIPA_VOCAB_RAW;
  }
  window.BipaDataLoader={load,loadLevel:loadOne,ready,count,expected:Object.assign({},EXPECTED),loadedLevels:()=>Object.keys(EXPECTED).filter(ready)};
})();
