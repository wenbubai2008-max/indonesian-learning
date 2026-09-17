const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const failures=[];
function ok(cond,msg){if(!cond)failures.push(msg)}

try{
  const index=read('index.html');
  const loader=read('data/vocab-memory-feedback.js');
  const unified=read('data/vocab-unified-renderer-20260917.js');
  const bipaState=read('data/vocab-bipa-state-20260917.js');
  const toolbar=read('data/vocab-bipa-toolbar-compact-20260917.js');
  const guard=read('data/vocab-unified-ui-guard-20260917.js');
  const flip=read('data/vocab-flip-content-fix-20260917.js');
  const reviewStub=read('data/vocab-review-ui.js');

  [
    ['data/vocab-memory-feedback.js',loader],
    ['data/vocab-unified-renderer-20260917.js',unified],
    ['data/vocab-bipa-state-20260917.js',bipaState],
    ['data/vocab-bipa-toolbar-compact-20260917.js',toolbar],
    ['data/vocab-unified-ui-guard-20260917.js',guard],
    ['data/vocab-flip-content-fix-20260917.js',flip],
    ['data/vocab-review-ui.js',reviewStub]
  ].forEach(([name,code])=>new vm.Script(code,{filename:name}));

  const externalScripts=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]);
  const memoryPos=externalScripts.findIndex(x=>x.includes('vocab-memory-feedback.js'));
  ok(memoryPos>=0,'index must load vocab-memory-feedback.js');
  ok(memoryPos===externalScripts.length-1,'vocab-memory-feedback.js must remain the last external script in index.html');

  const activeOrder=[
    'vocab-unified-renderer-20260917.js',
    'vocab-bipa-state-20260917.js',
    'vocab-bipa-toolbar-compact-20260917.js',
    'vocab-unified-ui-guard-20260917.js',
    'vocab-flip-content-fix-20260917.js'
  ];
  let last=-1;
  activeOrder.forEach(name=>{const p=loader.indexOf(name);ok(p>last,'active vocabulary chain order broken at '+name);last=p;});

  const retired=[
    'vocab-bipa-badge-audio-fix-20260913.js',
    'vocab-bipa-final-20260913.js',
    'vocab-bipa-flip-layout-fix-20260913.js',
    'vocab-bipa-progress-fix-20260913.js',
    'vocab-bipa-stable-20260913.js',
    'vocab-bipa-switch-polish-20260913.js',
    'vocab-final-fix-20260913.js',
    'vocab-final-hotfix-20260913.js',
    'vocab-ui-cleanup-20260913.js',
    'vocab-scoped-stats.js'
  ];
  retired.forEach(name=>{
    ok(!loader.includes(name),'retired script must not be loaded by vocab loader: '+name);
    ok(!index.includes('data/'+name),'retired script must not be loaded by index: '+name);
    ok(!exists('data/'+name),'retired script must not remain in active data directory: '+name);
    ok(exists('archive/vocab-legacy/'+name),'retired script must exist in archive: '+name);
  });
  ok(exists('archive/vocab-legacy/vocab-review-ui-legacy-20260831.js'),'old review UI must be archived');
  ok(reviewStub.includes('__VOCAB_REVIEW_UI_RETIRED_20260917__'),'review UI path must remain an inert compatibility stub');
  ok(!reviewStub.includes('renderReviewQueue'),'review stub must not contain legacy renderer');
  ok(exists('archive/vocab-legacy/README.md'),'legacy archive must include rules README');

  ok(unified.includes('vocabUnifiedCard'),'unified renderer must output vocabUnifiedCard');
  ok(/window\.renderVocab\s*=\s*render/.test(unified),'unified renderer must own window.renderVocab');
  ok(unified.includes("window.showKnownWords=function(){setView('known')}"),'已掌握 must use unified view');
  ok(unified.includes("window.showReviewWords=function(){setView('review')}"),'待掌握 must use unified view');
  ok(unified.includes('window.applyFilter=function(){return filterByView(true)}'),'search/category filters must use unified filtering');
  ok(unified.includes('vocabUnifiedFlip'),'flip action must stay inside unified card renderer');
  ok(!unified.includes('<div class="item"><span>主题'),'retired metadata tile layout must never return');

  ok(bipaState.includes('window.bipaMarkFinal=function(v)'),'BIPA marking must be state-only in active module');
  ok(bipaState.includes("'indo_bipa_mem_'+level()"),'BIPA must keep independent progress memory');
  ok(bipaState.includes('sabFilterStable'),'BIPA S/A/B filter must be created by active state module');
  ok(bipaState.includes('syncTopics()'),'BIPA theme filter must be maintained by active state module');
  ok(!bipaState.includes('innerHTML=\'<div id="bipaV7Card"'),'BIPA state module must not render a legacy card');

  ok(guard.includes('const unifiedRender=window.renderVocab'),'guard must capture the final renderer');
  ok(guard.includes('new MutationObserver(restore)'),'guard must detect legacy DOM rewrites');
  ok(guard.includes("window.renderVocab=unifiedRender"),'guard must restore final renderer ownership');

  ok(flip.includes('BIPA：中文 → 英文 → 词根'),'BIPA detail order must stay Chinese, English, then root');
  ok(flip.includes('#vocab .vocabUnifiedCard{justify-content:flex-start!important;}'),'card must not vertically recenter on flip');
  ok(flip.includes('#vocab .vocabUnifiedCore{width:100%!important;margin-top:145px!important;transform:none!important;}'),'ordinary word position must stay fixed');
  ok(flip.includes('#vocab .vocabUnifiedCard.vocabUnifiedBipa .vocabUnifiedCore{margin-top:85px!important;}'),'BIPA word position must stay fixed');

  const workflows=fs.readdirSync(path.join(ROOT,'.github/workflows')).filter(x=>/\.ya?ml$/i.test(x)).sort();
  const expected=['build-learning-runtime.yml','sync-daily-vocab.yml'].sort();
  ok(JSON.stringify(workflows)===JSON.stringify(expected),'temporary one-shot workflows must not remain');
}catch(e){
  failures.push('vocab UI guard crashed: '+(e&&e.stack?e.stack:e));
}

if(failures.length){
  console.error('Vocabulary UI regression guard failed:');
  failures.forEach(x=>console.error('  FAIL  '+x));
  process.exit(1);
}
console.log('Vocabulary UI regression guard passed');
