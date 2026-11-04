'use strict';
// Explicit user-marked unfamiliar vocabulary that is not already in an active master
// bank can be first-taught in regular lessons. This is a small, bounded supplement,
// not an expansion of the 977 primary library or the curated BIPA secondary library.
const key=s=>String(s||'').trim().toLowerCase();
const reasons=x=>Array.isArray(x&&x.reasons)?x.reasons:[];
function collectUnfamiliar({weakWords,dailySet,primarySet,secondarySet}){
 const out=[],seen=new Set();
 for(const x of Array.isArray(weakWords)?weakWords:[]){
  const word=String(x&&x.word||'').trim(),k=key(word);
  if(!k||seen.has(k)||x.status!=='active'||reasons(x).includes('training_excluded'))continue;
  if(!reasons(x).some(r=>r==='manual_unknown'||r==='seed_unfamiliar'))continue;
  if(dailySet.has(k)||primarySet.has(k)||secondarySet.has(k))continue;
  // Avoid automatically teaching incomplete/garbled local marks as new vocabulary.
  const cn=String(x.cn||'').trim();
  if(!cn||['暂无释义','暂未查到释义','查询中文释义…'].includes(cn))continue;
  if(word.length>80||/[<>\r\n\t]/.test(word))continue;
  seen.add(k);out.push({word,cn,root:String(x.root||'').trim(),root_cn:String(x.root_cn||'').trim()});
 }
 return out;
}
module.exports={collectUnfamiliar};
