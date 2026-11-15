/* Art – HUD, bảng tên và hiệu ứng vẽ bằng canvas 2D (nền & nhân vật là asset 3D trong public/assets) */
window.Art = (() => {
  const W = 1080, H = 1920;
  const FONT_SERIF = '"Noto Serif", Georgia, serif';
  const FONT_SANS = '"Be Vietnam Pro", system-ui, sans-serif';

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

  return { W, H, FONT_SERIF, FONT_SANS, rr, lin, rad, goldH, goldV, lotus, flame, nameTag, speech, ornateFrame, pill, hash };
})();
