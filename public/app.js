/* Điện Tam Phúc – runtime 2.5D
 * - Nền + nhân vật là asset render từ 3D (tools/render). Vị trí tính theo mét rồi chiếu bằng ma trận camera.
 * - Bình luận chọn điều ước -> ngồi vào khu Tài Lộc / Bình An / Tình Duyên.
 * - Tặng quà -> đứng dậy, đi lên ban thờ của khu, vái, dâng lễ (loại lễ theo giá trị quà) rồi về chỗ.
 */
(async () => {
  const W = 1080, H = 1920;
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  if (params.get('overlay') === '1') document.body.classList.add('overlay');

  // Bộ cảnh: 'ai' (nền tranh AI, mặc định) hoặc '3d' (nền render từ Three.js)
  const SCENE = params.get('scene') === '3d' ? '3d' : 'ai';
  const BASE = `assets/${SCENE}/`;
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [layout, meta] = await Promise.all([
    fetch(BASE + 'layout.json').then((r) => r.json()),
    fetch(BASE + 'sprites.json').then((r) => r.json()),
  ]);
  const [bgImg, ...sheets] = await Promise.all([loadImg(params.get('bg') || BASE + (layout.background || 'background.png')), ...meta.variants.map((v) => loadImg(BASE + v))]);
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  // Nền AI rất rực: tăng độ đậm/tương phản của sprite cho khỏi chìm (làm 1 lần lúc tải)
  if (layout.spriteFilter) {
    sheets.forEach((img, i) => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.filter = layout.spriteFilter; g.drawImage(img, 0, 0);
      sheets[i] = c;
    });
  }

  const CFG = {
    walkSpeed: 1.35,          // m/s
    bows: 3,
    incenseLife: 90,          // s
    offeringLife: 150,        // s lễ vật nằm trên ban
    likesPerLotus: 100,
    defaultZone: params.get('zone') || 'balance', // người mới vào: 'balance' = khu ít người nhất, hoặc 'an' | 'tai' | 'tinh'
  };

  // Điều ước theo bình luận
  const WISHES = [
    { zone: 'an', re: /(binh an|suc khoe|gia dao|an lanh)/ },
    { zone: 'tai', re: /(tai loc|tien tai|may man|cong danh|phat tai|giau)/ },
    { zone: 'tinh', re: /(tinh duyen|tinh yeu|nhan duyen|hanh phuc|nguoi yeu)/ },
  ];
  // Loại lễ theo giá trị 1 món quà (xu)
  const TIERS = [
    { key: 'hoa', min: 0, icon: 'rose', label: 'dâng hoa' },
    { key: 'huong', min: 5, icon: null, label: 'dâng hương' },
    { key: 'lehoa', min: 30, icon: 'bouquet', label: 'dâng lễ hoa' },
    { key: 'mamle', min: 99, icon: 'tray', label: 'dâng mâm lễ' },
    { key: 'dacbiet', min: 500, icon: 'special', label: 'dâng lễ trang trọng' },
  ];
  const tierFor = (g) => {
    const name = (g.name || '').toLowerCase();
    if (/tiktok/.test(name)) return TIERS[1];
    let t = TIERS[0];
    for (const x of TIERS) if ((g.diamonds || 0) >= x.min) t = x;
    return t;
  };
  const ZONE_STYLE = {
    tai: { title: 'KHU CẦU TÀI LỘC', icon: 'coins', colors: ['#c88a14', '#6a3c04'], glow: '255,210,90' },
    an: { title: 'KHU CẦU BÌNH AN', icon: 'lotus', colors: ['#2a4cc0', '#0e1e66'], glow: '150,190,255' },
    tinh: { title: 'KHU CẦU TÌNH DUYÊN', icon: 'heart', colors: ['#d03a74', '#6e0e38'], glow: '255,150,190' },
  };

  // ---------- Toạ độ & phép chiếu ----------
  // mode 'camera' (cảnh 3D): (x, y, z) tính bằng mét, chiếu bằng ma trận camera.
  // mode 'screen' (nền AI): x = pixel ngang, z = pixel dọc của chân người; y = độ cao (mét); cỡ người theo độ sâu.
  const SCREEN = layout.mode === 'screen';
  const personH = meta.personHeight;
  const M = layout.viewProj;
  const pxm = (z) => (z - layout.horizonY) / layout.camH;                               // px / mét tại độ sâu z
  const depthPx = (z) => (z - layout.horizonY) ** 2 / (layout.focal * layout.camH);       // px cho 1 mét theo chiều sâu
  function project(x, y, z) {
    if (SCREEN) return { x, y: z - y * pxm(z) };
    const cx = M[0] * x + M[4] * y + M[8] * z + M[12];
    const cy = M[1] * x + M[5] * y + M[9] * z + M[13];
    const cw = M[3] * x + M[7] * y + M[11] * z + M[15];
    return { x: (cx / cw + 1) / 2 * W, y: (1 - cy / cw) / 2 * H };
  }
  const screenScale = (x, z) => (SCREEN ? pxm(z) / meta.pxPerMeter : (project(x, 0, z).y - project(x, personH, z).y) / meta.heightPx);
  // đơn vị toạ độ cho 1 mét (ngang, sâu) – dùng cho tốc độ đi
  const metric = (z) => (SCREEN ? [pxm(z), depthPx(z)] : [1, 1]);
  // điểm màn hình (sx, sy) -> toạ độ thế giới có cỡ lấy theo zRef
  const at = (sx, sy, zRef) => ({ x: sx, y: (zRef - sy) / pxm(zRef), z: zRef });
  const pt = (a) => (SCREEN ? { x: a[0], y: a[1] } : project(a[0], a[1], a[2]));

  const WORLD = layout.world;
  const zones = {};
  for (const z of (SCREEN ? layout.zones : WORLD.zones)) {
    const seats = SCREEN ? z.seats : layout.seats.filter((s) => s.zone === z.key).filter((s) => {
      const f = project(s.x, 0, s.z);
      return f.x > 28 && f.x < W - 28 && f.y < H - 150;
    });
    zones[z.key] = {
      ...z,
      seats: [...seats].sort((a, b) => a.row - b.row || a.col - b.col).map((s) => ({ ...s, occupant: null })),
      slots: z.slots.map(([x, zz]) => ({ x, z: zz, by: null })),
      queue: [],
      variants: meta.variantZones.map((v, i) => (v === z.key ? i : -1)).filter((i) => i >= 0),
    };
  }
  const B = layout.burner;

  // ---------- Trạng thái ----------
  const people = new Map();
  const incense = [];     // nén hương đang cháy {x,y,z,born,tilt}
  const offerings = [];   // lễ vật trên ban {icon,x,y,z,born}
  const flying = [];      // lễ vật đang bay lên ban
  const particles = [];
  const pulses = [];      // hào quang khi có lễ lớn
  const banners = [];
  const petals = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 30 + Math.random() * 40, sw: 0.5 + Math.random(), p: Math.random() * 6, r: 5 + Math.random() * 5, rot: Math.random() * 6 }));
  const motes = Array.from({ length: 70 }, () => ({ x: 120 + Math.random() * 840, y: Math.random() * 1500, v: 8 + Math.random() * 16, f: 0.3 + Math.random() * 0.6, p: Math.random() * 6, r: 0.8 + Math.random() * 1.8 }));

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

  // ---------- Người & chỗ ngồi ----------
  function freeSeat(zoneKey) { return zones[zoneKey].seats.find((s) => !s.occupant) || null; }
  function pickZone() {
    if (zones[CFG.defaultZone] && freeSeat(CFG.defaultZone)) return CFG.defaultZone;
    const cands = Object.values(zones).filter((z) => freeSeat(z.key));
    if (!cands.length) return null;
    cands.sort((a, b) => a.seats.filter((s) => s.occupant).length - b.seats.filter((s) => s.occupant).length);
    return cands[0].key;
  }
  function evictIdle() {
    let victim = null;
    for (const p of people.values()) {
      if (p.state !== 'seated' || p.offers.length || p.gifts > 0) continue;
      if (!victim || p.lastActive < victim.lastActive) victim = p;
    }
    if (!victim) return false;
    victim.seat.occupant = null;
    people.delete(victim.id);
    return true;
  }
  function sit(p, zoneKey) {
    const seat = freeSeat(zoneKey);
    if (!seat) return false;
    if (p.seat) { const f = project(p.x, 0.8, p.z); burst(f.x, f.y, 10); p.seat.occupant = null; }
    seat.occupant = p;
    p.seat = seat; p.zone = zoneKey; p.x = seat.x; p.z = seat.z;
    const vs = zones[zoneKey].variants;
    p.variant = vs[Art.hash(p.id) % vs.length];
    const f = project(seat.x, 0.8, seat.z);
    burst(f.x, f.y, 14, ZONE_STYLE[zoneKey].glow);
    return true;
  }

  function ensurePerson(user, wishZone) {
    let p = people.get(user.id);
    if (p) {
      if (user.nickname) p.nickname = user.nickname;
      if (user.avatar && !p.avatarUrl) setAvatar(p, user.avatar);
      p.lastActive = now();
      return p;
    }
    let zoneKey = wishZone && freeSeat(wishZone) ? wishZone : pickZone();
    if (!zoneKey) { if (!evictIdle()) return null; zoneKey = wishZone && freeSeat(wishZone) ? wishZone : pickZone(); }
    p = {
      id: user.id, nickname: user.nickname || user.id, img: null, avatarUrl: null,
      seat: null, zone: null, variant: 0, x: 0, z: 0,
      state: 'seated', anim: 'sit', animT: 0, animReverse: false,
      path: [], slot: null, bowsLeft: 0, tier: null, carrying: false, placed: false,
      offers: [], wantZone: null, diamonds: 0, gifts: 0, likes: 0,
      lastActive: now(), bubble: null, breath: Math.random() * 6,
    };
    if (!sit(p, zoneKey)) return null;
    if (user.avatar) setAvatar(p, user.avatar);
    people.set(p.id, p);
    return p;
  }
  function setAvatar(p, url) {
    p.avatarUrl = url;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { p.img = img; };
    img.src = url;
  }

  // ---------- Event TikTok ----------
  function handleEvent(evt) {
    const wish = evt.type === 'chat' ? (WISHES.find((w) => w.re.test(plain(evt.text || ''))) || {}).zone : null;
    const p = ensurePerson(evt.user, wish);
    if (!p) return;
    switch (evt.type) {
      case 'chat':
        p.bubble = { text: truncate(evt.text, 26), until: now() + 4.5 };
        if (wish && wish !== p.zone) {
          if (p.state === 'seated' && !p.offers.length) sit(p, wish);
          else p.wantZone = wish;
        }
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
        const tier = tierFor(g);
        p.gifts += count;
        p.diamonds += (g.diamonds || 1) * count;
        banners.push({ name: truncate(p.nickname, 16), text: ` ${tier.label} · ${g.name || 'quà'} x${count}`, zone: p.zone, born: now() });
        if (banners.length > 2) banners.shift();
        p.offers.push(tier);
        if (p.state === 'seated' && !zones[p.zone].queue.includes(p.id)) zones[p.zone].queue.push(p.id);
        break;
      }
    }
  }

  // ---------- Hoạt ảnh ----------
  function play(p, anim, reverse = false) { p.anim = anim; p.animT = 0; p.animReverse = reverse; }
  const animLen = (p) => meta.anims[p.anim].count / meta.anims[p.anim].fps;
  const animDone = (p) => !meta.anims[p.anim].loop && p.animT >= animLen(p);
  const animProgress = (p) => clamp(p.animT / animLen(p), 0, 1);
  function frameIndex(p) {
    const a = meta.anims[p.anim];
    let f = Math.floor(p.animT * a.fps);
    f = a.loop ? f % a.count : Math.min(a.count - 1, f);
    if (p.animReverse) f = a.count - 1 - f;
    return a.start + f;
  }
  const hasIncense = (p) => p.carrying && p.tier && p.tier.key === 'huong';
  function walkAnim(p, dx, dz) {
    const inc = hasIncense(p);
    if (Math.abs(dx) > Math.abs(dz)) return (dx < 0 ? 'walkL' : 'walkR') + (inc ? 'i' : '');
    if (dz < 0) return inc ? 'walkB' : 'walkBn';
    return 'walkF';
  }
  function aisleFor(p) {
    const z = zones[p.zone];
    return z.key === 'an' ? (p.seat.x < 0 ? -WORLD.aisleX : WORLD.aisleX) : z.aisle;
  }
  // Đường đi từ ghế lên chỗ đứng dâng lễ (đường về = đi ngược lại)
  function routeUp(p) {
    if (SCREEN) return [...p.seat.via.map(([x, z]) => ({ x, z })), { x: p.slot.x, z: p.slot.z }];
    const a = aisleFor(p), rz = p.seat.z - 0.5;
    return [{ x: p.seat.x, z: rz }, { x: a, z: rz }, { x: a, z: WORLD.crossZ }, { x: p.slot.x, z: WORLD.crossZ }, { x: p.slot.x, z: p.slot.z }];
  }
  function routeBack(p) {
    const up = routeUp(p);
    return [...up.slice(0, -1).reverse(), { x: p.seat.x, z: p.seat.z }];
  }
  function stepPath(p, dt) {
    let dist = CFG.walkSpeed * dt; // mét
    while (dist > 0 && p.path.length) {
      const t = p.path[0];
      const [mx, mz] = metric(p.z);
      const dx = (t.x - p.x) / mx, dz = (t.z - p.z) / mz, d = Math.hypot(dx, dz);
      if (d > 0.001) { const want = walkAnim(p, dx, dz); if (p.anim !== want) { const keep = p.animT; play(p, want); p.animT = keep; } }
      if (d <= dist) { p.x = t.x; p.z = t.z; p.path.shift(); dist -= d; }
      else { const u = Math.min(dist, 0.25) / d; p.x += (t.x - p.x) * u; p.z += (t.z - p.z) * u; dist -= Math.min(dist, 0.25); }
    }
    return p.path.length === 0;
  }

  // Điểm đặt lễ trên ban của từng khu
  function offerSpot(zoneKey) {
    if (SCREEN) { const a = zones[zoneKey].offerAreas; const [x0, x1, y, zRef] = a[Math.floor(Math.random() * a.length)]; return at(rand(x0, x1), y + rand(-3, 3), zRef); }
    if (zoneKey === 'an') { const s = Math.random() < 0.5 ? -1 : 1; return { x: s * rand(1.05, 2.3), y: WORLD.stageH + 0.02, z: WORLD.stageFrontZ - 0.25 }; }
    const o = zones[zoneKey].offer;
    return { x: o[0] + rand(-0.95, 0.95), y: 0.86, z: o[2] + rand(-0.18, 0.18) };
  }
  function incenseSpot(zoneKey, px) {
    if (SCREEN) { const c = zones[zoneKey].incense; return at(c.x + rand(-c.spread, c.spread), c.y + rand(-3, 3), c.zRef); }
    if (zoneKey === 'an') return { x: B.x + clamp(px - B.x, -0.45, 0.45) + rand(-0.04, 0.04), y: B.y - 0.02, z: B.z + 0.25 + rand(-0.12, 0.12) };
    const o = zones[zoneKey].offer;
    return { x: o[0] + rand(-0.14, 0.14), y: 1.02, z: o[2] + rand(-0.08, 0.08) };
  }

  function deliver(p, t) {
    const tier = p.tier, zk = p.zone;
    const from = project(p.x, 1.35, p.z);
    if (tier.key === 'huong') {
      for (let i = 0; i < 3; i++) { const s = incenseSpot(zk, p.x); incense.push({ ...s, born: t, tilt: rand(-0.12, 0.12) }); }
      while (incense.length > 90) incense.shift();
      burst(from.x, from.y - 20, 16);
    } else {
      const spot = offerSpot(zk);
      flying.push({ icon: tier.icon, from, spot, born: t, dur: 0.7, tier });
    }
    if (tier.key === 'dacbiet' || tier.key === 'mamle') {
      const c = pt(layout.deities[zk]);
      pulses.push({ x: c.x, y: c.y, born: t, big: tier.key === 'dacbiet', glow: ZONE_STYLE[zk].glow });
      if (tier.key === 'dacbiet') for (let i = 0; i < 6; i++) setTimeout(() => firework(c.x + rand(-260, 260), c.y + rand(-260, 40)), i * 260);
    }
    floatLotus(from.x + rand(-30, 30), from.y - 40);
  }

  function update(dt) {
    const t = now();
    for (const z of Object.values(zones)) {
      for (const slot of z.slots) {
        if (slot.by || !z.queue.length) continue;
        const p = people.get(z.queue.shift());
        if (!p || p.state !== 'seated' || !p.offers.length) continue;
        slot.by = p; p.slot = slot; p.tier = p.offers.shift();
        p.state = 'standing'; play(p, 'stand');
      }
    }
    for (const p of people.values()) {
      p.animT += dt;
      switch (p.state) {
        case 'standing':
          if (animDone(p)) { p.carrying = true; p.path = routeUp(p); p.state = 'toAltar'; }
          break;
        case 'toAltar':
          if (stepPath(p, dt)) { p.state = 'bowing'; p.bowsLeft = CFG.bows; play(p, hasIncense(p) ? 'bow' : 'bown'); }
          break;
        case 'bowing':
          if (animDone(p)) {
            if (--p.bowsLeft > 0) play(p, hasIncense(p) ? 'bow' : 'bown');
            else { p.state = 'placing'; p.placed = false; play(p, hasIncense(p) ? 'plant' : 'plantn'); }
          }
          break;
        case 'placing':
          if (!p.placed && animProgress(p) > 0.5) { p.placed = true; deliver(p, t); p.carrying = false; }
          if (animDone(p)) { p.path = routeBack(p); p.slot.by = null; p.slot = null; p.state = 'toSeat'; }
          break;
        case 'toSeat':
          if (stepPath(p, dt)) { p.state = 'sitting'; play(p, 'stand', true); }
          break;
        case 'sitting':
          if (animDone(p)) {
            p.state = 'seated'; play(p, 'sit'); p.tier = null;
            if (p.wantZone && !p.offers.length) { sit(p, p.wantZone); p.wantZone = null; }
            if (p.offers.length && !zones[p.zone].queue.includes(p.id)) zones[p.zone].queue.push(p.id);
          }
          break;
      }
      if (p.bubble && p.bubble.until < t) p.bubble = null;
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      if (t - f.born >= f.dur) {
        offerings.push({ icon: f.icon, ...f.spot, born: t });
        const s = project(f.spot.x, f.spot.y, f.spot.z); burst(s.x, s.y - 10, 12);
        flying.splice(i, 1);
      }
    }
    while (offerings.length > 60) offerings.shift();
    for (let i = offerings.length - 1; i >= 0; i--) if (t - offerings[i].born > CFG.offeringLife) offerings.splice(i, 1);
    for (let i = incense.length - 1; i >= 0; i--) if (t - incense[i].born > CFG.incenseLife) incense.splice(i, 1);
    for (const s of incense) if (s.tipX && Math.random() < dt * 1.6) addSmoke(s.tipX, s.tipY, 0.9);
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.age += dt;
      q.x += (q.kind === 'smoke' ? q.vx + Math.sin(q.age * 1.6 + q.seed) * 12 : q.vx) * dt;
      q.y += q.vy * dt;
      if (q.kind === 'spark') q.vy += (q.g ?? 90) * dt;
      if (q.age >= q.life) particles.splice(i, 1);
    }
    if (particles.length > 1200) particles.splice(0, particles.length - 1200);
    while (pulses.length && t - pulses[0].born > 3.5) pulses.shift();
    while (banners.length && t - banners[0].born > 5.5) banners.shift();
  }

  function addSmoke(x, y, s) { particles.push({ kind: 'smoke', x, y, vx: rand(-4, 4), vy: rand(-36, -22), life: rand(3, 5), age: 0, r: rand(2.5, 5) * s, seed: Math.random() * 6 }); }
  function burst(x, y, n, rgb = '255,214,120') { for (let i = 0; i < n; i++) particles.push({ kind: 'spark', rgb, x, y, vx: rand(-90, 90), vy: rand(-140, -40), life: rand(0.5, 1.1), age: 0, r: rand(1.2, 3) }); }
  function floatLotus(x, y) { particles.push({ kind: 'lotus', x, y, vx: rand(-12, 12), vy: rand(-50, -34), life: 6, age: 0 }); }
  function firework(x, y) {
    const rgb = ['255,220,120', '255,140,190', '150,200,255', '255,170,90'][Math.floor(Math.random() * 4)];
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, v = rand(120, 240); particles.push({ kind: 'spark', rgb, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, life: rand(0.9, 1.6), age: 0, r: rand(1.8, 3.4) }); }
  }

  // ---------- Vẽ ----------
  const haloP = pt(layout.halo);
  const candles = layout.candles.map(pt);

  function drawAmbient(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(haloP.x, haloP.y);
    ctx.rotate(t * 0.04);
    for (let i = 0; i < 28; i++) {
      ctx.rotate((Math.PI * 2) / 28);
      ctx.fillStyle = 'rgba(255,214,140,0.02)';
      ctx.beginPath(); ctx.moveTo(-4, 80); ctx.lineTo(4, 80); ctx.lineTo(26, 380); ctx.lineTo(-26, 380); ctx.closePath(); ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const p of pulses) {
      const u = (t - p.born) / 3.5, R = (p.big ? 520 : 300) * (0.4 + u * 0.8);
      ctx.fillStyle = Art.rad(ctx, p.x, p.y, 0, R, [[0, `rgba(${p.glow},${0.55 * (1 - u)})`], [1, `rgba(${p.glow},0)`]]);
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
    }
    for (const m of motes) {
      const y = ((m.y - t * m.v) % 1500 + 1500) % 1500 + 150;
      const x = m.x + Math.sin(t * m.f + m.p) * 22;
      ctx.fillStyle = `rgba(255,232,170,${0.2 + 0.2 * Math.sin(t * 2 + m.p)})`;
      ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    for (const c of candles) Art.flame(ctx, c.x, c.y + 4, t, 0.55);
  }

  function drawIncense(t) {
    for (const s of incense) {
      const burnt = clamp((t - s.born) / CFG.incenseLife, 0, 1);
      const len = (SCREEN ? 0.6 : 0.38) * (1 - burnt * 0.7);
      const base = project(s.x, s.y, s.z);
      const tip = project(s.x + Math.sin(s.tilt) * len, s.y + Math.cos(s.tilt) * len, s.z);
      ctx.strokeStyle = '#b4542a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = Art.rad(ctx, tip.x, tip.y, 0, 8, [[0, 'rgba(255,170,60,0.9)'], [1, 'rgba(255,90,20,0)']]);
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(tip.x, tip.y, 1.6, 0, Math.PI * 2); ctx.fill();
      s.tipX = tip.x; s.tipY = tip.y;
    }
  }

  function drawOfferings(t) {
    for (const o of offerings) {
      const s = project(o.x, o.y, o.z);
      const a = clamp((CFG.offeringLife - (t - o.born)) / 3, 0, 1);
      ctx.globalAlpha = a;
      Art.icon(ctx, o.icon, s.x, s.y - 10, 0.62);
      ctx.globalAlpha = 1;
    }
    for (const f of flying) {
      const u = clamp((t - f.born) / f.dur, 0, 1), e = u * u * (3 - 2 * u);
      const to = project(f.spot.x, f.spot.y, f.spot.z);
      const x = f.from.x + (to.x - f.from.x) * e, y = f.from.y + (to.y - 10 - f.from.y) * e - Math.sin(u * Math.PI) * 70;
      Art.icon(ctx, f.icon, x, y, 0.9 - 0.25 * e);
    }
  }

  function drawPerson(p, t) {
    const f = project(p.x, 0, p.z);
    const k = screenScale(p.x, p.z);
    ctx.fillStyle = 'rgba(30,8,0,0.32)';
    const sw = (p.anim === 'sit' || p.anim === 'stand' ? 44 : 32) * k * 1.5;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, sw, sw * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    const idx = frameIndex(p);
    const sx = (idx % meta.cols) * meta.frameW, sy = Math.floor(idx / meta.cols) * meta.frameH;
    const breathe = p.state === 'seated' ? 1 + Math.sin(t * 1.4 + p.breath) * 0.008 : 1;
    ctx.drawImage(sheets[p.variant], sx, sy, meta.frameW, meta.frameH, f.x - meta.footX * k, f.y - meta.footY * k * breathe, meta.frameW * k, meta.frameH * k * breathe);
    let hf = 1;
    if (p.anim === 'sit') hf = 0.6;
    else if (p.anim === 'stand') { const u = animProgress(p); hf = p.animReverse ? 1 - 0.4 * u : 0.6 + 0.4 * u; }
    else if (p.anim === 'bow' || p.anim === 'bown') hf = 1 - 0.18 * Math.sin(animProgress(p) * Math.PI);
    const top = f.y - meta.heightPx * k * hf;
    // lễ vật đang mang (nổi trên đầu) / khói hương
    if (p.carrying && p.tier) {
      if (p.tier.icon) Art.icon(ctx, p.tier.icon, f.x, top - 34 - Math.sin(t * 4 + p.breath) * 3, 0.85);
      else if (Math.random() < 0.15) { const hp = project(p.x, 1.6, p.z); addSmoke(hp.x, hp.y, 0.5); }
    }
    p._tag = { x: f.x, y: top - (p.carrying && p.tier && p.tier.icon ? 62 : 0), k };
  }

  function drawTags() {
    const t = now();
    for (const p of people.values()) {
      if (!p._tag) continue;
      // chỉ hiện tên người vừa tương tác / đang dâng lễ / đã tặng quà
      if (!(p.gifts > 0 || p.state !== 'seated' || p.bubble || t - p.lastActive < 12)) continue;
      const { x, y, k } = p._tag;
      const s = clamp(k * 1.3, 0.58, 0.95);
      const ty = y - 13 * s;
      Art.nameTag(ctx, x, ty, s, p, p.gifts > 0);
      if (p.bubble) Art.speech(ctx, x, ty - 18 * s, clamp(s * 1.25, 0.8, 1.2), p.bubble.text);
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
        ctx.fillStyle = `rgba(${q.rgb},${a})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (q.kind === 'lotus') {
        Art.lotus(ctx, q.x, q.y, 0.7 + Math.sin(t * 3 + q.x) * 0.04, a);
        Art.flame(ctx, q.x, q.y - 11, t, 0.36);
      }
    }
  }

  function drawPetals(t, dt) {
    for (const p of petals) {
      p.y += p.v * dt; p.x += Math.sin(t * p.sw + p.p) * 22 * dt; p.rot += dt * p.sw;
      if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(255,170,205,0.75)';
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  const vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
  (() => { const v = vignette.getContext('2d'); v.fillStyle = Art.rad(v, 540, 900, 560, 1280, [[0, 'rgba(0,0,0,0)'], [1, `rgba(15,2,0,${SCREEN ? 0.3 : 0.5})`]]); v.fillRect(0, 0, W, H); })();

  // ---------- HUD ----------
  function infoPanel(x, y, w, title1, title2, rows) {
    const rowH = 62, h = 86 + rows.length * rowH;
    Art.ornateFrame(ctx, x, y, w, h, null);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = Art.lin(ctx, 0, y + 14, 0, y + 70, [[0, '#fff2b8'], [1, '#eeb840']]);
    ctx.font = `700 21px ${Art.FONT_SANS}`;
    ctx.fillText(title1, x + w / 2, y + 30); ctx.fillText(title2, x + w / 2, y + 56);
    rows.forEach(([icon, a, b], i) => {
      const ry = y + 80 + i * rowH;
      ctx.fillStyle = 'rgba(255,220,150,0.09)'; Art.rr(ctx, x + 12, ry, w - 24, rowH - 6, 10); ctx.fill();
      Art.icon(ctx, icon, x + 40, ry + 27, 0.95);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff'; ctx.font = `700 20px ${Art.FONT_SANS}`; ctx.fillText(a, x + 70, ry + 18);
      ctx.fillStyle = '#f2d6b0'; ctx.font = `400 15px ${Art.FONT_SANS}`; ctx.fillText(b, x + 70, ry + 40);
    });
  }

  const LBL = { buddha: pt(layout.labels.buddha), tai: pt(layout.labels.tai), tinh: pt(layout.labels.tinh) };

  function drawHUD(t) {
    // Biển chính
    Art.plaque(ctx, 230, 22, 620, 118, 'ĐIỆN TAM PHÚC', 'Cầu Bình An · Tài Lộc · Tình Duyên');
    Art.lotus(ctx, 540, 30, 0.8);

    infoPanel(18, 168, 250, 'BÌNH LUẬN', 'CHỌN ĐIỀU ƯỚC', [
      ['lotus', 'Bình an', 'sức khoẻ, gia đạo'],
      ['coins', 'Tài lộc', 'may mắn, công danh'],
      ['heart', 'Tình duyên', 'tình yêu, hạnh phúc'],
    ]);
    infoPanel(812, 168, 250, 'DÂNG LỄ', 'THEO QUÀ TẶNG', [
      ['rose', 'Hoa hồng', '→ Dâng hoa'],
      ['note', 'TikTok', '→ Dâng hương'],
      ['bouquet', 'Bó hoa', '→ Dâng lễ hoa'],
      ['gift', 'Quà lớn', '→ Dâng mâm lễ'],
      ['special', 'Quà đặc biệt', '→ Lễ trang trọng'],
    ]);

    // Bảng tên ban thờ
    Art.plaque(ctx, LBL.buddha.x - 150, LBL.buddha.y - 34, 300, 68, 'ĐỨC PHẬT', 'Cầu Bình An – Sức Khoẻ');
    Art.plaque(ctx, clamp(LBL.tai.x - 120, 12, W), LBL.tai.y - 30, 240, 64, 'THẦN TÀI', 'Cầu Tài Lộc', ZONE_STYLE.tai.colors);
    Art.plaque(ctx, clamp(LBL.tinh.x - 120, 0, W - 252), LBL.tinh.y - 30, 240, 64, 'NGUYỆT LÃO', 'Cầu Tình Duyên', ZONE_STYLE.tinh.colors);

    // Tên khu + số người
    const zx = { tai: 180, an: 540, tinh: 900 };
    for (const key of ['tai', 'an', 'tinh']) {
      const st = ZONE_STYLE[key], n = zones[key].seats.filter((s) => s.occupant).length;
      const w = 330, x = zx[key] - w / 2, y = 1800;
      Art.plaque(ctx, x, y, w, 76, st.title, `${n} người đang cầu nguyện`, st.colors, 52);
      Art.icon(ctx, st.icon, x + 38, y + 36, 1.15);
    }

    // Thông báo quà (dưới biển chính)
    banners.forEach((b, i) => {
      const age = t - b.born;
      const a = clamp(Math.min(age * 4, (5.5 - age) * 2), 0, 1);
      const y = 176 + i * 56;
      ctx.font = `700 23px ${Art.FONT_SANS}`; const w1 = ctx.measureText(b.name).width;
      ctx.font = `500 23px ${Art.FONT_SANS}`; const w2 = ctx.measureText(b.text).width;
      const w = w1 + w2 + 56, x = 540 - w / 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = `rgba(${ZONE_STYLE[b.zone].glow},0.7)`; ctx.shadowBlur = 18;
      ctx.fillStyle = Art.lin(ctx, 0, y - 24, 0, y + 24, [[0, ZONE_STYLE[b.zone].colors[0]], [1, ZONE_STYLE[b.zone].colors[1]]]);
      Art.rr(ctx, x, y - 24, w, 48, 24); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5; ctx.strokeStyle = Art.goldH(ctx, x, x + w); Art.rr(ctx, x, y - 24, w, 48, 24); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `700 23px ${Art.FONT_SANS}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText(b.name, x + 28, y + 1);
      ctx.font = `500 23px ${Art.FONT_SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(b.text, x + 28 + w1, y + 1);
      ctx.restore();
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
    drawIncense(t);
    drawOfferings(t);
    [...people.values()].sort((a, b) => a.z - b.z).forEach((p) => drawPerson(p, t));
    drawParticles(t);
    drawPetals(t, dt);
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
  const SIM_GIFTS = { hoa: ['Hoa hồng', 1], huong: ['TikTok', 1], lehoa: ['Bó hoa', 30], mamle: ['Quà lớn', 199], dacbiet: ['Quà đặc biệt', 1000] };
  const SIM_WISH = { an: 'Cầu bình an cho gia đình', tai: 'Cầu tài lộc may mắn', tinh: 'Cầu tình duyên' };
  let simId = 0;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const newUser = () => { simId++; return { id: 'sim_' + Date.now().toString(36) + simId, nickname: `${pick(TEN)} ${pick(HO)}` }; };
  const existingUser = () => { const arr = [...people.values()]; if (!arr.length) return newUser(); const p = pick(arr); return { id: p.id, nickname: p.nickname }; };
  const simGift = (key, user = existingUser()) => { const [name, diamonds] = SIM_GIFTS[key]; return post('/api/simulate', { type: 'gift', user, gift: { name, diamonds, count: 1 } }); };
  const simWish = (key, user = newUser()) => post('/api/simulate', { type: 'chat', user, text: SIM_WISH[key] });
  const sims = {
    join: () => post('/api/simulate', { type: 'join', user: newUser() }),
    join10: () => { for (let i = 0; i < 10; i++) sims.join(); },
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
          if (r < 0.3) sims.join();
          else if (r < 0.6) simWish(pick(['an', 'tai', 'tinh']), Math.random() < 0.6 ? newUser() : existingUser());
          else if (r < 0.9) simGift(pick(['hoa', 'hoa', 'huong', 'huong', 'lehoa', 'mamle', 'dacbiet']));
          else post('/api/simulate', { type: 'like', user: existingUser(), count: 50 });
        }, 800);
        return;
      }
      if (k.startsWith('wish:')) return simWish(k.slice(5));
      if (k.startsWith('gift:')) return simGift(k.slice(5));
      sims[k]?.();
    };
  });
})();
