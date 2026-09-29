(function(){
  if(window.__masterTop1000WeakMergeLoaded)return;
  window.__masterTop1000WeakMergeLoaded=true;

  // 主学习词库只保留人工筛选后的静态核心词库。
  // Top1000 中“模糊 / 不会”的词继续留在 weakness-sync / indo_mem 里复习，
  // 不再永久合并进主学习词库，也不再计入 master 总数。
  const LEGACY_MEMBER_KEY='master_top1000_members_v1';
  let scheduled=false,applying=false;

  function norm(w){return String(w||'').trim().toLowerCase()}
  function isLegacyTopAdded(x){
    if(!x)return false;
    const cats=Array.isArray(x.categories)?x.categories:[];
    return cats.includes('Top1000不会补充') || String(x.source||'')==='Top1000人工核对补充';
  }
  function uniqueCore(arr){
    const seen=new Set(),out=[];
    (arr||[]).forEach(x=>{
      if(!x||!x.word||isLegacyTopAdded(x))return;
      const k=norm(x.word);if(!k||seen.has(k))return;
      seen.add(k);out.push(x);
    });
    return out;
  }
  function clearLegacyMembership(){
    try{
      localStorage.removeItem(LEGACY_MEMBER_KEY);
      localStorage.removeItem('master_top1000_weak_added_count');
      const result=JSON.stringify({disabled:true,reason:'top1000_weak_words_use_weakness_pool_only'});
      if(localStorage.getItem('master_top1000_weak_merge_result')!==result)localStorage.setItem('master_top1000_weak_merge_result',result);
    }catch(e){}
  }
  function updateOption(total){
    const sel=document.getElementById('librarySelect');
    const opt=sel&&sel.querySelector('option[value="master"]');
    const label='主学习词库（'+total+'）';
    if(opt&&opt.textContent!==label)opt.textContent=label;
  }
  function apply(){
    if(applying)return 0;applying=true;
    try{
      clearLegacyMembership();
      const src=Array.isArray(window.MASTER_VOCAB_OBJECTS)?window.MASTER_VOCAB_OBJECTS:[];
      const core=uniqueCore(src);
      const changed=core.length!==src.length||core.some((item,i)=>item!==src[i]);
      if(core.length){
        if(changed){
          window.MASTER_VOCAB_OBJECTS=core;
          window.dispatchEvent(new CustomEvent('master-core-locked',{detail:{total:core.length}}));
        }
        updateOption(core.length);
        try{if(localStorage.getItem('master_core_count_v1')!==String(core.length))localStorage.setItem('master_core_count_v1',String(core.length));}catch(e){}
      }
      return core.length;
    }finally{applying=false;}
  }
  function schedule(){
    if(scheduled)return;scheduled=true;
    setTimeout(function(){scheduled=false;apply();},60);
  }

  // 兼容旧代码：保留函数名，但现在它只负责“锁定核心 master”，不再做 Top1000 合并。
  window.mergeTop1000WeakIntoMaster=apply;
  window.lockMasterToCore=apply;
  window.getEffectiveMasterVocabulary=function(){return uniqueCore(window.MASTER_VOCAB_OBJECTS||[])};

  // Library switches are UI-only: never let one trigger another master-core refresh.
  ['vocab-controller-ready','master-vocab-ready','master-library-selected','master-top1000-weak-merged'].forEach(ev=>window.addEventListener(ev,schedule));
  if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true});
  setTimeout(schedule,250);
  setTimeout(schedule,1200);
})();
