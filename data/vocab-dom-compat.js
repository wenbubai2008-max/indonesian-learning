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
    tag=document.createElement('span');
    tag.id='vocabTag';
    tag.style.display='none';
    document.body.appendChild(tag);
    return tag;
  }

  function defaultPmTime(date){return String(date||'')>=PM_SWITCH_DATE?'18:00':'19:00';}

  function patchHomeTime(){
    var hero=document.querySelector('#home .hero');
    if(hero){
      Array.from(hero.children||[]).forEach(function(el){
        if(el&&el.textContent&&el.textContent.indexOf('每天 08:00 / 19:00')>=0){
          el.textContent=el.textContent.replace('08:00 / 19:00','08:00 / 18:00');
        }
      });
    }
    var pmStatus=document.getElementById('pmStatus');
    var pmSlot=pmStatus&&pmStatus.closest?pmStatus.closest('.slot'):null;
    var slotTime=pmSlot&&pmSlot.querySelector?pmSlot.querySelector('.slotTime'):null;
    if(slotTime)slotTime.textContent='18:00';
    var pmReadingBtn=document.querySelector('#readingPage button[onclick*="loadReading(\'pm\')"]');
    if(pmReadingBtn)pmReadingBtn.textContent='18:00短文';
  }

  async function lessonPmTime(date){
    var fallback=defaultPmTime(date);
    try{
      if(typeof window.fetchJSON==='function'){
        var x=await window.fetchJSON('data/daily/'+date+'-pm.json');
        return String((x&&x.time)||fallback);
      }
    }catch(e){}
    return fallback;
  }

  function patchDailyPmDisplay(time){
    time=time||'18:00';
    var mid=document.querySelector('#daily .dailyFixMid span');
    if(mid&&/晚间学习/.test(mid.textContent||''))mid.textContent=time+' 晚间学习';
    document.querySelectorAll('#daily .dailyFixChip').forEach(function(chip){
      if(/晚间学习/.test(chip.textContent||''))chip.textContent=time+' 晚间学习';
    });
    var title=document.getElementById('dailyTitle');
    if(title&&/^(18:00|19:00)\s+晚间学习$/.test((title.textContent||'').trim()))title.textContent=time+' 晚间学习';
    if(title&&/^19:00｜/.test(title.textContent||'')&&time!=='19:00')title.textContent=title.textContent.replace(/^19:00｜/,time+'｜');
  }

  function currentVisiblePmTime(){
    var mid=document.querySelector('#daily .dailyFixMid span');
    var m=mid&&String(mid.textContent||'').match(/(\d{2}:\d{2})\s*晚间学习/);
    if(m)return m[1];
    var date=(document.getElementById('dailyMeta')&&document.getElementById('dailyMeta').textContent||'').trim();
    return defaultPmTime(date);
  }

  function patchToastTime(){
    var toast=document.getElementById('dailyCompleteToast');
    if(!toast||!/晚间学习/.test(toast.textContent||''))return;
    toast.textContent=toast.textContent.replace(/^\d{2}:\d{2}/,currentVisiblePmTime());
  }

  function wrapOpenDaily(){
    if(typeof window.openDaily!=='function'||window.openDaily.__pm18Compat)return;
    var original=window.openDaily;
    var wrapped=async function(session,date){
      var r=await original.apply(this,arguments);
      if(session==='pm'){
        var shown=(document.getElementById('dailyMeta')&&document.getElementById('dailyMeta').textContent||date||'').trim();
        var t=await lessonPmTime(shown);
        patchDailyPmDisplay(t);
      }
      return r;
    };
    wrapped.__pm18Compat=true;
    wrapped.__original=original;
    window.openDaily=wrapped;
  }

  function wrapLoadReading(){
    if(typeof window.loadReading!=='function'||window.loadReading.__pm18Compat)return;
    var original=window.loadReading;
    var wrapped=async function(session){
      var r=await original.apply(this,arguments);
      if(session==='pm'){
        var date=typeof window.today==='function'?window.today():(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
        var t=await lessonPmTime(date);
        var meta=document.getElementById('readingMeta');if(meta)meta.textContent=t;
      }
      return r;
    };
    wrapped.__pm18Compat=true;
    wrapped.__original=original;
    window.loadReading=wrapped;
  }

  function patch(){
    ensureVocabTag();
    patchHomeTime();
    wrapOpenDaily();
    wrapLoadReading();
    patchToastTime();
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
  document.addEventListener('DOMContentLoaded',patch);
  new MutationObserver(function(){ensureVocabTag();patchHomeTime();patchToastTime();}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('load',patch);
})();
