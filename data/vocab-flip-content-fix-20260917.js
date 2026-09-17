(function(){
  if(window.__VOCAB_FLIP_CONTENT_FIX_20260917__)return;
  window.__VOCAB_FLIP_CONTENT_FIX_20260917__=true;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').trim().toLowerCase();

  function currentItem(){
    try{
      const a=Array.isArray(FILTER)?FILTER:[];
      if(!a.length)return null;
      const i=((Number(idx||0)%a.length)+a.length)%a.length;
      return a[i]||a[0]||null;
    }catch(e){return null;}
  }
  function libraryText(){
    const s=$('librarySelect');
    return s&&s.selectedIndex>=0?String(s.options[s.selectedIndex]?.textContent||''):'';
  }
  function bipaLevel(){
    const m=libraryText().match(/BIPA\s*[（(]?\s*(A1|A2|B1|B2)/i);
    return m?m[1].toUpperCase():'';
  }
  function bipaRaw(word){
    const lv=bipaLevel();
    if(!lv)return null;
    const rows=(window.BIPA_VOCAB_RAW&&window.BIPA_VOCAB_RAW[lv])||[];
    const r=rows.find(x=>Array.isArray(x)&&norm(x[0])===norm(word));
    if(!r)return null;
    return {word:r[0]||'',cn:r[1]||'',en:r[2]||'',root:r[3]||'',theme:r[5]||''};
  }
  function value(x,names){
    for(const k of names){
      const v=x&&x[k];
      if(v!=null&&String(v).trim())return String(v).trim();
    }
    return '';
  }
  function details(){
    const x=currentItem();
    if(!x)return {cn:'',en:'',root:'',example:'',exampleCn:'',note:'',bipa:false};
    const r=bipaRaw(x.word);
    const b=!!bipaLevel();
    return {
      cn:(r&&r.cn)||value(x,['cn','zh','zh_cn','chinese','meaning_cn','meaning','translation_cn']),
      en:(r&&r.en)||value(x,['en','english','meaning_en','translation_en']),
      root:(r&&r.root)||value(x,['root','lemma','base','root_word']),
      example:value(x,['example','scene','example_id','sentence']),
      exampleCn:value(x,['example_cn','scene_cn','sentence_cn','example_zh']),
      note:value(x,['note','usage_note','synonym_note']),
      bipa:b
    };
  }
  function meaningHtml(){
    const d=details();
    const cn=d.cn||'暂无中文';
    let h='<div class="vocabUnifiedCn">'+esc(cn)+'</div>';
    if(d.en)h+='<div class="vocabUnifiedEn">'+esc(d.en)+'</div>';
    if(d.root)h+='<div class="vocabUnifiedRoot">词根 · '+esc(d.root)+'</div>';
    // 历史约定：BIPA 翻卡只显示中文、英文、词根；普通词库保留例句/备注。
    if(!d.bipa&&d.example)h+='<div class="vocabUnifiedExample">'+esc(d.example)+'</div>';
    if(!d.bipa&&d.exampleCn)h+='<div class="vocabUnifiedExampleCn">'+esc(d.exampleCn)+'</div>';
    if(!d.bipa&&d.note)h+='<div class="vocabUnifiedNote">'+esc(d.note)+'</div>';
    return h;
  }
  function ensureMeaning(){
    const card=$('vocabUnifiedCard');
    if(!card)return null;
    let m=card.querySelector('.vocabUnifiedMeaning');
    if(!m){
      m=document.createElement('div');
      m.className='vocabUnifiedMeaning';
      const line=card.querySelector('.vocabUnifiedWordLine');
      if(line&&line.parentNode)line.parentNode.appendChild(m);else card.appendChild(m);
    }
    m.innerHTML=meaningHtml();
    return m;
  }

  let st=$('vocabFlipContentFixStyle20260917');
  if(st)st.remove();
  st=document.createElement('style');
  st.id='vocabFlipContentFixStyle20260917';
  st.textContent=`
    #vocab .vocabUnifiedMeaning{display:none!important;visibility:hidden!important;opacity:0!important;margin-top:30px!important;max-width:760px!important;position:static!important;transform:none!important;}
    #vocab .vocabUnifiedCard.revealed .vocabUnifiedMeaning{display:block!important;visibility:visible!important;opacity:1!important;}
    #vocab .vocabUnifiedCard.revealed{height:auto!important;min-height:510px!important;overflow:visible!important;}
    #vocab .vocabUnifiedCard.revealed .vocabUnifiedCn{display:block!important;font-size:27px!important;font-weight:850!important;color:#5d687e!important;line-height:1.45!important;}
    #vocab .vocabUnifiedCard.revealed .vocabUnifiedEn{display:block!important;font-size:20px!important;color:#778197!important;margin-top:8px!important;line-height:1.45!important;}
    #vocab .vocabUnifiedCard.revealed .vocabUnifiedRoot{display:block!important;font-size:16px!important;color:#8a94a8!important;font-weight:750!important;margin-top:16px!important;}
    @media(max-width:700px){#vocab .vocabUnifiedCard.revealed .vocabUnifiedCn{font-size:23px!important}}
  `;
  document.head.appendChild(st);

  window.vocabUnifiedFlip=function(){
    const card=$('vocabUnifiedCard'),btn=$('vocabUnifiedFlipBtn');
    if(!card)return;
    const opening=!card.classList.contains('revealed');
    if(opening){
      const m=ensureMeaning();
      card.classList.add('revealed');
      if(m){
        m.style.setProperty('display','block','important');
        m.style.setProperty('visibility','visible','important');
        m.style.setProperty('opacity','1','important');
      }
      if(btn)btn.textContent='收起';
    }else{
      const m=card.querySelector('.vocabUnifiedMeaning');
      card.classList.remove('revealed');
      if(m){
        m.style.setProperty('display','none','important');
        m.style.setProperty('visibility','hidden','important');
        m.style.setProperty('opacity','0','important');
      }
      if(btn)btn.textContent='翻卡';
    }
  };

  // 每次统一卡片重新渲染后，确保 meaning 容器仍含有当前词的正确内容。
  const box=$('vocabBox');
  if(box){
    new MutationObserver(function(){
      const card=$('vocabUnifiedCard');
      if(!card)return;
      const m=card.querySelector('.vocabUnifiedMeaning');
      if(m&&!m.textContent.trim())m.innerHTML=meaningHtml();
    }).observe(box,{childList:true,subtree:false});
  }
})();
