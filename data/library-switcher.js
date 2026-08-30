(function(){
  function uniqueByWord(arr){
    const seen=new Set();
    return (arr||[]).filter(x=>x&&x.word&&!seen.has(String(x.word).toLowerCase())&&seen.add(String(x.word).toLowerCase()));
  }
  function sourceFor(key){
    if(key==='daily') return uniqueByWord(window.DAILY_VOCAB_DB||[]);
    return uniqueByWord(window.EMBEDDED_DB||[]);
  }
  function rebuildCategories(){
    const cat=document.getElementById('cat');
    if(!cat)return;
    const cats=[...new Set((DB||[]).flatMap(x=>x.categories||[]))].sort();
    cat.innerHTML='<option value="">全部分类</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join('');
  }
  function setLibrary(key){
    const select=document.getElementById('librarySelect');
    if(select&&select.value!==key)select.value=key;
    DB=sourceFor(key);
    FILTER=DB.slice();
    idx=0;
    rebuildCategories();
    document.getElementById('search').value='';
    document.getElementById('vocabCount').textContent=DB.length;
    document.getElementById('vocabTag').textContent=(key==='daily'?'每日学习词汇 ':'Top1000 ')+DB.length+' 词';
    document.getElementById('dbStatus').textContent=(key==='daily'?'每日学习词汇':'Top1000')+' · '+DB.length+' 词';
    if(DB.length){renderVocab();}else{document.getElementById('vocabBox').innerHTML='<div class="empty">这个词库目前还没有词。每日学习生成后会自动累计到这里。</div>';}
    updateStats();
    localStorage.setItem('selected_vocab_library',key);
  }
  function install(){
    const toolbar=document.querySelector('#vocab .toolbar');
    if(!toolbar||document.getElementById('librarySelect'))return;
    const select=document.createElement('select');
    select.id='librarySelect';
    const topCount=(window.EMBEDDED_DB||[]).length;
    const dailyCount=(window.DAILY_VOCAB_DB||[]).length;
    select.innerHTML='<option value="top1000">Top1000（'+topCount+'）</option><option value="daily">每日学习词汇（'+dailyCount+'）</option>';
    select.onchange=function(){setLibrary(this.value)};
    toolbar.insertBefore(select,toolbar.firstChild);
    loadDB=function(){setLibrary(document.getElementById('librarySelect')?.value||'top1000')};
    window.loadDB=loadDB;
    setLibrary(localStorage.getItem('selected_vocab_library')||'top1000');
  }
  window.switchVocabLibrary=setLibrary;
  window.addEventListener('load',function(){setTimeout(install,0)});
})();
