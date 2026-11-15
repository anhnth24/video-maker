// Tạo public/assets/ai/layout.json cho ảnh nền AI (public/assets/ai/background.jpg, 1080x1920).
// Ảnh AI không có camera thật nên mọi vị trí được đo trực tiếp trên ảnh (pixel):
//   x = toạ độ ngang trên màn hình, z = toạ độ dọc của CHÂN người trên màn hình (z lớn = gần ống kính).
// Cỡ người theo độ sâu: s(z) = (z - horizonY) / camH  (pixel trên 1 mét).
// Chạy: node tools/layout-ai.js
const fs = require('fs');
const path = require('path');

const W = 1080, H = 1920;
const horizonY = 724;   // đường chân trời (đo từ 2 mép thảm xanh)
const camH = 6.27;      // "độ cao camera" (m) sao cho thảm xanh rộng 3.6 m
const focal = 1250;     // tiêu cự giả định (px) – quyết định tốc độ đi theo chiều sâu

const s = (z) => (z - horizonY) / camH;                 // px / mét (ngang & cao)
const dz = (z) => (z - horizonY) ** 2 / (focal * camH); // px màn hình cho 1 mét theo chiều sâu
const lerpLine = (x0, y0, x1, y1) => (y) => x0 + (x1 - x0) * (y - y0) / (y1 - y0);
// n hàng cách đều theo chiều sâu thật giữa 2 toạ độ màn hình
const rowsBetween = (zTop, zBot, n) => Array.from({ length: n }, (_, i) => {
  const a = 1 / (zTop - horizonY), b = 1 / (zBot - horizonY);
  return horizonY + 1 / (a + (b - a) * (i / (n - 1)));
});
const r1 = (v) => Math.round(v * 10) / 10;

// ---- Khu Bình An: thảm xanh ở giữa, lối đi chính giữa thảm ----
const blueL = lerpLine(428, 1128, 300, 1560), blueR = lerpLine(660, 1128, 780, 1560);
const blueC = (z) => (blueL(z) + blueR(z)) / 2;
function zoneAn() {
  const seats = [];
  const laneTop = [540, 1136];
  rowsBetween(1160, 1540, 9).forEach((z, row) => {
    [-0.62, 0.62, -1.38, 1.38].forEach((off, col) => {
      const x = blueC(z) + off * s(z), zg = z - 0.5 * dz(z);
      seats.push({ x: r1(x), z: r1(z), row, col, via: [[r1(x), r1(zg)], [r1(blueC(zg)), r1(zg)], laneTop] });
    });
  });
  return {
    key: 'an', name: 'Bình An', seats,
    slots: [[478, 1118], [540, 1114], [602, 1118]],
    offerAreas: [[392, 466, 1106, 1118], [614, 688, 1106, 1118]], // [x0, x1, y màn hình, z tham chiếu cỡ]
    incense: { x: 540, y: 888, spread: 44, zRef: 1118 },          // miệng lư hương trên bục
  };
}

// ---- Khu Tài Lộc: thảm vàng bên trái; lối đi sát mép trong của thảm (tránh đèn sen) ----
function zoneSide(key, name, mirror) {
  const mx = (x) => (mirror ? W - x : x);
  const inner = lerpLine(300, 1195, 215, 1560);            // mép trong thảm
  const outer = (z) => 150 - 1.58 * (z - 1195);           // mép ngoài thảm
  const lane = (z) => inner(z) - 0.32 * s(z);
  const laneTop = [r1(mx(lane(1202))), 1202];
  const seats = [];
  rowsBetween(1228, 1540, 8).forEach((z, row) => {
    for (let col = 0; col < 4; col++) {
      const x = inner(z) - (0.98 + col * 0.86) * s(z);
      if (x < 34 || x < outer(z) + 0.35 * s(z)) break;
      const zg = z - 0.5 * dz(z);
      seats.push({ x: r1(mx(x)), z: r1(z), row, col, via: [[r1(mx(x)), r1(zg)], [r1(mx(lane(zg))), r1(zg)], laneTop] });
    }
  });
  return {
    key, name, seats,
    slots: [[mx(245), 1168], [mx(165), 1168]],
    offerAreas: [[Math.min(mx(122), mx(285)), Math.max(mx(122), mx(285)), 984, 1168]],
    incense: { x: mx(205), y: 976, spread: 26, zRef: 1168 },
  };
}

const layout = {
  mode: 'screen',
  width: W, height: H, horizonY, camH, focal,
  background: 'background.jpg',
  spriteFilter: 'saturate(1.75) contrast(1.18) brightness(0.9)',
  zones: [zoneSide('tai', 'Tài Lộc', false), zoneAn(), zoneSide('tinh', 'Tình Duyên', true)],
  deities: { tai: [172, 646], an: [540, 494], tinh: [908, 646] },
  halo: [540, 333],
  candles: [],
  labels: { buddha: [540, 772], tai: [165, 846], tinh: [915, 846] },
};

const out = path.join(__dirname, '..', 'public', 'assets', 'ai', 'layout.json');
fs.writeFileSync(out, JSON.stringify(layout, null, 1));
console.log('wrote', path.relative(process.cwd(), out), layout.zones.map((z) => `${z.key}:${z.seats.length}`).join(' '));
