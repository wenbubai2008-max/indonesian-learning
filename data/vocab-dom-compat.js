(function(){
  const PM_SWITCH_DATE='2026-09-16';

  function ensureVocabTag(){
    var tag=document.getElementById('vocabTag');
    if(tag)return tag;
    var vocabModule=document.querySelector('#home .module[onclick*="vocab"]');
    if(vocabModule){
      tag=document.createElement('span');
      tag.id='vocabTag';
      tag.className='tag';
      var n=(window.DAILY_VOCAB_DB||[]).length||(window.EMBEDDED_DB||[]).length||0;
      tag.textContent=n?n+' 个词':'加载中...';
      vocabModule.appendChild(tag);
      return tag;
    }
    return null;
  }

  function pmTimeForDate(date){
    return String(date||'')>=PM_SWITCH_DATE?'18:00':'19:00';
  }

  function patchHomeTime(){
    var hero=document.querySelector('#home .hero');
    if(hero){
      Array.from(hero.children||[]).forEach(function(el){
        var text=el&&el.textContent||'';
        if(text.indexOf('每天 08:00 / 19:00')>=0){
          el.textContent=text.replace('08:00 / 19:00','08:00 / 18:00');
        }
      });
    }
    var pmStatus=document.getElementById('pmStatus');
    var pmSlot=pmStatus&&pmStatus.closest?pmStatus.closest('.slot'):null;
    var slotTime=pmSlot&&pmSlot.querySelector?pmSlot.querySelector('.slotTime'):null;
    if(slotTime&&slotTime.textContent!=='18:00')slotTime.textContent='18:00';
    var pmReadingBtn=document.querySelector('#readingPage button[onclick*="loadReading(\'pm\')"]');
    if(pmReadingBtn&&pmReadingBtn.textContent!=='18:00短文')pmReadingBtn.textContent='18:00短文';
  }

  function wrapLoadReading(){
    if(typeof window.loadReading!=='function'||window.loadReading.__pm18Compat)return;
    var original=window.loadReading;
    var wrapped=async function(session){
      var r=await original.apply(this,arguments);
      if(session==='pm'){
        var date=typeof window.today==='function'?window.today():(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
        var meta=document.getElementById('readingMeta');
        var time=pmTimeForDate(date);
        if(meta&&meta.textContent!==time)meta.textContent=time;
      }
      return r;
    };
    wrapped.__pm18Compat=true;
    window.loadReading=wrapped;
  }

  function patch(){
    ensureVocabTag();
    patchHomeTime();
    wrapLoadReading();
    if(typeof window.loadDB==='function'&&!window.loadDB.__domCompat){
      var original=window.loadDB;
      var wrapped=async function(){
        ensureVocabTag();
        return original.apply(this,arguments);
      };
      wrapped.__domCompat=true;
      window.loadDB=wrapped;
    }
  }

  patch();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.addEventListener('load',patch,{once:true});
})();
