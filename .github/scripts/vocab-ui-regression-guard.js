const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const failures=[];
function ok(cond,msg){if(!cond)failures.push(msg)}

try{
  const index=read('index.html');
  const loader=read('data/vocab-memory-feedback.js');
  const unified=read('data/vocab-unified-renderer-20260917.js');
  const guard=read('data/vocab-unified-ui-guard-20260917.js');
  const flip=read('data/vocab-flip-content-fix-20260917.js');

  new vm.Script(loader,{filename:'data/vocab-memory-feedback.js'});
  new vm.Script(unified,{filename:'data/vocab-unified-renderer-20260917.js'});
  new vm.Script(guard,{filename:'data/vocab-unified-ui-guard-20260917.js'});
  new vm.Script(flip,{filename:'data/vocab-flip-content-fix-20260917.js'});

  const externalScripts=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]);
  const memoryPos=externalScripts.findIndex(x=>x.includes('vocab-memory-feedback.js'));
  ok(memoryPos>=0,'index must load vocab-memory-feedback.js');
  ok(memoryPos===externalScripts.length-1,'vocab-memory-feedback.js must remain the last external script in index.html');

  const workflows=fs.readdirSync(path.join(ROOT,'.github/workflows')).filter(x=>/\.ya?ml$/i.test(x)).sort();
  const expected=['build-learning-runtime.yml','sync-daily-vocab.yml'].sort();
  ok(JSON.stringify(workflows)===JSON.stringify(expected),'temporary one-shot UI/cache workflows must not remain');

  const pBipa=loader.lastIndexOf('vocab-bipa-flip-layout-fix-20260913.js');
  const pUnified=loader.lastIndexOf('vocab-unified-renderer-20260917.js');
  const pGuard=loader.lastIndexOf('vocab-unified-ui-guard-20260917.js');
  const pFlip=loader.lastIndexOf('vocab-flip-content-fix-20260917.js');
  ok(pBipa>=0&&pUnified>pBipa,'unified renderer must load after all historical BIPA renderers');
  ok(pGuard>pUnified,'unified UI guard must load after unified renderer');
  ok(pFlip>pGuard,'flip content restoration must load after the UI guard');

  ok(unified.includes('vocabUnifiedCard'),'unified renderer must output vocabUnifiedCard');
  ok(/window\.renderVocab\s*=\s*render/.test(unified),'unified renderer must own window.renderVocab');
  ok(unified.includes("window.showKnownWords=function(){setView('known')}"),'已掌握 must use unified view');
  ok(unified.includes("window.showReviewWords=function(){setView('review')}"),'待掌握 must use unified view');
  ok(unified.includes('window.applyFilter=function(){return filterByView(true)}'),'search/category filters must use unified filtering');
  ok(unified.includes('vocabUnifiedFlip'),'flip action must stay inside unified card renderer');
  ok(!unified.includes('<div class="item"><span>主题'),'unified renderer must not restore retired metadata tile layout');

  ok(unified.includes('#vocab .vocabUnifiedMeaning{display:none'),'flip detail block must start hidden');
  ok(unified.includes('#vocab .vocabUnifiedCard.revealed .vocabUnifiedMeaning{display:block}'),'revealed selector must outrank hidden selector so meanings can actually open');
  ok(unified.includes('<div class="vocabUnifiedCn">'),'base renderer must contain Chinese meaning');
  ok(unified.includes("const root=d.root?'<div class=\"vocabUnifiedRoot\">词根 · "),'base renderer must show root when the word has one');
  ok(unified.includes("const topic=isBipa()&&d.theme?"),'only BIPA cards may show the theme badge');
  ok(unified.includes("const example=!isBipa()&&d.example?"),'non-BIPA cards keep their example detail while BIPA flip stays Chinese/English/root only');

  ok(guard.includes('const unifiedRender=window.renderVocab'),'guard must capture the final renderer');
  ok(guard.includes('new MutationObserver(restore)'),'guard must detect legacy DOM rewrites');
  ok(guard.includes("window.renderVocab=unifiedRender"),'guard must restore final renderer ownership');
  ok(guard.includes("b.querySelector(':scope > .vocabUnifiedCard')"),'guard must verify the final card is present');

  ok(flip.includes("cn:(r&&r.cn)||value(x,['cn'"),'flip fix must recover Chinese meaning from current word data');
  ok(flip.includes("en:(r&&r.en)||value(x,['en'"),'flip fix must recover English meaning from current word data');
  ok(flip.includes("root:(r&&r.root)||value(x,['root'"),'flip fix must recover root from current word data');
  ok(flip.includes('<div class="vocabUnifiedCn">'),'flip fix must render Chinese meaning');
  ok(flip.includes('<div class="vocabUnifiedRoot">词根 · '),'flip fix must render root when present');
  ok(flip.includes("m.style.setProperty('display','block','important')"),'flip fix must force details visible even if stale CSS exists');
  ok(flip.includes('if(!d.bipa&&d.example)'),'ordinary vocab cards must retain example content');
  ok(flip.includes('BIPA 翻卡只显示中文、英文、词根'),'BIPA flip contract must remain explicit');
}catch(e){
  failures.push('vocab UI guard crashed: '+(e&&e.stack?e.stack:e));
}

if(failures.length){
  console.error('Vocabulary UI regression guard failed:');
  failures.forEach(x=>console.error('  FAIL  '+x));
  process.exit(1);
}
console.log('Vocabulary UI regression guard passed');