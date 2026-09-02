(function(){
  const examples={
    "mengurangi":["Kita perlu mengurangi biaya operasional bulan ini.","这个月我们需要降低运营成本。"],
    "menghadapi":["Kalau ada masalah, kita hadapi satu-satu aja.","如果有问题，我们一个一个处理就好。"],
    "memilih":["Kalau ada pilihan yang lebih praktis, aku bakal pilih yang itu.","如果有更方便的选择，我会选那个。"],
    "kesalahan":["Nggak apa-apa bikin kesalahan, yang penting jangan diulang terus.","犯错没关系，重要的是别一直重复。"],
    "menyadari":["Aku baru menyadari ternyata masalahnya bukan di klien.","我刚意识到，原来问题不在客户那边。"],
    "berkembang":["Bahasa Indonesiaku mulai berkembang sejak aku lebih sering ngobrol sama orang lokal.","自从我更常和本地人聊天后，我的印尼语开始进步了。"],
    "kemampuan":["Kemampuan ngomong biasanya naik kalau sering dipakai langsung.","经常直接使用的话，口语能力通常会提高。"],
    "berbeda":["Cara kerja tiap orang bisa berbeda, jadi harus sering komunikasi.","每个人的工作方式可能不同，所以要经常沟通。"],
    "mencapai":["Kita belum mencapai target bulan ini, tapi masih ada waktu.","我们这个月还没达到目标，不过还有时间。"],
    "mendukung":["Tim lokal harus saling mendukung biar kerjaannya lebih lancar.","本地团队要互相支持，这样工作会更顺。"]
  };
  const db=Array.isArray(window.DAILY_VOCAB_DB)?window.DAILY_VOCAB_DB:[];
  db.forEach(x=>{
    if(!x||!x.word||x.example)return;
    const hit=examples[String(x.word).trim().toLowerCase()];
    if(hit){x.example=hit[0];x.example_cn=hit[1];x.example_source='学习例句';}
  });
})();
