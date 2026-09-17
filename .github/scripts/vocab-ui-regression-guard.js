const fs=require('fs');
const path=require('path');
const vm=require('vm');
const zlib=require('zlib');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const failures=[];
const EXPECTED_BIPA={A1:515,A2:290,B1:204,B2:274};
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
  const weaknessPool=read('data/weakness-pool.js');
  const weaknessSync=read('data/weakness-sync-client.js');
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
    ['data/weakness-pool.js',weaknessPool],
    ['data/weakness-sync-client.js',weaknessSync],
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
  ok(index.includes('grid-template-columns:repeat(3,1fr)'),'vocabulary stats bar must be three columns');

  const pData=loader.indexOf('bipa-json-loader-20260917.js');
  const pController=loader.indexOf('vocab-controller-20260917.js');
  ok(pData>=0&&pController>pData,'BIPA loader definition must load before VocabController');
  ok(!loader.includes('await window.BipaDataLoader.load()'),'homepage boot must not eagerly decompress BIPA data');
  ok(!loader.includes('bipa-secondary-seed-20260917.js'),'completed BIPA secondary migration must not reseed on every page load');
  ok(!loader.includes('VocabController.refresh'),'hidden vocabulary page must not be rebuilt again during global boot');

  const activeOrder=['vocab-controller-20260917.js','vocab-unified-renderer-20260917.js','vocab-bipa-toolbar-compact-20260917.js','vocab-unified-ui-guard-20260917.js','vocab-flip-content-fix-20260917.js'];
  let last=-1;activeOrder.forEach(name=>{const p=loader.indexOf(name);ok(p>last,'active vocabulary chain order broken at '+name);last=p;});
  ['vocab-upgrade-gz-01.js','vocab-upgrade-gz-02.js','library-switcher.js','vocab-bipa-state-20260917.js'].forEach(name=>ok(!loader.includes(name),'loader must not execute retired controller/state module: '+name));

  ok(bipaLoader.includes('JSON.parse(text)'),'BIPA gzip payload must be parsed as JSON');
  ok(bipaLoader.includes('const EXPECTED={A1:515,A2:290,B1:204,B2:274}'),'BIPA loader must pin complete counts');
  ok(bipaLoader.includes('window.BIPA_VOCAB_RAW=raw'),'BIPA loader must publish complete raw data');

  const chunks=[];
  for(let i=1;i<=8;i++){
    const p=`data/bipa-gz-${String(i).padStart(2,'0')}.js`,s=read(p),m=s.match(/\+'([^']+)'\s*;?\s*$/);
    ok(!!m,'BIPA compressed chunk cannot be parsed: '+p);if(m)chunks.push(m[1]);
  }
  if(chunks.length===8){
    let raw=null;try{raw=JSON.parse(zlib.gunzipSync(Buffer.from(chunks.join(''),'base64')).toString('utf8'))}catch(e){failures.push('BIPA compressed JSON decode failed: '+e.message)}
    if(raw){const counts={};Object.keys(EXPECTED_BIPA).forEach(lv=>{counts[lv]=Array.isArray(raw[lv])?raw[lv].length:0;ok(counts[lv]===EXPECTED_BIPA[lv],`BIPA ${lv} count mismatch: ${counts[lv]} / ${EXPECTED_BIPA[lv]}`)});console.log('BIPA compressed source counts:',counts)}
  }

  ok(controller.includes('const EXPECTED_MASTER_COUNT=977'),'controller must pin master count to 977');
  ok(controller.includes('const EXPECTED_BIPA_COUNTS={A1:515,A2:290,B1:204,B2:274}'),'controller must pin all BIPA counts');
  ok(controller.includes('const memCache=new Map()'),'controller must cache parsed memory maps');
  ok(controller.includes('const sourceCache=new Map()'),'controller must cache static vocabulary sources');
  ok(controller.includes('function statusFromMemory'),'status filtering must reuse one parsed memory map');
  ok(controller.includes('function computeStats(src=sourceFor(),mem=memoryFor())'),'stats must reuse cached memory');
  ok(controller.includes('function currentFilterPredicate(x,mem=memoryFor())'),'FILTER predicate must accept cached memory');
  ok(controller.includes('src.filter(x=>currentFilterPredicate(x,mem))'),'rebuild must not parse localStorage once per word');
  ok(controller.includes('async function setLibrary'),'library switching must support on-demand BIPA load');
  ok(controller.includes('if(isBipaKey(key)&&!bipaReady())'),'BIPA must only load when a BIPA library is actually selected');
  ok(controller.includes('await ensureBipaData()'),'BIPA library switch must await complete BIPA data before rendering');
  ok(controller.includes('function prepareHiddenLibrary'),'hidden vocabulary page must defer heavy library rendering until opened');
  ok(controller.includes("return lv?'indo_bipa_mem_'+lv:'indo_mem'"),'BIPA must keep independent per-level memory');
  ok(controller.includes("if(activeView==='known'){if(st!=='know')return false}"),'known view must filter current-library status');
  ok(controller.includes("else if(activeView==='review'){if(st!=='fuzzy'&&st!=='dont')return false}"),'review view must filter fuzzy/dont');
  ok(controller.includes('FILTER=out'),'controller must own FILTER writes');
  ok(controller.includes('DB=src.slice()'),'controller must own DB writes');
  ok(controller.includes('window.VocabController={'),'single VocabController API must be installed');
  ok(!controller.includes('runGzipPayload'),'controller must never execute decompressed BIPA JSON as JS');
  ok(!controller.includes('bipaV7Card'),'controller must not render legacy BIPA cards');

  ok(weaknessPool.includes('removeReasons:removeReasons'),'WeaknessPool must support scoped reason removal');
  ok(weaknessPool.includes('importRecord:importRecord'),'WeaknessPool must support remote record import');
  ok(weaknessSync.includes("typeof p.importRecord==='function'"),'cloud pull must preserve weakness state');

  ok(unified.includes('vocabUnifiedCard'),'unified renderer must output vocabUnifiedCard');
  ok(/window\.renderVocab\s*=\s*render/.test(unified),'unified renderer must own window.renderVocab');
  ok(unified.includes("window.vocabUnifiedPrev=function(){window.VocabController?.move?.(-1)}"),'previous action must use VocabController');
  ok(unified.includes("window.vocabUnifiedNext=function(){window.VocabController?.move?.(1)}"),'next action must use VocabController');
  ok(unified.includes("window.vocabUnifiedMark=function(v){window.VocabController?.mark?.(v)}"),'mark action must use VocabController');

  ok(guard.includes('const unifiedRender=window.renderVocab'),'UI guard must capture unified renderer');
  ok(guard.includes('new MutationObserver(restore)'),'UI guard must detect DOM rewrites');
  ok(flip.includes('BIPA：中文 → 英文 → 词根'),'BIPA detail order must stay Chinese, English, then root');

  ok(libraryStub.includes('__VOCAB_LIBRARY_SWITCHER_RETIRED_20260917__'),'legacy library-switcher must remain inert');
  ok(!libraryStub.includes('FILTER='),'retired library-switcher must not write FILTER');
  ok(reviewStub.includes('__VOCAB_REVIEW_UI_RETIRED_20260917__'),'old review UI must remain retired');
  ok(bipaStateStub.includes('__VOCAB_BIPA_STATE_RETIRED_20260917__'),'old BIPA state module must remain retired');

  const retired=['vocab-bipa-badge-audio-fix-20260913.js','vocab-bipa-final-20260913.js','vocab-bipa-flip-layout-fix-20260913.js','vocab-bipa-progress-fix-20260913.js','vocab-bipa-stable-20260913.js','vocab-bipa-switch-polish-20260913.js','vocab-final-fix-20260913.js','vocab-final-hotfix-20260913.js','vocab-ui-cleanup-20260913.js','vocab-scoped-stats.js'];
  retired.forEach(name=>{ok(!loader.includes(name),'retired script must not be loaded: '+name);ok(!index.includes('data/'+name),'retired script must not be in index: '+name);ok(!exists('data/'+name),'retired script must not remain active: '+name);ok(exists('archive/vocab-legacy/'+name),'retired script must be archived: '+name)});

  const workflows=fs.readdirSync(path.join(ROOT,'.github/workflows')).filter(x=>/\.ya?ml$/i.test(x)).sort();
  const expected=['build-learning-runtime.yml','sync-daily-vocab.yml'].sort();
  ok(JSON.stringify(workflows)===JSON.stringify(expected),'temporary one-shot workflows must not remain');
}catch(e){failures.push('vocab UI guard crashed: '+(e&&e.stack?e.stack:e))}

if(failures.length){console.error('Vocabulary UI regression guard failed:');failures.forEach(x=>console.error('  FAIL  '+x));process.exit(1)}
console.log('Vocabulary UI regression guard passed');
