(function(){
  if(window.BipaDataLoader)return;
  const SCRIPTS=Array.from({length:8},(_,i)=>'data/bipa-gz-'+String(i+1).padStart(2,'0')+'.js?v=20260917-json2');
  const EXPECTED={A1:515,A2:290,B1:204,B2:274};
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>resolve();s.onerror=()=>reject(new Error('加载失败：'+src));document.head.appendChild(s);});}
  function countsOf(raw){const out={};Object.keys(EXPECTED).forEach(k=>{out[k]=Array.isArray(raw&&raw[k])?raw[k].length:0});return out}
  function ready(){const c=countsOf(window.BIPA_VOCAB_RAW||{});return Object.keys(EXPECTED).every(k=>c[k]===EXPECTED[k])}
  async function load(){
    if(ready())return window.BIPA_VOCAB_RAW;
    if(typeof DecompressionStream==='undefined')throw new Error('浏览器不支持 BIPA gzip 数据解压');
    window.BIPA_GZ='';
    for(const src of SCRIPTS)await loadScript(src);
    if(!window.BIPA_GZ)throw new Error('BIPA 压缩数据为空');
    const bin=atob(window.BIPA_GZ),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text=await new Response(stream).text();
    window.BIPA_GZ='';
    let raw;
    try{raw=JSON.parse(text)}catch(e){throw new Error('BIPA 压缩数据不是有效 JSON：'+e.message)}
    const counts=countsOf(raw);
    for(const lv of Object.keys(EXPECTED)){
      if(counts[lv]!==EXPECTED[lv])throw new Error('BIPA '+lv+' 数量异常：'+counts[lv]+' / '+EXPECTED[lv]);
    }
    window.BIPA_VOCAB_RAW=raw;
    window.BIPA_RUNTIME_COUNTS=counts;
    window.dispatchEvent(new CustomEvent('bipa-data-ready',{detail:counts}));
    return raw;
  }
  window.BipaDataLoader={load,ready,expected:Object.assign({},EXPECTED)};
})();
