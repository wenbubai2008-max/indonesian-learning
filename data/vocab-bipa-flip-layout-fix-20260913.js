(function(){
  if(window.__BIPA_FLIP_LAYOUT_FIX_20260913__)return;
  window.__BIPA_FLIP_LAYOUT_FIX_20260913__=true;
  const st=document.createElement('style');
  st.id='bipaFlipLayoutFix20260913';
  st.textContent=`
    #vocab .bipaV7Core{transform:translateY(-42px)!important;}
    #vocab .bipaV7Badge{margin-bottom:14px!important;}
    #vocab .bipaV7Meaning{top:218px!important;width:min(720px,82vw)!important;}
    #vocab .bipaV7Cn{font-size:23px!important;line-height:1.3!important;}
    #vocab .bipaV7En{font-size:18px!important;line-height:1.3!important;margin-top:5px!important;}
    #vocab .bipaV7Root{margin-top:8px!important;}
    @media(max-width:620px){
      #vocab .bipaV7Core{transform:translateY(-38px)!important;}
      #vocab .bipaV7Badge{margin-bottom:12px!important;}
      #vocab .bipaV7Meaning{top:210px!important;width:88vw!important;}
    }
  `;
  document.head.appendChild(st);
})();
