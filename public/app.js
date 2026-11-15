/* Chùa Online – khung cảnh canvas 1080x1920
 * - Người vào phòng (join/chat/like) được xếp ngồi theo hàng
 * - Người tặng quà: đứng dậy, đi ra lối giữa, lên lư hương thắp hương, vái 3 lạy, rồi quay về chỗ cũ
 */
(() => {
  const W = 1080, H = 1920;
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  if (params.get('overlay') === '1') document.body.classList.add('overlay');

  // ---------- Cấu hình bố cục ----------
  const CFG = {
    aisleX: 540,
    aisleHalf: 85,          // nửa bề rộng thảm đỏ
    burner: { x: 540, y: 965 },
    altarSlotsY: 1045,      // vị trí đứng trước lư hương
    altarSlotsX: [470, 540, 610],
    rowStartY: 1175,
    rowGap: 112,
    rows: 7,
    colsPerSide: 4,
    colGap: 92,
    sideInner: 110,         // khoảng cách từ lối giữa tới cột ghế đầu tiên
    walkSpeed: 260,         // px/giây
    prayTime: 3.6,          // giây
    incenseLife: 90,        // giây cây hương cháy trên lư
    likesPerLotus: 100,
  };

  // Tạo danh sách ghế: ưu tiên hàng trên, gần lối giữa trước
  const seats = [];
  for (let r = 0; r < CFG.rows; r++) {
    const y = CFG.rowStartY + r * CFG.rowGap;
    for (let c = 0; c < CFG.colsPerSide; c++) {
      for (const side of [-1, 1]) {
        const x = CFG.aisleX + side * (CFG.sideInner + c * CFG.colGap);
        seats.push({ x, y, side, row: r, occupant: null });
      }
    }
  }

  // ---------- Trạng thái ----------
  const people = new Map();       // id -> person
  const prayQueue = [];           // id chờ tới lượt lên thắp hương
  const slots = CFG.altarSlotsX.map((x) => ({ x, y: CFG.altarSlotsY, by: null }));
  const incense = [];             // cây hương trên lư {dx, born}
  const particles = [];           // khói / hoa sen / lấp lánh
  const banners = [];             // thông báo quà
  const chatLog = [];
  let totalLotus = 0;
  let lastT = performance.now() / 1000;

  // ---------- Tiện ích ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const perspective = (y) => 0.78 + 0.32 * clamp((y - 960) / 960, 0, 1);
  function hashColor(s) {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 55% 45%)`;
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ---------- Quản lý người ----------
  function ensurePerson(user) {
    let p = people.get(user.id);
    if (p) {
      if (user.nickname) p.nickname = user.nickname;
      if (user.avatar && !p.avatarUrl) setAvatar(p, user.avatar);
      p.lastActive = now();
      return p;
    }
    const seat = takeSeat();
    if (!seat) return null;
    p = {
      id: user.id,
      nickname: user.nickname || user.id,
      color: hashColor(user.id),
      img: null, avatarUrl: null,
      seat, x: seat.x, y: seat.y,
      state: 'seated',          // seated | toAltar | praying | toSeat
      path: [], slot: null, prayStart: 0,
      pending: 0, diamonds: 0, gifts: 0, likes: 0,
      lastActive: now(), bornAt: now(),
      bubble: null,
    };
    seat.occupant = p;
    if (user.avatar) setAvatar(p, user.avatar);
    people.set(p.id, p);
    // hiệu ứng xuất hiện
    burst(seat.x, seat.y - 40, 'spark', 8);
    return p;
  }

  function setAvatar(p, url) {
    p.avatarUrl = url;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { p.img = img; };
    img.src = url;
  }

  function takeSeat() {
    const free = seats.find((s) => !s.occupant);
    if (free) return free;
    // Hết ghế: mời người ngồi lâu nhất, chưa hoạt động và không có lượt quà chờ ra về
    let victim = null;
    for (const p of people.values()) {
      if (p.state !== 'seated' || p.pending > 0 || prayQueue.includes(p.id)) continue;
      if (!victim || p.lastActive < victim.lastActive) victim = p;
    }
    if (!victim) return null;
    const seat = victim.seat;
    seat.occupant = null;
    people.delete(victim.id);
    return seat;
  }

  // ---------- Xử lý event ----------
  function handleEvent(evt) {
    const p = ensurePerson(evt.user);
    if (!p) return;
    switch (evt.type) {
      case 'join':
        break;
      case 'chat':
        p.bubble = { text: truncate(evt.text, 28), until: now() + 4 };
        pushChat(p.nickname, evt.text);
        break;
      case 'like': {
        const before = Math.floor(p.likes / CFG.likesPerLotus);
        p.likes += evt.count || 1;
        const after = Math.floor(p.likes / CFG.likesPerLotus);
        for (let i = before; i < after; i++) floatLotus(p.x, p.y - 60);
        break;
      }
      case 'gift': {
        const g = evt.gift || {};
        const count = g.count || 1;
        p.gifts += count;
        p.diamonds += (g.diamonds || 1) * count;
        totalLotus += count;
        banners.push({ text: `${truncate(p.nickname, 16)} đã gửi ${g.name || 'quà'} x${count}`, born: now() });
        if (banners.length > 3) banners.shift();
        // Mỗi lần tặng = 1 lượt lên thắp hương (gộp nếu đang chờ)
        p.pending += 1;
        if (!prayQueue.includes(p.id) && p.state === 'seated') prayQueue.push(p.id);
        break;
      }
    }
  }

  function pushChat(name, text) {
    chatLog.push({ name, text, born: now() });
    if (chatLog.length > 5) chatLog.shift();
  }

  // ---------- Di chuyển ----------
  function aisleLaneX(side) { return CFG.aisleX + side * 38; }

  function startPrayer(p, slot) {
    slot.by = p;
    p.slot = slot;
    p.state = 'toAltar';
    p.pending = Math.max(0, p.pending - 1);
    const laneX = aisleLaneX(p.seat.side);
    p.path = [
      { x: laneX, y: p.seat.y },
      { x: laneX, y: slot.y + 70 },
      { x: slot.x, y: slot.y },
    ];
  }

  function startReturn(p) {
    const laneX = aisleLaneX(p.seat.side);
    p.state = 'toSeat';
    p.path = [
      { x: laneX, y: p.slot.y + 70 },
      { x: laneX, y: p.seat.y },
      { x: p.seat.x, y: p.seat.y },
    ];
    p.slot.by = null;
    p.slot = null;
  }

  function stepPath(p, dt) {
    let dist = CFG.walkSpeed * dt;
    while (dist > 0 && p.path.length) {
      const t = p.path[0];
      const dx = t.x - p.x, dy = t.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= dist) { p.x = t.x; p.y = t.y; p.path.shift(); dist -= d; }
      else { p.x += (dx / d) * dist; p.y += (dy / d) * dist; dist = 0; }
    }
    return p.path.length === 0;
  }

  function update(dt) {
    const t = now();
    // Gán lượt thắp hương cho slot trống
    for (const slot of slots) {
      if (slot.by || !prayQueue.length) continue;
      const id = prayQueue.shift();
      const p = people.get(id);
      if (p && p.state === 'seated') startPrayer(p, slot);
    }

    for (const p of people.values()) {
      if (p.state === 'toAltar') {
        if (stepPath(p, dt)) { p.state = 'praying'; p.prayStart = t; }
      } else if (p.state === 'praying') {
        const k = (t - p.prayStart) / CFG.prayTime;
        if (k >= 0.75 && !p.planted) {
          p.planted = true;
          incense.push({ dx: rand(-55, 55), born: t, tilt: rand(-0.08, 0.08) });
          if (incense.length > 40) incense.shift();
          burst(CFG.burner.x, CFG.burner.y - 40, 'spark', 14);
          floatLotus(CFG.burner.x + rand(-40, 40), CFG.burner.y - 60);
        }
        if (k >= 1) { p.planted = false; startReturn(p); }
      } else if (p.state === 'toSeat') {
        if (stepPath(p, dt)) {
          p.state = 'seated';
          if (p.pending > 0 && !prayQueue.includes(p.id)) prayQueue.push(p.id);
        }
      }
      if (p.bubble && p.bubble.until < t) p.bubble = null;
    }

    // Hương cháy hết thì bỏ
    for (let i = incense.length - 1; i >= 0; i--) {
      if (t - incense[i].born > CFG.incenseLife) incense.splice(i, 1);
    }
    // Khói từ các cây hương
    for (const s of incense) {
      if (Math.random() < dt * 2.2) {
        const tip = incenseTip(s, t);
        particles.push({ kind: 'smoke', x: tip.x, y: tip.y, vx: rand(-6, 6), vy: rand(-38, -26), life: rand(3, 5), age: 0, r: rand(5, 9) });
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.age += dt;
      q.x += q.vx * dt + (q.kind === 'smoke' ? Math.sin((q.age + q.y) * 1.3) * 8 * dt : 0);
      q.y += q.vy * dt;
      if (q.kind === 'spark') q.vy += 60 * dt;
      if (q.age >= q.life) particles.splice(i, 1);
    }
    if (particles.length > 600) particles.splice(0, particles.length - 600);
    while (banners.length && t - banners[0].born > 5) banners.shift();
  }

  function burst(x, y, kind, n) {
    for (let i = 0; i < n; i++) {
      particles.push({ kind, x, y, vx: rand(-90, 90), vy: rand(-140, -40), life: rand(0.6, 1.2), age: 0, r: rand(2, 4) });
    }
  }
  function floatLotus(x, y) {
    particles.push({ kind: 'lotus', x, y, vx: rand(-10, 10), vy: rand(-60, -40), life: 6, age: 0, r: 18 });
  }

  // ---------- Vẽ nền tĩnh (render 1 lần) ----------
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  drawBackground(bg.getContext('2d'));

  function drawBackground(g) {
    // Tường đỏ
    let grd = g.createLinearGradient(0, 0, 0, 980);
    grd.addColorStop(0, '#4a0b0b');
    grd.addColorStop(1, '#8a1a12');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, 980);

    // Hoa văn tường (ô vuông mờ)
    g.strokeStyle = 'rgba(255,200,120,0.07)';
    g.lineWidth = 2;
    for (let y = 120; y < 960; y += 70) for (let x = 0; x < W; x += 70) g.strokeRect(x + 8, y + 8, 54, 54);

    // Cột
    for (const x of [70, 1010]) {
      grd = g.createLinearGradient(x - 40, 0, x + 40, 0);
      grd.addColorStop(0, '#5a0e0a'); grd.addColorStop(0.5, '#b8321f'); grd.addColorStop(1, '#5a0e0a');
      g.fillStyle = grd;
      g.fillRect(x - 40, 80, 80, 900);
      g.fillStyle = '#d9a441';
      g.fillRect(x - 46, 80, 92, 18);
      g.fillRect(x - 46, 950, 92, 22);
    }

    // Hào quang
    const halo = { x: 540, y: 470 };
    grd = g.createRadialGradient(halo.x, halo.y, 40, halo.x, halo.y, 340);
    grd.addColorStop(0, 'rgba(255,236,170,0.95)');
    grd.addColorStop(0.45, 'rgba(255,190,90,0.55)');
    grd.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(halo.x, halo.y, 340, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,220,140,0.6)';
    g.lineWidth = 4;
    g.beginPath(); g.arc(halo.x, halo.y - 120, 120, 0, Math.PI * 2); g.stroke();

    drawBuddha(g, 540, 300);

    // Đèn lồng
    for (const x of [200, 880]) drawLantern(g, x, 210);

    // Bàn thờ
    grd = g.createLinearGradient(0, 860, 0, 960);
    grd.addColorStop(0, '#7a1f12'); grd.addColorStop(1, '#3d0906');
    g.fillStyle = grd;
    g.fillRect(250, 870, 580, 90);
    g.fillStyle = '#d9a441';
    g.fillRect(240, 860, 600, 14);
    g.strokeStyle = 'rgba(217,164,65,0.6)';
    g.lineWidth = 3;
    for (let x = 290; x < 800; x += 105) g.strokeRect(x, 888, 80, 54);
    // Bình hoa sen trên bàn thờ
    for (const x of [300, 780]) drawVase(g, x, 860);
    // Nến
    for (const x of [380, 700]) {
      g.fillStyle = '#f2e6c8'; g.fillRect(x - 7, 815, 14, 45);
      g.fillStyle = '#ffd36b';
      g.beginPath(); g.ellipse(x, 806, 6, 12, 0, 0, Math.PI * 2); g.fill();
    }

    // Sàn
    grd = g.createLinearGradient(0, 960, 0, H);
    grd.addColorStop(0, '#c9a27a'); grd.addColorStop(1, '#8f6a48');
    g.fillStyle = grd;
    g.fillRect(0, 960, W, H - 960);
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    g.lineWidth = 2;
    for (let y = 1000; y < H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    // Thảm đỏ lối giữa (phối cảnh)
    g.fillStyle = '#9e1b1b';
    g.beginPath();
    g.moveTo(CFG.aisleX - 70, 990); g.lineTo(CFG.aisleX + 70, 990);
    g.lineTo(CFG.aisleX + 115, H); g.lineTo(CFG.aisleX - 115, H);
    g.closePath(); g.fill();
    g.strokeStyle = '#e0b04e';
    g.lineWidth = 5;
    g.stroke();

    // Bồ đoàn (đệm ngồi) cho từng ghế
    for (const s of seats) {
      const k = perspective(s.y);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.ellipse(s.x, s.y + 6, 36 * k, 12 * k, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a5532a';
      g.beginPath(); g.ellipse(s.x, s.y, 34 * k, 11 * k, 0, 0, Math.PI * 2); g.fill();
    }
  }

  function drawBuddha(g, cx, top) {
    const gold = (y0, y1) => {
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.5, '#e0a832'); gr.addColorStop(1, '#a8701a');
      return gr;
    };
    // Đài sen
    g.fillStyle = gold(700, 820);
    for (let i = -4; i <= 4; i++) {
      g.beginPath();
      g.ellipse(cx + i * 46, 770, 30, 52, i * 0.12, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#b97a1e';
    g.fillRect(cx - 210, 800, 420, 50);
    g.fillStyle = gold(800, 850);
    g.fillRect(cx - 220, 795, 440, 14);

    // Thân (y phục)
    g.fillStyle = gold(top + 150, top + 460);
    g.beginPath();
    g.moveTo(cx - 70, top + 150);
    g.quadraticCurveTo(cx - 175, top + 230, cx - 175, top + 400);
    g.lineTo(cx + 175, top + 400);
    g.quadraticCurveTo(cx + 175, top + 230, cx + 70, top + 150);
    g.closePath(); g.fill();
    // Chân xếp bằng
    g.beginPath();
    g.ellipse(cx, top + 420, 225, 70, 0, 0, Math.PI * 2);
    g.fill();
    // Nếp áo
    g.strokeStyle = 'rgba(120,70,10,0.45)';
    g.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(cx - 60 + i * 10, top + 170 + i * 20);
      g.quadraticCurveTo(cx + 40, top + 260 + i * 25, cx + 130, top + 330 + i * 15);
      g.stroke();
    }
    // Tay ấn thiền
    g.fillStyle = gold(top + 340, top + 420);
    g.beginPath(); g.ellipse(cx, top + 385, 80, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff9fb0';
    g.beginPath(); g.ellipse(cx, top + 365, 18, 14, 0, 0, Math.PI * 2); g.fill();

    // Cổ & đầu
    g.fillStyle = gold(top + 40, top + 160);
    g.fillRect(cx - 26, top + 120, 52, 40);
    g.beginPath(); g.ellipse(cx, top + 75, 62, 74, 0, 0, Math.PI * 2); g.fill();
    // Tai
    g.beginPath(); g.ellipse(cx - 64, top + 90, 13, 34, 0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 64, top + 90, 13, 34, -0.1, 0, Math.PI * 2); g.fill();
    // Tóc xoắn ốc + nhục kế
    g.fillStyle = '#7a4a10';
    g.beginPath(); g.ellipse(cx, top + 30, 60, 38, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.ellipse(cx, top - 8, 26, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,220,140,0.35)';
    for (let i = -4; i <= 4; i++) for (let j = 0; j < 2; j++) {
      g.beginPath(); g.arc(cx + i * 12, top + 14 + j * 12, 3, 0, Math.PI * 2); g.fill();
    }
    // Mặt
    g.strokeStyle = 'rgba(110,60,10,0.8)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(cx - 24, top + 80, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.arc(cx + 24, top + 80, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.arc(cx, top + 112, 12, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.fillStyle = '#c0392b';
    g.beginPath(); g.arc(cx, top + 58, 3.5, 0, Math.PI * 2); g.fill();
  }

  function drawLantern(g, x, y) {
    g.strokeStyle = '#d9a441'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, 80); g.lineTo(x, y - 60); g.stroke();
    const gr = g.createRadialGradient(x, y, 10, x, y, 80);
    gr.addColorStop(0, '#ff6a4a'); gr.addColorStop(1, '#a3120c');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, 70, 62, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9a441';
    g.fillRect(x - 30, y - 70, 60, 12);
    g.fillRect(x - 30, y + 58, 60, 12);
    g.strokeStyle = '#d9a441'; g.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 8, y + 70); g.lineTo(x + i * 8, y + 110); g.stroke(); }
    // ánh sáng
    const glow = g.createRadialGradient(x, y, 20, x, y, 160);
    glow.addColorStop(0, 'rgba(255,120,60,0.25)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, 160, 0, Math.PI * 2); g.fill();
  }

  function drawVase(g, x, base) {
    g.fillStyle = '#e0b04e';
    g.beginPath(); g.ellipse(x, base - 25, 22, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f7d32';
    for (const a of [-0.5, 0, 0.5]) {
      g.save(); g.translate(x, base - 50); g.rotate(a);
      g.fillRect(-2, -60, 4, 60);
      g.restore();
    }
    g.fillStyle = '#ff9fb0';
    for (const a of [-0.5, 0, 0.5]) {
      g.beginPath(); g.ellipse(x + Math.sin(a) * 60, base - 50 - Math.cos(a) * 60, 12, 16, a, 0, Math.PI * 2); g.fill();
    }
  }

  // ---------- Vẽ động ----------
  function incenseTip(s, t) {
    const burnt = clamp((t - s.born) / CFG.incenseLife, 0, 1);
    const len = 70 * (1 - burnt * 0.75);
    const bx = CFG.burner.x + s.dx, by = CFG.burner.y - 28;
    return { x: bx + Math.sin(s.tilt) * len, y: by - Math.cos(s.tilt) * len, bx, by, len };
  }

  function drawBurner(t) {
    const { x, y } = CFG.burner;
    // Cây hương
    for (const s of incense) {
      const tip = incenseTip(s, t);
      ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tip.bx, tip.by); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.fillStyle = `rgba(255,${120 + Math.sin(t * 8 + s.dx) * 40},40,1)`;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Lư hương đồng
    const gr = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    gr.addColorStop(0, '#6b4a1a'); gr.addColorStop(0.5, '#d9a441'); gr.addColorStop(1, '#6b4a1a');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(x, y - 28, 88, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 88, y - 28);
    ctx.quadraticCurveTo(x - 92, y + 30, x - 50, y + 40);
    ctx.lineTo(x + 50, y + 40);
    ctx.quadraticCurveTo(x + 92, y + 30, x + 88, y - 28);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2508';
    ctx.beginPath(); ctx.ellipse(x, y - 28, 76, 11, 0, 0, Math.PI * 2); ctx.fill();
    // Chân + quai
    ctx.fillStyle = '#8a6020';
    for (const dx of [-50, 0, 50]) ctx.fillRect(x + dx - 7, y + 38, 14, 28);
    ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 7;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(x + s * 98, y - 12, 16, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPerson(p, t) {
    const k = perspective(p.y);
    const R = 30 * k; // bán kính avatar
    const walking = p.state === 'toAltar' || p.state === 'toSeat';
    const praying = p.state === 'praying';
    const seated = p.state === 'seated';
    const bob = walking ? Math.abs(Math.sin(t * 10 + p.x)) * 6 * k : 0;

    // Góc vái: 3 lạy trong thời gian cầu nguyện
    let bow = 0;
    if (praying) {
      const ph = ((t - p.prayStart) / CFG.prayTime) * 3;
      bow = ph < 3 ? Math.max(0, Math.sin((ph % 1) * Math.PI)) : 0;
    }

    ctx.save();
    ctx.translate(p.x, p.y - bob);

    // Bóng
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, bob + 4, 30 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();

    // Thân (áo tràng lam)
    const bodyH = (seated ? 46 : 78) * k;
    const bodyW = (seated ? 50 : 40) * k;
    ctx.fillStyle = '#c9cfe0';
    ctx.strokeStyle = '#8c93ab';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.45, -bodyH);
    ctx.quadraticCurveTo(-bodyW, -bodyH * 0.3, -bodyW * (seated ? 1 : 0.6), 0);
    ctx.lineTo(bodyW * (seated ? 1 : 0.6), 0);
    ctx.quadraticCurveTo(bodyW, -bodyH * 0.3, bodyW * 0.45, -bodyH);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Tay chắp / cầm hương
    const handY = -bodyH * 0.6 + bow * 10 * k;
    ctx.fillStyle = '#f1c9a5';
    ctx.beginPath(); ctx.ellipse(0, handY, 7 * k, 11 * k, 0, 0, Math.PI * 2); ctx.fill();
    if (p.state === 'toAltar' || (praying && !p.planted)) {
      // 3 nén hương trên tay
      ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 2;
      for (const dx of [-5, 0, 5]) {
        ctx.beginPath(); ctx.moveTo(dx * k, handY); ctx.lineTo(dx * 1.6 * k, handY - 42 * k); ctx.stroke();
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath(); ctx.arc(dx * 1.6 * k, handY - 42 * k, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      if (Math.random() < 0.15) {
        particles.push({ kind: 'smoke', x: p.x, y: p.y + handY - 44 * k, vx: rand(-4, 4), vy: -25, life: 2, age: 0, r: 4 });
      }
    }

    // Đầu = avatar
    const headY = -bodyH - R * 0.85 + bow * 22 * k;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, headY, R, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = p.color; ctx.fill();
    ctx.clip();
    if (p.img) {
      ctx.drawImage(p.img, -R, headY - R, R * 2, R * 2);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(R)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((p.nickname[0] || '?').toUpperCase(), 0, headY + 1);
    }
    ctx.restore();
    const isTop = p.gifts > 0;
    ctx.strokeStyle = isTop ? '#ffd24a' : '#fff6e0';
    ctx.lineWidth = isTop ? 4 : 2.5;
    ctx.beginPath(); ctx.arc(0, headY, R, 0, Math.PI * 2); ctx.stroke();

    // Tên
    const label = truncate(p.nickname, 12);
    ctx.font = `600 ${Math.round(17 * k)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 14;
    const ly = headY - R - 14 * k;
    ctx.fillStyle = isTop ? 'rgba(120,20,10,0.85)' : 'rgba(0,0,0,0.5)';
    roundRect(ctx, -tw / 2, ly - 12 * k, tw, 24 * k, 10 * k); ctx.fill();
    ctx.fillStyle = isTop ? '#ffd98a' : '#fff';
    ctx.fillText(label, 0, ly);

    // Bong bóng chat
    if (p.bubble) {
      ctx.font = `500 ${Math.round(18 * k)}px system-ui`;
      const bw = ctx.measureText(p.bubble.text).width + 20;
      const by = ly - 40 * k;
      ctx.fillStyle = 'rgba(255,250,235,0.95)';
      roundRect(ctx, -bw / 2, by - 16 * k, bw, 32 * k, 12 * k); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, by + 15 * k); ctx.lineTo(6, by + 15 * k); ctx.lineTo(0, by + 24 * k); ctx.fill();
      ctx.fillStyle = '#4a1a0a';
      ctx.fillText(p.bubble.text, 0, by);
    }
    ctx.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawParticles() {
    for (const q of particles) {
      const a = 1 - q.age / q.life;
      if (q.kind === 'smoke') {
        ctx.fillStyle = `rgba(235,235,240,${0.28 * a})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + q.age * 0.8), 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'spark') {
        ctx.fillStyle = `rgba(255,220,120,${a})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'lotus') {
        drawLotus(q.x, q.y, q.r, a);
      }
    }
  }

  function drawLotus(x, y, r, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.2);
    glow.addColorStop(0, 'rgba(255,220,140,0.7)'); glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8fab';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.ellipse(i * r * 0.32, 0, r * 0.32, r * 0.8, i * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function panel(x, y, w, h, title) {
    ctx.fillStyle = 'rgba(60,8,6,0.78)';
    roundRect(ctx, x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.font = '700 28px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, x + w / 2, y + 30);
  }

  function drawHUD(t) {
    // Thanh trên
    ctx.textBaseline = 'middle';
    const pills = [
      `${people.size} Phật tử`,
      `${totalLotus} tâm hoa`,
      `${incense.length} nén hương`,
    ];
    pills.forEach((txt, i) => {
      const x = 30 + i * 345;
      ctx.fillStyle = 'rgba(60,8,6,0.8)';
      roundRect(ctx, x, 28, 330, 54, 27); ctx.fill();
      ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe3a3';
      ctx.font = '700 26px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(txt, x + 165, 56);
    });

    // Hướng dẫn tham gia
    panel(26, 380, 250, 300, 'Cùng tham gia');
    ctx.textAlign = 'left';
    const tips = [
      ['Vào phòng', 'được mời ngồi'],
      ['Tặng quà', 'lên thắp hương'],
      ['Tim 100 lần', 'thả 1 đèn hoa sen'],
      ['Bình luận', 'hiện lời cầu nguyện'],
    ];
    tips.forEach(([a, b], i) => {
      const y = 440 + i * 58;
      ctx.fillStyle = '#ffe3a3'; ctx.font = '700 22px system-ui'; ctx.fillText(a, 46, y);
      ctx.fillStyle = '#f0d3b0'; ctx.font = '400 18px system-ui'; ctx.fillText(b, 46, y + 24);
    });

    // Bảng tri ân
    panel(804, 380, 250, 300, 'Bảng tri ân');
    const top = [...people.values()].filter((p) => p.gifts > 0)
      .sort((a, b) => b.diamonds - a.diamonds).slice(0, 7);
    ctx.textAlign = 'left';
    top.forEach((p, i) => {
      const y = 440 + i * 34;
      ctx.fillStyle = i === 0 ? '#ffd24a' : '#ffe3a3';
      ctx.font = '700 20px system-ui';
      ctx.fillText(`${i + 1}. ${truncate(p.nickname, 11)}`, 822, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(p.diamonds), 1040, y);
      ctx.textAlign = 'left';
    });
    if (!top.length) {
      ctx.fillStyle = '#f0d3b0'; ctx.font = 'italic 18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Chưa có ai', 929, 520);
    }

    // Thông báo quà
    banners.forEach((b, i) => {
      const age = t - b.born;
      const a = clamp(Math.min(age * 4, (5 - age) * 2), 0, 1);
      const y = 1080 - (banners.length - 1 - i) * 62;
      ctx.globalAlpha = a;
      ctx.font = '700 26px system-ui';
      const w = ctx.measureText(b.text).width + 50;
      const x = 540 - w / 2 + (1 - a) * -60;
      const gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(160,30,20,0.92)'); gr.addColorStop(1, 'rgba(220,140,40,0.92)');
      ctx.fillStyle = gr;
      roundRect(ctx, x, y - 26, w, 52, 26); ctx.fill();
      ctx.fillStyle = '#fff6dc'; ctx.textAlign = 'center';
      ctx.fillText(b.text, 540, y);
      ctx.globalAlpha = 1;
    });

    // Chat log dưới cùng
    const lines = chatLog.filter((c) => t - c.born < 20);
    lines.forEach((c, i) => {
      const y = H - 40 - (lines.length - 1 - i) * 40;
      ctx.font = '600 22px system-ui';
      ctx.textAlign = 'left';
      const name = truncate(c.name, 14) + ': ';
      const nw = ctx.measureText(name).width;
      const text = truncate(c.text, 40);
      ctx.font = '400 22px system-ui';
      const w = nw + ctx.measureText(text).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, 20, y - 17, w, 34, 17); ctx.fill();
      ctx.font = '600 22px system-ui'; ctx.fillStyle = '#ffd98a'; ctx.fillText(name, 32, y);
      ctx.font = '400 22px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(text, 32 + nw, y);
    });
  }

  function render() {
    const t = now();
    const dt = Math.min(0.05, t - lastT);
    lastT = t;
    update(dt);

    ctx.drawImage(bg, 0, 0);
    // Người đi lên gần lư hương phía sau lư thì vẽ trước lư — sắp xếp theo y
    const list = [...people.values()].sort((a, b) => a.y - b.y);
    const behind = list.filter((p) => p.y < CFG.burner.y);
    const front = list.filter((p) => p.y >= CFG.burner.y);
    behind.forEach((p) => drawPerson(p, t));
    drawBurner(t);
    front.forEach((p) => drawPerson(p, t));
    drawParticles();
    drawHUD(t);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---------- Socket ----------
  const statusEl = document.getElementById('status');
  const socket = io();
  socket.on('live', handleEvent);
  socket.on('status', (s) => {
    const map = { idle: 'chưa kết nối', connecting: 'đang kết nối…', connected: 'đã kết nối', error: 'lỗi', ended: 'live đã kết thúc', disconnected: 'mất kết nối' };
    statusEl.textContent = `Trạng thái: ${map[s.state] || s.state}${s.username ? ' @' + s.username : ''}${s.viewers ? ' · ' + s.viewers + ' người xem' : ''}${s.error ? ' — ' + s.error : ''}`;
  });

  // ---------- Bảng điều khiển ----------
  const $ = (id) => document.getElementById(id);
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then((r) => r.json()).catch((e) => ({ error: e.message }));

  $('btnConnect').onclick = async () => {
    const r = await post('/api/connect', { username: $('username').value });
    if (r.error) statusEl.textContent = 'Lỗi: ' + r.error;
  };
  $('btnDisconnect').onclick = () => post('/api/disconnect');

  const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
  const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Hiền', 'Lan', 'Minh', 'Nam', 'Ngọc', 'Phúc', 'Quân', 'Thảo', 'Trang', 'Tuấn', 'Yến', 'Khang', 'Linh'];
  const GIFTS = [['Hoa hồng', 1], ['Tim', 5], ['Đèn hoa sen', 10], ['Kem', 30], ['Nhẫn', 99]];
  const CHATS = ['A Di Đà Phật', 'Nam mô A Di Đà Phật', 'Cho mình vào thắp hương', 'Cầu bình an cho gia đình', 'Con xin cảm ơn', 'Cầu mong sức khoẻ'];
  let simId = 0;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const newUser = () => { simId++; return { id: 'sim_' + Date.now().toString(36) + simId, nickname: `${pick(TEN)} ${pick(HO)}` }; };
  const existingUser = () => {
    const arr = [...people.values()];
    if (!arr.length) return newUser();
    const p = pick(arr);
    return { id: p.id, nickname: p.nickname };
  };
  const simGift = (user) => {
    const [name, diamonds] = pick(GIFTS);
    return post('/api/simulate', { type: 'gift', user, gift: { name, diamonds, count: 1 + Math.floor(Math.random() * 3) } });
  };

  const sims = {
    join: () => post('/api/simulate', { type: 'join', user: newUser() }),
    join10: () => { for (let i = 0; i < 10; i++) sims.join(); },
    gift: () => simGift(existingUser()),
    gift5: () => { for (let i = 0; i < 5; i++) simGift(existingUser()); },
    chat: () => post('/api/simulate', { type: 'chat', user: existingUser(), text: pick(CHATS) }),
  };

  let autoTimer = null;
  document.querySelectorAll('[data-sim]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.sim;
      if (k === 'auto') {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; b.textContent = 'Tự động: TẮT'; return; }
        b.textContent = 'Tự động: BẬT';
        autoTimer = setInterval(() => {
          const r = Math.random();
          if (r < 0.4) sims.join();
          else if (r < 0.65) sims.chat();
          else if (r < 0.85) sims.gift();
          else post('/api/simulate', { type: 'like', user: existingUser(), count: 50 });
        }, 900);
        return;
      }
      sims[k]?.();
    };
  });
})();
