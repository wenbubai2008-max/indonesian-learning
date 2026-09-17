const fs=require('fs');
const path=require('path');
const vm=require('vm');
const zlib=require('zlib');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const failures=[];
function ok(cond,msg){if(!cond)failures.push(msg)}

try{
  const index=read('index.html');
  const loader=read('data/vocab-memory-feedback.js');
  const bipaLoader=read('data/bipa-json-loader-20260917.js');
  const controller=read('data/vocab-controller-20260917.js');
  const unified=read('data/vocab-unified-renderer-20260917.js');
  const toolbar=read('data/vocab-bipa-toolbar-compact-20260917.js');
  const guard=read('data/vocab-unified-ui-guard-20260917.js');
  const flip=read('data/vocab-flip-content-fix-20260917.js');
  const libraryStub=read('data/library-switcher.js');
  const reviewStub=read('data/vocab-review-ui.js');
  const bipaStateStub=read('data/vocab-bipa-state-20260917.js');

  [
    ['data/vocab-memory-feedback.js',loader],
    ['data/bipa-json-loader-20260917.js',bipaLoader],
    ['data/vocab-controller-20260917.js',controller],
    ['data/vocab-unified-renderer-20260917.js',unified],
    ['data/vocab-bipa-toolbar-compact-20260917.js',toolbar],
    ['data/vocab-unified-ui-guard-20260917.js',guard],
    ['data/vocab-flip-content-fix-20260917.js',flip],
    ['data/library-switcher.js',libraryStub],
    ['data/vocab-review-ui.js',reviewStub],
    ['data/vocab-bipa-state-20260917.js',bipaStateStub]
  ].forEach(([name,code])=>new vm.Script(code,{filename:name}));

  const externalScripts=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]);
  const memoryPos=externalScripts.findIndex(x=>x.includes('vocab-memory-feedback.js'));
  ok(memoryPos>=0,'index must load vocab-memory-feedback.js');
  ok(memoryPos===externalScripts.length-1,'vocab-memory-feedback.js must remain the last external script in index.html');
  ok(!externalScripts.some(x=>x.includes('library-switcher.js')),'legacy library-switcher must not be loaded by index.html');
  ok(!index.includes('sessionCount'),'retired 今日完成 vocab stat must not exist in index.html');
  ok(!index.includes('<span>今日完成</span>'),'retired 今日完成 vocab stat label must not exist in index.html');
  ok(index.includes('grid-template-columns:repeat(3,1fr)'),'vocabulary stats bar must be three columns');
  ok(index.includes('onclick="showReviewWords()"'),'待掌握 card must stay inside the vocabulary controller flow');

  const pData=loader.indexOf('bipa-json-loader-20260917.js');
  const pController=loader.indexOf('vocab-controller-20260917.js');
  ok(pData>=0&&pController>pData,'complete BIPA JSON data must load before VocabController');
  ok(loader.includes('await window.BipaDataLoader.load()'),'boot must await complete BIPA data before controller init');

  const activeOrder=[
    'vocab-controller-20260917.js',
    'vocab-unified-renderer-20260917.js',
    'vocab-bipa-toolbar-compact-20260917.js',
    'vocab-unified-ui-guard-20260917.js',
    'vocab-flip-content-fix-20260917.js'
  ];
  let last=-1;
  activeOrder.forEach(name=>{const p=loader.indexOf(name);ok(p>last,'active vocabulary chain order broken at '+name);last=p;});
  ['vocab-upgrade-gz-01.js','vocab-upgrade-gz-02.js','library-switcher.js','vocab-bipa-state-20260917.js'].forEach(name=>ok(!loader.includes(name),'loader must not execute retired controller/state module: '+name));

  ok(bipaLoader.includes('JSON.parse(text)'),'BIPA gzip payload must be parsed as JSON, never executed as JavaScript');
  ok(!bipaLoader.includes("type:'text/javascript'"),'BIPA JSON loader must not wrap decompressed JSON as a script blob');
  ok(bipaLoader.includes("for(const lv of ['A1','A2','B1','B2'])"),'BIPA loader must validate all four levels');
  ok(bipaLoader.includes('window.BIPA_VOCAB_RAW=raw'),'BIPA loader must publish complete raw data before controller starts');

  const chunks=[];
  for(let i=1;i<=8;i++){
    const p=`data/bipa-gz-${String(i).padStart(2,'0')}.js`;
    const s=read(p),m=s.match(/\+'([^']+)'\s*;?\s*$/);
    ok(!!m,'BIPA compressed chunk cannot be parsed: '+p);
    if(m)chunks.push(m[1]);
  }
  if(chunks.length===8){
    let raw=null;
    try{raw=JSON.parse(zlib.gunzipSync(Buffer.from(chunks.join(''),'base64')).toString('utf8'))}catch(e){failures.push('BIPA compressed JSON decode failed: '+e.message)}
    if(raw){
      const counts={};
      ['A1','A2','B1','B2'].forEach(lv=>{counts[lv]=Array.isArray(raw[lv])?raw[lv].length:0;ok(counts[lv]>0,'BIPA compressed source missing '+lv)});
      console.log('BIPA compressed source counts:',counts);
    }
  }

  ok(controller.includes("const BIPA_KEYS=['bipa-a1','bipa-a2','bipa-b1','bipa-b2']"),'single controller must own all BIPA libraries');
  ok(controller.includes("return lv?'indo_bipa_mem_'+lv:'indo_mem'"),'BIPA must use independent per-level memory while normal vocab uses indo_mem');
  ok(controller.includes('function sourceFor(key=activeKey)'),'single controller must own every vocabulary data source');
  ok(controller.includes('const lv=bipaLevelForKey(key);if(lv)return bipaObjects(lv)'),'BIPA source must come from BIPA raw data, not generic DB residue');
  ok(controller.includes('function computeStats(src=sourceFor())'),'stats must be computed by the single controller');
  ok(controller.includes('function currentFilterPredicate(x)'),'visible FILTER must be computed by the single controller');
  ok(controller.includes("if(activeView==='known'){if(st!=='know')return false}"),'known view must filter from the current library status');
  ok(controller.includes("else if(activeView==='review'){if(st!=='fuzzy'&&st!=='dont')return false}"),'review view must filter from the current library status');
  ok(controller.includes('else if(st)return false'),'default flash view must contain only unjudged words');
  ok(controller.includes('const out=src.filter(currentFilterPredicate)'),'FILTER must come from the same source/status/filter predicate');
  ok(controller.includes('FILTER=out'),'single controller must own FILTER writes');
  ok(controller.includes('DB=src.slice()'),'single controller must own DB writes');
  ok(controller.includes('idx=opts.restore===false?0:restoreIndex(out)'),'library switch must rebuild index from the newly built visible pool');
  ok(controller.includes("window.showKnownWords=()=>setView('known')"),'已掌握 must route to the single controller');
  ok(controller.includes("window.showReviewWords=()=>setView('review')"),'待掌握 must route to the single controller');
  ok(controller.includes('window.applyFilter=()=>rebuild(true)'),'search/category/SAB filters must route to the single controller');
  ok(controller.includes('window.mark=mark'),'memory marking must route to the single controller');
  ok(controller.includes('window.VocabController={'),'single VocabController API must be installed');
  ok(!controller.includes('oldRender'),'single controller must not retain old renderer fallback');
  ok(!controller.includes('bipaV7Card'),'single controller must not render legacy BIPA cards');

  ok(unified.includes('vocabUnifiedCard'),'unified renderer must output vocabUnifiedCard');
  ok(/window\.renderVocab\s*=\s*render/.test(unified),'unified renderer must own window.renderVocab');
  ok(unified.includes("window.vocabUnifiedPrev=function(){window.VocabController?.move?.(-1)}"),'previous action must use VocabController');
  ok(unified.includes("window.vocabUnifiedNext=function(){window.VocabController?.move?.(1)}"),'next action must use VocabController');
  ok(unified.includes("window.vocabUnifiedMark=function(v){window.VocabController?.mark?.(v)}"),'mark action must use VocabController');
  ok(!unified.includes('<div class="item"><span>主题'),'retired metadata tile layout must never return');

  ok(guard.includes('const unifiedRender=window.renderVocab'),'UI guard must capture the unified renderer');
  ok(guard.includes('new MutationObserver(restore)'),'UI guard must detect legacy DOM rewrites');
  ok(guard.includes("window.renderVocab=unifiedRender"),'UI guard must restore unified renderer ownership');

  ok(flip.includes('BIPA：中文 → 英文 → 词根'),'BIPA detail order must stay Chinese, English, then root');
  ok(flip.includes('#vocab .vocabUnifiedCard{justify-content:flex-start!important;}'),'card must not vertically recenter on flip');
  ok(flip.includes('#vocab .vocabUnifiedCore{width:100%!important;margin-top:145px!important;transform:none!important;}'),'ordinary word position must stay fixed');
  ok(flip.includes('#vocab .vocabUnifiedCard.vocabUnifiedBipa .vocabUnifiedCore{margin-top:85px!important;}'),'BIPA word position must stay fixed');

  ok(libraryStub.includes('__VOCAB_LIBRARY_SWITCHER_RETIRED_20260917__'),'legacy library-switcher path must be an inert retired shim');
  ok(!libraryStub.includes('FILTER='),'retired library-switcher shim must not write FILTER');
  ok(!libraryStub.includes('window.renderVocab'),'retired library-switcher shim must not own renderer');
  ok(reviewStub.includes('__VOCAB_REVIEW_UI_RETIRED_20260917__'),'old review UI path must remain a retired compatibility shim');
  ok(!reviewStub.includes('renderReviewQueue'),'review shim must not contain legacy renderer');
  ok(bipaStateStub.includes('__VOCAB_BIPA_STATE_RETIRED_20260917__'),'old BIPA state module must remain retired');

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
  ok(exists('archive/vocab-legacy/library-switcher-legacy-20260913.js'),'legacy library-switcher implementation must be archived');
  ok(exists('archive/vocab-legacy/vocab-review-ui-legacy-20260831.js'),'legacy review UI implementation must be archived');
  ok(exists('archive/vocab-legacy/README.md'),'legacy archive must include rules README');

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