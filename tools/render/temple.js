// Job: dựng chính điện 3D, render ảnh nền 1080x1920 và xuất layout (ma trận camera + vị trí)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  makeRenderer, makeEnv, MAT, marbleTex, carpetTex, wallTex, latticeTex, plaqueTex, radialTex,
  petalGeometry, lotusFlower, lathe, canvasTex,
} from './common.js';

const W = 1080, H = 1920;

// ---------- Bố cục thế giới (mét) ----------
export const WORLD = {
  statueZ: -12.6,
  altarZ: -9.3,
  burner: { x: 0, z: -7.0 },
  slotsZ: -5.75,
  slotsX: [-0.95, 0, 0.95],
  rows: 9, rowZ0: -4.0, rowGap: 1.12,
  cols: 6, colX0: 1.45, colGap: 0.98,
  lane: 0.5,
  personHeight: 1.62,
};

function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

function capsuleBetween(a, b, r, mat) {
  const len = a.distanceTo(b);
  const geo = new THREE.CapsuleGeometry(r, len, 8, 24);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function ellipsoid(rx, ry, rz, mat, segs = 40) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segs, Math.round(segs * 0.75)), mat);
  m.scale.set(rx, ry, rz);
  return m;
}

function shadowAll(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
}

// ---------- Tượng Phật ----------
function buildBuddha() {
  const g = new THREE.Group();
  const gold = MAT.goldStatue();
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 0.9, roughness: 0.26, emissive: 0x3a2400, emissiveIntensity: 0.18 });
  const goldD = MAT.goldDark();
  const rose = new THREE.MeshStandardMaterial({ color: 0xf7a98c, metalness: 0.75, roughness: 0.3, emissive: 0x401408, emissiveIntensity: 0.25 });

  // Bệ bát giác
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.5, 8), goldD); b1.position.y = 0.25; b1.rotation.y = Math.PI / 8; g.add(b1);
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.55, 0.42, 8), MAT.redLacquer()); b2.position.y = 0.71; b2.rotation.y = Math.PI / 8; g.add(b2);
  for (const [y, r] of [[0.52, 2.62], [0.93, 2.42]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 8), MAT.gold()); t.position.y = y; t.rotation.y = Math.PI / 8; g.add(t);
  }
  const b3 = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.3, 0.22, 48), MAT.gold()); b3.position.y = 1.05; g.add(b3);

  // Đài sen 3 tầng
  const tiers = [
    { n: 26, R: 2.05, y: 1.1, w: 0.42, h: 0.95, open: 1.05, mat: gold },
    { n: 22, R: 1.8, y: 1.22, w: 0.42, h: 0.95, open: 0.72, mat: rose },
    { n: 18, R: 1.5, y: 1.36, w: 0.4, h: 0.85, open: 0.42, mat: gold },
  ];
  tiers.forEach((t, ti) => {
    const geo = petalGeometry(t.w, t.h, 0.22, 0.05);
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * Math.PI * 2 + ti * 0.12;
      const holder = new THREE.Group();
      holder.rotation.y = a;
      holder.position.y = t.y;
      const p = new THREE.Mesh(geo, t.mat);
      p.position.z = t.R;
      p.rotation.x = t.open;
      holder.add(p);
      g.add(holder);
    }
  });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.35, 48), goldD); seat.position.y = 1.62; g.add(seat);

  // Thân
  const body = new THREE.Group();
  body.position.y = 1.78;
  g.add(body);
  // Đùi xếp bằng
  const lap = ellipsoid(1.78, 0.45, 1.12, gold); lap.position.set(0, 0.25, 0.2); body.add(lap);
  for (const s of [-1, 1]) {
    const knee = ellipsoid(0.55, 0.36, 0.6, gold); knee.position.set(s * 1.25, 0.28, 0.5); body.add(knee);
    const sole = ellipsoid(0.32, 0.12, 0.2, gold); sole.position.set(s * 0.55, 0.62, 0.72); sole.rotation.z = s * 0.25; body.add(sole);
  }
  // Nếp áo trên đùi
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.6 + i * 0.28, 0.035, 8, 48, Math.PI * 0.8), goldD);
    t.rotation.x = -Math.PI / 2 + 0.2; t.rotation.z = Math.PI * 1.1;
    t.position.set(0.1, 0.55, 0.45);
    t.scale.set(1.2, 0.8, 1);
    body.add(t);
  }
  // Thân trên
  const torsoGeo = lathe([[0.001, -0.05], [0.9, 0], [0.95, 0.35], [0.86, 0.85], [0.92, 1.25], [0.98, 1.55], [0.86, 1.78], [0.55, 1.93], [0.26, 1.99], [0.001, 2.0]], 64);
  const torso = new THREE.Mesh(torsoGeo, gold);
  torso.scale.set(1.16, 1, 0.64);
  torso.position.set(0, 0.35, -0.05);
  body.add(torso);
  // Cà sa vắt chéo
  const sashCurve = new THREE.CatmullRomCurve3([v3(-0.8, 2.25, 0.3), v3(-0.35, 1.85, 0.6), v3(0.25, 1.35, 0.62), v3(0.8, 0.95, 0.5), v3(1.0, 0.7, 0.3)]);
  const sash = new THREE.Mesh(new THREE.TubeGeometry(sashCurve, 64, 0.14, 12), goldD);
  sash.scale.set(1, 1, 0.75);
  body.add(sash);
  for (let i = 1; i <= 3; i++) {
    const c = new THREE.CatmullRomCurve3([v3(-0.6 + i * 0.12, 2.0 - i * 0.12, 0.52), v3(0.0 + i * 0.1, 1.45 - i * 0.12, 0.6), v3(0.65 + i * 0.05, 1.0 - i * 0.12, 0.5)]);
    body.add(new THREE.Mesh(new THREE.TubeGeometry(c, 32, 0.03, 8), goldD));
  }
  // Tay
  for (const s of [-1, 1]) {
    const sh = v3(s * 0.9, 1.95, 0), el = v3(s * 1.22, 1.05, 0.22), hd = v3(s * 0.3, 0.74, 0.8);
    const upper = capsuleBetween(sh, el, 0.3, gold); upper.scale.x = 1.0; body.add(upper);
    body.add(capsuleBetween(el, hd, 0.23, gold));
    // vạt tay áo rủ xuống
    const drape = ellipsoid(0.32, 0.5, 0.42, gold); drape.position.set(s * 1.18, 0.75, 0.25); drape.rotation.z = s * 0.2; body.add(drape);
  }
  const hands = ellipsoid(0.5, 0.14, 0.32, skin); hands.position.set(0, 0.74, 0.8); body.add(hands);
  const lf = lotusFlower(1.25); lf.position.set(0, 0.84, 0.82); body.add(lf);

  // Cổ & đầu
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.42, 32), skin); neck.position.set(0, 2.4, 0.02); body.add(neck);
  for (const y of [2.33, 2.45]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 32), goldD); r.rotation.x = Math.PI / 2; r.position.set(0, y, 0.03); body.add(r); }
  const head = new THREE.Group();
  head.position.set(0, 2.98, 0.05);
  body.add(head);
  const skull = ellipsoid(0.47, 0.56, 0.5, skin, 64); head.add(skull);
  const chin = ellipsoid(0.3, 0.2, 0.3, skin); chin.position.set(0, -0.33, 0.12); head.add(chin);
  for (const s of [-1, 1]) {
    const ear = ellipsoid(0.08, 0.36, 0.14, skin); ear.position.set(s * 0.46, -0.08, -0.02); ear.rotation.z = s * -0.08; head.add(ear);
    const lobe = ellipsoid(0.07, 0.12, 0.1, skin); lobe.position.set(s * 0.47, -0.42, 0.0); head.add(lobe);
  }
  // Tóc xoắn ốc (instanced)
  const curlGeo = new THREE.SphereGeometry(0.052, 10, 8);
  const curlMat = new THREE.MeshStandardMaterial({ color: 0x8a5a1c, metalness: 0.9, roughness: 0.35 });
  const curlPts = [];
  const N = 900;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    const x = Math.cos(phi) * r, z = Math.sin(phi) * r;
    const hair = z > 0.2 ? y > 0.42 : y > -0.15 + Math.max(0, z) * 0.6;
    if (hair) curlPts.push(v3(x * 0.49, y * 0.58, z * 0.52));
  }
  const ushPts = [];
  for (let i = 0; i < 220; i++) {
    const y = 1 - (i / 219) * 2; const r = Math.sqrt(1 - y * y); const phi = i * 2.399963;
    if (y > -0.4) ushPts.push(v3(Math.cos(phi) * r * 0.27, 0.6 + y * 0.25, Math.sin(phi) * r * 0.27 - 0.03));
  }
  const allCurls = curlPts.concat(ushPts);
  const inst = new THREE.InstancedMesh(curlGeo, curlMat, allCurls.length);
  const m4 = new THREE.Matrix4();
  allCurls.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m4); });
  head.add(inst);
  const ushBase = ellipsoid(0.26, 0.24, 0.26, curlMat); ushBase.position.set(0, 0.6, -0.03); head.add(ushBase);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 1, roughness: 0.15, emissive: 0xffa020, emissiveIntensity: 1.2 }));
  jewel.position.set(0, 0.88, -0.03); head.add(jewel);
  // Ngũ quan (nổi khối)
  const featMat = new THREE.MeshStandardMaterial({ color: 0x6a3a0a, metalness: 0.6, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 24, Math.PI * 0.8), featMat);
    lid.position.set(s * 0.17, 0.02, 0.44); lid.rotation.z = Math.PI * 1.1; lid.rotation.x = -0.15; head.add(lid);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 24, Math.PI * 0.7), skin);
    brow.position.set(s * 0.17, 0.08, 0.43); brow.rotation.z = Math.PI * 0.15; head.add(brow);
  }
  const nose = ellipsoid(0.06, 0.15, 0.08, skin); nose.position.set(0, -0.08, 0.48); nose.rotation.x = 0.25; head.add(nose);
  const lips = ellipsoid(0.11, 0.032, 0.05, new THREE.MeshStandardMaterial({ color: 0xc8603a, metalness: 0.6, roughness: 0.35 })); lips.position.set(0, -0.27, 0.44); head.add(lips);
  const urna = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 0.8 })); urna.position.set(0, 0.16, 0.47); head.add(urna);

  shadowAll(g, true, true);
  g.scale.setScalar(1.3);
  g.userData.headWorldY = (1.78 + 2.98) * 1.3;
  return g;
}

// ---------- Kiến trúc & đồ thờ ----------
function pillar(x, z, h = 10) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, h, 48), MAT.redLacquer()); col.position.y = h / 2; g.add(col);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.45, 32), MAT.goldDark()); base.position.y = 0.22; g.add(base);
  for (const y of [0.5, 0.62, h - 0.6, h - 0.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 12, 48), MAT.gold()); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  // Rồng cuốn (xoắn ốc vàng)
  const pts = [];
  for (let i = 0; i <= 200; i++) { const t = i / 200; const a = t * Math.PI * 5; pts.push(v3(Math.cos(a) * 0.5, 1.2 + t * (h - 2.6), Math.sin(a) * 0.5)); }
  const dragon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.1, 12), MAT.gold());
  g.add(dragon);
  for (let i = 0; i < 60; i++) {
    const t = i / 60, a = t * Math.PI * 5;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), MAT.gold());
    spike.position.set(Math.cos(a) * 0.55, 1.2 + t * (h - 2.6) + 0.08, Math.sin(a) * 0.55);
    g.add(spike);
  }
  g.position.set(x, 0, z);
  shadowAll(g, true, true);
  return g;
}

function lantern(x, y, z, scene) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xd8281c, roughness: 0.55, emissive: 0xff3010, emissiveIntensity: 0.85 });
  const prof = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; prof.push([Math.max(0.001, Math.cos(a) * 0.7 + (Math.abs(Math.sin(a)) > 0.9 ? 0 : 0)), Math.sin(a) * 0.62]); }
  const body = new THREE.Mesh(lathe(prof, 64), red);
  g.add(body);
  for (let i = 0; i < 10; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.01, 4, 48), MAT.goldDark());
    rib.rotation.y = (i / 10) * Math.PI; rib.scale.set(1, 0.92, 1); g.add(rib);
  }
  for (const yy of [0.62, -0.62]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 32), MAT.gold()); cap.position.y = yy; g.add(cap); }
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc81a10, side: THREE.DoubleSide })); tassel.position.y = -1.0; tassel.rotation.x = Math.PI; g.add(tassel);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3), MAT.goldDark()); rope.position.y = 2.1; g.add(rope);
  const light = new THREE.PointLight(0xff7a3a, 6, 9, 1.6); g.add(light);
  g.position.set(x, y, z);
  scene.add(g);
}

function vase(x, z, y) {
  const g = new THREE.Group();
  const v = new THREE.Mesh(lathe([[0.001, 0], [0.16, 0.0], [0.24, 0.12], [0.26, 0.3], [0.18, 0.5], [0.1, 0.62], [0.14, 0.72], [0.001, 0.7]]), MAT.porcelain());
  g.add(v);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 6, 32), MAT.gold()); band.rotation.x = Math.PI / 2; band.position.y = 0.28; g.add(band);
  const stems = [[-0.35, 1.0], [0, 1.2], [0.35, 1.0], [-0.18, 0.75], [0.2, 0.8]];
  stems.forEach(([a, l], i) => {
    const end = v3(Math.sin(a) * l * 0.6, 0.7 + Math.cos(a) * l, 0.05 * i - 0.1);
    const c = new THREE.QuadraticBezierCurve3(v3(0, 0.65, 0), v3(end.x * 0.2, 0.7 + l * 0.5, 0), end);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.012, 6), MAT.leaf()));
    if (i < 3) { const f = lotusFlower(0.9); f.position.copy(end); g.add(f); }
    else { const leaf = ellipsoid(0.22, 0.02, 0.18, MAT.leaf()); leaf.position.copy(end); leaf.rotation.z = a; g.add(leaf); }
  });
  g.position.set(x, y, z);
  shadowAll(g);
  return g;
}

function fruitPlate(x, z, y) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(lathe([[0.001, 0], [0.12, 0], [0.08, 0.12], [0.36, 0.2], [0.4, 0.25], [0.001, 0.22]]), MAT.gold());
  g.add(plate);
  const cols = [0xf0a020, 0xe05a20, 0xf2c230, 0x8cc63f, 0xd94a2a, 0xffb02a];
  const pts = [[-0.2, 0.32, 0], [0.2, 0.32, 0], [0, 0.32, 0.18], [0, 0.32, -0.18], [-0.08, 0.5, 0.05], [0.1, 0.5, -0.04], [0, 0.66, 0]];
  pts.forEach(([px, py, pz], i) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), new THREE.MeshPhysicalMaterial({ color: cols[i % cols.length], roughness: 0.35, clearcoat: 0.6 }));
    f.position.set(px, py, pz); g.add(f);
  });
  g.position.set(x, y, z);
  shadowAll(g);
  return g;
}

function candle(x, z, y, scene, flames) {
  const g = new THREE.Group();
  const holder = new THREE.Mesh(lathe([[0.001, 0], [0.18, 0], [0.06, 0.1], [0.06, 0.25], [0.16, 0.3], [0.001, 0.3]]), MAT.gold()); g.add(holder);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 24), MAT.wax()); wax.position.y = 0.6; g.add(wax);
  const light = new THREE.PointLight(0xffb060, 2.5, 4, 2); light.position.y = 1.05; g.add(light);
  g.position.set(x, y, z);
  scene.add(g);
  flames.push(v3(x, y + 1.0, z));
}

function burner() {
  const g = new THREE.Group();
  const br = MAT.bronze();
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.14, 48), MAT.goldDark()); dais.position.y = 0.07; g.add(dais);
  const bowl = new THREE.Mesh(lathe([[0.001, 0.35], [0.5, 0.36], [0.7, 0.48], [0.8, 0.7], [0.78, 0.9], [0.86, 0.98], [0.88, 1.04], [0.76, 1.05], [0.74, 0.97], [0.001, 0.97]], 64), br);
  g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 12, 64), MAT.gold()); rim.rotation.x = Math.PI / 2; rim.position.y = 1.03; g.add(rim);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.03, 8, 64), MAT.gold()); belt.rotation.x = Math.PI / 2; belt.position.y = 0.72; g.add(belt);
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshStandardMaterial({ color: 0xb8ada0, roughness: 1 })); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.98; g.add(ash);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.42, 16), br);
    leg.position.set(Math.cos(a) * 0.45, 0.33, Math.sin(a) * 0.45); leg.rotation.z = Math.cos(a) * 0.2; leg.rotation.x = -Math.sin(a) * 0.2; g.add(leg);
    const head = ellipsoid(0.13, 0.11, 0.13, MAT.gold()); head.position.set(Math.cos(a) * 0.5, 0.48, Math.sin(a) * 0.5); g.add(head);
  }
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 32), MAT.gold());
    handle.position.set(s * 0.98, 1.08, 0); handle.rotation.y = Math.PI / 2; g.add(handle);
  }
  shadowAll(g);
  return g;
}

function swastikaClothTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#f6c84a'); grd.addColorStop(1, '#c88a1c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a0141a'; g.lineWidth = 10; g.strokeRect(20, 20, w - 40, h - 40);
    g.lineWidth = 3; g.strokeRect(38, 38, w - 76, h - 76);
    g.save(); g.translate(w / 2, h / 2); g.strokeStyle = '#a0141a'; g.lineWidth = 26; g.lineCap = 'square';
    const s = 90;
    g.beginPath(); g.moveTo(0, -s); g.lineTo(0, s); g.moveTo(-s, 0); g.lineTo(s, 0);
    g.moveTo(0, -s); g.lineTo(-s, -s); g.moveTo(s, 0); g.lineTo(s, -s); g.moveTo(0, s); g.lineTo(s, s); g.moveTo(-s, 0); g.lineTo(-s, s);
    g.stroke(); g.restore();
  });
}

function altar(scene, flames) {
  const z = WORLD.altarZ;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.1, 1.5), MAT.redLacquer()); body.position.y = 0.55; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.1, 1.7), MAT.gold()); top.position.y = 1.15; g.add(top);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.12, 1.6), MAT.goldDark()); foot.position.y = 0.06; g.add(foot);
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.02), MAT.goldDark());
    frame.position.set(i * 1.3, 0.58, 0.76); g.add(frame);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.5, 0.03), MAT.redLacquer());
    inset.position.set(i * 1.3, 0.58, 0.765); g.add(inset);
    const medal = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 32), MAT.gold()); medal.position.set(i * 1.3, 0.58, 0.79); g.add(medal);
  }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), new THREE.MeshStandardMaterial({ map: swastikaClothTex(), roughness: 0.7 }));
  cloth.position.set(0, 0.6, 0.77); g.add(cloth);
  g.position.z = z;
  shadowAll(g);
  scene.add(g);
  scene.add(vase(-2.7, z - 0.1, 1.2), vase(2.7, z - 0.1, 1.2));
  scene.add(fruitPlate(-1.55, z + 0.1, 1.2), fruitPlate(1.55, z + 0.1, 1.2));
  candle(-0.75, z + 0.25, 1.2, scene, flames);
  candle(0.75, z + 0.25, 1.2, scene, flames);
  // bát hương nhỏ trên bàn
  const bowl = new THREE.Mesh(lathe([[0.001, 0], [0.25, 0], [0.3, 0.2], [0.28, 0.28], [0.001, 0.26]]), MAT.bronze());
  bowl.position.set(0, 1.2, z + 0.2); shadowAll(bowl); scene.add(bowl);
}

function buildHall(scene) {
  // Sàn đá + phản chiếu
  const mirror = new Reflector(new THREE.PlaneGeometry(40, 60), { textureWidth: W, textureHeight: H, color: 0x555555 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.002;
  scene.add(mirror);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), new THREE.MeshPhysicalMaterial({ map: marbleTex(), roughness: 0.25, clearcoat: 0.6, transparent: true, opacity: 0.86 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // Thảm đỏ
  const ct = carpetTex(); ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(1, 3);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 26), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.012, 5.2); carpet.scale.x = 0.82; carpet.receiveShadow = true;
  scene.add(carpet);

  // Tường sau & hai bên
  const wt = wallTex();
  const wallMat = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.7 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), wallMat); back.position.set(0, 7, -16); back.receiveShadow = true; scene.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(36, 14), wallMat); side.position.set(s * 9.5, 7, 0); side.rotation.y = -s * Math.PI / 2; scene.add(side);
    for (const z of [-12.5, -6.5, -0.5]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshBasicMaterial({ map: latticeTex(), toneMapped: false, color: 0xbb8866 }));
      win.position.set(s * 9.45, 4.2, z); win.rotation.y = -s * Math.PI / 2; scene.add(win);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.5, 3.5), MAT.goldDark()); fr.position.set(s * 9.5, 4.2, z); scene.add(fr);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.25, 3.25), new THREE.MeshBasicMaterial({ visible: false })); inner.position.copy(fr.position); scene.add(inner);
    }
  }
  // Diềm trang trí trên tường sau
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(22, 1.0, 0.4), MAT.redLacquer()); fascia.position.set(0, 13.2, -15.6); scene.add(fascia);
  for (const y of [12.7, 13.7]) { const t = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 0.44), MAT.gold()); t.position.set(0, y, -15.6); scene.add(t); }
  // Khám thờ: vòm vàng + nền tối
  const arch = new THREE.Shape();
  arch.moveTo(-5, 0); arch.lineTo(-5, 7.6); arch.absarc(0, 7.6, 5, Math.PI, 0, true); arch.lineTo(5, 0); arch.lineTo(-5, 0);
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(arch, 48), new THREE.MeshBasicMaterial({ map: radialTex([[0, '#ffdca0'], [0.35, '#d86a2a'], [0.7, '#6a1008'], [1, '#2a0402']]), toneMapped: true }));
  // UV cho shape: map toạ độ
  const uv = niche.geometry.attributes.uv, pos = niche.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 6.5) / 13, (pos.getY(i) - 0.8) / 13);
  niche.position.set(0, 0, -15.8); scene.add(niche);
  const archPts = [];
  archPts.push(v3(-5, 0, 0));
  for (let i = 0; i <= 48; i++) { const a = Math.PI - (i / 48) * Math.PI; archPts.push(v3(Math.cos(a) * 5, 7.6 + Math.sin(a) * 5, 0)); }
  archPts.push(v3(5, 0, 0));
  const archPath = new THREE.CurvePath();
  for (let i = 0; i < archPts.length - 1; i++) archPath.add(new THREE.LineCurve3(archPts[i], archPts[i + 1]));
  for (const [r, off] of [[0.2, 0], [0.08, 0.45]]) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(archPath, 400, r, 12), MAT.gold());
    tube.scale.setScalar(1 + off / 5); tube.position.set(0, 0, -15.6); scene.add(tube);
  }

  // Biển đề
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshStandardMaterial({ map: plaqueTex('ĐẠI HÙNG BẢO ĐIỆN'), roughness: 0.4, emissive: 0xffffff, emissiveMap: plaqueTex('ĐẠI HÙNG BẢO ĐIỆN'), emissiveIntensity: 0.25 }));
  plaque.position.set(0, 9.05, -13.55); scene.add(plaque);
  const pf = new THREE.Mesh(new THREE.BoxGeometry(5.1, 1.45, 0.1), MAT.gold()); pf.position.set(0, 9.05, -13.61); scene.add(pf);

  // Cột
  for (const s of [-1, 1]) {
    scene.add(pillar(s * 5.6, -13.5));
    scene.add(pillar(s * 6.6, -6.5));
    scene.add(pillar(s * 7.6, 1.5));
  }
}

function halo(scene, headY) {
  const z = WORLD.statueZ - 1.3;
  const glowTex = radialTex([[0, 'rgba(255,240,190,1)'], [0.35, 'rgba(255,200,110,0.7)'], [0.7, 'rgba(255,140,60,0.25)'], [1, 'rgba(255,120,40,0)']]);
  const big = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  big.position.set(0, 5.2, z - 0.5); big.scale.setScalar(1.3); big.material.opacity = 0.55; scene.add(big);
  const headGlow = new THREE.Mesh(new THREE.CircleGeometry(1.55, 64), new THREE.MeshBasicMaterial({ map: radialTex([[0, '#fff8dc'], [0.6, '#ffd27a'], [1, '#e08a2a']]), toneMapped: false, color: 0xddbb88 }));
  headGlow.position.set(0, headY, z + 0.3); scene.add(headGlow);
  for (const [r, t, zz] of [[1.58, 0.07, 0.32], [3.7, 0.08, 0], [3.88, 0.035, 0]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 128), MAT.gold());
    ring.position.set(0, r > 2 ? 5.0 : headY, z + zz); scene.add(ring);
  }
  // Ngọn lửa quanh vòng hào quang lớn
  for (let i = 0; i < 30; i++) {
    const a = -0.15 * Math.PI + (i / 29) * 1.3 * Math.PI;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 12), MAT.gold());
    f.position.set(Math.cos(a) * 4.05, 5.0 + Math.sin(a) * 4.05, z);
    f.rotation.z = a - Math.PI / 2;
    scene.add(f);
  }
}

function cushions(scene, seats) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xb87424, roughness: 0.7 });
  const top = new THREE.MeshStandardMaterial({ color: 0xe0a640, roughness: 0.6 });
  const geo = new THREE.CylinderGeometry(0.31, 0.33, 0.12, 40);
  const tgeo = new THREE.TorusGeometry(0.26, 0.045, 12, 40);
  for (const s of seats) {
    const c = new THREE.Mesh(geo, mat); c.position.set(s.x, 0.065, s.z); c.scale.z = 0.9; c.castShadow = c.receiveShadow = true; scene.add(c);
    const t = new THREE.Mesh(tgeo, top); t.rotation.x = Math.PI / 2; t.position.set(s.x, 0.13, s.z); t.scale.y = 0.9; t.castShadow = true; scene.add(t);
  }
}

export function makeSeats() {
  const seats = [];
  for (let r = 0; r < WORLD.rows; r++) {
    const z = WORLD.rowZ0 + r * WORLD.rowGap;
    for (let c = 0; c < WORLD.cols; c++) for (const side of [-1, 1]) {
      seats.push({ x: side * (WORLD.colX0 + c * WORLD.colGap), z, side, row: r, col: c });
    }
  }
  return seats;
}

export function makeCamera() {
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
  cam.position.set(0, 16, 25);
  cam.lookAt(0, 2.4, -7.5);
  cam.updateMatrixWorld();
  return cam;
}

export async function run() {
  const renderer = makeRenderer(W, H);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120202);
  makeEnv(renderer, scene, 0.35);
  const cam = makeCamera();

  const flames = [];
  buildHall(scene);
  const buddha = buildBuddha();
  buddha.position.z = WORLD.statueZ;
  scene.add(buddha);
  const headY = buddha.userData.headWorldY;
  halo(scene, headY);
  altar(scene, flames);
  const bn = burner(); bn.position.set(WORLD.burner.x, 0, WORLD.burner.z); scene.add(bn);
  for (const s of [-1, 1]) { lantern(s * 3.7, 6.9, -8.2, scene); lantern(s * 5.6, 7.3, -1.0, scene); }
  const seats = makeSeats();
  cushions(scene, seats);

  // Ánh sáng
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x3a0a06, 0.35));
  const key = new THREE.SpotLight(0xffd8a0, 260, 40, 0.42, 0.6, 1.6);
  key.position.set(0, 9.0, -4.8); key.target.position.set(0, 4.6, WORLD.statueZ); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const hall = new THREE.SpotLight(0xffd2a0, 160, 45, 0.75, 0.8, 1.5);
  hall.position.set(0, 9.8, -9); hall.target.position.set(0, 0, 2.5); hall.castShadow = true;
  hall.shadow.mapSize.set(2048, 2048); hall.shadow.bias = -0.0004; hall.shadow.radius = 4;
  scene.add(hall, hall.target);
  const rim = new THREE.PointLight(0xff9a4a, 14, 12, 1.5); rim.position.set(0, 5, WORLD.statueZ - 2); scene.add(rim);
  const fill = new THREE.PointLight(0xffc890, 6, 30, 1.2); fill.position.set(0, 7, 8); scene.add(fill);

  // Render với bloom
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.55, 0.88));
  composer.addPass(new OutputPass());
  composer.render();

  const png = renderer.domElement.toDataURL('image/png');
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const layout = {
    width: W, height: H,
    viewProj: vp.elements,
    cameraPos: cam.position.toArray(),
    world: WORLD,
    seats,
    burner: { x: WORLD.burner.x, y: 1.0, z: WORLD.burner.z, r: 0.72 },
    slots: WORLD.slotsX.map((x) => ({ x, z: WORLD.slotsZ })),
    candles: flames.map((f) => f.toArray()),
    halo: [0, headY, WORLD.statueZ - 1.0],
  };
  return { png, layout };
}
