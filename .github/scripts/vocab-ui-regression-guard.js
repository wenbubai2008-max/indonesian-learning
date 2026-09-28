const fs=require('fs');
const path=require('path');
const vm=require('vm');
const zlib=require('zlib');
const crypto=require('crypto');
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
  const levelManifest=JSON.parse(read('data/bipa-level-manifest.json'));

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
  // Homepage is one entry point: index owns the structural slots, each module only fills its own container.
  const heroPos=index.indexOf('<div class="hero">'),profilePos=index.indexOf('id="vocabProfile"'),listenPos=index.indexOf('id="listenQuickCard"'),modsPos=index.indexOf('id="homeModules"');
  const coachHomePos=index.indexOf('id="vocabCoachHome"');
  ok(heroPos>=0&&heroPos<coachHomePos&&coachHomePos<profilePos&&profilePos<listenPos&&listenPos<modsPos,'homepage order must be daily > daily coach > compact profile > listening > other modules');
  ok(coachHomePos>heroPos&&coachHomePos<profilePos&&index.includes('#home #vocabCoachHome{min-height:'),'coach task card must reserve first-paint layout before compact profile');
  ok((index.match(/id="vocabProfile"/g)||[]).length===1,'homepage profile must have exactly one mount container');
  const gridPos=index.indexOf('class="homeLearningGrid"'),shortcutPos=index.indexOf('class="homeShortcuts"'),otherTitlePos=index.indexOf('其他学习工具');
  ok(heroPos<gridPos&&gridPos<coachHomePos&&coachHomePos<profilePos&&profilePos<shortcutPos&&shortcutPos<listenPos&&listenPos<otherTitlePos&&otherTitlePos<modsPos,'homepage shows paired coach/profile, then three shortcuts, then remaining tools');
  ok(index.includes('grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr)')&&index.includes('#home .homeShortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'),'two-column dashboard and three shortcuts must exist in first-paint CSS');
  ok(index.includes('onclick="openListeningWords()"')&&index.includes('onclick="openQuickPracticeV2()"')&&index.includes('onclick="openAutomationTraining()"'),'all three shortcut cards must open the existing training modules');
  ok(index.includes('#home #homeModules>.module[data-home-module="quick"],#home #homeModules>.module[data-home-module="automation"]{display:none!important}'),'old duplicate quick/automation tool cards must stay hidden at first paint');
  ok((index.match(/id="listenQuickCard"/g)||[]).length===1,'listening shortcut must have one live-card container');
  ok(index.includes('#home .homeShortcuts>#listenQuickCard{margin:0;height:100%}'),'listening card must cancel legacy bottom margin and align with adjacent shortcuts at first paint');

  ok(!index.includes('A2+ → B1 · 雅加达真实口语优先 · 你的个人词库'),'retired homepage subtitle must stay removed');
  ok(!index.includes('每天 08:00 / 18:00 自动生成到网站。学完后只点一次'),'retired homepage lesson instructions must stay removed');
  const profileUi=read('data/vocab-profile-ui.js');
  const profileEvidence=read('data/vocab-profile-evidence.js');
  const studyCoach=read('data/vocab-study-coach.js');
  const automation=read('data/automation-training.js');
  const quick=read('data/home-learning-upgrade-v2.js');
  const listenUi=read('data/listening-word-training.js');
  const weakPage=read('data/weakness-paging-roots.js');
  new vm.Script(weakPage,{filename:'data/weakness-paging-roots.js'});
  new vm.Script(profileUi,{filename:'data/vocab-profile-ui.js'});
  new vm.Script(profileEvidence,{filename:'data/vocab-profile-evidence.js'});
  new vm.Script(studyCoach,{filename:'data/vocab-study-coach.js'});
  new vm.Script(automation,{filename:'data/automation-training.js'});
  new vm.Script(quick,{filename:'data/home-learning-upgrade-v2.js'});
  new vm.Script(listenUi,{filename:'data/listening-word-training.js'});
  const evidencePos=externalScripts.findIndex(x=>x.includes('data/vocab-profile-evidence.js'));
  const profileScriptPos=externalScripts.findIndex(x=>x.includes('data/vocab-profile-ui.js'));
  ok(evidencePos>=0&&profileScriptPos>evidencePos,'local profile evidence must load before profile UI');
  const coachPos=externalScripts.findIndex(x=>x.includes('data/vocab-study-coach.js'));
  const autoPos=externalScripts.findIndex(x=>x.includes('data/automation-training.js'));
  const quickPos=externalScripts.findIndex(x=>x.includes('data/home-learning-upgrade-v2.js'));
  const listeningPos=externalScripts.findIndex(x=>x.includes('data/listening-word-training.js'));
  ok(evidencePos>=0&&coachPos>evidencePos&&coachPos<autoPos&&coachPos<quickPos&&coachPos<listeningPos&&profileScriptPos>coachPos,'shared coach loads after evidence and before all training/profile modules');
  ok(studyCoach.includes('eligibleSet')&&studyCoach.includes('requestVerification'),'coach must keep targeted self-verification and typed eligibility');
  ok(studyCoach.includes('indo_vocab_skill_rounds_v1')&&studyCoach.includes('round(mode,')&&studyCoach.includes('markAnswer(mode,'),'three modes must share a small stable round mechanism');
  ok(studyCoach.includes("status(mode,word")&&studyCoach.includes("mode==='quick'")&&studyCoach.includes("mode==='listen'")&&studyCoach.includes("mode==='auto'"),'skill states must have independent eligibility and due dates');
  ok(studyCoach.includes('review_level')&&studyCoach.includes('review_due')&&studyCoach.includes('review_last_counted_day'),'quick and listening ladders must use real cross-day events and distinct dates');
  ok(studyCoach.includes('dailySession')&&studyCoach.includes("mode+'|'"),'priority recommendation completion must use mode+word identity');
  ok(profileEvidence.includes('indo_vocab_profile_longterm_v1')&&profileEvidence.includes('compactSummary(longterm())'),'long-term ability must not depend on 1500 most recent events');
  ok(automation.includes("VocabStudyCoach.candidates('auto')")&&quick.includes("window.VocabStudyCoach.candidates('quick')")&&listenUi.includes("coach.round('listen'"),'all three entrypoints must use their own due queues without taking other module words');
  ok(quick.includes("coach.round('quick'")&&quick.includes('继续下一组')&&quick.includes("coach.markAnswer('quick'"),'quick can continue ten-word rounds and records independent visual results');
  ok(automation.includes('old.words.length&&(!force||old.words.some')&&automation.includes('今天已记录')&&automation.includes("coach.eligible(word,Date.now(),'auto')"),'automation persists unanswered cards and honors active-only cooldown');
  ok(listenUi.includes('state.queue=coach.round')&&listenUi.includes('查看今日剩余听词')&&listenUi.includes("coach.markAnswer('listen'"),'listening uses stable per-mode batches and records first-hear quality');
  ok(profileUi.includes('今天最该练什么')&&profileUi.includes('逐词能力档案')&&profileUi.includes('data-coach-start')&&profileUi.includes('网站快照＋本机训练'),'profile must distinguish remote mastery from local skill progress');
  ok(profileUi.includes('vpHomeNext')&&profileUi.includes('vpHomeNumbers')&&profileUi.includes('查看全部任务 →'),'homepage must show only next recommended word and compact metrics while keeping the complete detail page');
  ok(automation.includes('openAutomationTrainingWord')&&automation.includes('autoSelfCheck'),'automation must directly train selected words and require expression self-confirmation');

  ok(studyCoach.includes('overdue')&&studyCoach.includes('category(a)')&&studyCoach.includes('statistics(mode'),'due backlog, unverified and low-frequency review must be globally visible');
  ok(studyCoach.includes('pendingSet')&&weakPage.includes('coach.requestVerification(word)')&&!weakPage.includes("wp.markMastered(word,'weakness_done')"),'weak-page known button only reserves delayed verification');
  ok(weakPage.includes('PAUSE_KEY')&&weakPage.includes('weakRestoreBtn')&&weakPage.includes('data-pause-word'),'untaught reader words may be paused and restored without fake mastery');
  ok(!weaknessPool.includes("x.mastered_reason='3_correct'"),'three recognition answers must not auto-master the word');
  ok(listenUi.includes('const allowed=rootCoachEligible(),used=new Set(state.queue.map')&&listenUi.includes('allowed&&!allowed.has(k)')&&!listenUi.includes('state.queue.splice('),'listening contrasts must not inject unreserved scored questions');
  ok(automation.includes("st.last_result=result.kind==='self_checked'?'self_checked':'right'"),'stage-three self-assessment must retain its own evidence type');

  ok(quick.includes('openQuickPracticeWordV2')&&listenUi.includes('openListeningWordTarget'),'quick and listening practice must support exact-word entry');
  ok(profileEvidence.includes('indo_vocab_profile_evidence_v2')&&profileEvidence.includes('DAILY_VOCAB_DB'),'local evidence must limit observations to formally taught words');
  ok(profileEvidence.includes('quick-practice-updated')&&profileEvidence.includes('listening-answer-recorded')&&profileEvidence.includes('automation-training-updated'),'profile must capture all three actual training result events');
  ok(listenUi.includes("new CustomEvent('listening-answer-recorded'"),'listening module must emit per-answer evidence');
  ok(profileUi.includes('VocabProfileEvidence.summarize()'),'profile detail ability totals must use local verified evidence');
  ok(profileUi.includes("home.querySelector(':scope > .hero')"),'profile fallback must mount directly after daily hero');
  ok(!profileUi.includes('DAILY_VOCAB_DB')&&!profileUi.includes('WeaknessPool'),'profile homepage must not recompute full vocab databases');
  ok(profileUi.includes('openVocabProfileDetail'),'profile summary must expose a clickable detail entry');
  ok(profileUi.includes('主词库当前待学习')&&profileUi.includes('primary_eligible_new_total')&&!profileUi.includes('尚未正式学习 '+"'+data.primary_unlearned_total+'"),'profile shows only the actionable primary new-word remainder');
  ok(profileUi.includes("page.id='vocabProfileDetail'")&&profileUi.includes("['overview','能力总览']")&&profileUi.includes("['trend','学习趋势']")&&profileUi.includes("['weak','弱词分析']")&&profileUi.includes("['advice','学习建议']"),'profile detail page keeps four planned analysis tabs');
  ok(profileUi.includes('data-vp-action="automation"')&&profileUi.includes('data-vp-action="quick"'),'weak-word detail keeps direct training actions');
  ok(!externalScripts.some(x=>x.includes('library-switcher.js')),'legacy library-switcher must not be loaded by index.html');
  ok(!index.includes('sessionCount'),'retired 今日完成 vocab stat must not exist in index.html');
  ok(index.includes('grid-template-columns:repeat(3,1fr)'),'vocabulary stats bar must be three columns');

  const pData=loader.indexOf('bipa-json-loader-20260917.js');
  const pController=loader.indexOf('vocab-controller-20260917.js');
  ok(pData>=0&&pController>pData,'BIPA loader definition must load before VocabController');
  ok(!loader.includes('await window.BipaDataLoader.load()'),'homepage boot must not eagerly decompress BIPA data');
  ok(!loader.includes('bipa-secondary-seed-20260917.js'),'completed BIPA secondary migration must not reseed on every page load');
  ok(!loader.includes('VocabController.refresh'),'hidden vocabulary page must not be rebuilt again during global boot');
  ok(loader.includes('进入 B2 只请求和解压 B2'),'loader contract must document per-level BIPA loading');

  const activeOrder=['vocab-controller-20260917.js','vocab-unified-renderer-20260917.js','vocab-bipa-toolbar-compact-20260917.js','vocab-unified-ui-guard-20260917.js','vocab-flip-content-fix-20260917.js'];
  let last=-1;activeOrder.forEach(name=>{const p=loader.indexOf(name);ok(p>last,'active vocabulary chain order broken at '+name);last=p;});
  ['vocab-upgrade-gz-01.js','vocab-upgrade-gz-02.js','library-switcher.js','vocab-bipa-state-20260917.js'].forEach(name=>ok(!loader.includes(name),'loader must not execute retired controller/state module: '+name));

  ok(bipaLoader.includes("const EXPECTED={A1:515,A2:290,B1:204,B2:274}"),'BIPA loader must pin complete counts');
  ok(bipaLoader.includes("function levelScript(lv){return 'data/bipa-level-'"),'BIPA loader must address one level file at a time');
  ok(bipaLoader.includes('async function loadOne(level)'),'BIPA loader must expose one-level loading');
  ok(bipaLoader.includes('async function load(level)'),'BIPA loader must keep compatible load API');
  ok(bipaLoader.includes('if(lv)return loadOne(lv)'),'load(level) must only load the requested BIPA level');
  ok(bipaLoader.includes('window.BIPA_VOCAB_RAW[lv]=rows'),'BIPA loader must publish only the loaded level');
  ok(!bipaLoader.includes("data/bipa-gz-"),'browser BIPA loader must not request the combined all-level payload');

  const chunks=[];
  for(let i=1;i<=8;i++){
    const p=`data/bipa-gz-${String(i).padStart(2,'0')}.js`,s=read(p),m=s.match(/\+'([^']+)'\s*;?\s*$/);
    ok(!!m,'canonical BIPA compressed chunk cannot be parsed: '+p);if(m)chunks.push(m[1]);
  }
  let canonical=null;
  if(chunks.length===8){
    try{canonical=JSON.parse(zlib.gunzipSync(Buffer.from(chunks.join(''),'base64')).toString('utf8'))}catch(e){failures.push('canonical BIPA compressed JSON decode failed: '+e.message)}
    if(canonical){const counts={};Object.keys(EXPECTED_BIPA).forEach(lv=>{counts[lv]=Array.isArray(canonical[lv])?canonical[lv].length:0;ok(counts[lv]===EXPECTED_BIPA[lv],`canonical BIPA ${lv} count mismatch: ${counts[lv]} / ${EXPECTED_BIPA[lv]}`)});console.log('BIPA canonical counts:',counts)}
  }

  ok(levelManifest&&levelManifest.version===1,'BIPA level manifest version must be 1');
  for(const [lv,count] of Object.entries(EXPECTED_BIPA)){
    const p=`data/bipa-level-${lv.toLowerCase()}-gz.js`;
    ok(exists(p),'missing per-level BIPA payload: '+p);
    if(!exists(p))continue;
    const s=read(p);new vm.Script(s,{filename:p});
    const m=s.match(new RegExp('BIPA_LEVEL_GZ\\.'+lv+"='([^']+)'"));
    ok(!!m,'cannot parse per-level BIPA payload: '+p);if(!m)continue;
    let rows=null;try{rows=JSON.parse(zlib.gunzipSync(Buffer.from(m[1],'base64')).toString('utf8'))}catch(e){failures.push('per-level '+lv+' decode failed: '+e.message)}
    if(!rows)continue;
    ok(Array.isArray(rows)&&rows.length===count,`per-level BIPA ${lv} count mismatch: ${Array.isArray(rows)?rows.length:0} / ${count}`);
    if(canonical)ok(JSON.stringify(rows)===JSON.stringify(canonical[lv]),'per-level BIPA '+lv+' must exactly match canonical source');
    const meta=levelManifest.levels&&levelManifest.levels[lv];
    ok(meta&&meta.count===count,'manifest count mismatch for '+lv);
    const hash=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    ok(meta&&meta.sha256===hash,'manifest hash mismatch for '+lv);
  }

  ok(controller.includes('const EXPECTED_MASTER_COUNT=977'),'controller must pin master count to 977');
  ok(controller.includes('const EXPECTED_BIPA_COUNTS={A1:515,A2:290,B1:204,B2:274}'),'controller must pin all BIPA counts');
  ok(controller.includes('const memCache=new Map()'),'controller must cache parsed memory maps');
  ok(controller.includes('const sourceCache=new Map()'),'controller must cache static vocabulary sources');
  ok(controller.includes('function statusFromMemory'),'status filtering must reuse one parsed memory map');
  ok(controller.includes('function computeStats(src=sourceFor(),mem=memoryFor())'),'stats must reuse cached memory');
  ok(controller.includes('function currentFilterPredicate(x,mem=memoryFor())'),'FILTER predicate must accept cached memory');
  ok(controller.includes('src.filter(x=>currentFilterPredicate(x,mem))'),'rebuild must not parse localStorage once per word');
  ok(controller.includes('function bipaReady(level)'),'controller must support per-level BIPA readiness');
  ok(controller.includes('async function ensureBipaData(level)'),'controller must load one BIPA level on demand');
  ok(controller.includes("await window.BipaDataLoader.load(lv)"),'controller must request only the selected BIPA level');
  ok(controller.includes('const mySeq=++switchSeq,lv=bipaLevelForKey(key)'),'library switch must resolve the selected BIPA level');
  ok(controller.includes('if(lv&&!bipaReady(lv))'),'BIPA switch must test readiness for that level only');
  ok(controller.includes('await ensureBipaData(lv)'),'BIPA switch must await only that selected level');
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
