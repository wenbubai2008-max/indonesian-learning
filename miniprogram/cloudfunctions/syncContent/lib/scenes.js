const { normalize } = require('./cards');

const rules = [
  ['快递物流', 'paket resi kirim kurir ongkir agen gudang ekspedisi pengiriman alamat dikirim mengirim 包裹 快递 运单 派送 仓库 运费'],
  ['网店客服', 'stok pesanan komplain tukar refund toko pelanggan diskon promo ulasan 缺货 订单 换货 退款 顾客'],
  ['付款账单', 'bayar tagihan invoice transfer lunas harga uang pembayaran dibayar 付款 账单 发票 转账 价格'],
  ['办公室', 'rapat kantor atasan laporan meeting rekan_kerja 开会 同事 报告 老板'],
  ['出行', 'ojek macet kereta halte jalan bandara 打车 堵车 火车 车站'],
  ['吃喝', 'makan minum sambal warung pedas kopi 吃 喝 辣椒酱']
].map(([scene, words]) => [scene, words.split(' ').map(word => word.replace('_', ' '))]);

function classify(id, cn) {
  const indonesian = ' ' + normalize(id) + ' ';
  const match = rules.find(([, words]) => words.some(word =>
    /^[a-z]/.test(word) ? indonesian.includes(' ' + word + ' ') : cn.includes(word)));
  return match ? match[0] : '其他';
}

module.exports = { classify, scenes: ['全部', ...rules.map(([scene]) => scene), '其他'] };
