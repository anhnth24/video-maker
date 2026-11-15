/* Art – các hàm vẽ cho khung cảnh chùa (canvas 2D, 1080x1920) */
window.Art = (() => {
  const W = 1080, H = 1920;
  const FONT_SERIF = '"Noto Serif", Georgia, serif';
  const FONT_SANS = '"Be Vietnam Pro", system-ui, sans-serif';
  const VP = { x: 540, y: 620 }; // điểm tụ phối cảnh

  // ---------- Helpers ----------
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function lin(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  function rad(g, x, y, r0, r1, stops) {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  // Vàng kim loại theo trục ngang (đổ bóng hình trụ)
  const GOLD_H = [[0, '#6b420c'], [0.18, '#b67a1c'], [0.38, '#f6d27a'], [0.48, '#fff2c2'], [0.62, '#e0a83c'], [0.85, '#9a6414'], [1, '#5a3608']];
  const GOLD_V = [[0, '#fff0b8'], [0.3, '#f2c35a'], [0.65, '#c8892a'], [1, '#6e440c']];
  const goldH = (g, x0, x1) => lin(g, x0, 0, x1, 0, GOLD_H);
  const goldV = (g, y0, y1) => lin(g, 0, y0, 0, y1, GOLD_V);
  function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- Hoa sen ----------
  function petal(g, x, y, w, h, rot, fill, stroke) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-w, -h * 0.25, -w * 0.7, -h * 0.85, 0, -h);
    g.bezierCurveTo(w * 0.7, -h * 0.85, w, -h * 0.25, 0, 0);
    g.closePath();
    g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
    g.restore();
  }
  function lotus(g, x, y, s, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y); g.scale(s, s);
    const pf = lin(g, 0, -40, 0, 0, [[0, '#fff1f4'], [0.5, '#ff9fbb'], [1, '#d94f7a']]);
    for (const [a, sc] of [[-1.1, 0.8], [1.1, 0.8], [-0.6, 0.95], [0.6, 0.95]]) petal(g, 0, 0, 14 * sc, 40 * sc, a, pf, 'rgba(160,30,70,0.35)');
    petal(g, 0, 0, 13, 44, 0, pf, 'rgba(160,30,70,0.35)');
    g.fillStyle = lin(g, -30, 0, 30, 0, [[0, '#2f7d4a'], [0.5, '#5fbf6f'], [1, '#2f7d4a']]);
    g.beginPath(); g.ellipse(0, 4, 30, 7, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ---------- Tượng Phật ----------
  function buddha(g, cx) {
    // Đài sen (3 tầng)
    const base = 865;
    g.fillStyle = goldH(g, cx - 250, cx + 250);
    g.beginPath();
    g.moveTo(cx - 250, base); g.lineTo(cx + 250, base);
    g.lineTo(cx + 215, base - 55); g.lineTo(cx - 215, base - 55); g.closePath(); g.fill();
    g.fillStyle = '#7a1410';
    for (let i = -3; i <= 3; i++) { rr(g, cx + i * 60 - 22, base - 44, 44, 30, 6); g.fill(); }
    g.strokeStyle = 'rgba(255,220,140,0.6)'; g.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { rr(g, cx + i * 60 - 22, base - 44, 44, 30, 6); g.stroke(); }

    const tiers = [
      { y: base - 55, n: 13, spread: 220, w: 22, h: 60, dark: true },
      { y: base - 62, n: 11, spread: 205, w: 24, h: 72, dark: false },
      { y: base - 70, n: 9, spread: 170, w: 24, h: 70, dark: false },
    ];
    tiers.forEach((t) => {
      for (let i = 0; i < t.n; i++) {
        const u = t.n === 1 ? 0 : i / (t.n - 1) * 2 - 1;
        const x = cx + u * t.spread;
        const fill = t.dark
          ? lin(g, 0, t.y - t.h, 0, t.y, [[0, '#f7b9c8'], [1, '#a8334f']])
          : lin(g, 0, t.y - t.h, 0, t.y, [[0, '#fff3f6'], [0.45, '#ffb3c6'], [1, '#c8456a']]);
        petal(g, x, t.y, t.w, t.h, u * 0.35, fill, 'rgba(255,215,130,0.85)');
      }
    });

    const top = 260;
    // Chân xếp bằng
    g.fillStyle = lin(g, 0, top + 360, 0, top + 520, [[0, '#ffe7a0'], [0.4, '#e5ad40'], [1, '#8a5810']]);
    g.beginPath(); g.ellipse(cx, top + 440, 240, 82, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(110,60,8,0.45)'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.ellipse(cx, top + 430 + i * 8, 200 - i * 30, 52 - i * 6, 0, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    }

    // Thân
    g.fillStyle = goldH(g, cx - 175, cx + 175);
    g.beginPath();
    g.moveTo(cx - 34, top + 150);
    g.bezierCurveTo(cx - 120, top + 160, cx - 165, top + 185, cx - 170, top + 250);
    g.bezierCurveTo(cx - 178, top + 330, cx - 190, top + 390, cx - 205, top + 430);
    g.lineTo(cx + 205, top + 430);
    g.bezierCurveTo(cx + 190, top + 390, cx + 178, top + 330, cx + 170, top + 250);
    g.bezierCurveTo(cx + 165, top + 185, cx + 120, top + 160, cx + 34, top + 150);
    g.closePath(); g.fill();

    // Cà sa vắt vai trái
    g.fillStyle = lin(g, cx - 160, top + 160, cx + 160, top + 420, [[0, '#a96a14'], [0.5, '#e4aa3c'], [1, '#8a5410']]);
    g.beginPath();
    g.moveTo(cx - 34, top + 150);
    g.bezierCurveTo(cx - 10, top + 220, cx + 60, top + 320, cx + 175, top + 330);
    g.lineTo(cx + 190, top + 420);
    g.bezierCurveTo(cx + 60, top + 400, cx - 40, top + 300, cx - 90, top + 165);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,240,190,0.7)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx - 34, top + 150); g.bezierCurveTo(cx - 10, top + 220, cx + 60, top + 320, cx + 175, top + 330); g.stroke();
    // Nếp áo
    g.strokeStyle = 'rgba(95,52,6,0.4)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(cx - 70 + i * 14, top + 190 + i * 22);
      g.bezierCurveTo(cx - 10 + i * 10, top + 260 + i * 20, cx + 60 + i * 8, top + 320 + i * 12, cx + 150, top + 350 + i * 12);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,236,170,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.moveTo(cx - 150 + i * 8, top + 230 + i * 40); g.quadraticCurveTo(cx - 110, top + 260 + i * 40, cx - 100 + i * 10, top + 300 + i * 40); g.stroke();
    }

    // Tay kiết ấn thiền định + hoa sen
    g.fillStyle = lin(g, 0, top + 360, 0, top + 430, [[0, '#ffe39a'], [1, '#c58a26']]);
    g.beginPath(); g.ellipse(cx, top + 400, 92, 30, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(110,60,8,0.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 80, top + 400); g.quadraticCurveTo(cx, top + 418, cx + 80, top + 400); g.stroke();
    lotus(g, cx, top + 392, 0.95);

    // Cổ
    g.fillStyle = goldH(g, cx - 34, cx + 34);
    g.fillRect(cx - 30, top + 110, 60, 46);
    g.strokeStyle = 'rgba(110,60,8,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(cx - 28, top + 128 + i * 12); g.quadraticCurveTo(cx, top + 134 + i * 12, cx + 28, top + 128 + i * 12); g.stroke(); }

    // Tai (dái tai dài)
    for (const s of [-1, 1]) {
      g.fillStyle = goldH(g, cx + s * 70 - 16, cx + s * 70 + 16);
      g.beginPath(); g.ellipse(cx + s * 66, top + 72, 15, 44, s * -0.08, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(110,60,8,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx + s * 66, top + 66, 7, 26, s * -0.08, 0, Math.PI * 2); g.stroke();
    }
    // Mặt
    g.fillStyle = rad(g, cx - 14, top + 50, 10, 90, [[0, '#fff3c4'], [0.5, '#f2c45c'], [1, '#b47a1e']]);
    g.beginPath(); g.ellipse(cx, top + 62, 60, 74, 0, 0, Math.PI * 2); g.fill();
    // Tóc xoắn ốc
    g.fillStyle = '#1e2740';
    g.beginPath(); g.ellipse(cx, top + 26, 62, 46, 0, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(cx + 60, top + 30); g.quadraticCurveTo(cx, top + 6, cx - 60, top + 30); g.fill();
    g.beginPath(); g.ellipse(cx, top - 22, 30, 28, 0, 0, Math.PI * 2); g.fill(); // nhục kế
    g.fillStyle = '#e6b045';
    g.beginPath(); g.arc(cx, top - 50, 7, 0, Math.PI * 2); g.fill();
    for (let row = 0; row < 4; row++) {
      for (let i = -6; i <= 6; i++) {
        const x = cx + i * 9.5 + (row % 2) * 4.5;
        const y = top - 32 + row * 11 + Math.abs(i) * 1.2 + (row > 1 ? 4 : 0);
        if (row < 2 && Math.abs(i) > 3) continue;
        if (row >= 2 && Math.abs(i) > 6) continue;
        g.fillStyle = '#34446b';
        g.beginPath(); g.arc(x, y + (row >= 2 ? 22 : 0), 4.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(160,180,230,0.55)';
        g.beginPath(); g.arc(x - 1.2, y - 1.2 + (row >= 2 ? 22 : 0), 1.5, 0, Math.PI * 2); g.fill();
      }
    }
    // Ngũ quan
    g.strokeStyle = 'rgba(95,50,6,0.85)'; g.lineCap = 'round';
    g.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(cx + s * 8, top + 52); g.quadraticCurveTo(cx + s * 26, top + 40, cx + s * 46, top + 52); g.stroke(); // mày
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx + s * 12, top + 70); g.quadraticCurveTo(cx + s * 26, top + 77, cx + s * 40, top + 69); g.stroke(); // mắt khép
      g.lineWidth = 2.5;
    }
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 2, top + 58); g.quadraticCurveTo(cx - 6, top + 88, cx - 9, top + 96); g.quadraticCurveTo(cx, top + 101, cx + 9, top + 96); g.stroke();
    g.fillStyle = '#b8462e';
    g.beginPath(); g.moveTo(cx - 14, top + 112); g.quadraticCurveTo(cx, top + 106, cx + 14, top + 112); g.quadraticCurveTo(cx, top + 120, cx - 14, top + 112); g.fill();
    g.fillStyle = '#d4362a';
    g.beginPath(); g.arc(cx, top + 42, 4, 0, Math.PI * 2); g.fill(); // bạch hào
    g.lineCap = 'butt';
  }

  // ---------- Kiến trúc ----------
  function pillar(g, x, y0, y1, w) {
    g.fillStyle = lin(g, x - w / 2, 0, x + w / 2, 0, [[0, '#3a0705'], [0.25, '#8e1a12'], [0.45, '#d8402a'], [0.6, '#a3221a'], [1, '#3a0705']]);
    g.fillRect(x - w / 2, y0, w, y1 - y0);
    // Rồng cuốn cách điệu
    g.save();
    g.beginPath(); g.rect(x - w / 2, y0, w, y1 - y0); g.clip();
    g.lineCap = 'round';
    for (const [lw, col] of [[16, 'rgba(70,40,4,0.6)'], [11, goldH(g, x - w / 2, x + w / 2)]]) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath();
      for (let y = y0 + 160; y < y1 - 100; y += 4) {
        const xx = x + Math.sin((y - y0) / 70) * (w * 0.42);
        if (y === y0 + 160) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.stroke();
    }
    g.fillStyle = '#fff0b8';
    for (let y = y0 + 170; y < y1 - 110; y += 22) {
      const xx = x + Math.sin((y - y0) / 70) * (w * 0.42);
      g.beginPath(); g.arc(xx, y, 2, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // Đai vàng
    for (const [yy, hh] of [[y0, 40], [y0 + 46, 10], [y1 - 70, 12], [y1 - 52, 52]]) {
      g.fillStyle = goldH(g, x - w / 2 - 8, x + w / 2 + 8);
      g.fillRect(x - w / 2 - 8, yy, w + 16, hh);
    }
  }

  function lantern(g, x, y, s = 1) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = '#c8922e'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -200); g.lineTo(0, -78); g.stroke();
    g.fillStyle = rad(g, 0, 0, 30, 260, [[0, 'rgba(255,140,60,0.35)'], [1, 'rgba(255,100,40,0)']]);
    g.beginPath(); g.arc(0, 0, 260, 0, Math.PI * 2); g.fill();
    g.fillStyle = rad(g, -18, -14, 8, 92, [[0, '#ffb070'], [0.35, '#f0452a'], [1, '#7d0c08']]);
    g.beginPath(); g.ellipse(0, 0, 82, 72, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,200,110,0.55)'; g.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(0, 0, Math.abs(i) * 25 + 4, 72, 0, 0, Math.PI * 2); g.stroke(); }
    for (const yy of [-80, 70]) { g.fillStyle = goldH(g, -36, 36); rr(g, -36, yy, 72, 12, 4); g.fill(); }
    g.fillStyle = '#d8402a';
    g.beginPath(); g.moveTo(-14, 84); g.lineTo(14, 84); g.lineTo(18, 150); g.lineTo(-18, 150); g.closePath(); g.fill();
    g.strokeStyle = '#a3221a'; g.lineWidth = 1.5;
    for (let i = -16; i <= 16; i += 4) { g.beginPath(); g.moveTo(i * 0.8, 88); g.lineTo(i, 150); g.stroke(); }
    g.fillStyle = '#ffd36b';
    g.beginPath(); g.arc(0, 84, 6, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function latticePanel(g, x, y, w, h) {
    g.fillStyle = rad(g, x + w / 2, y + h / 2, 10, h * 0.7, [[0, 'rgba(255,190,110,0.55)'], [1, 'rgba(120,30,10,0.4)']]);
    g.fillRect(x, y, w, h);
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = 'rgba(110,22,12,0.95)'; g.lineWidth = 6;
    const step = 34;
    for (let i = -h; i < w + h; i += step) {
      g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + h, y + h); g.stroke();
      g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke();
    }
    g.strokeStyle = 'rgba(230,170,70,0.35)'; g.lineWidth = 1.5;
    for (let i = -h; i < w + h; i += step) {
      g.beginPath(); g.moveTo(x + i + 3, y); g.lineTo(x + i + h + 3, y + h); g.stroke();
    }
    g.restore();
    g.strokeStyle = goldH(g, x, x + w); g.lineWidth = 10;
    g.strokeRect(x, y, w, h);
    g.strokeStyle = 'rgba(80,20,8,0.9)'; g.lineWidth = 2;
    g.strokeRect(x + 7, y + 7, w - 14, h - 14);
  }

  function cloudBand(g, y, h) {
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#4a0a06'], [0.5, '#7a140e'], [1, '#3a0705']]);
    g.fillRect(0, y, W, h);
    g.strokeStyle = goldV(g, y, y + h); g.lineWidth = 3;
    for (let x = 20; x < W; x += 72) {
      const cy = y + h / 2;
      g.beginPath(); g.arc(x, cy, 12, Math.PI, Math.PI * 2.5); g.stroke();
      g.beginPath(); g.arc(x + 26, cy + 2, 16, Math.PI * 1.1, Math.PI * 2.2); g.stroke();
      g.beginPath(); g.arc(x + 50, cy, 10, Math.PI * 0.5, Math.PI * 2); g.stroke();
    }
    g.fillStyle = goldV(g, y - 6, y + 6); g.fillRect(0, y - 6, W, 8);
    g.fillStyle = goldV(g, y + h - 2, y + h + 8); g.fillRect(0, y + h - 2, W, 8);
  }

  function candle(g, x, y) {
    g.fillStyle = lin(g, x - 9, 0, x + 9, 0, [[0, '#c9a77a'], [0.5, '#fff6e2'], [1, '#c9a77a']]);
    g.fillRect(x - 9, y - 60, 18, 60);
    g.fillStyle = goldH(g, x - 18, x + 18);
    rr(g, x - 18, y - 4, 36, 12, 4); g.fill();
  }

  function vase(g, x, base) {
    g.fillStyle = lin(g, x - 26, 0, x + 26, 0, [[0, '#0f3f5c'], [0.45, '#5fa8c8'], [1, '#0b2e44']]);
    g.beginPath();
    g.moveTo(x - 12, base - 92); g.lineTo(x + 12, base - 92);
    g.bezierCurveTo(x + 14, base - 70, x + 34, base - 60, x + 30, base - 28);
    g.quadraticCurveTo(x + 26, base, x + 14, base); g.lineTo(x - 14, base);
    g.quadraticCurveTo(x - 26, base, x - 30, base - 28);
    g.bezierCurveTo(x - 34, base - 60, x - 14, base - 70, x - 12, base - 92);
    g.fill();
    g.strokeStyle = 'rgba(255,230,170,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, base - 40, 26, 6, 0, 0, Math.PI); g.stroke();
    g.strokeStyle = '#2f7d4a'; g.lineWidth = 3;
    const stems = [[-0.45, 120], [0, 140], [0.42, 118], [-0.2, 95], [0.25, 100]];
    stems.forEach(([a, l]) => { g.beginPath(); g.moveTo(x, base - 90); g.quadraticCurveTo(x + Math.sin(a) * l * 0.3, base - 90 - l * 0.6, x + Math.sin(a) * l, base - 90 - Math.cos(a) * l); g.stroke(); });
    stems.slice(0, 3).forEach(([a, l]) => lotus(g, x + Math.sin(a) * l, base - 82 - Math.cos(a) * l, 0.75));
    g.fillStyle = lin(g, 0, base - 200, 0, base - 160, [[0, '#4fb36a'], [1, '#22603a']]);
    stems.slice(3).forEach(([a, l]) => { g.beginPath(); g.ellipse(x + Math.sin(a) * l, base - 90 - Math.cos(a) * l, 22, 10, a, 0, Math.PI * 2); g.fill(); });
  }

  function fruitPlate(g, x, y) {
    g.fillStyle = goldH(g, x - 50, x + 50);
    g.beginPath(); g.ellipse(x, y, 52, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 10, y, 20, 18);
    g.beginPath(); g.ellipse(x, y + 18, 26, 6, 0, 0, Math.PI * 2); g.fill();
    const fruits = [[-28, -10, '#e8a020'], [0, -12, '#e05a20'], [28, -10, '#f2c230'], [-14, -32, '#8cc63f'], [14, -32, '#e8a020'], [0, -50, '#d94a2a']];
    fruits.forEach(([dx, dy, c]) => {
      g.fillStyle = rad(g, x + dx - 5, y + dy - 5, 2, 18, [[0, '#fff3c0'], [0.3, c], [1, 'rgba(0,0,0,0.5)']]);
      g.beginPath(); g.arc(x + dx, y + dy, 16, 0, Math.PI * 2); g.fill();
    });
  }

  function cushion(g, x, y, k) {
    g.fillStyle = 'rgba(30,10,4,0.35)';
    g.beginPath(); g.ellipse(x, y + 6 * k, 44 * k, 14 * k, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = lin(g, 0, y - 14 * k, 0, y + 10 * k, [[0, '#e6b84e'], [0.5, '#b8781e'], [1, '#6e3e0a']]);
    g.beginPath(); g.ellipse(x, y, 40 * k, 13 * k, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = lin(g, 0, y - 12 * k, 0, y, [[0, '#ffe08a'], [1, '#d09a32']]);
    g.beginPath(); g.ellipse(x, y - 3 * k, 32 * k, 9 * k, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,60,10,0.5)'; g.lineWidth = 1.2; g.setLineDash([3, 3]);
    g.beginPath(); g.ellipse(x, y - 3 * k, 26 * k, 7 * k, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }

  // ---------- Nền tĩnh ----------
  function drawBackground(g, opts) {
    const { seats, perspective, aisleX } = opts;
    // Tường
    g.fillStyle = lin(g, 0, 0, 0, 990, [[0, '#1c0302'], [0.35, '#4e0b07'], [1, '#7c170f']]);
    g.fillRect(0, 0, W, 1000);

    // Ô hoa văn chìm
    g.strokeStyle = 'rgba(255,190,110,0.06)'; g.lineWidth = 2;
    for (let y = 200; y < 980; y += 64) for (let x = 0; x < W; x += 64) {
      g.beginPath(); g.arc(x + 32, y + 32, 18, 0, Math.PI * 2); g.stroke();
      g.strokeRect(x + 6, y + 6, 52, 52);
    }

    // Song cửa hai bên
    latticePanel(g, 130, 330, 140, 440);
    latticePanel(g, 810, 330, 140, 440);

    // Khám thờ (vòm)
    const kx = 270, kw = 540, ky = 175, kh = 720;
    g.save();
    g.beginPath();
    g.moveTo(kx, ky + kh); g.lineTo(kx, ky + 170);
    g.quadraticCurveTo(kx, ky, kx + kw / 2, ky);
    g.quadraticCurveTo(kx + kw, ky, kx + kw, ky + 170);
    g.lineTo(kx + kw, ky + kh); g.closePath();
    g.fillStyle = rad(g, 540, 470, 20, 460, [[0, '#ffdf9a'], [0.25, '#e48a3a'], [0.6, '#8c1e10'], [1, '#3a0705']]);
    g.fill();
    g.lineWidth = 14; g.strokeStyle = goldH(g, kx, kx + kw); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(80,20,6,0.9)'; g.stroke();
    g.restore();

    // Hào quang thân & đầu
    g.fillStyle = rad(g, 540, 560, 60, 330, [[0, 'rgba(255,245,200,0.9)'], [0.5, 'rgba(255,200,100,0.45)'], [1, 'rgba(255,160,60,0)']]);
    g.beginPath(); g.arc(540, 560, 330, 0, Math.PI * 2); g.fill();
    for (const [r, a] of [[128, 0.85], [142, 0.4], [250, 0.35]]) {
      g.strokeStyle = `rgba(255,224,150,${a})`; g.lineWidth = r === 128 ? 6 : 3;
      g.beginPath(); g.arc(540, r === 250 ? 520 : 320, r, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = rad(g, 540, 320, 10, 125, [[0, 'rgba(255,250,225,0.95)'], [1, 'rgba(255,210,120,0.25)']]);
    g.beginPath(); g.arc(540, 320, 125, 0, Math.PI * 2); g.fill();
    // Lửa quanh hào quang
    g.fillStyle = 'rgba(255,214,120,0.55)';
    for (let i = 0; i < 28; i++) {
      const a = Math.PI + (i / 27) * Math.PI;
      const r = 250;
      const x = 540 + Math.cos(a) * r, y = 520 + Math.sin(a) * r;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-6, -16, 0, -26); g.quadraticCurveTo(6, -16, 8, 0); g.closePath(); g.fill();
      g.restore();
    }

    buddha(g, 540);

    // Xà ngang + biển
    cloudBand(g, 96, 56);
    g.fillStyle = lin(g, 0, 160, 0, 230, [[0, '#8e1a12'], [1, '#4a0a06']]);
    rr(g, 360, 158, 360, 66, 10); g.fill();
    g.lineWidth = 6; g.strokeStyle = goldH(g, 360, 720); g.stroke();
    g.fillStyle = goldV(g, 170, 215);
    g.font = `700 36px ${FONT_SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ĐẠI HÙNG BẢO ĐIỆN', 540, 192);

    // Diềm treo
    g.fillStyle = 'rgba(140,20,14,0.95)';
    for (let x = 0; x < W; x += 60) {
      g.beginPath(); g.moveTo(x, 150); g.lineTo(x + 60, 150); g.lineTo(x + 30, 178); g.closePath(); g.fill();
    }
    g.fillStyle = '#e6b045';
    for (let x = 30; x < W; x += 60) { g.beginPath(); g.arc(x, 176, 4, 0, Math.PI * 2); g.fill(); }

    // Bàn thờ
    const ay = 868;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(225, ay + 10, 630, 120);
    g.fillStyle = lin(g, 0, ay, 0, ay + 112, [[0, '#8e1d12'], [1, '#2e0504']]);
    g.fillRect(235, ay, 610, 112);
    g.fillStyle = goldH(g, 220, 860); g.fillRect(220, ay - 14, 640, 18);
    g.fillStyle = goldV(g, ay + 100, ay + 112); g.fillRect(228, ay + 100, 624, 12);
    // Khăn trải bàn thờ
    g.fillStyle = lin(g, 0, ay, 0, ay + 100, [[0, '#f0c040'], [1, '#c48a1c']]);
    g.beginPath(); g.moveTo(420, ay + 4); g.lineTo(660, ay + 4); g.lineTo(640, ay + 98); g.lineTo(540, ay + 108); g.lineTo(440, ay + 98); g.closePath(); g.fill();
    g.strokeStyle = '#8a1a12'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#9e1b16';
    g.font = `700 40px ${FONT_SERIF}`; g.fillText('卍', 540, ay + 52);
    // Hoa văn hai bên khăn
    g.strokeStyle = 'rgba(230,170,70,0.6)'; g.lineWidth = 2;
    for (const x0 of [255, 680]) { rr(g, x0, ay + 22, 145, 64, 8); g.stroke(); g.beginPath(); g.arc(x0 + 72, ay + 54, 18, 0, Math.PI * 2); g.stroke(); }

    vase(g, 290, ay - 6);
    vase(g, 790, ay - 6);
    fruitPlate(g, 400, ay - 22);
    fruitPlate(g, 680, ay - 22);
    candle(g, 340, ay - 6);
    candle(g, 740, ay - 6);

    // Sàn
    const fy = 990;
    g.fillStyle = lin(g, 0, fy, 0, H, [[0, '#5a2a14'], [0.25, '#8a5532'], [1, '#3e1f0e']]);
    g.fillRect(0, fy, W, H - fy);
    // Gạch phối cảnh
    g.strokeStyle = 'rgba(20,6,2,0.28)'; g.lineWidth = 2;
    for (let i = -14; i <= 14; i++) {
      const xb = 540 + i * 110;
      g.beginPath();
      const t0 = (fy - VP.y) / (H - VP.y);
      g.moveTo(VP.x + (xb - VP.x) * t0, fy); g.lineTo(xb, H); g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const y = fy + Math.pow(i / 13, 1.5) * (H - fy);
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    // Phản chiếu ánh sáng trên sàn
    g.fillStyle = rad(g, 540, 1040, 20, 520, [[0, 'rgba(255,200,120,0.45)'], [1, 'rgba(255,160,80,0)']]);
    g.beginPath(); g.ellipse(540, 1100, 560, 260, 0, 0, Math.PI * 2); g.fill();

    // Thảm đỏ
    const top = fy + 8, tw = 82, bw = 168;
    g.fillStyle = lin(g, 0, top, 0, H, [[0, '#7e0d0d'], [0.5, '#a8161a'], [1, '#6a0808']]);
    g.beginPath();
    g.moveTo(aisleX - tw, top); g.lineTo(aisleX + tw, top);
    g.lineTo(aisleX + bw, H); g.lineTo(aisleX - bw, H); g.closePath(); g.fill();
    for (const [off, lw] of [[0, 6], [16, 2]]) {
      g.strokeStyle = goldH(g, aisleX - bw, aisleX + bw); g.lineWidth = lw;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(aisleX + s * (tw - off * 0.5), top); g.lineTo(aisleX + s * (bw - off), H); g.stroke();
      }
    }
    g.fillStyle = 'rgba(240,190,80,0.55)';
    for (let i = 0; i < 12; i++) {
      const u = i / 11;
      const y = top + 40 + Math.pow(u, 1.25) * (H - top - 80);
      const k = 0.55 + 0.55 * u;
      g.save(); g.translate(aisleX, y); g.scale(k, k * 0.55);
      g.beginPath(); g.moveTo(0, -18); g.lineTo(18, 0); g.lineTo(0, 18); g.lineTo(-18, 0); g.closePath(); g.fill();
      g.restore();
    }

    // Cột trước (đè lên mép)
    pillar(g, 52, 70, 1070, 96);
    pillar(g, 1028, 70, 1070, 96);

    // Đèn lồng
    lantern(g, 210, 290, 0.95);
    lantern(g, 870, 290, 0.95);

    // Bồ đoàn
    for (const s of seats) cushion(g, s.x, s.y, perspective(s.y));
  }

  // Lớp phủ trước (vignette) – vẽ sau nhân vật
  function drawVignette(g) {
    g.fillStyle = rad(g, 540, 900, 500, 1250, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(10,0,0,0.6)']]);
    g.fillRect(0, 0, W, H);
  }

  // ---------- Hiệu ứng động ----------
  function drawAmbient(g, t, motes) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    // Tia hào quang xoay
    g.translate(540, 320);
    g.rotate(t * 0.05);
    for (let i = 0; i < 24; i++) {
      g.rotate((Math.PI * 2) / 24);
      g.fillStyle = 'rgba(255,210,120,0.05)';
      g.beginPath(); g.moveTo(-6, 130); g.lineTo(6, 130); g.lineTo(30, 420); g.lineTo(-30, 420); g.closePath(); g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Cột sáng từ trên xuống
    const pulse = 0.75 + 0.25 * Math.sin(t * 0.7);
    for (const [x, w, a] of [[420, 120, 0.06], [620, 160, 0.05], [540, 260, 0.04]]) {
      g.fillStyle = lin(g, 0, 150, 0, 1500, [[0, `rgba(255,220,150,${a * pulse})`], [1, 'rgba(255,220,150,0)']]);
      g.beginPath(); g.moveTo(x - w * 0.3, 150); g.lineTo(x + w * 0.3, 150); g.lineTo(x + w, 1500); g.lineTo(x - w, 1500); g.closePath(); g.fill();
    }
    // Bụi lấp lánh trong ánh sáng
    for (const m of motes) {
      const y = ((m.y - t * m.v) % 1300 + 1300) % 1300 + 200;
      const x = m.x + Math.sin(t * m.f + m.p) * 20;
      const a = 0.25 + 0.25 * Math.sin(t * 2 + m.p);
      g.fillStyle = `rgba(255,230,170,${a})`;
      g.beginPath(); g.arc(x, y, m.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // Lửa nến
    for (const x of [340, 740]) flame(g, x, 868 - 66, t, 1);
  }

  function flame(g, x, y, t, s) {
    const f = 1 + Math.sin(t * 13 + x) * 0.08 + Math.sin(t * 7.3 + x) * 0.06;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rad(g, x, y - 8, 2, 46 * s, [[0, 'rgba(255,200,90,0.55)'], [1, 'rgba(255,120,40,0)']]);
    g.beginPath(); g.arc(x, y - 8, 46 * s, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = lin(g, 0, y - 26 * s * f, 0, y, [[0, '#fff7d6'], [0.5, '#ffc43a'], [1, '#ff6a1a']]);
    g.beginPath();
    g.moveTo(x, y - 26 * s * f);
    g.quadraticCurveTo(x + 8 * s, y - 8 * s, x, y);
    g.quadraticCurveTo(x - 8 * s, y - 8 * s, x, y - 26 * s * f);
    g.fill();
  }

  // ---------- Lư hương ----------
  function burner(g, x, y, sticks, t, life) {
    // Bóng
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.ellipse(x, y + 70, 130, 22, 0, 0, Math.PI * 2); g.fill();
    // Chân
    for (const dx of [-62, 0, 62]) {
      g.fillStyle = goldH(g, x + dx - 12, x + dx + 12);
      g.beginPath(); g.moveTo(x + dx - 12, y + 26); g.lineTo(x + dx + 12, y + 26); g.lineTo(x + dx + 8, y + 70); g.lineTo(x + dx - 16, y + 72); g.closePath(); g.fill();
    }
    // Thân
    g.fillStyle = lin(g, x - 110, 0, x + 110, 0, [[0, '#3a2206'], [0.2, '#8a5a18'], [0.42, '#f2c25a'], [0.52, '#fff0b0'], [0.68, '#b47820'], [1, '#2e1a04']]);
    g.beginPath();
    g.moveTo(x - 108, y - 26);
    g.bezierCurveTo(x - 118, y + 20, x - 80, y + 46, x - 40, y + 48);
    g.lineTo(x + 40, y + 48);
    g.bezierCurveTo(x + 80, y + 46, x + 118, y + 20, x + 108, y - 26);
    g.closePath(); g.fill();
    // Hoa văn thân
    g.strokeStyle = 'rgba(70,40,4,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y + 6, 92, 16, 0, 0, Math.PI); g.stroke();
    g.fillStyle = 'rgba(90,50,6,0.55)';
    g.font = `700 30px ${FONT_SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('卍', x, y + 22);
    // Quai
    g.lineWidth = 9;
    for (const s of [-1, 1]) {
      g.strokeStyle = goldH(g, x + s * 120 - 20, x + s * 120 + 20);
      const a0 = s > 0 ? -Math.PI * 0.6 : Math.PI * 0.4;
      g.beginPath(); g.arc(x + s * 116, y - 24, 22, a0, a0 + Math.PI * 1.2); g.stroke();
    }
    // Miệng lư
    g.fillStyle = goldH(g, x - 112, x + 112);
    g.beginPath(); g.ellipse(x, y - 26, 112, 20, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = lin(g, 0, y - 40, 0, y - 14, [[0, '#2a1a0c'], [1, '#6b5a48']]);
    g.beginPath(); g.ellipse(x, y - 26, 98, 14, 0, 0, Math.PI * 2); g.fill();
    // Tro
    g.fillStyle = 'rgba(200,190,175,0.6)';
    g.beginPath(); g.ellipse(x, y - 24, 88, 10, 0, 0, Math.PI * 2); g.fill();

    // Nhang
    sticks.forEach((s) => {
      const burnt = Math.min(1, (t - s.born) / life);
      const len = 92 * (1 - burnt * 0.72);
      const bx = x + s.dx, by = y - 26 + s.dz;
      const tx = bx + Math.sin(s.tilt) * len, ty = by - Math.cos(s.tilt) * len;
      g.strokeStyle = '#7a2a12'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(bx, by + 10); g.lineTo(bx + Math.sin(s.tilt) * 30, by - Math.cos(s.tilt) * 30); g.stroke();
      g.strokeStyle = '#c46a2a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(bx + Math.sin(s.tilt) * 30, by - Math.cos(s.tilt) * 30); g.lineTo(tx, ty); g.stroke();
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = rad(g, tx, ty, 0, 12, [[0, 'rgba(255,170,60,0.9)'], [1, 'rgba(255,90,20,0)']]);
      g.beginPath(); g.arc(tx, ty, 12, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = '#ffe2a0';
      g.beginPath(); g.arc(tx, ty, 2.4, 0, Math.PI * 2); g.fill();
      s.tipX = tx; s.tipY = ty;
    });
  }

  // ---------- Nhân vật (nhìn từ phía sau, mặc áo tràng) ----------
  const ROBES = [
    ['#a9b8d6', '#6f80a8', '#d9e2f2'],   // lam
    ['#b9a98f', '#7e6c52', '#e4d8c2'],   // nâu nhạt
    ['#c9cfdc', '#8890a6', '#eef1f7'],   // xám trắng
    ['#a7bfc3', '#6c8a8f', '#d6e6e8'],   // lam ngọc
  ];
  const HAIR = ['#151112', '#231a16', '#2e2420', '#8f8a86', '#d5d2cf'];

  function figure(g, p, t, opts) {
    const k = opts.scale;
    const h = hash(p.id);
    const [robe, robeDark, robeLight] = ROBES[h % ROBES.length];
    const hair = HAIR[(h >>> 3) % HAIR.length];
    const bun = ((h >>> 6) & 3) === 0;
    const state = p.state;
    const walking = state === 'toAltar' || state === 'toSeat';
    const facing = state === 'toSeat' && p.path.length && p.path[0].y > p.y + 1 ? 'front' : 'back';
    const seated = state === 'seated';
    const step = walking ? t * 9 + (h % 10) : 0;
    const bob = walking ? Math.abs(Math.sin(step)) * 4 : 0;
    const sway = walking ? Math.sin(step) * 0.04 : 0;
    const bow = opts.bow || 0;

    g.save();
    g.translate(p.x, p.y);
    g.scale(k, k);

    // Bóng
    g.fillStyle = 'rgba(20,5,0,0.38)';
    g.beginPath(); g.ellipse(0, 4, seated ? 40 : 30, seated ? 12 : 9, 0, 0, Math.PI * 2); g.fill();

    g.translate(0, -bob);
    g.rotate(sway);

    let headY, shoulderY;
    if (seated || state === 'praying') {
      // Quỳ / ngồi: áo xoè trên đệm
      const kneel = state === 'praying';
      const bodyTop = (kneel ? -82 : -74) + bow * 30;
      shoulderY = bodyTop;
      g.fillStyle = lin(g, -44, 0, 44, 0, [[0, robeDark], [0.35, robe], [0.5, robeLight], [0.7, robe], [1, robeDark]]);
      g.beginPath();
      g.moveTo(-44, -2);
      g.quadraticCurveTo(-46, -24, -30, -34);
      g.quadraticCurveTo(-26, bodyTop + 30, -21, bodyTop + 6);
      g.quadraticCurveTo(-18, bodyTop - 2, -8, bodyTop - 3);
      g.lineTo(8, bodyTop - 3);
      g.quadraticCurveTo(18, bodyTop - 2, 21, bodyTop + 6);
      g.quadraticCurveTo(26, bodyTop + 30, 30, -34);
      g.quadraticCurveTo(46, -24, 44, -2);
      g.quadraticCurveTo(0, 6, -44, -2);
      g.closePath(); g.fill();
      // Nếp áo
      g.strokeStyle = 'rgba(40,40,70,0.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, bodyTop + 4); g.lineTo(0, -6); g.stroke();
      g.beginPath(); g.moveTo(-14, bodyTop + 30); g.quadraticCurveTo(-20, -20, -30, -6); g.stroke();
      g.beginPath(); g.moveTo(14, bodyTop + 30); g.quadraticCurveTo(20, -20, 30, -6); g.stroke();
      // Gót chân lộ ra
      g.fillStyle = '#e8c09a';
      g.beginPath(); g.ellipse(-12, -2, 7, 4, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(12, -2, 7, 4, 0, 0, Math.PI * 2); g.fill();
      headY = bodyTop - 14 + bow * 12;
    } else {
      // Đứng / đi: áo tràng dài
      const top = -96;
      shoulderY = top;
      // Chân bước
      if (walking) {
        g.fillStyle = '#2a2220';
        g.beginPath(); g.ellipse(-8 + Math.sin(step) * 5, 0, 7, 4, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(8 - Math.sin(step) * 5, 0, 7, 4, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = lin(g, -30, 0, 30, 0, [[0, robeDark], [0.35, robe], [0.5, robeLight], [0.7, robe], [1, robeDark]]);
      g.beginPath();
      g.moveTo(-26, -3);
      g.quadraticCurveTo(-27, top + 40, -22, top + 8);
      g.quadraticCurveTo(-18, top - 2, -8, top - 3);
      g.lineTo(8, top - 3);
      g.quadraticCurveTo(18, top - 2, 22, top + 8);
      g.quadraticCurveTo(27, top + 40, 26, -3);
      g.quadraticCurveTo(0, 2, -26, -3);
      g.closePath(); g.fill();
      // Tay áo
      g.fillStyle = robeDark;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 20, top + 8);
        g.quadraticCurveTo(s * 30, top + 40, s * (facing === 'front' ? 10 : 24), top + 58);
        g.lineTo(s * (facing === 'front' ? 4 : 18), top + 54);
        g.quadraticCurveTo(s * 22, top + 34, s * 16, top + 10);
        g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(40,40,70,0.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, top + 4); g.lineTo(0, -4); g.stroke();
      if (facing === 'front') {
        // vạt áo chéo + tay chắp
        g.strokeStyle = 'rgba(40,40,70,0.4)';
        g.beginPath(); g.moveTo(-8, top - 2); g.lineTo(10, top + 36); g.stroke();
        g.fillStyle = '#ecc49e';
        g.beginPath(); g.ellipse(0, top + 52, 6, 9, 0, 0, Math.PI * 2); g.fill();
      }
      headY = top - 16;
    }

    // Nén hương trên tay (khi đi lên và lúc vái)
    if ((state === 'toAltar' || (state === 'praying' && !p.planted))) {
      const hx = 0, hy = shoulderY + 16 + bow * 14;
      for (const dx of [-4, 0, 4]) {
        const ex = hx + dx * 1.8, ey = hy - 62 + bow * 18;
        g.strokeStyle = '#c46a2a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(hx + dx * 0.5, hy); g.lineTo(ex, ey); g.stroke();
        g.save(); g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,150,50,0.8)';
        g.beginPath(); g.arc(ex, ey, 4, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      opts.onSmoke && opts.onSmoke(p.x, p.y + (hy - 62 + bow * 18) * k);
    }

    // Đầu
    g.fillStyle = '#e2b892';
    g.fillRect(-6, headY + 8, 12, 10); // cổ
    if (facing === 'front') {
      g.fillStyle = rad(g, -3, headY - 3, 2, 18, [[0, '#f6d4b2'], [1, '#d6a47c']]);
      g.beginPath(); g.ellipse(0, headY, 13, 15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hair;
      g.beginPath(); g.ellipse(0, headY - 6, 14, 11, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#3a2418';
      g.beginPath(); g.arc(-5, headY + 1, 1.5, 0, Math.PI * 2); g.arc(5, headY + 1, 1.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#a0583a'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, headY + 6, 3.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    } else {
      g.fillStyle = rad(g, -4, headY - 6, 2, 20, [[0, shade(hair, 40)], [1, hair]]);
      g.beginPath(); g.ellipse(0, headY, 14, 16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e2b892';
      g.beginPath(); g.ellipse(-14, headY + 2, 3, 5, 0, 0, Math.PI * 2); g.ellipse(14, headY + 2, 3, 5, 0, 0, Math.PI * 2); g.fill();
      if (bun) { g.fillStyle = hair; g.beginPath(); g.arc(0, headY + 10, 7, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    return { headTop: p.y + (headY - 16 - bob) * k };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  // ---------- Bảng tên ----------
  function nameTag(g, x, y, k, p, gold) {
    const name = p.nickname.length > 10 ? p.nickname.slice(0, 9) + '…' : p.nickname;
    g.save();
    g.translate(x, y); g.scale(k, k);
    g.font = `600 15px ${FONT_SANS}`;
    const tw = g.measureText(name).width;
    const w = tw + 40, h = 26;
    const x0 = -w / 2;
    if (gold) {
      g.shadowColor = 'rgba(255,200,80,0.7)'; g.shadowBlur = 12;
    }
    g.fillStyle = gold ? lin(g, 0, -h / 2, 0, h / 2, [[0, '#ffe9a6'], [0.5, '#e2a63a'], [1, '#a46a14']])
      : lin(g, 0, -h / 2, 0, h / 2, [[0, 'rgba(120,20,14,0.92)'], [1, 'rgba(60,6,4,0.92)']]);
    rr(g, x0, -h / 2, w, h, h / 2); g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 1.6; g.strokeStyle = gold ? '#fff4c8' : 'rgba(230,170,70,0.9)'; g.stroke();
    // avatar
    const ar = 11, ax = x0 + 14;
    g.save();
    g.beginPath(); g.arc(ax, 0, ar, 0, Math.PI * 2); g.clip();
    g.fillStyle = `hsl(${hash(p.id) % 360} 50% 45%)`; g.fillRect(ax - ar, -ar, ar * 2, ar * 2);
    if (p.img) g.drawImage(p.img, ax - ar, -ar, ar * 2, ar * 2);
    else { g.fillStyle = '#fff'; g.font = `700 12px ${FONT_SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((p.nickname[0] || '?').toUpperCase(), ax, 1); }
    g.restore();
    g.strokeStyle = gold ? '#7a1410' : '#e6b045'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(ax, 0, ar, 0, Math.PI * 2); g.stroke();
    g.fillStyle = gold ? '#5a0e08' : '#fff2d6';
    g.font = `600 15px ${FONT_SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(name, ax + ar + 5, 1);
    if (gold) { lotus(g, 0, -h / 2 - 2, 0.32); }
    g.restore();
  }

  function speech(g, x, y, k, text) {
    g.save();
    g.translate(x, y); g.scale(k, k);
    g.font = `500 17px ${FONT_SANS}`;
    const w = g.measureText(text).width + 26, h = 34;
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 10;
    g.fillStyle = 'rgba(255,250,238,0.97)';
    rr(g, -w / 2, -h, w, h, 14); g.fill();
    g.beginPath(); g.moveTo(-7, -1); g.lineTo(7, -1); g.lineTo(0, 9); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#d9a441'; g.lineWidth = 1.5; rr(g, -w / 2, -h, w, h, 14); g.stroke();
    g.fillStyle = '#5a1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 0, -h / 2 + 1);
    g.restore();
  }

  // ---------- Khung trang trí cho HUD ----------
  function ornateFrame(g, x, y, w, h, title) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 18;
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, 'rgba(90,10,6,0.9)'], [1, 'rgba(40,4,2,0.9)']]);
    rr(g, x, y, w, h, 16); g.fill();
    g.restore();
    g.lineWidth = 4; g.strokeStyle = goldH(g, x, x + w); rr(g, x, y, w, h, 16); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(240,190,90,0.6)'; rr(g, x + 8, y + 8, w - 16, h - 16, 10); g.stroke();
    // Góc
    g.fillStyle = goldH(g, x, x + w);
    for (const [cx, cy] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) {
      g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a1410'; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = goldH(g, x, x + w);
    }
    if (title) {
      // Ruy băng tiêu đề
      const bw = w - 24, bx = x + 12, by = y - 20, bh = 44;
      g.fillStyle = lin(g, 0, by, 0, by + bh, [[0, '#ffe9a6'], [0.5, '#dca038'], [1, '#9a6010']]);
      g.beginPath();
      g.moveTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw - 12, by + bh / 2); g.lineTo(bx + bw, by + bh);
      g.lineTo(bx, by + bh); g.lineTo(bx + 12, by + bh / 2); g.closePath(); g.fill();
      g.strokeStyle = '#fff2c4'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#6a0e08';
      g.font = `700 24px ${FONT_SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(title, x + w / 2, by + bh / 2 + 1);
    }
  }

  function pill(g, x, y, w, h, icon, text) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 12;
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, 'rgba(110,14,8,0.92)'], [1, 'rgba(50,5,3,0.92)']]);
    rr(g, x, y, w, h, h / 2); g.fill();
    g.restore();
    g.lineWidth = 3; g.strokeStyle = goldH(g, x, x + w); rr(g, x, y, w, h, h / 2); g.stroke();
    // icon tròn
    const cx = x + h / 2 + 2, cy = y + h / 2;
    g.fillStyle = goldH(g, cx - h / 2, cx + h / 2);
    g.beginPath(); g.arc(cx, cy, h / 2 - 5, 0, Math.PI * 2); g.fill();
    if (icon === 'lotus') lotus(g, cx, cy + 8, 0.42);
    else if (icon === 'people') {
      g.fillStyle = '#6a0e08';
      g.beginPath(); g.arc(cx, cy - 6, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx, cy + 9, 11, 7, 0, Math.PI, Math.PI * 2); g.fill();
    } else if (icon === 'incense') {
      g.strokeStyle = '#6a0e08'; g.lineWidth = 2.5;
      for (const dx of [-5, 0, 5]) { g.beginPath(); g.moveTo(cx + dx * 0.4, cy + 12); g.lineTo(cx + dx, cy - 10); g.stroke(); }
      g.fillStyle = '#ff5a1a'; for (const dx of [-5, 0, 5]) { g.beginPath(); g.arc(cx + dx, cy - 11, 2.5, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = '#ffe7a8';
    g.font = `700 25px ${FONT_SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x + w / 2 + h / 4, y + h / 2 + 1);
  }

  return { W, H, FONT_SERIF, FONT_SANS, rr, lin, rad, goldH, goldV, lotus, flame, drawBackground, drawVignette, drawAmbient, burner, figure, nameTag, speech, ornateFrame, pill, hash };
})();
