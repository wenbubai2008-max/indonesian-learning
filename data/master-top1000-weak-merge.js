(function(){
  const MEMBER_KEY='master_top1000_members_v1';
  function norm(w){return String(w||'').trim().toLowerCase()}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function statusOf(m,w){const k=norm(w);return m[w]||m[k]||''}
  function loadMembers(){
    try{
      const raw=JSON.parse(localStorage.getItem(MEMBER_KEY)||'[]');
      if(Array.isArray(raw))return new Set(raw.map(norm).filter(Boolean));
      if(raw&&typeof raw==='object')return new Set(Object.keys(raw).map(norm).filter(Boolean));
    }catch(e){}
    return new Set();
  }
  function saveMembers(set){localStorage.setItem(MEMBER_KEY,JSON.stringify(Array.from(set).sort()))}
  function isTopAdded(x){return Array.isArray(x&&x.categories)&&x.categories.includes('Top1000不会补充')}
  function cloneAsMaster(x){
    const item=Object.assign({},x);
    item.categories=Array.isArray(item.categories)?item.categories.slice():[];
    if(!item.categories.includes('主学习词库'))item.categories.push('主学习词库');
    if(!item.categories.includes('Top1000不会补充'))item.categories.push('Top1000不会补充');
    item.source=item.source||'Top1000人工核对补充';
    return item;
  }
  function unique(arr){
    const seen=new Set(),out=[];
    (arr||[]).forEach(x=>{const k=norm(x&&x.word);if(!k||seen.has(k))return;seen.add(k);out.push(x)});
    return out;
  }
  function updateMasterOption(total){
    const sel=document.getElementById('librarySelect');
    const opt=sel&&sel.querySelector('option[value="master"]');
    if(opt)opt.textContent='主学习词库（'+total+'）';
  }
  function effective(){return unique(Array.isArray(window.MASTER_VOCAB_OBJECTS)?window.MASTER_VOCAB_OBJECTS:[])}
  function merge(){
    let master=effective();
    const top=Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[];
    if(!master.length||!top.length)return {weak:0,duplicates:0,added:0,total:master.length,members:0};

    const m=mem(),members=loadMembers();
    const baseSeen=new Set(master.filter(x=>!isTopAdded(x)).map(x=>norm(x.word)).filter(Boolean));
    const topMap=new Map();top.forEach(x=>{const k=norm(x&&x.word);if(k&&!topMap.has(k))topMap.set(k,x)});
    let weak=0,duplicates=0,newMembers=0;

    // First migration: any Top1000 word the user marked fuzzy/don't becomes a permanent
    // member of the main-learning library unless it was already in the static master base.
    topMap.forEach((x,k)=>{
      const s=statusOf(m,x.word);
      if(s!=='fuzzy'&&s!=='dont')return;
      weak++;
      if(baseSeen.has(k)){duplicates++;return;}
      if(!members.has(k)){members.add(k);newMembers++;}
    });
    saveMembers(members);

    // Re-apply the saved membership on every load. Once added to the main library,
    // changing the learning status to "know" must not make the word disappear later.
    const seen=new Set(master.map(x=>norm(x&&x.word)).filter(Boolean));
    let restored=0;
    members.forEach(k=>{
      if(baseSeen.has(k)||seen.has(k))return;
      const src=topMap.get(k);if(!src)return;
      master.push(cloneAsMaster(src));seen.add(k);restored++;
    });
    master=unique(master);
    window.MASTER_VOCAB_OBJECTS=master;
    window.getEffectiveMasterVocabulary=function(){return unique(window.MASTER_VOCAB_OBJECTS||[])};

    const result={weak:weak,duplicates:duplicates,added:newMembers,restored:restored,total:master.length,members:members.size};
    localStorage.setItem('master_top1000_weak_merge_result',JSON.stringify(result));
    localStorage.setItem('master_top1000_weak_added_count',String(members.size));
    updateMasterOption(master.length);
    if(document.getElementById('librarySelect')?.value==='master'&&typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();
    window.dispatchEvent(new CustomEvent('master-top1000-weak-merged',{detail:result}));
    return result;
  }
  function run(){merge();}
  window.getEffectiveMasterVocabulary=effective;
  window.mergeTop1000WeakIntoMaster=merge;
  window.addEventListener('vocab-library-ready',()=>setTimeout(run,0));
  if(document.readyState==='complete')setTimeout(run,250);else window.addEventListener('load',()=>setTimeout(run,250),{once:true});
})();
