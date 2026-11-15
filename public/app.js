/* Chùa Online – runtime 2.5D
 * Nền + nhân vật là asset render từ 3D (tools/render). Toạ độ người tính theo mét trong thế giới 3D
 * rồi chiếu ra màn hình bằng ma trận camera (assets/layout.json) nên luôn khớp phối cảnh.
 */
(async () => {
  const W = 1080, H = 1920;
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  if (params.get('overlay') === '1') document.body.classList.add('overlay');

  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [layout, meta] = await Promise.all([
    fetch('assets/layout.json').then((r) => r.json()),
    fetch('assets/sprites.json').then((r) => r.json()),
  ]);
  const [bgImg, ...sheets] = await Promise.all([loadImg(params.get('bg') || 'assets/background.png'), ...meta.variants.map((v) => loadImg('assets/' + v))]);
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

  const CFG = {
    walkSpeed: 1.25,      // m/s
    bows: 3,
    incenseLife: 90,      // s
    likesPerLotus: 100,
    lane: layout.world.lane,
  };

  // ---------- Chiếu 3D -> màn hình ----------
  const M = layout.viewProj;
  function project(x, y, z) {
    const cx = M[0] * x + M[4] * y + M[8] * z + M[12];
    const cy = M[1] * x + M[5] * y + M[9] * z + M[13];
    const cw = M[3] * x + M[7] * y + M[11] * z + M[15];
    return { x: (cx / cw + 1) / 2 * W, y: (1 - cy / cw) / 2 * H };
  }
  const personH = meta.personHeight;
  function screenScale(x, z) {
    const a = project(x, 0, z), b = project(x, personH, z);
    return (a.y - b.y) / meta.heightPx;
  }

  // Ghế nhìn thấy được trên màn hình; ưu tiên hàng gần bàn thờ, gần lối giữa
  const seats = layout.seats.filter((s) => {
    const f = project(s.x, 0, s.z), h = project(s.x, personH, s.z);
    return f.x > 50 && f.x < W - 50 && f.y < H - 30 && h.y > 0;
  }).sort((a, b) => a.row - b.row || a.col - b.col).map((s) => ({ ...s, occupant: null }));

  const slots = layout.slots.map((s) => ({ ...s, by: null }));
  const B = layout.burner;

  // ---------- Trạng thái ----------
  const people = new Map();
  const prayQueue = [];
  const incense = [];
  const particles = [];
  const banners = [];
  const chatLog = [];
  const motes = Array.from({ length: 80 }, () => ({ x: 120 + Math.random() * 840, y: Math.random() * 1500, v: 8 + Math.random() * 16, f: 0.3 + Math.random() * 0.6, p: Math.random() * 6, r: 0.8 + Math.random() * 1.8 }));
  let totalLotus = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

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
      variant: Art.hash(user.id) % sheets.length,
      img: null, avatarUrl: null,
      seat, x: seat.x, z: seat.z,
      state: 'seated', anim: 'sit', animT: 0, animReverse: false,
      path: [], slot: null, bowsLeft: 0, incense: false, planted: false,
      pending: 0, diamonds: 0, gifts: 0, likes: 0,
      lastActive: now(), bubble: null, breath: Math.random() * 6,
    };
    seat.occupant = p;
    if (user.avatar) setAvatar(p, user.avatar);
    people.set(p.id, p);
    const f = project(seat.x, 0.9, seat.z);
    burst(f.x, f.y, 14);
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

  // ---------- Event TikTok ----------
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
        for (let i = before; i < after; i++) { const h = project(p.x, 1.2, p.z); floatLotus(h.x, h.y); }
        break;
      }
      case 'gift': {
        const g = evt.gift || {};
        const count = g.count || 1;
        p.gifts += count;
        p.diamonds += (g.diamonds || 1) * count;
        totalLotus += count;
        banners.push({ name: truncate(p.nickname, 16), gift: g.name || 'quà', count, born: now() });
        if (banners.length > 3) banners.shift();
        p.pending += 1;
        if (!prayQueue.includes(p.id) && p.state === 'seated') prayQueue.push(p.id);
        break;
      }
    }
  }

  // ---------- Hoạt ảnh ----------
  function play(p, anim, reverse = false) { p.anim = anim; p.animT = 0; p.animReverse = reverse; }
  function animDone(p) { const a = meta.anims[p.anim]; return !a.loop && p.animT >= a.count / a.fps; }
  function animProgress(p) { const a = meta.anims[p.anim]; return clamp(p.animT / (a.count / a.fps), 0, 1); }
  function frameIndex(p) {
    const a = meta.anims[p.anim];
    let f = Math.floor(p.animT * a.fps);
    f = a.loop ? f % a.count : Math.min(a.count - 1, f);
    if (p.animReverse) f = a.count - 1 - f;
    return a.start + f;
  }
  function walkAnim(p, dx, dz) {
    const inc = p.incense ? 'i' : '';
    if (Math.abs(dx) > Math.abs(dz)) return dx < 0 ? 'walkL' + inc : 'walkR' + inc;
    if (dz < 0) return 'walkB';
    return 'walkF';
  }

  function startPrayer(p, slot) {
    slot.by = p; p.slot = slot;
    p.pending = Math.max(0, p.pending - 1);
    p.state = 'standing';
    play(p, 'stand');
  }

  function stepPath(p, dt) {
    let dist = CFG.walkSpeed * dt;
    while (dist > 0 && p.path.length) {
      const t = p.path[0];
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      const want = walkAnim(p, dx, dz);
      if (p.anim !== want) { const keep = p.animT; play(p, want); p.animT = keep; }
      if (d <= dist) { p.x = t.x; p.z = t.z; p.path.shift(); dist -= d; }
      else { p.x += (dx / d) * dist; p.z += (dz / d) * dist; dist = 0; }
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
      p.animT += dt;
      switch (p.state) {
        case 'standing':
          if (animDone(p)) {
            p.incense = true;
            const lx = p.seat.side * CFG.lane;
            p.path = [{ x: lx, z: p.seat.z }, { x: lx, z: p.slot.z + 0.9 }, { x: p.slot.x, z: p.slot.z }];
            p.state = 'toAltar';
          }
          break;
        case 'toAltar':
          if (stepPath(p, dt)) { p.state = 'bowing'; p.bowsLeft = CFG.bows; play(p, 'bow'); }
          break;
        case 'bowing':
          if (animDone(p)) {
            p.bowsLeft--;
            if (p.bowsLeft > 0) play(p, 'bow');
            else { p.state = 'planting'; p.planted = false; play(p, 'plant'); }
          }
          break;
        case 'planting':
          if (!p.planted && animProgress(p) > 0.5) {
            p.planted = true; p.incense = false;
            const dx = clamp(p.x - B.x, -0.45, 0.45);
            for (const o of [-0.05, 0, 0.05]) incense.push({ x: B.x + dx + o + rand(-0.03, 0.03), z: B.z + 0.25 + rand(-0.12, 0.12), born: t, tilt: rand(-0.12, 0.12) });
            while (incense.length > 60) incense.shift();
            const tip = project(B.x + dx, B.y + 0.3, B.z);
            burst(tip.x, tip.y, 22);
            floatLotus(tip.x + rand(-40, 40), tip.y - 30);
          }
          if (animDone(p)) {
            const lx = p.seat.side * CFG.lane;
            p.path = [{ x: lx, z: p.slot.z + 0.9 }, { x: lx, z: p.seat.z }, { x: p.seat.x, z: p.seat.z }];
            p.slot.by = null; p.slot = null;
            p.state = 'toSeat';
          }
          break;
        case 'toSeat':
          if (stepPath(p, dt)) { p.state = 'sitting'; play(p, 'stand', true); }
          break;
        case 'sitting':
          if (animDone(p)) {
            p.state = 'seated'; play(p, 'sit');
            if (p.pending > 0 && !prayQueue.includes(p.id)) prayQueue.push(p.id);
          }
          break;
      }
      if (p.bubble && p.bubble.until < t) p.bubble = null;
    }

    for (let i = incense.length - 1; i >= 0; i--) if (t - incense[i].born > CFG.incenseLife) incense.splice(i, 1);
    for (const s of incense) if (s.tipX && Math.random() < dt * 2.2) addSmoke(s.tipX, s.tipY, 1);
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.age += dt;
      q.x += (q.kind === 'smoke' ? q.vx + Math.sin(q.age * 1.6 + q.seed) * 14 : q.vx) * dt;
      q.y += q.vy * dt;
      if (q.kind === 'spark') q.vy += 90 * dt;
      if (q.age >= q.life) particles.splice(i, 1);
    }
    if (particles.length > 800) particles.splice(0, particles.length - 800);
    while (banners.length && t - banners[0].born > 5.5) banners.shift();
  }

  function addSmoke(x, y, s) { particles.push({ kind: 'smoke', x, y, vx: rand(-4, 4), vy: rand(-42, -26), life: rand(3.5, 5.5), age: 0, r: rand(3, 6) * s, seed: Math.random() * 6 }); }
  function burst(x, y, n) { for (let i = 0; i < n; i++) particles.push({ kind: 'spark', x, y, vx: rand(-110, 110), vy: rand(-170, -50), life: rand(0.6, 1.3), age: 0, r: rand(1.5, 3.5) }); }
  function floatLotus(x, y) { particles.push({ kind: 'lotus', x, y, vx: rand(-12, 12), vy: rand(-55, -38), life: 6.5, age: 0 }); }

  // ---------- Vẽ ----------
  const haloP = project(...layout.halo);
  const candles = layout.candles.map(([x, y, z]) => project(x, y, z));

  function drawAmbient(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // tia hào quang xoay chậm
    ctx.translate(haloP.x, haloP.y);
    ctx.rotate(t * 0.04);
    for (let i = 0; i < 28; i++) {
      ctx.rotate((Math.PI * 2) / 28);
      ctx.fillStyle = 'rgba(255,214,140,0.022)';
      ctx.beginPath(); ctx.moveTo(-5, 120); ctx.lineTo(5, 120); ctx.lineTo(34, 520); ctx.lineTo(-34, 520); ctx.closePath(); ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pulse = 0.75 + 0.25 * Math.sin(t * 0.6);
    for (const [x, w, a] of [[430, 130, 0.03], [650, 170, 0.028], [540, 300, 0.02]]) {
      ctx.fillStyle = Art.lin(ctx, 0, 120, 0, 1600, [[0, `rgba(255,220,150,${a * pulse})`], [1, 'rgba(255,220,150,0)']]);
      ctx.beginPath(); ctx.moveTo(x - w * 0.3, 120); ctx.lineTo(x + w * 0.3, 120); ctx.lineTo(x + w, 1600); ctx.lineTo(x - w, 1600); ctx.closePath(); ctx.fill();
    }
    for (const m of motes) {
      const y = ((m.y - t * m.v) % 1500 + 1500) % 1500 + 150;
      const x = m.x + Math.sin(t * m.f + m.p) * 22;
      ctx.fillStyle = `rgba(255,232,170,${0.22 + 0.22 * Math.sin(t * 2 + m.p)})`;
      ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    for (const c of candles) Art.flame(ctx, c.x, c.y + 8, t, 0.85);
  }

  function drawIncense(t) {
    for (const s of incense) {
      const burnt = clamp((t - s.born) / CFG.incenseLife, 0, 1);
      const len = 0.36 * (1 - burnt * 0.7);
      const base = project(s.x, B.y - 0.02, s.z);
      const tip = project(s.x + Math.sin(s.tilt) * len, B.y - 0.02 + Math.cos(s.tilt) * len, s.z);
      ctx.strokeStyle = '#b4542a'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = Art.rad(ctx, tip.x, tip.y, 0, 11, [[0, 'rgba(255,170,60,0.9)'], [1, 'rgba(255,90,20,0)']]);
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(tip.x, tip.y, 2.2, 0, Math.PI * 2); ctx.fill();
      s.tipX = tip.x; s.tipY = tip.y;
    }
  }

  function drawPerson(p, t) {
    const f = project(p.x, 0, p.z);
    const k = screenScale(p.x, p.z);
    // bóng đổ
    ctx.fillStyle = 'rgba(30,8,0,0.35)';
    const sw = (p.state === 'seated' || p.anim === 'stand' ? 46 : 34) * k * 2.2;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, sw, sw * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    const idx = frameIndex(p);
    const sx = (idx % meta.cols) * meta.frameW, sy = Math.floor(idx / meta.cols) * meta.frameH;
    const breathe = p.state === 'seated' ? 1 + Math.sin(t * 1.4 + p.breath) * 0.008 : 1;
    const w = meta.frameW * k, h = meta.frameH * k * breathe;
    ctx.drawImage(sheets[p.variant], sx, sy, meta.frameW, meta.frameH, f.x - meta.footX * k, f.y - meta.footY * k * breathe, w, h);
    // khói hương trên tay
    if (p.incense && Math.random() < 0.18) {
      const hp = project(p.x, 1.55, p.z - 0.15);
      addSmoke(hp.x, hp.y, 0.6);
    }
    // đỉnh đầu (để đặt bảng tên)
    let hf = 1;
    if (p.anim === 'sit') hf = 0.6;
    else if (p.anim === 'stand') { const u = animProgress(p); hf = p.animReverse ? 1 - 0.4 * u : 0.6 + 0.4 * u; }
    else if (p.anim === 'bow') hf = 1 - 0.18 * Math.sin(animProgress(p) * Math.PI);
    p._tag = { x: f.x, y: f.y - meta.heightPx * k * hf, k };
  }

  function drawTags() {
    for (const p of people.values()) {
      if (!p._tag) continue;
      const { x, y, k } = p._tag;
      const s = clamp(k * 1.25, 0.62, 1.1);
      const ty = y - 16 * s;
      Art.nameTag(ctx, x, ty, s, p, p.gifts > 0);
      if (p.bubble) Art.speech(ctx, x, ty - 20 * s, s, p.bubble.text);
    }
  }

  function drawParticles(t) {
    for (const q of particles) {
      const a = 1 - q.age / q.life;
      if (q.kind === 'smoke') {
        const r = q.r * (1 + q.age * 1.1);
        ctx.fillStyle = Art.rad(ctx, q.x, q.y, 0, r, [[0, `rgba(240,236,232,${0.24 * a})`], [1, 'rgba(240,236,232,0)']]);
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

  const vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
  (() => { const v = vignette.getContext('2d'); v.fillStyle = Art.rad(v, 540, 900, 520, 1250, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(15,2,0,0.55)']]); v.fillRect(0, 0, W, H); })();

  function drawHUD(t) {
    Art.pill(ctx, 26, 30, 330, 62, 'people', `${people.size} Phật tử`);
    Art.pill(ctx, 375, 30, 330, 62, 'lotus', `${totalLotus} tâm hoa`);
    Art.pill(ctx, 724, 30, 330, 62, 'incense', `${Math.ceil(incense.length / 3)} nén hương`);

    Art.ornateFrame(ctx, 22, 760, 240, 330, 'Cùng tham gia');
    const tips = [['Vào phòng', 'được mời an toạ'], ['Tặng quà', 'lên dâng hương'], ['Thả 100 tim', 'thắp 1 đèn hoa sen'], ['Bình luận', 'gửi lời nguyện cầu']];
    tips.forEach(([a, b], i) => {
      const y = 820 + i * 66;
      Art.lotus(ctx, 48, y + 12, 0.38);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe3a3'; ctx.font = `700 21px ${Art.FONT_SANS}`; ctx.fillText(a, 70, y);
      ctx.fillStyle = '#e9c9a4'; ctx.font = `400 17px ${Art.FONT_SANS}`; ctx.fillText(b, 70, y + 24);
    });

    Art.ornateFrame(ctx, 818, 760, 240, 330, 'Bảng tri ân');
    const top = [...people.values()].filter((p) => p.gifts > 0).sort((a, b) => b.diamonds - a.diamonds).slice(0, 7);
    const medal = ['#ffd24a', '#d8dde6', '#e09a5a'];
    top.forEach((p, i) => {
      const y = 814 + i * 38;
      ctx.fillStyle = medal[i] || 'rgba(255,230,170,0.25)';
      ctx.beginPath(); ctx.arc(848, y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i < 3 ? '#4a0a06' : '#ffe3a3';
      ctx.font = `700 14px ${Art.FONT_SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), 848, y + 1);
      ctx.textAlign = 'left'; ctx.fillStyle = i === 0 ? '#ffd24a' : '#fbe6bc'; ctx.font = `600 18px ${Art.FONT_SANS}`;
      ctx.fillText(truncate(p.nickname, 10), 868, y + 1);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffd98a'; ctx.font = `700 17px ${Art.FONT_SANS}`;
      ctx.fillText(String(p.diamonds), 1040, y + 1);
    });
    if (!top.length) {
      ctx.fillStyle = 'rgba(240,210,170,0.8)'; ctx.font = `italic 18px ${Art.FONT_SERIF}`; ctx.textAlign = 'center';
      ctx.fillText('Chờ người hữu duyên', 938, 920);
    }

    const chatCount = chatLog.filter((c) => t - c.born < 20).length;
    const baseY = H - 70 - chatCount * 44;
    banners.forEach((b, i) => {
      const age = t - b.born;
      const a = clamp(Math.min(age * 4, (5.5 - age) * 2), 0, 1);
      const y = baseY - (banners.length - 1 - i) * 66;
      const text1 = b.name, text2 = ` dâng ${b.gift} x${b.count}`;
      ctx.font = `700 24px ${Art.FONT_SANS}`; const w1 = ctx.measureText(text1).width;
      ctx.font = `500 24px ${Art.FONT_SANS}`; const w2 = ctx.measureText(text2).width;
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

    const lines = chatLog.filter((c) => t - c.born < 20);
    lines.forEach((c, i) => {
      const y = H - 44 - (lines.length - 1 - i) * 44;
      const name = truncate(c.name, 14), text = truncate(c.text, 38);
      ctx.font = `700 21px ${Art.FONT_SANS}`; const nw = ctx.measureText(name + '  ').width;
      ctx.font = `400 21px ${Art.FONT_SANS}`; const w = nw + ctx.measureText(text).width + 34;
      ctx.fillStyle = 'rgba(25,4,2,0.6)'; Art.rr(ctx, 22, y - 18, w, 36, 18); ctx.fill();
      ctx.fillStyle = '#d9a441'; Art.rr(ctx, 22, y - 18, 5, 36, 2); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 21px ${Art.FONT_SANS}`; ctx.fillStyle = '#ffd98a'; ctx.fillText(name, 38, y + 1);
      ctx.font = `400 21px ${Art.FONT_SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(text, 38 + nw, y + 1);
    });
  }

  let lastT = now();
  function render() {
    const t = now();
    const dt = Math.min(0.05, t - lastT);
    lastT = t;
    update(dt);
    ctx.drawImage(bgImg, 0, 0, W, H);
    drawAmbient(t);
    const list = [...people.values()].sort((a, b) => a.z - b.z);
    const behind = list.filter((p) => p.z < B.z);
    const front = list.filter((p) => p.z >= B.z);
    behind.forEach((p) => drawPerson(p, t));
    drawIncense(t);
    front.forEach((p) => drawPerson(p, t));
    drawParticles(t);
    ctx.drawImage(vignette, 0, 0);
    drawTags();
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
  const existingUser = () => { const arr = [...people.values()]; if (!arr.length) return newUser(); const p = pick(arr); return { id: p.id, nickname: p.nickname }; };
  const simGift = (user) => { const [name, diamonds] = pick(GIFTS); return post('/api/simulate', { type: 'gift', user, gift: { name, diamonds, count: 1 + Math.floor(Math.random() * 3) } }); };
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
