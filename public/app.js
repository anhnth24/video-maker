/* Chùa Online – logic khung cảnh (canvas 1080x1920)
 * - Người vào phòng (join/chat/like) được xếp ngồi theo hàng
 * - Người tặng quà: đứng dậy, ra lối giữa, lên lư hương, vái 3 lạy, cắm hương rồi quay về chỗ cũ
 */
(() => {
  const { W, H } = Art;
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  if (params.get('overlay') === '1') document.body.classList.add('overlay');

  // ---------- Cấu hình bố cục ----------
  const CFG = {
    aisleX: 540,
    burner: { x: 540, y: 1018 },
    altarSlotsY: 1112,          // vị trí đứng vái trước lư hương
    altarSlotsX: [462, 540, 618],
    rowStartY: 1225,
    rowGap: 102,
    rows: 7,
    colsPerSide: 4,
    colGap: 96,
    sideInner: 118,             // khoảng cách từ lối giữa tới cột ghế đầu tiên
    walkSpeed: 240,             // px/giây
    prayTime: 4.2,              // giây (3 lạy)
    incenseLife: 90,            // giây cây hương cháy trên lư
    likesPerLotus: 100,
    background: params.get('bg') || null, // ảnh nền tuỳ chọn, vd ?bg=assets/background.jpg
  };

  const perspective = (y) => 0.82 + 0.4 * Math.min(1, Math.max(0, (y - 1000) / 920));

  // Ghế: ưu tiên hàng trên, gần lối giữa trước; giãn theo phối cảnh
  const seats = [];
  for (let r = 0; r < CFG.rows; r++) {
    const y = CFG.rowStartY + r * CFG.rowGap;
    const k = perspective(y);
    for (let c = 0; c < CFG.colsPerSide; c++) {
      for (const side of [-1, 1]) {
        const x = CFG.aisleX + side * (CFG.sideInner + c * CFG.colGap) * k;
        seats.push({ x, y, side, row: r, col: c, occupant: null });
      }
    }
  }

  // ---------- Trạng thái ----------
  const people = new Map();
  const prayQueue = [];
  const slots = CFG.altarSlotsX.map((x) => ({ x, y: CFG.altarSlotsY, by: null }));
  const incense = [];
  const particles = [];
  const banners = [];
  const chatLog = [];
  const motes = Array.from({ length: 70 }, () => ({ x: 200 + Math.random() * 680, y: Math.random() * 1300, v: 6 + Math.random() * 14, f: 0.3 + Math.random() * 0.6, p: Math.random() * 6, r: 0.8 + Math.random() * 1.8 }));
  let totalLotus = 0;
  let lastT = performance.now() / 1000;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // ---------- Người ----------
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
      id: user.id, nickname: user.nickname || user.id,
      img: null, avatarUrl: null,
      seat, x: seat.x, y: seat.y,
      state: 'seated', path: [], slot: null, prayStart: 0, planted: false,
      pending: 0, diamonds: 0, gifts: 0, likes: 0,
      lastActive: now(), bornAt: now(), bubble: null,
    };
    seat.occupant = p;
    if (user.avatar) setAvatar(p, user.avatar);
    people.set(p.id, p);
    burst(seat.x, seat.y - 60, 'spark', 10);
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
    let victim = null;
    for (const p of people.values()) {
      if (p.state !== 'seated' || p.pending > 0 || p.gifts > 0 || prayQueue.includes(p.id)) continue;
      if (!victim || p.lastActive < victim.lastActive) victim = p;
    }
    if (!victim) return null;
    const seat = victim.seat;
    seat.occupant = null;
    people.delete(victim.id);
    return seat;
  }

  // ---------- Event ----------
  function handleEvent(evt) {
    const p = ensurePerson(evt.user);
    if (!p) return;
    switch (evt.type) {
      case 'chat':
        p.bubble = { text: truncate(evt.text, 26), until: now() + 4.5 };
        chatLog.push({ name: p.nickname, text: evt.text, born: now() });
        if (chatLog.length > 5) chatLog.shift();
        break;
      case 'like': {
        const before = Math.floor(p.likes / CFG.likesPerLotus);
        p.likes += evt.count || 1;
        const after = Math.floor(p.likes / CFG.likesPerLotus);
        for (let i = before; i < after; i++) floatLotus(p.x, p.y - 90);
        break;
      }
      case 'gift': {
        const g = evt.gift || {};
        const count = g.count || 1;
        p.gifts += count;
        p.diamonds += (g.diamonds || 1) * count;
        totalLotus += count;
        banners.push({ name: truncate(p.nickname, 16), gift: g.name || 'quà', count, born: now(), p });
        if (banners.length > 3) banners.shift();
        p.pending += 1;
        if (!prayQueue.includes(p.id) && p.state === 'seated') prayQueue.push(p.id);
        break;
      }
    }
  }

  // ---------- Di chuyển ----------
  const laneX = (side) => CFG.aisleX + side * 42;

  function startPrayer(p, slot) {
    slot.by = p; p.slot = slot;
    p.state = 'toAltar';
    p.pending = Math.max(0, p.pending - 1);
    const lx = laneX(p.seat.side);
    p.path = [{ x: lx, y: p.seat.y }, { x: lx, y: slot.y + 60 }, { x: slot.x, y: slot.y }];
  }

  function startReturn(p) {
    const lx = laneX(p.seat.side);
    p.state = 'toSeat';
    p.path = [{ x: lx, y: p.slot.y + 60 }, { x: lx, y: p.seat.y }, { x: p.seat.x, y: p.seat.y }];
    p.slot.by = null; p.slot = null;
  }

  function stepPath(p, dt) {
    let dist = CFG.walkSpeed * perspective(p.y) * dt;
    while (dist > 0 && p.path.length) {
      const t = p.path[0];
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (d <= dist) { p.x = t.x; p.y = t.y; p.path.shift(); dist -= d; }
      else { p.x += (dx / d) * dist; p.y += (dy / d) * dist; dist = 0; }
    }
    return p.path.length === 0;
  }

  function update(dt) {
    const t = now();
    for (const slot of slots) {
      if (slot.by || !prayQueue.length) continue;
      const p = people.get(prayQueue.shift());
      if (p && p.state === 'seated') startPrayer(p, slot);
    }
    for (const p of people.values()) {
      if (p.state === 'toAltar') {
        if (stepPath(p, dt)) { p.state = 'praying'; p.prayStart = t; p.planted = false; }
      } else if (p.state === 'praying') {
        const k = (t - p.prayStart) / CFG.prayTime;
        if (k >= 0.78 && !p.planted) {
          p.planted = true;
          incense.push({ dx: clamp(p.x - CFG.burner.x, -60, 60) + rand(-14, 14), dz: rand(-6, 6), born: t, tilt: rand(-0.1, 0.1) });
          if (incense.length > 45) incense.shift();
          burst(CFG.burner.x + (p.x - CFG.burner.x) * 0.6, CFG.burner.y - 60, 'spark', 18);
          floatLotus(CFG.burner.x + rand(-60, 60), CFG.burner.y - 90);
        }
        if (k >= 1) startReturn(p);
      } else if (p.state === 'toSeat') {
        if (stepPath(p, dt)) {
          p.state = 'seated';
          if (p.pending > 0 && !prayQueue.includes(p.id)) prayQueue.push(p.id);
        }
      }
      if (p.bubble && p.bubble.until < t) p.bubble = null;
    }

    for (let i = incense.length - 1; i >= 0; i--) if (t - incense[i].born > CFG.incenseLife) incense.splice(i, 1);
    for (const s of incense) {
      if (s.tipX && Math.random() < dt * 2.5) addSmoke(s.tipX, s.tipY, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.age += dt;
      if (q.kind === 'smoke') q.x += (q.vx + Math.sin(q.age * 1.6 + q.seed) * 14) * dt;
      else q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind === 'spark') q.vy += 90 * dt;
      if (q.age >= q.life) particles.splice(i, 1);
    }
    if (particles.length > 700) particles.splice(0, particles.length - 700);
    while (banners.length && t - banners[0].born > 5.5) banners.shift();
  }

  function addSmoke(x, y, s) {
    particles.push({ kind: 'smoke', x, y, vx: rand(-4, 4), vy: rand(-40, -26), life: rand(3.5, 5.5), age: 0, r: rand(4, 7) * s, seed: Math.random() * 6 });
  }
  function burst(x, y, kind, n) {
    for (let i = 0; i < n; i++) particles.push({ kind, x, y, vx: rand(-110, 110), vy: rand(-170, -50), life: rand(0.6, 1.3), age: 0, r: rand(1.5, 3.5) });
  }
  function floatLotus(x, y) {
    particles.push({ kind: 'lotus', x, y, vx: rand(-12, 12), vy: rand(-55, -38), life: 6.5, age: 0, r: 1 });
  }

  // ---------- Nền ----------
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
  let bgImage = null;
  function buildStatic() {
    const g = bg.getContext('2d');
    g.clearRect(0, 0, W, H);
    Art.drawBackground(g, { seats, perspective, aisleX: CFG.aisleX });
    if (bgImage) {
      // Ảnh nền tuỳ chọn: phủ kiểu "cover", giữ bồ đoàn vẽ đè lên
      const s = Math.max(W / bgImage.width, H / bgImage.height);
      const w = bgImage.width * s, h = bgImage.height * s;
      g.drawImage(bgImage, (W - w) / 2, (H - h) / 2, w, h);
    }
    const v = vignette.getContext('2d');
    v.clearRect(0, 0, W, H);
    Art.drawVignette(v);
  }
  buildStatic();
  if (document.fonts) {
    Promise.all([
      document.fonts.load(`700 36px ${Art.FONT_SERIF}`),
      document.fonts.load(`600 16px ${Art.FONT_SANS}`),
      document.fonts.load(`700 16px ${Art.FONT_SANS}`),
    ]).then(buildStatic, () => {});
  }
  if (CFG.background) {
    const img = new Image();
    img.onload = () => { bgImage = img; buildStatic(); };
    img.src = CFG.background;
  }

  // ---------- Vẽ ----------
  function drawParticles(t) {
    for (const q of particles) {
      const a = 1 - q.age / q.life;
      if (q.kind === 'smoke') {
        const r = q.r * (1 + q.age * 1.1);
        ctx.fillStyle = Art.rad(ctx, q.x, q.y, 0, r, [[0, `rgba(240,236,232,${0.22 * a})`], [1, 'rgba(240,236,232,0)']]);
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'spark') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,214,120,${a})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (q.kind === 'lotus') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = Art.rad(ctx, q.x, q.y - 10, 0, 60, [[0, `rgba(255,200,120,${0.5 * a})`], [1, 'rgba(255,200,120,0)']]);
        ctx.beginPath(); ctx.arc(q.x, q.y - 10, 60, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        Art.lotus(ctx, q.x, q.y, 0.9 + Math.sin(t * 3 + q.x) * 0.05, a);
        Art.flame(ctx, q.x, q.y - 14, t, 0.45);
      }
    }
  }

  function bowAmount(p, t) {
    if (p.state !== 'praying') return 0;
    const ph = ((t - p.prayStart) / CFG.prayTime) * 3;
    return ph < 3 ? Math.pow(Math.sin((ph % 1) * Math.PI), 1.4) : 0;
  }

  function drawPeople(list, t) {
    const tags = [];
    for (const p of list) {
      const k = perspective(p.y);
      const r = Art.figure(ctx, p, t, {
        scale: k,
        bow: bowAmount(p, t),
        onSmoke: (x, y) => { if (Math.random() < 0.12) addSmoke(x, y, 0.7); },
      });
      tags.push({ p, k, top: r.headTop });
    }
    return tags;
  }

  function drawTags(tags) {
    for (const { p, k, top } of tags) {
      const moving = p.state !== 'seated';
      const stagger = !moving && p.seat.col % 2 === 1 ? 24 * k : 0;
      const y = top - 18 * k - stagger;
      Art.nameTag(ctx, p.x, y, k, p, p.gifts > 0);
      if (p.bubble) Art.speech(ctx, p.x, y - 22 * k, k, p.bubble.text);
    }
  }

  function drawHUD(t) {
    Art.pill(ctx, 26, 30, 330, 62, 'people', `${people.size} Phật tử`);
    Art.pill(ctx, 375, 30, 330, 62, 'lotus', `${totalLotus} tâm hoa`);
    Art.pill(ctx, 724, 30, 330, 62, 'incense', `${incense.length} nén hương`);

    // Cùng tham gia
    Art.ornateFrame(ctx, 22, 420, 240, 330, 'Cùng tham gia');
    const tips = [['Vào phòng', 'được mời an toạ'], ['Tặng quà', 'lên dâng hương'], ['Thả 100 tim', 'thắp 1 đèn hoa sen'], ['Bình luận', 'gửi lời nguyện cầu']];
    tips.forEach(([a, b], i) => {
      const y = 480 + i * 66;
      Art.lotus(ctx, 48, y + 12, 0.38);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe3a3'; ctx.font = `700 21px ${Art.FONT_SANS}`; ctx.fillText(a, 70, y);
      ctx.fillStyle = '#e9c9a4'; ctx.font = `400 17px ${Art.FONT_SANS}`; ctx.fillText(b, 70, y + 24);
    });

    // Bảng tri ân
    Art.ornateFrame(ctx, 818, 420, 240, 330, 'Bảng tri ân');
    const top = [...people.values()].filter((p) => p.gifts > 0).sort((a, b) => b.diamonds - a.diamonds).slice(0, 7);
    const medal = ['#ffd24a', '#d8dde6', '#e09a5a'];
    top.forEach((p, i) => {
      const y = 474 + i * 38;
      ctx.fillStyle = medal[i] || 'rgba(255,230,170,0.25)';
      ctx.beginPath(); ctx.arc(848, y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i < 3 ? '#4a0a06' : '#ffe3a3';
      ctx.font = `700 14px ${Art.FONT_SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), 848, y + 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? '#ffd24a' : '#fbe6bc';
      ctx.font = `600 18px ${Art.FONT_SANS}`;
      ctx.fillText(truncate(p.nickname, 10), 868, y + 1);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffd98a'; ctx.font = `700 17px ${Art.FONT_SANS}`;
      ctx.fillText(String(p.diamonds), 1040, y + 1);
    });
    if (!top.length) {
      ctx.fillStyle = 'rgba(240,210,170,0.8)'; ctx.font = `italic 18px ${Art.FONT_SERIF}`; ctx.textAlign = 'center';
      ctx.fillText('Chờ người hữu duyên', 938, 580);
    }

    // Thông báo quà (góc dưới trái, phía trên log chat)
    const chatCount = chatLog.filter((c) => t - c.born < 20).length;
    const baseY = H - 70 - chatCount * 44;
    banners.forEach((b, i) => {
      const age = t - b.born;
      const a = clamp(Math.min(age * 4, (5.5 - age) * 2), 0, 1);
      const y = baseY - (banners.length - 1 - i) * 66;
      const text1 = b.name, text2 = ` dâng ${b.gift} x${b.count}`;
      ctx.font = `700 24px ${Art.FONT_SANS}`;
      const w1 = ctx.measureText(text1).width;
      ctx.font = `500 24px ${Art.FONT_SANS}`;
      const w2 = ctx.measureText(text2).width;
      const w = w1 + w2 + 96, x = 22 - (1 - a) * 120;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(255,170,60,0.6)'; ctx.shadowBlur = 18;
      ctx.fillStyle = Art.lin(ctx, x, 0, x + w, 0, [[0, 'rgba(170,30,16,0.96)'], [1, 'rgba(110,10,6,0.9)']]);
      Art.rr(ctx, x, y - 26, w, 52, 26); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3; ctx.strokeStyle = Art.goldH(ctx, x, x + w); Art.rr(ctx, x, y - 26, w, 52, 26); ctx.stroke();
      Art.lotus(ctx, x + 32, y + 11, 0.48);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 24px ${Art.FONT_SANS}`; ctx.fillStyle = '#ffd98a'; ctx.fillText(text1, x + 60, y + 1);
      ctx.font = `500 24px ${Art.FONT_SANS}`; ctx.fillStyle = '#fff4dc'; ctx.fillText(text2, x + 60 + w1, y + 1);
      ctx.restore();
    });

    // Chat log
    const lines = chatLog.filter((c) => t - c.born < 20);
    lines.forEach((c, i) => {
      const y = H - 44 - (lines.length - 1 - i) * 44;
      const name = truncate(c.name, 14), text = truncate(c.text, 38);
      ctx.font = `700 21px ${Art.FONT_SANS}`;
      const nw = ctx.measureText(name + '  ').width;
      ctx.font = `400 21px ${Art.FONT_SANS}`;
      const w = nw + ctx.measureText(text).width + 34;
      ctx.fillStyle = 'rgba(25,4,2,0.6)';
      Art.rr(ctx, 22, y - 18, w, 36, 18); ctx.fill();
      ctx.fillStyle = '#d9a441'; Art.rr(ctx, 22, y - 18, 5, 36, 2); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 21px ${Art.FONT_SANS}`; ctx.fillStyle = '#ffd98a'; ctx.fillText(name, 38, y + 1);
      ctx.font = `400 21px ${Art.FONT_SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(text, 38 + nw, y + 1);
    });
  }

  function render() {
    const t = now();
    const dt = Math.min(0.05, t - lastT);
    lastT = t;
    update(dt);

    ctx.drawImage(bg, 0, 0);
    Art.drawAmbient(ctx, t, motes);

    const list = [...people.values()].sort((a, b) => a.y - b.y);
    const behind = list.filter((p) => p.y < CFG.burner.y + 40);
    const front = list.filter((p) => p.y >= CFG.burner.y + 40);
    const tags = drawPeople(behind, t);
    Art.burner(ctx, CFG.burner.x, CFG.burner.y, incense, t, CFG.incenseLife);
    tags.push(...drawPeople(front, t));
    drawParticles(t);
    ctx.drawImage(vignette, 0, 0);
    drawTags(tags);
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

  // ---------- Bảng điều khiển & giả lập ----------
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
