'use strict';
const assert=require('node:assert/strict');
const {collectUnfamiliar}=require('./unfamiliar-lesson-pool');
let checks=0;
const t=(name,fn)=>{fn();checks++;};
function run(){
const words=[
 {word:'panik',cn:'恐慌',status:'active',reasons:['manual_unknown']},
 {word:'nagih',cn:'催款',status:'active',reasons:['manual_unknown']},
 {word:'kebuang',cn:'浪费掉',status:'active',reasons:['seed_unfamiliar']},
 {word:'selera',cn:'胃口',status:'active',reasons:['manual_unknown']},
 {word:'samping',cn:'旁边',status:'active',reasons:['manual_unknown']},
 {word:'curiga',cn:'怀疑',status:'mastered',reasons:['manual_unknown']},
 {word:'pudar',cn:'褪色',status:'active',reasons:['manual_unknown','training_excluded']},
 {word:'bad',cn:'',status:'active',reasons:['manual_unknown']},
 {word:'hello',cn:'你好',status:'active',reasons:['quick_wrong']}
];
const args={weakWords:words,dailySet:new Set(['kebuang']),primarySet:new Set(['selera']),secondarySet:new Set(['samping'])};
const out=collectUnfamiliar(args);
t('only active untaught user-marked outside current banks',()=>assert.deepEqual(out.map(x=>x.word),['panik','nagih']));
t('keeps Chinese meanings for lesson generation',()=>assert.deepEqual(out.map(x=>x.cn),['恐慌','催款']));
t('teaching the marked word immediately removes it',()=>assert.deepEqual(collectUnfamiliar({...args,dailySet:new Set(['kebuang','panik'])}).map(x=>x.word),['nagih']));
t('mastered/excluded never re-enter lessons',()=>assert.ok(!out.some(x=>['curiga','pudar'].includes(x.word))));
t('no extra unknown source when no user reason',()=>assert.ok(!out.some(x=>x.word==='hello')));
t('dedupe case variations',()=>assert.deepEqual(collectUnfamiliar({...args,weakWords:[...words,{...words[0],word:'PANIK'}]}).map(x=>x.word),['panik','nagih']));
t('reject html/code-like words',()=>assert.deepEqual(collectUnfamiliar({...args,weakWords:[{word:'bad\nword',cn:'错误',status:'active',reasons:['manual_unknown']}]}),[]));
}
if(require.main===module){run();console.log('Unfamiliar lesson candidate tests passed: '+checks)}
module.exports={run};
