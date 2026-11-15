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

// ---------- Bố cục thế giới (mét) – Điện Tam Phúc ----------
const STAGE_H = 0.6;
export const WORLD = {
  stageH: STAGE_H,
  stageFrontZ: -5.7,
  statueZ: -12.6,
  altarZ: -9.3,
  burner: { x: 0, z: -4.75 },
  deityX: 4.7, deityZ: -9.0,
  sideTableZ: -4.9,
  aisleX: 2.2,
  crossZ: -3.35,
  rows: 10, rowZ0: -2.8, rowGap: 1.08,
  zones: [
    { key: 'tai', name: 'Tài Lộc', xs: [-2.95, -3.87, -4.79, -5.71], aisle: -2.2, slots: [[-3.75, -3.95], [-4.65, -3.95]], offer: [-4.2, 0.95, -4.9] },
    { key: 'an', name: 'Bình An', xs: [-0.46, 0.46, -1.38, 1.38], aisle: 0, slots: [[-0.85, -3.8], [0, -3.8], [0.85, -3.8]], offer: [0, 1.0, -4.75] },
    { key: 'tinh', name: 'Tình Duyên', xs: [2.95, 3.87, 4.79, 5.71], aisle: 2.2, slots: [[3.75, -3.95], [4.65, -3.95]], offer: [4.2, 0.95, -4.9] },
  ],
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

// ====================== ĐIỆN TAM PHÚC ======================
const painted = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, ...extra });
const SKIN = () => painted(0xf2c9a0);

function ingot(s = 1) {
  const g = new THREE.Group();
  const m = MAT.gold();
  const body = ellipsoid(0.24, 0.085, 0.14, m, 24); body.position.y = 0.085; g.add(body);
  for (const sx of [-1, 1]) { const tip = ellipsoid(0.09, 0.1, 0.12, m, 16); tip.position.set(sx * 0.2, 0.13, 0); g.add(tip); }
  const dome = ellipsoid(0.11, 0.09, 0.1, m, 16); dome.position.y = 0.16; g.add(dome);
  g.scale.setScalar(s);
  return g;
}

function ingotPile(n, spread) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i * 2.399963) % (Math.PI * 2), r = Math.sqrt((i + 0.5) / n) * spread;
    const it = ingot(0.9 + (i % 3) * 0.25);
    it.position.set(Math.cos(a) * r, Math.max(0, 0.35 - r * 0.25) * (i % 2), Math.sin(a) * r * 0.7);
    it.rotation.y = a * 3;
    g.add(it);
  }
  return g;
}

function pedestal(r = 1.3) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.35, 8), MAT.goldDark()); a.position.y = 0.175; a.rotation.y = Math.PI / 8; g.add(a);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.94, 0.3, 8), MAT.redLacquer()); b.position.y = 0.5; b.rotation.y = Math.PI / 8; g.add(b);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.08, 48), MAT.gold()); c.position.y = 0.69; g.add(c);
  const geo = petalGeometry(0.26, 0.5, 0.22, 0.03);
  for (let i = 0; i < 18; i++) {
    const h = new THREE.Group(); h.rotation.y = (i / 18) * Math.PI * 2; h.position.y = 0.7;
    const p = new THREE.Mesh(geo, i % 2 ? MAT.gold() : MAT.pink()); p.position.z = r * 0.72; p.rotation.x = 0.95; h.add(p); g.add(h);
  }
  return g;
}

// Thần Tài: áo đỏ viền vàng, mũ cánh chuồn, râu đen, ôm thỏi vàng
function buildThanTai() {
  const g = new THREE.Group();
  g.add(pedestal(1.35));
  const red = painted(0xc8181c), gold = MAT.gold(), skin = SKIN(), black = painted(0x15100e);
  const f = new THREE.Group(); f.position.y = 0.85; g.add(f);
  const robe = new THREE.Mesh(lathe([[0.001, 0], [1.05, 0], [1.1, 0.25], [0.95, 0.7], [0.78, 1.2], [0.7, 1.6], [0.5, 1.9], [0.2, 2.0], [0.001, 2.02]], 48), red);
  robe.scale.set(1.05, 1, 0.82); f.add(robe);
  for (const y of [0.12, 0.3]) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 64), gold); t.rotation.x = Math.PI / 2; t.position.y = y; t.scale.set(1.05, 0.82, 1); f.add(t); }
  const belly = ellipsoid(0.72, 0.62, 0.6, red); belly.position.set(0, 0.95, 0.25); f.add(belly);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.06, 8, 48), gold); belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.86, 0.14); belt.scale.set(1, 0.9, 1); f.add(belt);
  const chestPanel = ellipsoid(0.34, 0.34, 0.08, gold); chestPanel.position.set(0, 1.3, 0.62); f.add(chestPanel);
  for (const s of [-1, 1]) {
    const sh = v3(s * 0.72, 1.65, 0.05), el = v3(s * 1.0, 1.0, 0.45), hd = v3(s * 0.34, 0.95, 0.95);
    f.add(capsuleBetween(sh, el, 0.26, red)); f.add(capsuleBetween(el, hd, 0.24, red));
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 24), gold); cuff.position.copy(hd); cuff.lookAt(el); f.add(cuff);
    const hand = ellipsoid(0.14, 0.12, 0.14, skin); hand.position.set(s * 0.26, 0.98, 1.05); f.add(hand);
  }
  const big = ingot(2.4); big.position.set(0, 0.95, 1.02); f.add(big);
  // đầu
  const head = new THREE.Group(); head.position.set(0, 2.38, 0.08); f.add(head);
  head.add(ellipsoid(0.44, 0.46, 0.44, skin, 48));
  for (const s of [-1, 1]) {
    const cheek = ellipsoid(0.16, 0.13, 0.1, painted(0xf5a890)); cheek.position.set(s * 0.22, -0.08, 0.36); head.add(cheek);
    const eye = ellipsoid(0.07, 0.022, 0.03, black); eye.position.set(s * 0.17, 0.08, 0.41); eye.rotation.z = s * 0.25; head.add(eye);
    const brow = ellipsoid(0.1, 0.022, 0.03, black); brow.position.set(s * 0.18, 0.19, 0.4); brow.rotation.z = s * -0.2; head.add(brow);
    const ear = ellipsoid(0.07, 0.14, 0.08, skin); ear.position.set(s * 0.44, 0.0, 0); head.add(ear);
    const stache = ellipsoid(0.16, 0.03, 0.04, black); stache.position.set(s * 0.15, -0.16, 0.42); stache.rotation.z = s * -0.5; head.add(stache);
    const sideBeard = ellipsoid(0.05, 0.36, 0.05, black); sideBeard.position.set(s * 0.26, -0.55, 0.3); sideBeard.rotation.z = s * 0.12; head.add(sideBeard);
  }
  const nose = ellipsoid(0.08, 0.08, 0.08, skin); nose.position.set(0, -0.04, 0.45); head.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 20, Math.PI), painted(0x8a2018)); smile.position.set(0, -0.2, 0.4); smile.rotation.z = Math.PI; head.add(smile);
  const beard = ellipsoid(0.07, 0.48, 0.06, black); beard.position.set(0, -0.72, 0.36); head.add(beard);
  // mũ
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.34, 32), red); cap.position.y = 0.48; head.add(cap);
  const capBand = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 32), gold); capBand.rotation.x = Math.PI / 2; capBand.position.y = 0.33; head.add(capBand);
  const capBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.3), red); capBack.position.set(0, 0.72, -0.14); head.add(capBack);
  const gem = ellipsoid(0.1, 0.12, 0.06, gold); gem.position.set(0, 0.5, 0.42); head.add(gem);
  for (const s of [-1, 1]) {
    const wing = ellipsoid(0.42, 0.11, 0.03, gold); wing.position.set(s * 0.82, 0.55, -0.15); wing.rotation.z = s * 0.2; head.add(wing);
    const rod = capsuleBetween(v3(s * 0.3, 0.5, -0.15), v3(s * 0.5, 0.52, -0.15), 0.025, gold); head.add(rod);
  }
  // núi vàng quanh bệ
  const pile = ingotPile(34, 1.9); pile.position.set(0, 0, 0.7); g.add(pile);
  shadowAll(g);
  return g;
}

function heartArch() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    pts.push(v3(16 * Math.pow(Math.sin(t), 3) * 0.125, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.125 + 2.6, 0));
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.1, 10, true), painted(0xd8406a));
  g.add(tube);
  const cols = [0xff8fb8, 0xffc4dc, 0xff5a94, 0xffffff];
  const geo = new THREE.SphereGeometry(0.13, 10, 8);
  cols.forEach((c, ci) => {
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.08 }), 60);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) {
      const p = pts[(i * 2 + ci * 7) % pts.length];
      const j = (k) => Math.sin(i * 12.9898 * (k + 1) + ci * 78.233) * 0.16;
      m.makeTranslation(p.x + j(0), p.y + j(1), p.z + j(2) + 0.05); inst.setMatrixAt(i, m);
    }
    g.add(inst);
  });
  return g;
}

// Nguyệt Lão: áo hồng đỏ, râu tóc bạc, chống gậy, cầm tơ hồng
function buildNguyetLao() {
  const g = new THREE.Group();
  g.add(pedestal(1.25));
  const robe = painted(0xd84a6a), robe2 = painted(0xf7c0cf), gold = MAT.gold(), skin = SKIN(), white = painted(0xf6f4f0), dark = painted(0x2a1a14);
  const f = new THREE.Group(); f.position.y = 0.85; g.add(f);
  const body = new THREE.Mesh(lathe([[0.001, 0], [0.82, 0], [0.86, 0.2], [0.7, 0.9], [0.58, 1.6], [0.56, 2.0], [0.42, 2.3], [0.16, 2.4], [0.001, 2.42]], 48), robe);
  body.scale.set(1, 1, 0.8); f.add(body);
  const inner = ellipsoid(0.26, 0.9, 0.1, robe2); inner.position.set(0, 1.3, 0.5); f.add(inner);
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 48), gold); sash.rotation.x = Math.PI / 2; sash.position.y = 1.25; sash.scale.set(1, 0.8, 1); f.add(sash);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 8, 48), gold); hem.rotation.x = Math.PI / 2; hem.position.y = 0.1; hem.scale.set(1, 0.8, 1); f.add(hem);
  // tay: một tay chống gậy, một tay cầm tơ hồng
  const armA = [v3(-0.52, 2.1, 0.05), v3(-0.85, 1.5, 0.35), v3(-0.82, 1.7, 0.7)];
  const armB = [v3(0.52, 2.1, 0.05), v3(0.8, 1.45, 0.35), v3(0.45, 1.45, 0.75)];
  for (const [sh, el, hd] of [armA, armB]) {
    f.add(capsuleBetween(sh, el, 0.2, robe)); f.add(capsuleBetween(el, hd, 0.2, robe));
    const hand = ellipsoid(0.1, 0.1, 0.1, skin); hand.position.copy(hd).add(v3(0, 0.02, 0.12)); f.add(hand);
  }
  const staff = capsuleBetween(v3(-0.84, 0, 0.84), v3(-0.84, 3.3, 0.84), 0.04, painted(0x6a3a14)); f.add(staff);
  const gourd1 = ellipsoid(0.14, 0.16, 0.14, painted(0xe0a030)); gourd1.position.set(-0.84, 2.95, 0.98); f.add(gourd1);
  const gourd2 = ellipsoid(0.09, 0.1, 0.09, painted(0xe0a030)); gourd2.position.set(-0.84, 3.15, 0.98); f.add(gourd2);
  const thread = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 32), painted(0xe01030, { emissive: 0xff2040, emissiveIntensity: 0.4 })); thread.position.set(0.5, 1.4, 0.92); f.add(thread);
  const head = new THREE.Group(); head.position.set(0, 2.78, 0.06); f.add(head);
  head.add(ellipsoid(0.38, 0.42, 0.4, skin, 48));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), white); hair.rotation.x = -0.35; hair.scale.set(1.02, 1.05, 1.05); head.add(hair);
  const bun = ellipsoid(0.15, 0.17, 0.15, white); bun.position.set(0, 0.5, -0.05); head.add(bun);
  const pin = capsuleBetween(v3(-0.28, 0.5, -0.05), v3(0.28, 0.5, -0.05), 0.02, gold); head.add(pin);
  for (const s of [-1, 1]) {
    const eye = ellipsoid(0.055, 0.018, 0.025, dark); eye.position.set(s * 0.15, 0.05, 0.36); eye.rotation.z = s * 0.2; head.add(eye);
    const brow = ellipsoid(0.11, 0.03, 0.03, white); brow.position.set(s * 0.17, 0.15, 0.36); brow.rotation.z = s * -0.35; head.add(brow);
    const st = ellipsoid(0.14, 0.035, 0.04, white); st.position.set(s * 0.13, -0.14, 0.38); st.rotation.z = s * -0.5; head.add(st);
    const ear = ellipsoid(0.06, 0.12, 0.07, skin); ear.position.set(s * 0.38, 0, 0); head.add(ear);
  }
  const nose = ellipsoid(0.06, 0.07, 0.07, skin); nose.position.set(0, -0.03, 0.4); head.add(nose);
  const beard = new THREE.Mesh(lathe([[0.001, -1.15], [0.1, -0.9], [0.2, -0.45], [0.24, -0.1], [0.001, 0]], 24), white);
  beard.scale.set(1, 1, 0.5); beard.position.set(0, -0.18, 0.3); head.add(beard);
  const arch = heartArch(); arch.position.set(0, 0.5, -0.9); arch.scale.setScalar(1.18); g.add(arch);
  shadowAll(g);
  return g;
}

function lotusLamp(x, z, h = 0.95, y0 = 0) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, h, 12), MAT.darkWood()); post.position.y = h / 2; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 16), MAT.goldDark()); base.position.y = 0.05; g.add(base);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.1, 16), MAT.gold()); cup.position.y = h; g.add(cup);
  const fl = lotusFlower(1.25, new THREE.MeshStandardMaterial({ color: 0xffa8c8, roughness: 0.5, emissive: 0xff5a90, emissiveIntensity: 0.55 })); fl.position.y = h + 0.04; g.add(fl);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe6a0 })); glow.position.y = h + 0.2; g.add(glow);
  g.position.set(x, y0, z);
  return g;
}

function flowerPot(x, z, y0, cols = [0xff7aa8, 0xffc0d8, 0xffffff]) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(lathe([[0.001, 0], [0.22, 0], [0.34, 0.25], [0.3, 0.5], [0.36, 0.56], [0.001, 0.52]]), MAT.porcelain()); g.add(pot);
  const leaves = ellipsoid(0.5, 0.42, 0.5, MAT.leaf(), 20); leaves.position.y = 0.95; g.add(leaves);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399963, t = Math.acos(1 - (i + 0.5) / 26 * 1.3);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.6, emissive: cols[i % cols.length], emissiveIntensity: 0.15 }));
    fl.position.set(Math.sin(t) * Math.cos(a) * 0.5, 0.95 + Math.cos(t) * 0.44, Math.sin(t) * Math.sin(a) * 0.5); g.add(fl);
  }
  g.position.set(x, y0, z); shadowAll(g);
  return g;
}

function sideTable(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 0.8), MAT.redLacquer()); body.position.y = 0.38; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.95), MAT.gold()); top.position.y = 0.8; g.add(top);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.02), MAT.goldDark()); fr.position.set(0, 0.4, 0.41); g.add(fr);
  const bowl = new THREE.Mesh(lathe([[0.001, 0], [0.2, 0], [0.26, 0.16], [0.24, 0.22], [0.001, 0.2]]), MAT.bronze()); bowl.position.set(0, 0.84, 0); g.add(bowl);
  g.position.set(x, 0, z); shadowAll(g);
  return g;
}

function stage(scene) {
  const marble = new THREE.MeshPhysicalMaterial({ color: 0x9a7a52, roughness: 0.35, clearcoat: 0.5 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(20, STAGE_H, 11), marble); top.position.set(0, STAGE_H / 2, WORLD.stageFrontZ - 0.9 - 5.5); top.receiveShadow = true; scene.add(top);
  for (let i = 0; i < 3; i++) {
    const hh = STAGE_H * (3 - i) / 4;
    const step = new THREE.Mesh(new THREE.BoxGeometry(20, hh, 0.3), marble); step.position.set(0, hh / 2, WORLD.stageFrontZ - 0.75 + i * 0.3); step.receiveShadow = true; step.castShadow = true; scene.add(step);
    const nosing = new THREE.Mesh(new THREE.BoxGeometry(20, 0.03, 0.04), MAT.gold()); nosing.position.set(0, hh, WORLD.stageFrontZ - 0.62 + i * 0.3); scene.add(nosing);
  }
}

function buildHall(scene) {
  // Sàn đá + phản chiếu
  const mirror = new Reflector(new THREE.PlaneGeometry(50, 70), { textureWidth: W, textureHeight: H, color: 0x555555 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.002; scene.add(mirror);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 70), new THREE.MeshPhysicalMaterial({ map: marbleTex(), roughness: 0.25, clearcoat: 0.6, transparent: true, opacity: 0.86 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  stage(scene);

  // 3 thảm: vàng – xanh – hồng
  const z0 = WORLD.rowZ0 - 0.9, z1 = WORLD.rowZ0 + WORLD.rows * WORLD.rowGap + 0.2, len = z1 - z0;
  const carpets = [
    { x: -4.33, w: 3.8, tex: carpetTex('#b87a10', '#7a4a04', '#f2d27a', '#f6dc90') },
    { x: 0, w: 3.6, tex: carpetTex('#2444b0', '#142a78', '#e2b84e', '#f0cf70') },
    { x: 4.33, w: 3.8, tex: carpetTex('#c83a74', '#8a1c4c', '#f6c0d4', '#fad4e2') },
  ];
  for (const c of carpets) {
    c.tex.wrapT = THREE.RepeatWrapping; c.tex.repeat.set(1, 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w, len), new THREE.MeshStandardMaterial({ map: c.tex, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.012, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  }

  // Tường sau & hai bên
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.7 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), wallMat); back.position.set(0, 9, -16); back.receiveShadow = true; scene.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), wallMat); side.position.set(s * 11.5, 9, 0); side.rotation.y = -s * Math.PI / 2; scene.add(side);
  }
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(30, 1.0, 0.4), MAT.redLacquer()); fascia.position.set(0, 14.2, -15.6); scene.add(fascia);
  for (const y of [13.7, 14.7]) { const t = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 0.44), MAT.gold()); t.position.set(0, y, -15.6); scene.add(t); }

  // Khám thờ giữa (vòm) + 2 khám bên (tròn sáng)
  const arch = new THREE.Shape();
  arch.moveTo(-4.6, 0); arch.lineTo(-4.6, 8.2); arch.absarc(0, 8.2, 4.6, Math.PI, 0, true); arch.lineTo(4.6, 0); arch.lineTo(-4.6, 0);
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(arch, 48), new THREE.MeshBasicMaterial({ map: radialTex([[0, '#ffdca0'], [0.35, '#d86a2a'], [0.7, '#6a1008'], [1, '#2a0402']]) }));
  const uv = niche.geometry.attributes.uv, pos = niche.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 6.5) / 13, (pos.getY(i) - 0.2) / 13);
  niche.position.set(0, 0, -15.8); scene.add(niche);
  const archPts = [v3(-4.6, 0, 0)];
  for (let i = 0; i <= 48; i++) { const a = Math.PI - (i / 48) * Math.PI; archPts.push(v3(Math.cos(a) * 4.6, 8.2 + Math.sin(a) * 4.6, 0)); }
  archPts.push(v3(4.6, 0, 0));
  const archPath = new THREE.CurvePath();
  for (let i = 0; i < archPts.length - 1; i++) archPath.add(new THREE.LineCurve3(archPts[i], archPts[i + 1]));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(archPath, 400, 0.2, 12), MAT.gold()); tube.position.set(0, 0, -15.6); scene.add(tube);
  const sideGlow = [['#fff0b0', '#f0a030', '#7a3004'], ['#ffe0ec', '#f06090', '#701030']];
  [-1, 1].forEach((s, i) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), new THREE.MeshBasicMaterial({ map: radialTex([[0, sideGlow[i][0]], [0.5, sideGlow[i][1]], [1, sideGlow[i][2]]]), color: 0x999999 }));
    disc.position.set(s * WORLD.deityX, STAGE_H + 2.9, WORLD.deityZ - 1.8); scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.1, 12, 96), MAT.gold()); ring.position.copy(disc.position); scene.add(ring);
  });

  // Cột
  for (const s of [-1, 1]) { scene.add(pillar(s * 2.9 * 2.05, -14.2, 13)); scene.add(pillar(s * 8.4, -7.2, 13)); scene.add(pillar(s * 10.2, 0.5, 13)); }
}

function lotusPond(scene) {
  // Sen trước ống kính (mép dưới khung hình)
  for (let i = 0; i < 16; i++) {
    const x = -5.4 + i * 0.72 + Math.sin(i * 3.1) * 0.2, z = 7.95 + (i % 3) * 0.3;
    const leaf = ellipsoid(0.42, 0.03, 0.38, MAT.leaf(), 20); leaf.position.set(x + 0.4, 0.04, z + 0.2); scene.add(leaf);
    if (i % 2 === 0 || i % 5 === 0) {
      const fl = lotusFlower(1.7 + (i % 3) * 0.25, new THREE.MeshStandardMaterial({ color: 0xff9ec4, roughness: 0.45, emissive: 0xff4a8a, emissiveIntensity: 0.35 }));
      fl.position.set(x, 0.1, z); scene.add(fl);
    }
  }
}

function cushions(scene, seats) {
  const cols = { tai: [0xb81c1c, 0xe8b030], an: [0x8a1a1a, 0xd8a038], tinh: [0xb0204a, 0xf0a0b8] };
  const geo = new THREE.CylinderGeometry(0.29, 0.31, 0.1, 32);
  const tgeo = new THREE.TorusGeometry(0.24, 0.04, 10, 32);
  const mats = {};
  for (const k in cols) mats[k] = [new THREE.MeshStandardMaterial({ color: cols[k][0], roughness: 0.75 }), new THREE.MeshStandardMaterial({ color: cols[k][1], roughness: 0.6 })];
  for (const s of seats) {
    const c = new THREE.Mesh(geo, mats[s.zone][0]); c.position.set(s.x, 0.06, s.z); c.scale.z = 0.9; c.castShadow = c.receiveShadow = true; scene.add(c);
    const t = new THREE.Mesh(tgeo, mats[s.zone][1]); t.rotation.x = Math.PI / 2; t.position.set(s.x, 0.11, s.z); t.scale.y = 0.9; scene.add(t);
  }
}

export function makeSeats() {
  const seats = [];
  for (const zone of WORLD.zones) {
    for (let r = 0; r < WORLD.rows; r++) {
      zone.xs.forEach((x, c) => seats.push({ x, z: WORLD.rowZ0 + r * WORLD.rowGap, zone: zone.key, row: r, col: c }));
    }
  }
  return seats;
}

export function makeCamera() {
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
  cam.position.set(0, 22, 26);
  cam.lookAt(0, 2, -6);
  cam.updateMatrixWorld();
  return cam;
}

export async function run() {
  const renderer = makeRenderer(W, H);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120202);
  makeEnv(renderer, scene, 0.35);
  const cam = makeCamera();

  buildHall(scene);

  // Mọi thứ trên bục thờ
  const onStage = new THREE.Group(); onStage.position.y = STAGE_H; scene.add(onStage);
  const flames = [];
  const buddha = buildBuddha(); buddha.position.z = WORLD.statueZ; onStage.add(buddha);
  const headY = buddha.userData.headWorldY;
  halo(onStage, headY);
  altar(onStage, flames);
  const tt = buildThanTai(); tt.position.set(-WORLD.deityX, 0, WORLD.deityZ); tt.rotation.y = 0.12; tt.scale.setScalar(1.12); onStage.add(tt);
  const nl = buildNguyetLao(); nl.position.set(WORLD.deityX, 0, WORLD.deityZ); nl.rotation.y = -0.12; nl.scale.setScalar(1.12); onStage.add(nl);
  for (const s of [-1, 1]) {
    onStage.add(flowerPot(s * 2.6, -6.9, 0));
    onStage.add(flowerPot(s * 6.9, -7.0, 0, s < 0 ? [0xffd040, 0xffe890, 0xff9a30] : [0xff7aa8, 0xffc0d8, 0xffffff]));
    onStage.add(lotusLamp(s * 1.7, -6.5, 1.1), lotusLamp(s * 3.4, -6.5, 1.1), lotusLamp(s * 6.0, -6.5, 1.1), lotusLamp(s * 7.8, -6.5, 1.1));
    lantern(s * 3.3, 9.6, -9.5, scene); lantern(s * 7.4, 9.0, -6.0, scene);
  }

  // Dưới sàn: lư hương giữa, 2 bàn lễ hai bên, đèn sen dọc lối đi
  const bn = burner(); bn.position.set(WORLD.burner.x, 0, WORLD.burner.z); scene.add(bn);
  scene.add(sideTable(-4.2, WORLD.sideTableZ), sideTable(4.2, WORLD.sideTableZ));
  const tray = ingotPile(7, 0.35); tray.scale.setScalar(0.55); tray.position.set(-4.9, 0.84, WORLD.sideTableZ); scene.add(tray);
  const rose = lotusFlower(1.1); rose.position.set(4.9, 0.86, WORLD.sideTableZ); scene.add(rose);
  const zEnd = WORLD.rowZ0 + WORLD.rows * WORLD.rowGap;
  for (const s of [-1, 1]) {
        for (let z = WORLD.rowZ0 - 0.3; z < zEnd; z += 2.16) scene.add(lotusLamp(s * 6.55, z));
  }
  lotusPond(scene);
  const seats = makeSeats();
  cushions(scene, seats);

  // Ánh sáng
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x3a0a06, 0.26));
  renderer.toneMappingExposure = 0.82;
  const key = new THREE.SpotLight(0xffd8a0, 240, 45, 0.42, 0.6, 1.6);
  key.position.set(0, 10.5, -3.5); key.target.position.set(0, 5.0, WORLD.statueZ); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; scene.add(key, key.target);
  for (const s of [-1, 1]) {
    const sp = new THREE.SpotLight(s < 0 ? 0xffd890 : 0xffc8d8, 95, 40, 0.4, 0.7, 1.6);
    sp.position.set(s * 3.5, 10, -2.5); sp.target.position.set(s * WORLD.deityX, 2.6, WORLD.deityZ); sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005;
    scene.add(sp, sp.target);
  }
  const hall = new THREE.SpotLight(0xffd2a0, 120, 60, 0.8, 0.8, 1.5);
  hall.position.set(0, 14, -8); hall.target.position.set(0, 0, 3); hall.castShadow = true;
  hall.shadow.mapSize.set(2048, 2048); hall.shadow.bias = -0.0004; hall.shadow.radius = 4; scene.add(hall, hall.target);
  const rim = new THREE.PointLight(0xff9a4a, 14, 12, 1.5); rim.position.set(0, 5.5, WORLD.statueZ - 2); scene.add(rim);
  const fill = new THREE.PointLight(0xffc890, 4, 40, 1.2); fill.position.set(0, 9, 10); scene.add(fill);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.55, 0.86));
  composer.addPass(new OutputPass());
  composer.render();

  const png = renderer.domElement.toDataURL('image/png');
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const layout = {
    width: W, height: H,
    viewProj: vp.elements,
    world: WORLD,
    seats,
    burner: { x: WORLD.burner.x, y: 1.0, z: WORLD.burner.z, r: 0.72 },
    candles: flames.map((f) => [f.x, f.y + STAGE_H, f.z]),
    halo: [0, headY + STAGE_H, WORLD.statueZ - 1.0],
    labels: {
      buddha: [0, STAGE_H + 0.5, -7.3],
      tai: [-WORLD.deityX, STAGE_H + 0.3, -6.9],
      tinh: [WORLD.deityX, STAGE_H + 0.3, -6.9],
    },
    deities: { tai: [-WORLD.deityX, STAGE_H + 3.0, WORLD.deityZ], an: [0, STAGE_H + 5, WORLD.statueZ], tinh: [WORLD.deityX, STAGE_H + 3.0, WORLD.deityZ] },
  };
  return { png, layout };
}
