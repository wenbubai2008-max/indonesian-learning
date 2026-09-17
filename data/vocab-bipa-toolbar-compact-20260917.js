(function(){
  if(window.__BIPA_TOOLBAR_COMPACT_20260917__)return;
  window.__BIPA_TOOLBAR_COMPACT_20260917__=true;
  const st=document.createElement('style');
  st.id='bipaToolbarCompact20260917';
  st.textContent=`
    @media(min-width:901px){
      #vocab.bipaFinalV7 .toolbar{
        display:grid!important;
        grid-template-columns:145px minmax(180px,1fr) 128px 105px 92px 88px 112px!important;
        gap:7px!important;
        align-items:center!important;
        width:100%!important;
        grid-auto-flow:row!important;
      }
      #vocab.bipaFinalV7 .toolbar>*{
        min-width:0!important;
        max-width:100%!important;
        width:100%!important;
        height:44px!important;
        margin:0!important;
        padding-left:10px!important;
        padding-right:10px!important;
        font-size:14px!important;
        white-space:nowrap!important;
      }
      #vocab.bipaFinalV7 .toolbar button{font-weight:750!important;}
    }
    @media(max-width:900px){
      #vocab.bipaFinalV7 .toolbar{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important;}
      #vocab.bipaFinalV7 #search{grid-column:span 2!important;}
    }
    @media(max-width:620px){
      #vocab.bipaFinalV7 .toolbar{grid-template-columns:1fr 1fr!important;}
      #vocab.bipaFinalV7 #search{grid-column:1/-1!important;}
    }
  `;
  document.head.appendChild(st);
})();