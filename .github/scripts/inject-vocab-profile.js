const fs=require('fs'),crypto=require('crypto');
const p='index.html',ui='data/vocab-profile-ui.js';
let s=fs.readFileSync(p,'utf8');
const hash=crypto.createHash('sha256').update(fs.readFileSync(ui)).digest('hex').slice(0,12);
const tag=`<script src="data/vocab-profile-ui.js?v=${hash}"></script>`;
if(/<script src="data\/vocab-profile-ui\.js\?v=[^"]+"><\/script>/.test(s))s=s.replace(/<script src="data\/vocab-profile-ui\.js\?v=[^"]+"><\/script>/,tag);
else s=s.replace('</body>',tag+'\n</body>');
fs.writeFileSync(p,s);
