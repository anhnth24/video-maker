// Job: dựng nhân vật 3D (áo tràng) và render sprite sheet cho các động tác
import * as THREE from 'three';
import { makeRenderer, makeEnv, lathe } from './common.js';

const FW = 160, FH = 240;          // kích thước 1 frame trong sheet
const SS = 2;                       // render supersample
const COLS = 10;
// góc nhìn xuống của camera sprite (độ) – truyền qua ?pitch= để khớp với ảnh nền
const PITCH = THREE.MathUtils.degToRad(Number(new URLSearchParams(location.search).get('pitch')) || 38);
const VIEW_H = 2.35;                // chiều cao khung nhìn (mét)

// Động tác: [tên, số frame, fps, loop]
export const ANIMS = [
  ['sit', 1, 1, true],
  ['stand', 8, 12, false],      // quỳ -> đứng (phát ngược = ngồi xuống)
  ['walkB', 8, 10, true],       // đi lên (quay lưng), cầm hương
  ['walkF', 8, 10, true],       // đi về (quay mặt), chắp tay
  ['walkLi', 8, 10, true],      // đi sang trái, cầm hương
  ['walkRi', 8, 10, true],
  ['walkL', 8, 10, true],       // đi sang trái, chắp tay
  ['walkR', 8, 10, true],
  ['bow', 12, 9, false],        // vái (1 lạy), cầm hương
  ['plant', 10, 9, false],      // cắm hương
  ['walkBn', 8, 10, true],      // đi lên, tay không (lễ vật vẽ ở runtime)
  ['bown', 12, 9, false],       // vái, tay không
  ['plantn', 10, 9, false],     // đặt lễ
];

const VARIANTS = [
  // Khu Tài Lộc: áo vàng
  { zone: 'tai', robe: 0xe2ac2c, hair: 0x141012, bun: true, trim: 0xfff0b8 },
  { zone: 'tai', robe: 0xf0d48a, hair: 0x1c1512, bun: false, trim: 0xd89a20 },
  // Khu Bình An: áo lam / trắng
  { zone: 'an', robe: 0x6f8fdc, hair: 0x141012, bun: true, trim: 0xf2d27a },
  { zone: 'an', robe: 0xe2e7f4, hair: 0x1c1512, bun: false, trim: 0x8aa0dc },
  // Khu Tình Duyên: áo hồng
  { zone: 'tinh', robe: 0xee86b2, hair: 0x141012, bun: true, trim: 0xfff0f6 },
  { zone: 'tinh', robe: 0xf8c6d8, hair: 0x1c1512, bun: false, trim: 0xe0508c },
];

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function cylBetween(a, b, r0, r1, mat, segs = 20) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, segs, 1, false), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function ell(rx, ry, rz, mat, segs = 28) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segs, Math.round(segs * 0.7)), mat);
  m.scale.set(rx, ry, rz);
  return m;
}

// Hồ sơ váy áo (so với hông, y<=0): đứng và quỳ, cùng số điểm để nội suy
const LOWER_STAND = [[0.27, -0.86], [0.265, -0.7], [0.245, -0.5], [0.225, -0.3], [0.2, -0.12], [0.19, 0]];
const LOWER_KNEEL = [[0.33, -0.44], [0.345, -0.38], [0.33, -0.28], [0.28, -0.16], [0.22, -0.06], [0.19, 0]];

function poseFor(anim, f, n) {
  const u = n > 1 ? f / (n - 1) : 0;
  const p = { kneel: 0, bow: 0, stride: null, hands: 'pray', reach: 0, incense: false, facing: 'back' };
  switch (anim) {
    case 'sit': p.kneel = 1; break;
    case 'stand': p.kneel = 1 - ease(u); p.bow = Math.sin(u * Math.PI) * 0.35; break;
    case 'walkB': p.stride = (f / n) * Math.PI * 2; p.incense = true; break;
    case 'walkBn': p.stride = (f / n) * Math.PI * 2; break;
    case 'bown': p.bow = Math.pow(Math.sin(u * Math.PI), 1.3); break;
    case 'plantn': { const r = Math.sin(u * Math.PI); p.bow = 0.3 * r; p.reach = r; break; }
    case 'walkF': p.stride = (f / n) * Math.PI * 2; p.facing = 'front'; break;
    case 'walkLi': p.stride = (f / n) * Math.PI * 2; p.incense = true; p.facing = 'left'; break;
    case 'walkRi': p.stride = (f / n) * Math.PI * 2; p.incense = true; p.facing = 'right'; break;
    case 'walkL': p.stride = (f / n) * Math.PI * 2; p.facing = 'left'; break;
    case 'walkR': p.stride = (f / n) * Math.PI * 2; p.facing = 'right'; break;
    case 'bow': p.bow = Math.pow(Math.sin(u * Math.PI), 1.3); p.incense = true; break;
    case 'plant': {
      const r = Math.sin(u * Math.PI);
      p.bow = 0.3 * r; p.reach = r; p.incense = u < 0.55; break;
    }
  }
  return p;
}

function buildCharacter(variant, pose) {
  const root = new THREE.Group();
  const robeMat = new THREE.MeshPhysicalMaterial({ color: variant.robe, roughness: 0.78, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) });
  const robeDark = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(variant.robe).multiplyScalar(0.82), roughness: 0.8, sheen: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: variant.trim, roughness: 0.7 });
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe9b994, roughness: 0.55, sheen: 0.3 });
  const hairMat = new THREE.MeshStandardMaterial({ color: variant.hair, roughness: 0.55 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.7 });
  const sock = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 });

  const k = pose.kneel;
  const stride = pose.stride;
  const walking = stride !== null;
  const sw = walking ? Math.sin(stride) : 0;
  const hipY = lerp(0.9, 0.46, k) + (walking ? Math.abs(Math.cos(stride)) * 0.022 : 0);

  // ---- Chân / bàn chân ----
  if (k < 0.5) {
    for (const s of [-1, 1]) {
      const fz = walking ? -s * sw * 0.17 : 0;
      const lift = walking ? Math.max(0, s * Math.cos(stride)) * 0.04 : 0;
      const foot = ell(0.05, 0.035, 0.11, shoe);
      foot.position.set(s * 0.09, 0.035 + lift, fz - 0.03);
      root.add(foot);
    }
  } else {
    // bàn chân (gót) thò ra sau khi quỳ
    for (const s of [-1, 1]) {
      const sole = ell(0.048, 0.04, 0.1, sock);
      sole.position.set(s * 0.085, 0.045, 0.2);
      sole.rotation.x = 0.4;
      root.add(sole);
    }
  }

  // ---- Váy áo dưới ----
  const prof = LOWER_STAND.map((a, i) => [lerp(a[0], LOWER_KNEEL[i][0], k), lerp(a[1], LOWER_KNEEL[i][1], k)]);
  const lowerGeo = lathe(prof.map(([r, y]) => [r, y + hipY]).concat([[0.001, hipY + 0.001]]), 40);
  const pos = lowerGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const low = 1 - Math.min(1, Math.max(0, y / Math.max(0.01, hipY)));
    let nz = z * (1 + 0.55 * k) - 0.1 * k * low;  // quỳ: đầu gối nhô về trước
    let nx = x * (1 + 0.05 * k);
    if (walking) {
      nz += (x > 0 ? 1 : -1) * -sw * 0.09 * low * Math.min(1, Math.abs(x) / 0.1);
      nx += sw * 0.012 * low;
    }
    // nếp vải
    const ang = Math.atan2(z, x);
    const fold = Math.sin(ang * 9) * 0.008 * low;
    pos.setXYZ(i, nx + Math.cos(ang) * fold, y, nz * 0.85 + Math.sin(ang) * fold);
  }
  lowerGeo.computeVertexNormals();
  const lower = new THREE.Mesh(lowerGeo, robeMat);
  root.add(lower);

  // ---- Thân trên (xoay quanh hông khi vái) ----
  const waist = new THREE.Group();
  waist.position.y = hipY;
  waist.rotation.x = -pose.bow * 1.1;
  waist.position.z = pose.bow * 0.06;
  if (walking) waist.rotation.y = sw * 0.06;
  root.add(waist);

  const upperGeo = lathe([[0.19, 0], [0.2, 0.12], [0.215, 0.28], [0.215, 0.38], [0.19, 0.45], [0.12, 0.5], [0.06, 0.52], [0.001, 0.525]], 40);
  const up = new THREE.Mesh(upperGeo, robeMat);
  up.scale.set(1.12, 1, 0.74);
  waist.add(up);
  // đường may giữa lưng / vạt chéo trước ngực
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.01), robeDark);
  seam.position.set(0, 0.24, 0.158); waist.add(seam);
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.012), trimMat);
  lapel.position.set(0.03, 0.33, -0.158); lapel.rotation.z = -0.42; waist.add(lapel);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.014, 8, 24), trimMat);
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.515; waist.add(collar);

  // Cổ & đầu
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.1, 16), skin); neck.position.y = 0.56; waist.add(neck);
  const head = new THREE.Group(); head.position.y = 0.67; waist.add(head);
  head.rotation.x = -pose.bow * 0.25;
  head.add(ell(0.092, 0.112, 0.102, skin));
  for (const s of [-1, 1]) { const ear = ell(0.016, 0.03, 0.02, skin); ear.position.set(s * 0.092, -0.005, 0.005); head.add(ear); }
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
  hairCap.scale.set(1, 1.1, 1.06); hairCap.rotation.x = 0.55; hairCap.position.set(0, 0.012, 0.006);
  head.add(hairCap);
  const hairBack = ell(0.094, 0.09, 0.07, hairMat); hairBack.position.set(0, -0.015, 0.045); head.add(hairBack);
  if (variant.bun) { const bun = ell(0.042, 0.04, 0.04, hairMat); bun.position.set(0, 0.0, 0.12); head.add(bun); }
  // mặt
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a14 });
  for (const s of [-1, 1]) { const eye = ell(0.011, 0.006, 0.006, dark); eye.position.set(s * 0.032, 0.008, -0.096); head.add(eye); }
  const mouth = ell(0.016, 0.004, 0.005, new THREE.MeshStandardMaterial({ color: 0x9a4a3a })); mouth.position.set(0, -0.05, -0.094); head.add(mouth);
  const nose = ell(0.012, 0.02, 0.014, skin); nose.position.set(0, -0.015, -0.1); head.add(nose);

  // ---- Tay: chắp trước ngực / với ra cắm hương ----
  const handTarget = V(0, lerp(0.3, 0.2, pose.reach), lerp(-0.2, -0.5, pose.reach));
  for (const s of [-1, 1]) {
    const S = V(s * 0.205, 0.43, 0.0);
    const Hd = handTarget.clone().add(V(s * 0.025, 0, 0));
    const E = V(s * lerp(0.25, 0.2, pose.reach), lerp(0.17, 0.22, pose.reach), lerp(-0.04, -0.22, pose.reach));
    waist.add(ell(0.06, 0.058, 0.06, robeMat).translateX(S.x * 0.96).translateY(S.y - 0.005));
    waist.add(cylBetween(S, E, 0.062, 0.068, robeMat));
    waist.add(cylBetween(E, Hd.clone().lerp(E, 0.15), 0.07, 0.1, robeMat));
    // tay áo rộng rủ xuống
    const drape = ell(0.07, 0.11, 0.09, robeDark);
    drape.position.copy(E.clone().lerp(Hd, 0.55)).add(V(s * 0.01, -0.07, 0.01));
    waist.add(drape);
    const hand = ell(0.032, 0.05, 0.022, skin);
    hand.position.copy(Hd); hand.rotation.x = 0.3;
    waist.add(hand);
  }
  if (pose.incense) {
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xb85a28, roughness: 0.6 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    for (const dx of [-0.018, 0, 0.018]) {
      const a = handTarget.clone().add(V(dx, -0.04, 0));
      const b = handTarget.clone().add(V(dx * 2.2, 0.34, lerp(-0.06, -0.2, pose.reach)));
      waist.add(cylBetween(a, b, 0.004, 0.004, stickMat, 6));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), tipMat); tip.position.copy(b); waist.add(tip);
    }
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.scale.setScalar(0.95);
  const rot = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[pose.facing];
  root.rotation.y = rot;
  return root;
}

export async function run() {
  const renderer = makeRenderer(FW * SS, FH * SS, { alpha: true });
  const scene = new THREE.Scene();
  makeEnv(renderer, scene, 0.25);
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x5a2818, 0.5));
  const front = new THREE.DirectionalLight(0xffe6c8, 0.85); front.position.set(1.5, 5, 6); scene.add(front);
  const rim = new THREE.DirectionalLight(0xffa050, 2.2); rim.position.set(-1, 4, -6); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffc080, 0.9); rim2.position.set(3, 2, -3); scene.add(rim2);

  const aspect = FW / FH;
  const cam = new THREE.OrthographicCamera(-VIEW_H * aspect / 2, VIEW_H * aspect / 2, VIEW_H / 2, -VIEW_H / 2, 0.1, 50);
  const target = V(0, 0.92, 0);
  cam.position.set(0, target.y + Math.sin(PITCH) * 10, Math.cos(PITCH) * 10);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  const proj = (p) => { const v = p.clone().project(cam); return [(v.x + 1) / 2 * FW, (1 - v.y) / 2 * FH]; };
  const foot = proj(V(0, 0, 0));
  const headTop = proj(V(0, 1.62, 0));

  const totalFrames = ANIMS.reduce((a, x) => a + x[1], 0);
  const rows = Math.ceil(totalFrames / COLS);
  const anims = {};
  let idx = 0;
  for (const [name, n, fps, loop] of ANIMS) { anims[name] = { start: idx, count: n, fps, loop }; idx += n; }

  const sheets = [];
  for (const variant of VARIANTS) {
    const sheet = document.createElement('canvas');
    sheet.width = FW * COLS; sheet.height = FH * rows;
    const sg = sheet.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    let i = 0;
    for (const [name, n] of ANIMS) {
      for (let f = 0; f < n; f++) {
        const ch = buildCharacter(variant, poseFor(name, f, n));
        scene.add(ch);
        renderer.render(scene, cam);
        scene.remove(ch);
        ch.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        sg.drawImage(renderer.domElement, (i % COLS) * FW, Math.floor(i / COLS) * FH, FW, FH);
        i++;
      }
    }
    sheets.push(sheet.toDataURL('image/png'));
  }

  return {
    sheets,
    meta: {
      frameW: FW, frameH: FH, cols: COLS,
      footX: foot[0], footY: foot[1],
      heightPx: foot[1] - headTop[1],   // chiều cao 1.62m trong frame
      pxPerMeter: FH / VIEW_H,
      personHeight: 1.62,
      anims,
      variants: VARIANTS.map((_, i) => `people_${i}.png`),
      variantZones: VARIANTS.map((v) => v.zone),
    },
  };
}
