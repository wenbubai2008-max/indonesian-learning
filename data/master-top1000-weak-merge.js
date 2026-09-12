(function(){
  function norm(w){return String(w||'').trim().toLowerCase()}
  function mem(){try{return JSON.parse(localStorage.getItem('indo_mem')||'{}')}catch(e){return {}}}
  function statusOf(m,w){const k=norm(w);return m[w]||m[k]||''}
  function updateMasterOption(total){
    const sel=document.getElementById('librarySelect');
    const opt=sel&&sel.querySelector('option[value="master"]');
    if(opt)opt.textContent='主学习词库（'+total+'）';
  }
  function merge(){
    const master=Array.isArray(window.MASTER_VOCAB_OBJECTS)?window.MASTER_VOCAB_OBJECTS:[];
    const top=Array.isArray(window.EMBEDDED_DB)?window.EMBEDDED_DB:[];
    if(!master.length||!top.length)return {weak:0,duplicates:0,added:0,total:master.length};
    const m=mem(),seen=new Set(master.map(x=>norm(x&&x.word)).filter(Boolean));
    let weak=0,duplicates=0,added=0;
    top.forEach(x=>{
      if(!x||!x.word)return;
      const s=statusOf(m,x.word),k=norm(x.word);
      if(s!=='fuzzy'&&s!=='dont')return;
      weak++;
      if(seen.has(k)){duplicates++;return;}
      const item=Object.assign({},x);
      item.categories=Array.isArray(item.categories)?item.categories.slice():[];
      if(!item.categories.includes('主学习词库'))item.categories.push('主学习词库');
      if(!item.categories.includes('Top1000不会补充'))item.categories.push('Top1000不会补充');
      item.source=item.source||'Top1000人工核对补充';
      master.push(item);seen.add(k);added++;
    });
    window.MASTER_VOCAB_OBJECTS=master;
    const result={weak:weak,duplicates:duplicates,added:added,total:master.length};
    localStorage.setItem('master_top1000_weak_merge_result',JSON.stringify(result));
    localStorage.setItem('master_top1000_weak_added_count',String(added));
    updateMasterOption(master.length);
    if(document.getElementById('librarySelect')?.value==='master'&&typeof window.refreshMasterVocabulary==='function')window.refreshMasterVocabulary();
    window.dispatchEvent(new CustomEvent('master-top1000-weak-merged',{detail:result}));
    return result;
  }
  function run(){merge();}
  window.mergeTop1000WeakIntoMaster=merge;
  window.addEventListener('vocab-library-ready',()=>setTimeout(run,0));
  if(document.readyState==='complete')setTimeout(run,250);else window.addEventListener('load',()=>setTimeout(run,250),{once:true});
})();
