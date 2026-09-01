(function(){
  if(document.getElementById('dailyUiPolishStyle'))return;
  const st=document.createElement('style');
  st.id='dailyUiPolishStyle';
  st.textContent=`
    /* Daily lesson only — compact, wide, readable */
    #daily>.card{max-width:none;margin:0 auto;padding:0;background:transparent;border:0;border-radius:0}
    #daily .sectionHead{margin:0 4px 12px;padding:0}
    #daily #dailyTitle{font-size:30px;line-height:1.2;margin:0;font-weight:850;letter-spacing:-.02em}
    #daily #dailyMeta{font-size:13px;padding:6px 10px}

    #daily .dailyFixNav{padding:10px 12px;margin:0 0 9px;border-radius:13px}
    #daily .dailyFixMid b{font-size:16px}
    #daily .dailyFixMid span{font-size:12px;margin-top:1px;display:block}
    #daily .dailyFixPicker{margin:0 0 11px}
    #daily .dailyFixPicker select{font-size:14px;padding:8px 11px}
    #daily .dailyFixChips{gap:6px;margin-bottom:11px}
    #daily .dailyFixChip{font-size:12px;padding:5px 9px}

    #daily .dailyFixSec{border-radius:17px;padding:15px 17px;margin:10px 0;background:#fff;border-color:#dfe5ef}
    #daily .dailyFixSec h3{display:flex;align-items:center;justify-content:center;gap:7px;margin:0 0 13px;font-size:24px;line-height:1.2;font-weight:850;color:#273248}
    #daily .dailyFixNo{width:34px;height:34px;border-radius:10px;font-size:15px;margin-right:1px}

    #daily .dailyFixGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    #daily .dailyFixVocab{border-radius:15px;padding:15px 16px 14px;background:#fbfcff;border-color:#dfe5ef;box-shadow:none}
    #daily .dailyFixWord{gap:8px;font-size:30px;line-height:1.15;font-weight:850;letter-spacing:-.01em}
    #daily .dailyFixNum{font-size:16px;min-width:38px;color:#4265c7}
    #daily .dailyFixWord .sound{padding:6px 8px;border-radius:10px;font-size:16px;margin-left:1px}

    #daily .dailyFixCn{font-size:20px;line-height:1.35;margin-top:10px;color:#26364f;font-weight:800}
    #daily .dailyFixEn{font-size:14px;line-height:1.4;color:#7b8598;margin-top:2px}
    #daily .dailyFixMeta{font-size:14px;line-height:1.55;color:#52627a;margin-top:8px;background:#f4f6fa;border-radius:9px;padding:7px 9px}
    #daily .dailyFixMeta+.dailyFixMeta{margin-top:5px}
    #daily .dailyFixEx{font-size:18px;line-height:1.5;color:#285a94;margin-top:11px;padding-top:10px;border-top:1px solid #e5eaf2;font-weight:650}
    #daily .dailyFixExCn{font-size:15px;line-height:1.5;color:#786554;margin-top:4px}

    #daily .dailyFixItem{font-size:17px;line-height:1.65;border-radius:13px;padding:12px 14px;margin-bottom:8px}
    #daily .dailyFixId{font-size:18px;line-height:1.55}
    #daily .dailyFixCnLine{font-size:15px;line-height:1.5;margin-top:4px}

    #daily .dailyFixReading{font-size:19px;line-height:1.75;padding:15px 17px;border-radius:13px}
    #daily .dailyFixTranslation{font-size:16px;line-height:1.65;padding:13px 15px;border-radius:12px;margin-top:9px}
    #daily .dailyFixActions{margin-top:9px}

    #daily .dailyFixChoice{font-size:16px;line-height:1.45;padding:10px 12px;border-radius:10px}
    #daily .dailyFixChoiceWrap{gap:7px;margin-top:9px}
    #daily .dailyFixFeedback{font-size:14px;line-height:1.55;padding:9px 11px;margin-top:7px}
    #daily .dailyFixAnswer{font-size:16px;line-height:1.6;padding:11px 13px}
    #daily .dailyFixToggle{font-size:14px;padding:7px 10px}

    @media(max-width:820px){
      #daily .dailyFixGrid{grid-template-columns:1fr}
      #daily .dailyFixSec{padding:11px 10px;margin:8px 0;border-radius:14px}
      #daily .dailyFixVocab{padding:13px 12px}
      #daily .dailyFixSec h3{margin-bottom:11px}
    }
    @media(max-width:520px){
      #daily .sectionHead{margin:0 2px 9px}
      #daily #dailyTitle{font-size:24px}
      #daily #dailyMeta{font-size:12px;padding:5px 8px}
      #daily .dailyFixNav{padding:8px;margin-bottom:7px}
      #daily .dailyFixPicker{margin-bottom:8px}
      #daily .dailyFixChips{margin-bottom:8px}
      #daily .dailyFixSec{padding:9px 6px;border-radius:12px}
      #daily .dailyFixSec h3{font-size:21px;margin-bottom:9px}
      #daily .dailyFixNo{width:31px;height:31px;font-size:13px}
      #daily .dailyFixGrid{gap:8px}
      #daily .dailyFixVocab{padding:12px 11px;border-radius:12px}
      #daily .dailyFixWord{font-size:27px}
      #daily .dailyFixNum{font-size:15px;min-width:34px}
      #daily .dailyFixCn{font-size:19px;margin-top:8px}
      #daily .dailyFixEn{font-size:14px}
      #daily .dailyFixMeta{font-size:14px;line-height:1.5;padding:6px 8px;margin-top:6px}
      #daily .dailyFixEx{font-size:17px;line-height:1.5;margin-top:9px;padding-top:8px}
      #daily .dailyFixExCn{font-size:15px;line-height:1.45}
      #daily .dailyFixReading{font-size:18px;line-height:1.7;padding:12px}
      #daily .dailyFixTranslation{padding:11px 12px}
    }
  `;
  document.head.appendChild(st);
})();
