(function(){
  if(document.getElementById('dailyUiPolishStyle'))return;
  const st=document.createElement('style');
  st.id='dailyUiPolishStyle';
  st.textContent=`
    /* Daily lesson only */
    #daily .card{max-width:1120px;margin:0 auto;padding:30px 32px 34px}
    #daily .sectionHead{margin-bottom:18px}
    #daily #dailyTitle{font-size:30px;line-height:1.3;margin:0;font-weight:850;letter-spacing:-.02em}
    #daily #dailyMeta{font-size:13px;padding:7px 11px}

    #daily .dailyFixNav{padding:15px 16px;margin-bottom:14px;border-radius:16px}
    #daily .dailyFixMid b{font-size:17px}
    #daily .dailyFixMid span{font-size:13px;margin-top:2px;display:block}
    #daily .dailyFixPicker{margin:0 0 20px}
    #daily .dailyFixPicker select{font-size:15px;padding:10px 13px}
    #daily .dailyFixChips{gap:8px;margin-bottom:20px}
    #daily .dailyFixChip{font-size:13px;padding:7px 11px}

    #daily .dailyFixSec{border-radius:22px;padding:25px 27px;margin:18px 0;border-color:#dfe5ef}
    #daily .dailyFixSec h3{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 22px;font-size:25px;line-height:1.3;font-weight:850;color:#273248}
    #daily .dailyFixNo{width:38px;height:38px;border-radius:12px;font-size:16px;margin-right:2px}

    #daily .dailyFixGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    #daily .dailyFixVocab{border-radius:18px;padding:22px 22px 20px;background:#fbfcff;border-color:#dfe5ef;box-shadow:0 1px 0 rgba(25,39,70,.02)}
    #daily .dailyFixWord{gap:9px;font-size:29px;line-height:1.25;font-weight:850;letter-spacing:-.01em}
    #daily .dailyFixNum{font-size:17px;min-width:42px;color:#4265c7}
    #daily .dailyFixWord .sound{padding:7px 9px;border-radius:11px;font-size:18px;margin-left:2px}

    #daily .dailyFixCn{font-size:20px;line-height:1.45;margin-top:17px;color:#26364f;font-weight:800}
    #daily .dailyFixEn{font-size:15px;line-height:1.5;color:#7b8598;margin-top:3px}
    #daily .dailyFixMeta{font-size:15px;line-height:1.75;color:#52627a;margin-top:14px;background:#f3f6fb;border-radius:11px;padding:10px 12px}
    #daily .dailyFixMeta+.dailyFixMeta{margin-top:7px}
    #daily .dailyFixEx{font-size:18px;line-height:1.65;color:#285a94;margin-top:18px;padding-top:15px;border-top:1px solid #e5eaf2;font-weight:600}
    #daily .dailyFixExCn{font-size:16px;line-height:1.6;color:#786554;margin-top:6px}

    #daily .dailyFixItem{font-size:17px;line-height:1.85;border-radius:15px;padding:16px 18px;margin-bottom:11px}
    #daily .dailyFixId{font-size:18px;line-height:1.75}
    #daily .dailyFixCnLine{font-size:16px;line-height:1.7;margin-top:5px}

    #daily .dailyFixReading{font-size:19px;line-height:2;padding:21px 23px;border-radius:15px}
    #daily .dailyFixTranslation{font-size:16px;line-height:1.85;padding:17px 19px;border-radius:14px;margin-top:13px}
    #daily .dailyFixActions{margin-top:13px}

    #daily .dailyFixChoice{font-size:16px;line-height:1.55;padding:13px 15px;border-radius:12px}
    #daily .dailyFixFeedback{font-size:14px;line-height:1.7;padding:11px 13px}
    #daily .dailyFixAnswer{font-size:16px;line-height:1.8;padding:14px 16px}
    #daily .dailyFixToggle{font-size:15px;padding:8px 12px}

    @media(max-width:820px){
      #daily .dailyFixGrid{grid-template-columns:1fr}
      #daily .card{padding:23px 20px 28px}
      #daily .dailyFixSec{padding:21px 19px}
      #daily .dailyFixVocab{padding:19px}
    }
    @media(max-width:520px){
      #daily #dailyTitle{font-size:25px}
      #daily .dailyFixSec h3{font-size:22px}
      #daily .dailyFixNo{width:34px;height:34px;font-size:14px}
      #daily .dailyFixWord{font-size:26px}
      #daily .dailyFixCn{font-size:19px}
      #daily .dailyFixEx{font-size:17px}
      #daily .dailyFixReading{font-size:18px;line-height:1.9}
    }
  `;
  document.head.appendChild(st);
})();
