(function(root){
  'use strict';
  // Only new, actually observed responses. Never backfill ability from mastered or exposure.
  const KEY='indo_vocab_profile_evidence_v2';
  const LEGACY='indo_vocab_profile_evidence_v1';
  const LIMIT=1500;
  const MEMORY_KEY='indo_vocab_profile_longterm_v1';
  const norm=s=>String(s||'').trim().toLowerCase();
  function jakartaDay(iso){
    const date=new Date(iso);
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const map=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    return map.year+'-'+map.month+'-'+map.day;
  }
  function taughtSet(){
    return new Set((Array.isArray(root.DAILY_VOCAB_DB)?root.DAILY_VOCAB_DB:[]).map(x=>norm(x&&x.word)).filter(Boolean));
  }
  function normalize(x){
    if(!x||typeof x!=='object')return null;
    const word=norm(x.word),source=String(x.source||''),at=String(x.at||'');
    const t=Date.parse(at);
    if(!word||word.length>80||!Number.isFinite(t)||!['auto','quick','listen'].includes(source))return null;
    let result=String(x.result||''),stage=Number(x.stage||0);
    if(source==='auto'&&(![1,2,3,4].includes(stage)||!['direct','slow','right','hinted','fail','stable','self_checked'].includes(result)))return null;
    if(source==='quick'&&!['right','wrong'].includes(result))return null;
    if(source==='listen'&&!['fast_first','slow','wrong'].includes(result))return null;
    const id=String(x.id||[source,word,new Date(t).toISOString(),stage,result].join('|'));
    return {id:id.slice(0,180),word,source,at:new Date(t).toISOString(),result,stage:source==='auto'?stage:0};
  }
  function safeParse(key){
    try{const v=JSON.parse(root.localStorage.getItem(key)||'null');return Array.isArray(v)?v:[]}
    catch(e){return []}
  }
  function records(){
    let entries=safeParse(KEY),hasCurrent=false;
    try{hasCurrent=!!root.localStorage.getItem(KEY)}catch(e){return []}
    if(!hasCurrent){
      // The first profile version only captured genuine auto-training events.
      entries=safeParse(LEGACY).map(x=>Object.assign({},x,{source:'auto'}));
    }
    const taught=taughtSet(),seen=new Set();
    return entries.map(normalize).filter(x=>{
      if(!x||!taught.has(x.word)||seen.has(x.id))return false;
      seen.add(x.id);return true;
    }).slice(-LIMIT).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  }

  // Durable per-word state is independent of the rolling 1500-event display log.
  // A one-time migration replays ONLY real local events; no invented historical proficiency.
  function blank(word){return {word,attempts:0,last_at:'',last_id:'',direct:false,context:false,expression:false,verification_days:[],recognition_count:0,recognition_days:[],ever_verified:false,active:false,forgotten:false,relearned:false}}
  function advance(state,e){
    const s=state.words[e.word]||blank(e.word),day=jakartaDay(e.at);
    if(s.last_at&&(Date.parse(e.at)<Date.parse(s.last_at)||e.id===s.last_id))return;
    s.attempts++;s.last_at=e.at;s.last_id=e.id;
    if(e.source==='auto'){
      if(e.result==='fail'){
        if(s.active){s.active=false;s.forgotten=true}
        s.direct=false;s.context=false;s.expression=false;s.verification_days=[];
      }else{
        if(e.stage===1&&e.result==='direct')s.direct=true;
        if(e.stage===2&&e.result==='right')s.context=true;
        if(e.stage===3&&['right','self_checked'].includes(e.result))s.expression=true;
        if(e.stage===4&&['right','stable'].includes(e.result)){
          if(!s.verification_days.includes(day))s.verification_days.push(day);
          s.verification_days=s.verification_days.slice(-2);
          if(!s.active&&s.direct&&s.context&&s.expression&&s.verification_days.length>=2){
            s.active=true;if(s.ever_verified&&s.forgotten){s.relearned=true;s.forgotten=false}
            s.ever_verified=true;
          }
        }
      }
    }else if(e.result==='wrong'){
      s.recognition_count=0;s.recognition_days=[];
    }else if(e.source==='quick'&&e.result==='right'||e.source==='listen'&&e.result==='fast_first'){
      s.recognition_count=Math.min(3,s.recognition_count+1);
      if(!s.recognition_days.includes(day))s.recognition_days.push(day);
      s.recognition_days=s.recognition_days.slice(-2);
    }
    state.words[e.word]=s;state.total++;
  }
  function initialState(){
    const state={version:1,total:0,words:{}};
    records().forEach(e=>advance(state,e));
    return state;
  }
  function longterm(){
    try{
      const s=JSON.parse(root.localStorage.getItem(MEMORY_KEY)||'null');
      if(s&&s.version===1&&s.words&&typeof s.words==='object'&&Number.isSafeInteger(s.total))return s;
    }catch(e){}
    const s=initialState();
    try{root.localStorage.setItem(MEMORY_KEY,JSON.stringify(s))}catch(e){}
    return s;
  }
  function compactSummary(state){
    const rows=Object.values(state.words||{}).filter(x=>x&&x.last_at);
    const result={attempts:state.total,observed:rows.length,active:0,passive:0,forgotten:0,relearned:0,words:[]};
    rows.forEach(s=>{
      const passive=!s.active&&s.recognition_count>=3&&s.recognition_days.length>=2;
      if(s.active)result.active++;
      if(passive)result.passive++;
      if(s.forgotten&&!s.active)result.forgotten++;
      if(s.relearned&&s.active)result.relearned++;
      result.words.push({word:s.word,active:!!s.active,passive,forgotten:!!(s.forgotten&&!s.active),relearned:!!(s.relearned&&s.active),attempts:s.attempts,last_at:s.last_at});
    });
    result.words.sort((a,b)=>b.last_at.localeCompare(a.last_at));
    return result;
  }
  function capture(raw){
    const event=normalize(raw);
    if(!event||!taughtSet().has(event.word))return false;
    const list=records(),memory=longterm(),previous=memory.words[event.word];
    if(list.some(x=>x.id===event.id)||previous&&(event.id===previous.last_id||Date.parse(event.at)<Date.parse(previous.last_at)))return false;
    list.push(event);
    list.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    try{root.localStorage.setItem(KEY,JSON.stringify(list.slice(-LIMIT)))}
    catch(e){return false}
    advance(memory,event);
    try{root.localStorage.setItem(MEMORY_KEY,JSON.stringify(memory))}catch(e){console.warn('Profile long-term memory not persisted',e)}
    root.dispatchEvent(new CustomEvent('vocab-profile-evidence-updated',{detail:{word:event.word,source:event.source}}));
    return true;
  }
  function summarize(input){
    if(!Array.isArray(input))return compactSummary(longterm());
    const rows=input.map(normalize).filter(Boolean).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const byWord=new Map();
    for(const event of rows){
      const group=byWord.get(event.word)||[];
      group.push(event);byWord.set(event.word,group);
    }
    const result={attempts:rows.length,observed:byWord.size,active:0,passive:0,forgotten:0,relearned:0,words:[]};
    byWord.forEach((events,word)=>{
      let everVerified=false,currentlyVerified=false,forgotten=false,wasRelearned=false;
      let direct=false,context=false,expression=false,verifyDates=new Set();
      let recognition=[];
      for(const e of events){
        if(e.source==='auto'){
          if(e.result==='fail'){
            if(currentlyVerified){currentlyVerified=false;forgotten=true;}
            direct=false;context=false;expression=false;verifyDates=new Set();
          }else{
            if(e.stage===1&&e.result==='direct')direct=true;
            if(e.stage===2&&e.result==='right')context=true;
            if(e.stage===3&&['right','self_checked'].includes(e.result))expression=true; // User-confirmed expression is not independently grammar-graded.
            if(e.stage===4&&['right','stable'].includes(e.result)){
              verifyDates.add(jakartaDay(e.at));
              if(!currentlyVerified&&direct&&context&&expression&&verifyDates.size>=2){
                currentlyVerified=true;
                if(everVerified&&forgotten){wasRelearned=true;forgotten=false;}
                everVerified=true;
              }
            }
          }
        }
        if(e.source==='quick'||e.source==='listen'){
          if(e.result==='wrong')recognition=[];
          else if(e.source==='quick'&&e.result==='right'||e.source==='listen'&&e.result==='fast_first')recognition.push(e);
        }
      }
      const passive=!currentlyVerified&&recognition.length>=3&&new Set(recognition.map(e=>jakartaDay(e.at))).size>=2;
      if(currentlyVerified)result.active++;
      if(passive)result.passive++;
      if(forgotten&&!currentlyVerified)result.forgotten++;
      if(wasRelearned&&currentlyVerified)result.relearned++;
      result.words.push({word,active:currentlyVerified,passive,forgotten:forgotten&&!currentlyVerified,relearned:wasRelearned&&currentlyVerified,attempts:events.length,last_at:events[events.length-1].at});
    });
    result.words.sort((a,b)=>b.last_at.localeCompare(a.last_at));
    return result;
  }
  root.VocabProfileEvidence={records,summarize,capture};
  root.addEventListener('automation-training-updated',function(ev){
    const d=ev&&ev.detail||{},st=d.state||{},at=Number(st.last_at),word=norm(d.word);
    if(!Number.isFinite(at)||at<=0)return;
    capture({id:['auto',word,at,st.attempts].join('|'),source:'auto',word,at:new Date(at).toISOString(),stage:st.last_stage,result:st.last_result});
  });
  root.addEventListener('quick-practice-updated',function(ev){
    const d=ev&&ev.detail||{},s=d.state||{},at=Number(s.last),word=norm(d.word);
    if(!Number.isFinite(at)||at<=0)return;
    capture({id:['quick',word,at,s.right,s.wrong].join('|'),source:'quick',word,at:new Date(at).toISOString(),result:d.ok?'right':'wrong'});
  });
  root.addEventListener('listening-answer-recorded',function(ev){
    const d=ev&&ev.detail||{},word=norm(d.word),at=String(d.at||'');
    if(!Number.isFinite(Date.parse(at)))return;
    capture({id:['listen',word,at,d.attempts].join('|'),source:'listen',word,at,result:d.ok?(d.fast_first?'fast_first':'slow'):'wrong'});
  });
})(window);
